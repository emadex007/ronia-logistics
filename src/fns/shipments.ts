import { createServerFn } from '@tanstack/react-start'
import { all, first, run, audit, nowIso, todayLagos } from '~/server/db'
import { requirePerm } from '~/server/auth'
import { applyStatus, newTrackingCode, queueNotifications, recordShipmentPayment } from '~/server/shipment-core'
import type { Shipment, ShipmentEvent, ShipmentStatus } from '~/lib/types'

export type ShipmentFilters = { q?: string; status?: string; page?: number }

export const listShipments = createServerFn({ method: 'GET' })
  .validator((d: ShipmentFilters) => d)
  .handler(async ({ data }) => {
    await requirePerm('shipments')
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
  .validator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    await requirePerm('shipments')
    const shipment = await first<Shipment>(
      `SELECT s.*, cb.full_name AS created_by_name, rb.full_name AS received_by_name,
              db.full_name AS dispatched_by_name, dl.full_name AS delivered_by_name, ar.full_name AS assigned_rider_name
         FROM shipments s
         LEFT JOIN users ar ON ar.id = s.assigned_rider
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
  merchant_id?: number | null
}

export const createShipment = createServerFn({ method: 'POST' })
  .validator((d: NewShipmentInput) => d)
  .handler(async ({ data }) => {
    const user = await requirePerm('shipments')
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
          status, current_location, created_by, received_by, estimated_delivery, created_at, updated_at, merchant_id)
       VALUES (?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?)`,
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
      data.merchant_id ? Number(data.merchant_id) : null,
    )
    const id = Number(res.meta.last_row_id)

    // If the sender has a customer account with this email, the shipment appears in their account
    if (data.sender_email?.trim()) {
      await run(
        "UPDATE shipments SET customer_id = (SELECT id FROM users WHERE role = 'customer' AND email = ?) WHERE id = ?",
        data.sender_email.trim().toLowerCase(),
        id,
      )
    }

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
      {
        id,
        tracking_code: code,
        sender_name: data.sender_name,
        receiver_name: data.receiver_name,
        destination_city: data.destination_city,
        sender_phone: data.sender_phone,
        receiver_phone: data.receiver_phone,
        sender_email: data.sender_email || null,
        receiver_email: data.receiver_email || null,
      },
      status,
      `${origin} office`,
      true,
    )
    await audit(user.id, 'shipment.create', 'shipment', id, { code })
    return { ok: true as const, id, code }
  })

export const updateShipmentStatus = createServerFn({ method: 'POST' })
  .validator((d: { id: number; status: ShipmentStatus; location?: string; note?: string }) => d)
  .handler(async ({ data }) => {
    const user = await requirePerm('shipments')
    const s = await first<Shipment>('SELECT * FROM shipments WHERE id = ?', Number(data.id))
    if (!s) return { ok: false as const, error: 'Shipment not found.' }
    await applyStatus(user, s, data.status, { location: data.location, note: data.note })
    return { ok: true as const }
  })

export const markShipmentPaid = createServerFn({ method: 'POST' })
  .validator((d: { id: number; method: string }) => d)
  .handler(async ({ data }) => {
    const user = await requirePerm('shipments')
    const s = await first<Shipment>('SELECT * FROM shipments WHERE id = ?', Number(data.id))
    if (!s) return { ok: false as const, error: 'Shipment not found.' }
    if (s.payment_status === 'paid') return { ok: false as const, error: 'This shipment is already marked as paid.' }
    await recordShipmentPayment(user, s, data.method)
    return { ok: true as const }
  })
