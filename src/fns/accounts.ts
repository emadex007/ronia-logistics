// Customer self-registration, merchant applications (admin approval) and the customer portal.
import { createServerFn } from '@tanstack/react-start'
import { all, first, run, audit, db, nowIso } from '~/server/db'
import { createSession, hashPassword, requireUser } from '~/server/auth'
import type { Shipment } from '~/lib/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function emailTaken(email: string) {
  return Boolean(await first('SELECT 1 FROM users WHERE email = ?', email))
}

// ───────────── Customers (no approval needed) ─────────────

export const registerCustomer = createServerFn({ method: 'POST' })
  .inputValidator((d: { full_name: string; phone: string; email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const email = (data.email ?? '').trim().toLowerCase()
    if (!data.full_name?.trim()) return { ok: false as const, error: 'Enter your name.' }
    if (!data.phone?.trim()) return { ok: false as const, error: 'Enter your phone number.' }
    if (!EMAIL_RE.test(email)) return { ok: false as const, error: 'Enter a valid email address.' }
    if ((data.password ?? '').length < 8) return { ok: false as const, error: 'Password must be at least 8 characters.' }
    if (await emailTaken(email)) return { ok: false as const, error: 'An account with this email already exists. Try signing in.' }

    const res = await run(
      "INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer')",
      data.full_name.trim(),
      email,
      data.phone.trim(),
      await hashPassword(data.password),
    )
    const id = Number(res.meta.last_row_id)
    // Link past shipments where staff typed this exact email as the sender's
    await run('UPDATE shipments SET customer_id = ? WHERE customer_id IS NULL AND lower(sender_email) = ?', id, email)
    await createSession(id)
    await audit(id, 'customer.register', 'user', id)
    return { ok: true as const }
  })

async function requireCustomer() {
  return requireUser(['customer'])
}

export const getMyShipments = createServerFn({ method: 'GET' }).handler(async () => {
  const me = await requireCustomer()
  const cols = `s.id, s.tracking_code, s.receiver_name, s.destination_city, s.destination_country, s.service_type,
                s.status, s.current_location, s.payment_status, s.shipping_fee, s.created_at, s.updated_at, s.delivered_at`
  const [mine, watching] = await Promise.all([
    all<Shipment>(`SELECT ${cols} FROM shipments s WHERE s.customer_id = ? ORDER BY s.created_at DESC LIMIT 200`, me.id),
    all<Shipment>(
      `SELECT ${cols} FROM customer_watchlist w JOIN shipments s ON s.id = w.shipment_id
        WHERE w.user_id = ? AND (s.customer_id IS NULL OR s.customer_id != ?) ORDER BY w.created_at DESC`,
      me.id,
      me.id,
    ),
  ])
  // Watched shipments belong to someone else: hide the receiver's full name
  const masked = watching.map((s) => ({ ...s, receiver_name: s.receiver_name.split(/\s+/)[0] }))
  return { me, mine, watching: masked }
})

export const watchShipment = createServerFn({ method: 'POST' })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const me = await requireCustomer()
    const s = await first<{ id: number }>('SELECT id FROM shipments WHERE tracking_code = ?', (data.code ?? '').trim().toUpperCase())
    if (!s) return { ok: false as const, error: 'No shipment with that tracking number.' }
    await run('INSERT OR IGNORE INTO customer_watchlist (user_id, shipment_id) VALUES (?, ?)', me.id, s.id)
    return { ok: true as const }
  })

export const unwatchShipment = createServerFn({ method: 'POST' })
  .inputValidator((d: { shipment_id: number }) => d)
  .handler(async ({ data }) => {
    const me = await requireCustomer()
    await run('DELETE FROM customer_watchlist WHERE user_id = ? AND shipment_id = ?', me.id, Number(data.shipment_id))
    return { ok: true as const }
  })

// ───────────── Merchant applications ─────────────

export type ApplyInput = {
  business_name: string
  contact_name: string
  phone: string
  email: string
  address?: string
  what_they_sell?: string
  password: string
}

export const applyAsMerchant = createServerFn({ method: 'POST' })
  .inputValidator((d: ApplyInput) => d)
  .handler(async ({ data }) => {
    const email = (data.email ?? '').trim().toLowerCase()
    if (!data.business_name?.trim()) return { ok: false as const, error: 'Enter your business name.' }
    if (!data.contact_name?.trim()) return { ok: false as const, error: 'Enter the contact person.' }
    if (!data.phone?.trim()) return { ok: false as const, error: 'Enter a phone number.' }
    if (!EMAIL_RE.test(email)) return { ok: false as const, error: 'Enter a valid email address.' }
    if ((data.password ?? '').length < 8) return { ok: false as const, error: 'Password must be at least 8 characters.' }
    if (await emailTaken(email)) return { ok: false as const, error: 'This email already has an account. Use a different email or sign in.' }
    const pending = await first("SELECT 1 FROM merchant_applications WHERE email = ? AND status = 'pending'", email)
    if (pending) return { ok: false as const, error: 'You already have an application waiting for review.' }

    const res = await run(
      `INSERT INTO merchant_applications (business_name, contact_name, phone, email, address, what_they_sell, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      data.business_name.trim(),
      data.contact_name.trim(),
      data.phone.trim(),
      email,
      data.address?.trim() || null,
      data.what_they_sell?.trim() || null,
      await hashPassword(data.password),
    )
    await run(
      "INSERT INTO notifications (channel, title, message) VALUES ('dashboard', ?, ?)",
      'New merchant application',
      `${data.business_name.trim()} (${data.contact_name.trim()}, ${data.phone.trim()}) applied to become a merchant.`,
    )
    await audit(null, 'merchant.apply', 'merchant_application', Number(res.meta.last_row_id))
    return { ok: true as const }
  })

export type Application = {
  id: number
  business_name: string
  contact_name: string
  phone: string
  email: string
  address: string | null
  what_they_sell: string | null
  status: 'pending' | 'approved' | 'rejected'
  reject_reason: string | null
  merchant_id: number | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  created_at: string
}

export const listApplications = createServerFn({ method: 'GET' })
  .inputValidator((d: { status?: 'pending' | 'approved' | 'rejected' | 'all' }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser(['admin', 'manager', 'staff', 'rider'])
    if (me.role !== 'admin' && me.role !== 'manager') return [] as Application[]
    const status = data.status ?? 'pending'
    return all<Application>(
      `SELECT a.id, a.business_name, a.contact_name, a.phone, a.email, a.address, a.what_they_sell, a.status, a.reject_reason,
              a.merchant_id, a.reviewed_at, a.created_at, u.full_name AS reviewed_by_name
         FROM merchant_applications a LEFT JOIN users u ON u.id = a.reviewed_by
        ${status === 'all' ? '' : 'WHERE a.status = ?'}
        ORDER BY a.created_at DESC LIMIT 200`,
      ...(status === 'all' ? [] : [status]),
    )
  })

export const pendingApplicationCount = createServerFn({ method: 'GET' }).handler(async () => {
  const me = await requireUser(['admin', 'manager', 'staff', 'rider'])
  if (me.role !== 'admin' && me.role !== 'manager') return 0
  return (await first<{ n: number }>("SELECT COUNT(*) AS n FROM merchant_applications WHERE status = 'pending'"))?.n ?? 0
})

/** Approve: creates the merchant record + their login (using the password they chose when applying). */
export const approveApplication = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser(['admin', 'manager'])
    const app = await first<Application & { password_hash: string }>('SELECT * FROM merchant_applications WHERE id = ?', Number(data.id))
    if (!app) return { ok: false as const, error: 'Application not found.' }
    if (app.status !== 'pending') return { ok: false as const, error: `This application was already ${app.status}.` }
    if (await emailTaken(app.email)) return { ok: false as const, error: 'That email now belongs to another account. Reject this and ask them to re-apply.' }

    const m = await run(
      'INSERT INTO merchants (business_name, contact_name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?, ?)',
      app.business_name,
      app.contact_name,
      app.phone,
      app.email,
      app.address,
      app.what_they_sell ? `Sells: ${app.what_they_sell}` : null,
    )
    const merchantId = Number(m.meta.last_row_id)
    await db().batch([
      db()
        .prepare("INSERT INTO users (full_name, email, phone, password_hash, role, merchant_id) VALUES (?, ?, ?, ?, 'merchant', ?)")
        .bind(app.contact_name, app.email, app.phone, app.password_hash, merchantId),
      db()
        .prepare("UPDATE merchant_applications SET status = 'approved', merchant_id = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?")
        .bind(merchantId, me.id, nowIso(), app.id),
      db()
        .prepare("INSERT INTO notifications (channel, recipient, merchant_id, title, message) VALUES ('email', ?, ?, ?, ?)")
        .bind(app.email, merchantId, 'Merchant account approved', `Welcome to Ronia Logistics, ${app.business_name}! You can now sign in to your merchant portal.`),
    ])
    await audit(me.id, 'merchant.approve', 'merchant_application', app.id, { merchantId })
    return { ok: true as const, merchantId }
  })

export const rejectApplication = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: number; reason: string }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser(['admin', 'manager'])
    const app = await first<Application>('SELECT * FROM merchant_applications WHERE id = ?', Number(data.id))
    if (!app) return { ok: false as const, error: 'Application not found.' }
    if (app.status !== 'pending') return { ok: false as const, error: `This application was already ${app.status}.` }
    await run(
      "UPDATE merchant_applications SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?",
      data.reason?.trim() || null,
      me.id,
      nowIso(),
      app.id,
    )
    await audit(me.id, 'merchant.reject', 'merchant_application', app.id, { reason: data.reason })
    return { ok: true as const }
  })
