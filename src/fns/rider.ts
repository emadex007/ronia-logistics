// Rider / driver delivery mode: assigned jobs, proof of delivery (photo + signature), failed attempts.
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { all, first, run, audit, nowIso } from '~/server/db'
import { requirePerm } from '~/server/auth'
import { applyStatus, recordShipmentPayment } from '~/server/shipment-core'
import type { Shipment, ShipmentStatus } from '~/lib/types'

export type RiderJob = Pick<
  Shipment,
  | 'id'
  | 'tracking_code'
  | 'receiver_name'
  | 'receiver_phone'
  | 'receiver_address'
  | 'destination_city'
  | 'sender_name'
  | 'sender_phone'
  | 'sender_address'
  | 'status'
  | 'payment_status'
  | 'shipping_fee'
  | 'cod_amount'
  | 'description'
  | 'quantity'
  | 'delivered_at'
  | 'signed_by'
  | 'pickup_requested'
> & { last_note: string | null }

const JOB_COLS = `s.id, s.tracking_code, s.receiver_name, s.receiver_phone, s.receiver_address, s.destination_city, s.sender_name, s.sender_phone,
  s.sender_address, s.status, s.payment_status, s.shipping_fee, s.cod_amount, s.description, s.quantity, s.delivered_at, s.signed_by, s.pickup_requested,
  (SELECT note FROM shipment_events e WHERE e.shipment_id = s.id ORDER BY e.id DESC LIMIT 1) AS last_note`

/** My deliveries today: open jobs assigned to me + what I delivered today. */
export const getMyJobs = createServerFn({ method: 'GET' }).handler(async () => {
  const me = await requirePerm('shipments')
  const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString()
  const [open, done] = await Promise.all([
    all<RiderJob>(
      `SELECT ${JOB_COLS} FROM shipments s
        WHERE s.assigned_rider = ? AND s.status NOT IN ('delivered','cancelled','returned')
        ORDER BY CASE s.status WHEN 'out_for_delivery' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, s.assigned_at`,
      me.id,
    ),
    all<RiderJob>(
      `SELECT ${JOB_COLS} FROM shipments s WHERE s.delivered_by = ? AND s.delivered_at > ? ORDER BY s.delivered_at DESC`,
      me.id,
      since,
    ),
  ])
  return { me: { id: me.id, name: me.full_name }, open, done }
})

/** People who can be given deliveries. */
export const listRiders = createServerFn({ method: 'GET' }).handler(async () => {
  await requirePerm('shipments')
  return all<{ id: number; full_name: string; role: string; open_jobs: number }>(
    `SELECT u.id, u.full_name, u.role,
            (SELECT COUNT(*) FROM shipments s WHERE s.assigned_rider = u.id AND s.status NOT IN ('delivered','cancelled','returned')) AS open_jobs
       FROM users u WHERE u.is_active = 1 AND u.role IN ('rider','staff','manager','admin')
      ORDER BY CASE u.role WHEN 'rider' THEN 0 ELSE 1 END, u.full_name`,
  )
})

export const assignRider = createServerFn({ method: 'POST' })
  .validator((d: { id: number; riderId: number | null }) => d)
  .handler(async ({ data }) => {
    const me = await requirePerm('shipments')
    const s = await first<Shipment>('SELECT * FROM shipments WHERE id = ?', Number(data.id))
    if (!s) return { ok: false as const, error: 'Shipment not found.' }
    const riderId = data.riderId ? Number(data.riderId) : null
    let riderName: string | null = null
    if (riderId) {
      const r = await first<{ full_name: string }>("SELECT full_name FROM users WHERE id = ? AND is_active = 1 AND role IN ('rider','staff','manager','admin')", riderId)
      if (!r) return { ok: false as const, error: 'Choose an active staff member.' }
      riderName = r.full_name
    }
    await run('UPDATE shipments SET assigned_rider = ?, assigned_at = ?, updated_at = ? WHERE id = ?', riderId, riderId ? nowIso() : null, nowIso(), s.id)
    await audit(me.id, 'shipment.assign', 'shipment', s.id, { riderId })
    return { ok: true as const, riderName }
  })

/** Rider types/scans the tracking number on the label to take the job. */
export const claimJob = createServerFn({ method: 'POST' })
  .validator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const me = await requirePerm('shipments')
    const code = (data.code ?? '').trim().toUpperCase()
    const s = await first<Shipment & { assigned_rider: number | null }>('SELECT * FROM shipments WHERE tracking_code = ?', code)
    if (!s) return { ok: false as const, error: `No shipment with tracking number ${code}.` }
    if (['delivered', 'cancelled', 'returned'].includes(s.status)) return { ok: false as const, error: `This shipment is already ${s.status}.` }
    if (s.assigned_rider === me.id) return { ok: true as const, already: true }
    await run('UPDATE shipments SET assigned_rider = ?, assigned_at = ?, updated_at = ? WHERE id = ?', me.id, nowIso(), nowIso(), s.id)
    await audit(me.id, 'shipment.claim', 'shipment', s.id, { from: s.assigned_rider })
    return { ok: true as const, already: false }
  })

async function myJob(id: number, meId: number, isAdminish: boolean) {
  const s = await first<Shipment & { assigned_rider: number | null }>('SELECT * FROM shipments WHERE id = ?', Number(id))
  if (!s) return { error: 'Shipment not found.' as const }
  if (s.assigned_rider !== meId && !isAdminish) return { error: 'This delivery is not assigned to you.' as const }
  return { s }
}

/** Picked up from sender / on the way. */
export const riderSetStatus = createServerFn({ method: 'POST' })
  .validator((d: { id: number; status: ShipmentStatus; location?: string }) => d)
  .handler(async ({ data }) => {
    const me = await requirePerm('shipments')
    if (!['received', 'in_transit', 'out_for_delivery'].includes(data.status)) return { ok: false as const, error: 'Use the Delivered button for deliveries.' }
    const r = await myJob(data.id, me.id, me.role !== 'rider')
    if ('error' in r) return { ok: false as const, error: r.error }
    await applyStatus(me, r.s, data.status, {
      location: data.location || (data.status === 'received' ? `${r.s.origin_city} (picked up)` : `On the way — ${r.s.destination_city}`),
      note: data.status === 'received' ? `Picked up by ${me.full_name.split(' ')[0]}` : null,
    })
    return { ok: true as const }
  })

export const reportFailedAttempt = createServerFn({ method: 'POST' })
  .validator((d: { id: number; reason: string }) => d)
  .handler(async ({ data }) => {
    const me = await requirePerm('shipments')
    const r = await myJob(data.id, me.id, me.role !== 'rider')
    if ('error' in r) return { ok: false as const, error: r.error }
    const reason = (data.reason ?? '').trim().slice(0, 300) || 'Receiver not available'
    await run(
      'INSERT INTO shipment_events (shipment_id, status, location, note, staff_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      r.s.id,
      r.s.status,
      r.s.current_location,
      `Delivery attempt failed: ${reason}. We will try again.`,
      me.id,
      nowIso(),
    )
    await run(
      "INSERT INTO notifications (channel, shipment_id, title, message) VALUES ('dashboard', ?, ?, ?)",
      r.s.id,
      `Failed delivery: ${r.s.tracking_code}`,
      `${me.full_name}: ${reason}`,
    )
    await audit(me.id, 'shipment.failed_attempt', 'shipment', r.s.id, { reason })
    return { ok: true as const }
  })

const IMG: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Mark delivered with proof: photo, signature, who received it, and payment collected. */
export const completeDelivery = createServerFn({ method: 'POST' })
  .validator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error('Expected form data.')
    return d
  })
  .handler(async ({ data }) => {
    const me = await requirePerm('shipments')
    const id = Number(data.get('id'))
    const r = await myJob(id, me.id, me.role !== 'rider')
    if ('error' in r) return { ok: false as const, error: r.error }
    const s = r.s
    if (s.status === 'delivered') return { ok: false as const, error: 'Already marked as delivered.' }

    const receivedBy = String(data.get('received_by') ?? '').trim().slice(0, 120)
    if (!receivedBy) return { ok: false as const, error: 'Enter the name of the person who received it.' }
    const photo = data.get('photo')
    const signature = data.get('signature')
    if (!photo || typeof photo === 'string') return { ok: false as const, error: 'Take a photo of the delivered package.' }

    const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('')
    const ext = IMG[photo.type] ?? 'jpg'
    if (photo.size > 10 * 1024 * 1024) return { ok: false as const, error: 'Photo is too large (max 10 MB).' }
    const photoKey = `pod/${s.tracking_code}-${rand}.${ext}`
    await env.MEDIA.put(photoKey, await photo.arrayBuffer(), { httpMetadata: { contentType: photo.type || 'image/jpeg' } })

    let signatureKey: string | null = null
    if (signature && typeof signature !== 'string' && signature.size > 0 && signature.size < 2 * 1024 * 1024) {
      signatureKey = `pod/${s.tracking_code}-${rand}-sign.png`
      await env.MEDIA.put(signatureKey, await signature.arrayBuffer(), { httpMetadata: { contentType: 'image/png' } })
    }

    // Money collected at the door
    const payMethod = String(data.get('payment') ?? 'none')
    const notes: string[] = []
    if (s.cod_amount > 0 && data.get('cod_collected') === '1') notes.push(`Collected ₦${(s.cod_amount / 100).toLocaleString('en-NG')} for the goods`)
    const extra = String(data.get('note') ?? '').trim().slice(0, 300)
    if (extra) notes.push(extra)

    await applyStatus(me, s, 'delivered', {
      location: s.destination_city,
      note: notes.join('. ') || null,
      pod: { receivedBy, photoKey, signatureKey },
    })
    if (s.payment_status !== 'paid' && ['cash', 'transfer', 'pos'].includes(payMethod)) {
      await recordShipmentPayment(me, { ...s, status: 'delivered' }, payMethod)
    }
    return { ok: true as const }
  })
