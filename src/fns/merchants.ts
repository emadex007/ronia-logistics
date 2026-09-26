import { createServerFn } from '@tanstack/react-start'
import { all, first, run, audit, db, nowIso } from '~/server/db'
import { hashPassword, requireUser, STAFF_ROLES } from '~/server/auth'
import { getBalance, getMerchantProducts, getMovements, getPayouts, getTotals } from '~/server/stock'
import type { Merchant, MovementType, Product, Shipment } from '~/lib/types'

const MANAGERS = ['admin', 'manager'] as const

export type MerchantRow = Merchant & {
  product_count: number
  units_in_stock: number
  stock_value: number
  low_stock: number
  has_login: number
}

export const listMerchants = createServerFn({ method: 'GET' })
  .inputValidator((d: { q?: string }) => d)
  .handler(async ({ data }) => {
    await requireUser(STAFF_ROLES)
    const q = data.q?.trim() ? `%${data.q.trim()}%` : null
    return all<MerchantRow>(
      `SELECT m.*,
              (SELECT COUNT(*) FROM products p WHERE p.merchant_id = m.id) AS product_count,
              (SELECT COALESCE(SUM(quantity),0) FROM products p WHERE p.merchant_id = m.id) AS units_in_stock,
              (SELECT COALESCE(SUM(quantity * unit_price),0) FROM products p WHERE p.merchant_id = m.id) AS stock_value,
              (SELECT COUNT(*) FROM products p WHERE p.merchant_id = m.id AND p.quantity <= p.low_stock_threshold) AS low_stock,
              (SELECT COUNT(*) FROM users u WHERE u.merchant_id = m.id AND u.role = 'merchant') AS has_login
         FROM merchants m
        ${q ? 'WHERE m.business_name LIKE ? OR m.contact_name LIKE ? OR m.phone LIKE ?' : ''}
        ORDER BY m.is_active DESC, m.business_name`,
      ...(q ? [q, q, q] : []),
    )
  })

/** Small list for dropdowns (e.g. New shipment). */
export const merchantOptions = createServerFn({ method: 'GET' }).handler(async () => {
  await requireUser(STAFF_ROLES)
  return all<{ id: number; business_name: string }>('SELECT id, business_name FROM merchants WHERE is_active = 1 ORDER BY business_name')
})

export const getMerchant = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser(STAFF_ROLES)
    const id = Number(data.id)
    const merchant = await first<Merchant>('SELECT * FROM merchants WHERE id = ?', id)
    if (!merchant) return null
    const monthStart = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date()).slice(0, 8) + '01'
    const [products, movements, month, logins, shipments, payouts, balance] = await Promise.all([
      getMerchantProducts(id),
      getMovements(id, { limit: 50 }),
      getTotals(id, monthStart),
      all<{ id: number; full_name: string; email: string; is_active: number; last_login_at: string | null }>(
        "SELECT id, full_name, email, is_active, last_login_at FROM users WHERE merchant_id = ? AND role = 'merchant'",
        id,
      ),
      all<Shipment>(
        'SELECT id, tracking_code, receiver_name, destination_city, status, payment_status, cod_amount, created_at FROM shipments WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 20',
        id,
      ),
      getPayouts(id),
      getBalance(id),
    ])
    const canSeeBank = me.role === 'admin' || me.role === 'manager'
    return {
      merchant: canSeeBank ? merchant : { ...merchant, account_number: null, bank_name: null, account_name: null },
      products,
      movements,
      month,
      logins,
      shipments,
      payouts: canSeeBank ? payouts : [],
      balance,
    }
  })

type MerchantInput = Partial<Omit<Merchant, 'id' | 'created_at' | 'is_active'>> & { business_name: string }

export const saveMerchant = createServerFn({ method: 'POST' })
  .inputValidator((d: MerchantInput & { id?: number; is_active?: boolean }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser([...MANAGERS])
    if (!data.business_name?.trim()) return { ok: false as const, error: 'Business name is required.' }
    const v = (x?: string | null) => (x ?? '').toString().trim() || null
    const fields = [
      data.business_name.trim(),
      v(data.contact_name),
      v(data.phone),
      v(data.email),
      v(data.address),
      v(data.bank_name),
      v(data.account_name),
      v(data.account_number),
      v(data.notes),
    ]
    if (data.id) {
      await run(
        `UPDATE merchants SET business_name=?, contact_name=?, phone=?, email=?, address=?, bank_name=?, account_name=?, account_number=?, notes=?${
          data.is_active === undefined ? '' : ', is_active=?'
        } WHERE id=?`,
        ...fields,
        ...(data.is_active === undefined ? [] : [data.is_active ? 1 : 0]),
        Number(data.id),
      )
      if (data.is_active === false) {
        await run("UPDATE users SET is_active = 0 WHERE merchant_id = ? AND role = 'merchant'", Number(data.id))
      }
      await audit(me.id, 'merchant.update', 'merchant', Number(data.id))
      return { ok: true as const, id: Number(data.id) }
    }
    const res = await run(
      'INSERT INTO merchants (business_name, contact_name, phone, email, address, bank_name, account_name, account_number, notes) VALUES (?,?,?,?,?,?,?,?,?)',
      ...fields,
    )
    const id = Number(res.meta.last_row_id)
    await audit(me.id, 'merchant.create', 'merchant', id)
    return { ok: true as const, id }
  })

/** Give a merchant a login to their own portal (role = merchant). */
export const createMerchantLogin = createServerFn({ method: 'POST' })
  .inputValidator((d: { merchant_id: number; full_name: string; email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser([...MANAGERS])
    const merchant = await first<Merchant>('SELECT * FROM merchants WHERE id = ?', Number(data.merchant_id))
    if (!merchant) return { ok: false as const, error: 'Merchant not found.' }
    if (!data.email?.trim()) return { ok: false as const, error: 'Email is required.' }
    if ((data.password ?? '').length < 8) return { ok: false as const, error: 'Password must be at least 8 characters.' }
    const email = data.email.trim().toLowerCase()
    if (await first('SELECT 1 FROM users WHERE email = ?', email)) return { ok: false as const, error: 'That email is already used by another account.' }
    await run(
      "INSERT INTO users (full_name, email, phone, password_hash, role, merchant_id) VALUES (?, ?, ?, ?, 'merchant', ?)",
      data.full_name?.trim() || merchant.contact_name || merchant.business_name,
      email,
      merchant.phone,
      await hashPassword(data.password),
      merchant.id,
    )
    await audit(me.id, 'merchant.login_created', 'merchant', merchant.id, { email })
    return { ok: true as const }
  })

export const setMerchantLogin = createServerFn({ method: 'POST' })
  .inputValidator((d: { user_id: number; is_active?: boolean; password?: string }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser([...MANAGERS])
    const u = await first<{ id: number }>("SELECT id FROM users WHERE id = ? AND role = 'merchant'", Number(data.user_id))
    if (!u) return { ok: false as const, error: 'Login not found.' }
    if (data.password !== undefined) {
      if (data.password.length < 8) return { ok: false as const, error: 'Password must be at least 8 characters.' }
      await run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(data.password), u.id)
      await run('DELETE FROM sessions WHERE user_id = ?', u.id)
    }
    if (data.is_active !== undefined) {
      await run('UPDATE users SET is_active = ? WHERE id = ?', data.is_active ? 1 : 0, u.id)
      if (!data.is_active) await run('DELETE FROM sessions WHERE user_id = ?', u.id)
    }
    await audit(me.id, 'merchant.login_updated', 'user', u.id)
    return { ok: true as const }
  })

type ProductInput = {
  id?: number
  merchant_id: number
  name: string
  sku?: string
  description?: string
  unit_price: number // kobo
  low_stock_threshold?: number
  shelf_location?: string
  opening_quantity?: number
}

export const saveProduct = createServerFn({ method: 'POST' })
  .inputValidator((d: ProductInput) => d)
  .handler(async ({ data }) => {
    const me = await requireUser(STAFF_ROLES)
    if (!data.name?.trim()) return { ok: false as const, error: 'Product name is required.' }
    const common = [
      data.name.trim(),
      data.sku?.trim() || null,
      data.description?.trim() || null,
      Math.max(0, Number(data.unit_price) || 0),
      Math.max(0, Number(data.low_stock_threshold ?? 5)),
      data.shelf_location?.trim() || null,
    ]
    if (data.id) {
      await run(
        'UPDATE products SET name=?, sku=?, description=?, unit_price=?, low_stock_threshold=?, shelf_location=? WHERE id=? AND merchant_id=?',
        ...common,
        Number(data.id),
        Number(data.merchant_id),
      )
      await audit(me.id, 'product.update', 'product', Number(data.id))
      return { ok: true as const }
    }
    const res = await run(
      'INSERT INTO products (name, sku, description, unit_price, low_stock_threshold, shelf_location, merchant_id, quantity) VALUES (?,?,?,?,?,?,?,0)',
      ...common,
      Number(data.merchant_id),
    )
    const productId = Number(res.meta.last_row_id)
    const opening = Math.floor(Number(data.opening_quantity) || 0)
    if (opening > 0) {
      await applyMovement({
        productId,
        merchantId: Number(data.merchant_id),
        type: 'received',
        quantity: opening,
        unitPrice: Number(data.unit_price) || 0,
        note: 'Opening stock',
        userId: me.id,
      })
    }
    await audit(me.id, 'product.create', 'product', productId)
    return { ok: true as const }
  })

async function applyMovement(m: {
  productId: number
  merchantId: number
  type: MovementType
  quantity: number // positive, except adjustment which may be negative
  unitPrice: number
  reference?: string | null
  note?: string | null
  shipmentId?: number | null
  userId: number
}) {
  const sign = m.type === 'received' || m.type === 'returned' ? 1 : m.type === 'adjustment' ? 1 : -1
  const delta = sign * m.quantity
  const product = await first<Product>('SELECT * FROM products WHERE id = ? AND merchant_id = ?', m.productId, m.merchantId)
  if (!product) return { ok: false as const, error: 'Product not found.' }
  if (product.quantity + delta < 0) {
    return { ok: false as const, error: `Only ${product.quantity} of "${product.name}" in stock.` }
  }
  await db().batch([
    db().prepare('UPDATE products SET quantity = quantity + ? WHERE id = ?').bind(delta, product.id),
    db()
      .prepare(
        'INSERT INTO stock_movements (product_id, merchant_id, type, quantity, unit_price, shipment_id, reference, note, handled_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      )
      .bind(product.id, m.merchantId, m.type, delta, m.unitPrice, m.shipmentId ?? null, m.reference ?? null, m.note ?? null, m.userId, nowIso()),
  ])
  // Low-stock alert on the dashboard + merchant
  const after = product.quantity + delta
  if (delta < 0 && after <= product.low_stock_threshold) {
    await run(
      "INSERT INTO notifications (channel, merchant_id, title, message) VALUES ('dashboard', ?, ?, ?)",
      m.merchantId,
      `Low stock: ${product.name}`,
      `Only ${after} left of "${product.name}".`,
    )
  }
  return { ok: true as const, quantity: after }
}

export const recordStockMovement = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: { product_id: number; merchant_id: number; type: MovementType; quantity: number; unit_price?: number; reference?: string; note?: string; tracking_code?: string }) => d,
  )
  .handler(async ({ data }) => {
    const me = await requireUser(STAFF_ROLES)
    const qty = Math.trunc(Number(data.quantity))
    if (!qty || (data.type !== 'adjustment' && qty < 0)) return { ok: false as const, error: 'Enter a valid quantity.' }
    let shipmentId: number | null = null
    if (data.tracking_code?.trim()) {
      const s = await first<{ id: number }>('SELECT id FROM shipments WHERE tracking_code = ?', data.tracking_code.trim().toUpperCase())
      if (!s) return { ok: false as const, error: `No shipment with tracking number ${data.tracking_code}.` }
      shipmentId = s.id
    }
    const product = await first<Product>('SELECT unit_price FROM products WHERE id = ?', Number(data.product_id))
    const res = await applyMovement({
      productId: Number(data.product_id),
      merchantId: Number(data.merchant_id),
      type: data.type,
      quantity: qty,
      unitPrice: data.unit_price !== undefined && data.unit_price !== null && !Number.isNaN(data.unit_price) ? Number(data.unit_price) : product?.unit_price ?? 0,
      reference: data.reference?.trim() || null,
      note: data.note?.trim() || null,
      shipmentId,
      userId: me.id,
    })
    if (res.ok) await audit(me.id, `stock.${data.type}`, 'product', Number(data.product_id), { qty })
    return res
  })

/** Record money paid out to a merchant for their sales. */
export const recordPayout = createServerFn({ method: 'POST' })
  .inputValidator((d: { merchant_id: number; amount: number; method: string; reference?: string; note?: string; paid_on?: string }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser([...MANAGERS])
    const merchantId = Number(data.merchant_id)
    const amount = Math.round(Number(data.amount))
    if (!amount || amount <= 0) return { ok: false as const, error: 'Enter an amount greater than zero.' }
    const { owed } = await getBalance(merchantId)
    if (amount > owed) {
      return { ok: false as const, error: `That is more than the balance owed (₦${(owed / 100).toLocaleString('en-NG')}). Record the sales first.` }
    }
    const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(data.paid_on ?? '') ? `${data.paid_on}T11:00:00.000Z` : nowIso()
    const res = await run(
      'INSERT INTO merchant_payouts (merchant_id, amount, method, reference, note, handled_by, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      merchantId,
      amount,
      data.method || 'transfer',
      data.reference?.trim() || null,
      data.note?.trim() || null,
      me.id,
      paidAt,
    )
    await run(
      "INSERT INTO notifications (channel, merchant_id, title, message) VALUES ('dashboard', ?, ?, ?)",
      merchantId,
      'Payment sent to you',
      `Ronia Logistics paid you ₦${(amount / 100).toLocaleString('en-NG')}${data.reference ? ` (ref ${data.reference})` : ''}.`,
    )
    await audit(me.id, 'merchant.payout', 'merchant', merchantId, { amount, id: Number(res.meta.last_row_id) })
    return { ok: true as const }
  })
