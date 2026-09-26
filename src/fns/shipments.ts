import { createServerFn } from '@tanstack/react-start'
import { all, first, run, audit, nowIso, todayLagos, db } from '~/server/db'
import { requireUser, STAFF_ROLES } from '~/server/auth'
import { statusLabel } from '~/lib/format'
import type { Shipment, ShipmentEvent, ShipmentStatus } from '~/lib/types'

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

async function newTrackingCode() {
  const prefix = (await first<{ value: string }>("SELECT value FROM settings WHERE key = 'tracking_prefix'"))?.value || 'RL'
  const ymd = todayLagos().slice(2).replace(/-/g, '')
  for (let attempt = 0; attempt < 6; attempt++) {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
    const code = `${prefix}-${ymd}-${rand}`
    const exists = await first('SELECT 1 FROM shipments WHERE tracking_code = ?', code)
    if (!exists) return code
  }
  throw new Error('Could not generate a tracking code, please try again.')
}

/** Queue customer notifications (sent by the notifications worker in a later phase) + a dashboard alert. */
async function queueNotifications(s: Pick<Shipment, 'id' | 'tracking_code' | 'sender_phone' | 'receiver_phone' | 'sender_email' | 'receiver_email'>, status: ShipmentStatus, location?: string | null) {
  const title = `${s.tracking_code}: ${statusLabel(status)}`
  const message = `Ronia Logistics: your package ${s.tracking_code} is now "${statusLabel(status)}"${location ? ` — ${location}` : ''}. Track it on our website.`
  const stmts = [
    db().prepare('INSERT INTO notifications (channel, recipient, shipment_id, title, message) VALUES (?, ?, ?, ?, ?)').bind('sms', s.receiver_phone, s.id, title, message),
    db().prepare('INSERT INTO notifications (channel, recipient, shipment_id, title, message) VALUES (?, ?, ?, ?, ?)').bind('sms', s.sender_phone, s.id, title, message),
    db().prepare("INSERT INTO notifications (channel, shipment_id, title, message, status) VALUES ('dashboard', ?, ?, ?, 'queued')").bind(s.id, title, message),
  ]
  if (s.receiver_email) stmts.push(db().prepare('INSERT INTO notifications (channel, recipient, shipment_id, title, message) VALUES (?, ?, ?, ?, ?)').bind('email', s.receiver_email, s.id, title, message))
  if (s.sender_email) stmts.push(db().prepare('INSERT INTO notifications (channel, recipient, shipment_id, title, message) VALUES (?, ?, ?, ?, ?)').bind('email', s.sender_email, s.id, title, message))
  await db().batch(stmts)
}

export type ShipmentFilters = { q?: string; status?: string; page?: number }

export const listShipments = createServerFn({ method: 'GET' })
  .inputValidator((d: ShipmentFilters) => d)
  .handler(async ({ data }) => {
    await requireUser(STAFF_ROLES)
    const where: string[] = []
    const params: unknown[] = []
    if (data.q?.trim()) {
      const q = `%${data.q.trim()}%`
      where.push('(tracking_code LIKE ? OR sender_name LIKE ? OR receiver_name LIKE ? OR sender_phone LIKE ? OR receiver_phone LIKE ? OR destination_city LIKE ?)')
      params.push(q, q, q, q, q, q)
    }
    if (data.status) {
      where.push('status = ?')
      params.push(data.status)
    }
    const page = Math.max(1, data.page ?? 1)
    const perPage = 25
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = (await first<{ n: number }>(`SELECT COUNT(*) AS n FROM shipments ${whereSql}`, ...params))?.n ?? 0
    const rows = await all<Shipment>(
      `SELECT id, tracking_code, sender_name, receiver_name, receiver_phone, destination_city, destination_country,
              service_type, status, payment_status, shipping_fee, created_at
         FROM shipments ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      perPage,
      (page - 1) * perPage,
    )
    return { rows, total, page, pages: Math.max(1, Math.ceil(total / perPage)) }
  })

export const getShipment = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    await requireUser(STAFF_ROLES)
    const shipment = await first<Shipment>(
      `SELECT s.*, cb.full_name AS created_by_name, rb.full_name AS received_by_name,
              db.full_name AS dispatched_by_name, dl.full_name AS delivered_by_name
         FROM shipments s
         LEFT JOIN users cb ON cb.id = s.created_by
         LEFT JOIN users rb ON rb.id = s.received_by
         LEFT JOIN users db ON db.id = s.dispatched_by
         LEFT JOIN users dl ON dl.id = s.delivered_by
        WHERE s.id = ?`,
      Number(data.id),
    )
    if (!shipment) return null
    const events = await all<ShipmentEvent>(
      `SELECT e.id, e.status, e.location, e.note, e.created_at, u.full_name AS staff_name
         FROM shipment_events e LEFT JOIN users u ON u.id = e.staff_id
        WHERE e.shipment_id = ? ORDER BY e.created_at DESC, e.id DESC`,
      shipment.id,
    )
    return { shipment, events }
  })

export type NewShipmentInput = {
  sender_name: string
  sender_phone: string
  sender_email?: string
  sender_address?: string
  receiver_name: string
  receiver_phone: string
  receiver_email?: string
  receiver_address: string
  origin_city?: string
  destination_city: string
  destination_country?: string
  service_type: string
  description?: string
  quantity?: number
  weight_kg?: number | null
  declared_value?: number // kobo
  shipping_fee?: number // kobo
  cod_amount?: number // kobo
  payment_status: 'unpaid' | 'paid' | 'cod'
  payment_method?: string
  estimated_delivery?: string
  status?: ShipmentStatus
}

export const createShipment = createServerFn({ method: 'POST' })
  .inputValidator((d: NewShipmentInput) => d)
  .handler(async ({ data }) => {
    const user = await requireUser(STAFF_ROLES)
    const required: (keyof NewShipmentInput)[] = ['sender_name', 'sender_phone', 'receiver_name', 'receiver_phone', 'receiver_address', 'destination_city']
    for (const k of required) {
      if (!String(data[k] ?? '').trim()) return { ok: false as const, error: `Please fill in ${k.replace(/_/g, ' ')}.` }
    }
    const code = await newTrackingCode()
    const status: ShipmentStatus = data.status ?? 'received'
    const origin = data.origin_city?.trim() || 'Abuja'
    const t = nowIso()

    const res = await run(
      `INSERT INTO shipments (tracking_code, sender_name, sender_phone, sender_email, sender_address,
          receiver_name, receiver_phone, receiver_email, receiver_address, origin_city, destination_city, destination_country,
          service_type, description, quantity, weight_kg, declared_value, shipping_fee, cod_amount, payment_status, payment_method,
          status, current_location, created_by, received_by, estimated_delivery, created_at, updated_at)
       VALUES (?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?)`,
      code,
      data.sender_name.trim(),
      data.sender_phone.trim(),
      data.sender_email?.trim() || null,
      data.sender_address?.trim() || null,
      data.receiver_name.trim(),
      data.receiver_phone.trim(),
      data.receiver_email?.trim() || null,
      data.receiver_address.trim(),
      origin,
      data.destination_city.trim(),
      data.destination_country?.trim() || 'Nigeria',
      data.service_type || 'standard',
      data.description?.trim() || null,
      Math.max(1, Number(data.quantity) || 1),
      data.weight_kg ? Number(data.weight_kg) : null,
      Number(data.declared_value) || 0,
      Number(data.shipping_fee) || 0,
      Number(data.cod_amount) || 0,
      data.payment_status,
      data.payment_status === 'paid' ? data.payment_method || 'cash' : null,
      status,
      `${origin} office`,
      user.id,
      status === 'pending' ? null : user.id,
      data.estimated_delivery || null,
      t,
      t,
    )
    const id = Number(res.meta.last_row_id)

    await run(
      'INSERT INTO shipment_events (shipment_id, status, location, note, staff_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      status,
      `${origin} office`,
      status === 'pending' ? 'Shipment booked, awaiting pickup.' : 'Package received and registered.',
      user.id,
      t,
    )

    // Paid at the counter → record the income automatically
    if (data.payment_status === 'paid' && Number(data.shipping_fee) > 0) {
      await run(
        `INSERT INTO transactions (type, category, amount, description, method, reference, shipment_id, handled_by, txn_date)
         VALUES ('income', 'Shipping fee', ?, ?, ?, ?, ?, ?, ?)`,
        Number(data.shipping_fee),
        `Shipping fee for ${code}`,
        data.payment_method || 'cash',
        code,
        id,
        user.id,
        todayLagos(),
      )
    }

    await queueNotifications(
      { id, tracking_code: code, sender_phone: data.sender_phone, receiver_phone: data.receiver_phone, sender_email: data.sender_email || null, receiver_email: data.receiver_email || null },
      status,
      `${origin} office`,
    )
    await audit(user.id, 'shipment.create', 'shipment', id, { code })
    return { ok: true as const, id, code }
  })

export const updateShipmentStatus = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: number; status: ShipmentStatus; location?: string; note?: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser(STAFF_ROLES)
    const s = await first<Shipment>('SELECT * FROM shipments WHERE id = ?', Number(data.id))
    if (!s) return { ok: false as const, error: 'Shipment not found.' }
    const t = nowIso()
    const location = data.location?.trim() || s.current_location

    // Record which staff handled each stage
    const who: string[] = []
    if (data.status === 'received') who.push('received_by = ?')
    if (data.status === 'in_transit' || data.status === 'out_for_delivery') who.push('dispatched_by = ?')
    if (data.status === 'delivered') who.push('delivered_by = ?')

    await run(
      `UPDATE shipments SET status = ?, current_location = ?, updated_at = ?${data.status === 'delivered' ? ', delivered_at = ?' : ''}${who.length ? ', ' + who.join(', ') : ''} WHERE id = ?`,
      data.status,
      location,
      t,
      ...(data.status === 'delivered' ? [t] : []),
      ...who.map(() => user.id),
      s.id,
    )
    await run(
      'INSERT INTO shipment_events (shipment_id, status, location, note, staff_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      s.id,
      data.status,
      location,
      data.note?.trim() || null,
      user.id,
      t,
    )
    await queueNotifications(s, data.status, location)
    await audit(user.id, 'shipment.status', 'shipment', s.id, { from: s.status, to: data.status })
    return { ok: true as const }
  })

export const markShipmentPaid = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: number; method: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser(STAFF_ROLES)
    const s = await first<Shipment>('SELECT * FROM shipments WHERE id = ?', Number(data.id))
    if (!s) return { ok: false as const, error: 'Shipment not found.' }
    if (s.payment_status === 'paid') return { ok: false as const, error: 'This shipment is already marked as paid.' }
    await run('UPDATE shipments SET payment_status = ?, payment_method = ?, updated_at = ? WHERE id = ?', 'paid', data.method, nowIso(), s.id)
    const amount = s.shipping_fee + (s.payment_status === 'cod' ? s.cod_amount : 0)
    if (s.shipping_fee > 0) {
      await run(
        `INSERT INTO transactions (type, category, amount, description, method, reference, shipment_id, handled_by, txn_date)
         VALUES ('income', 'Shipping fee', ?, ?, ?, ?, ?, ?, ?)`,
        s.shipping_fee,
        `Shipping fee for ${s.tracking_code}`,
        data.method,
        s.tracking_code,
        s.id,
        user.id,
        todayLagos(),
      )
    }
    await audit(user.id, 'shipment.paid', 'shipment', s.id, { method: data.method, amount })
    return { ok: true as const }
  })
