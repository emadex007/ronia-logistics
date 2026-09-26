import { createServerFn } from '@tanstack/react-start'
import { all, first } from '~/server/db'
import type { Settings, Shipment, ShipmentEvent } from '~/lib/types'

export const getSiteContent = createServerFn({ method: 'GET' }).handler(async () => {
  const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings')
  const settings: Settings = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const pages = await all<{ slug: string; title: string; body: string }>('SELECT slug, title, body FROM pages')
  return { settings, pages: Object.fromEntries(pages.map((p) => [p.slug, p])) }
})

/** Public tracking lookup — returns only what a customer should see. */
export const trackShipment = createServerFn({ method: 'GET' })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const code = (data.code ?? '').trim().toUpperCase()
    if (!code) return null
    const s = await first<Shipment>(
      `SELECT id, tracking_code, sender_name, receiver_name, origin_city, destination_city, destination_country,
              service_type, quantity, weight_kg, status, current_location, shipping_fee, payment_status, estimated_delivery, delivered_at, created_at, updated_at
         FROM shipments WHERE tracking_code = ?`,
      code,
    )
    if (!s) return null
    const events = await all<ShipmentEvent>(
      'SELECT id, status, location, note, created_at FROM shipment_events WHERE shipment_id = ? ORDER BY created_at DESC, id DESC',
      s.id,
    )
    // Mask names for privacy on the public page (e.g. "Chinedu O.")
    const mask = (name: string) => {
      const [a, b] = name.trim().split(/\s+/)
      return b ? `${a} ${b[0]}.` : a
    }
    return {
      shipment: { ...s, id: 0, sender_name: mask(s.sender_name), receiver_name: mask(s.receiver_name) },
      events,
    }
  })
