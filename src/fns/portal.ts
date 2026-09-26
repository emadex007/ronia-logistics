// Merchant portal: everything here is scoped to the logged-in merchant's own data.
import { createServerFn } from '@tanstack/react-start'
import { all, first, todayLagos } from '~/server/db'
import { requireUser, STAFF_ROLES } from '~/server/auth'
import { getBalance, getMerchantProducts, getMovements, getPayouts, getStatement, getTotals } from '~/server/stock'
import type { Merchant, Shipment } from '~/lib/types'

async function requireMerchant() {
  const user = await requireUser(['merchant'])
  if (!user.merchant_id) throw new Error('This login is not linked to a merchant account.')
  return { user, merchantId: user.merchant_id }
}

export const getPortalDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const { user, merchantId } = await requireMerchant()
  const monthStart = todayLagos().slice(0, 8) + '01'
  const [merchant, products, month, allTime, recent, shipments, alerts, payouts, balance] = await Promise.all([
    first<Merchant>('SELECT id, business_name, contact_name, phone, email, address FROM merchants WHERE id = ?', merchantId),
    getMerchantProducts(merchantId),
    getTotals(merchantId, monthStart),
    getTotals(merchantId),
    getMovements(merchantId, { limit: 10 }),
    all<Shipment>(
      'SELECT id, tracking_code, receiver_name, destination_city, status, payment_status, cod_amount, created_at, updated_at FROM shipments WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 10',
      merchantId,
    ),
    all<{ id: number; title: string; message: string; created_at: string }>(
      'SELECT id, title, message, created_at FROM notifications WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 5',
      merchantId,
    ),
    getPayouts(merchantId),
    getBalance(merchantId),
  ])
  return { user, merchant, products, month, allTime, recent, shipments, alerts, payouts: payouts.slice(0, 10), balance }
})

export const getPortalHistory = createServerFn({ method: 'GET' })
  .inputValidator((d: { from?: string; to?: string; product?: number }) => d)
  .handler(async ({ data }) => {
    const { merchantId } = await requireMerchant()
    const [movements, totals, products] = await Promise.all([
      getMovements(merchantId, { from: data.from, to: data.to, productId: data.product, limit: 1000 }),
      getTotals(merchantId, data.from, data.to),
      getMerchantProducts(merchantId),
    ])
    return { movements, totals, products }
  })

export const getPortalShipments = createServerFn({ method: 'GET' }).handler(async () => {
  const { merchantId } = await requireMerchant()
  return all<Shipment>(
    `SELECT id, tracking_code, receiver_name, receiver_phone, destination_city, destination_country, status, payment_status,
            cod_amount, shipping_fee, current_location, created_at, delivered_at
       FROM shipments WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 200`,
    merchantId,
  )
})

/** Printable statement: merchants can only see their own; staff can see any. */
export const getStatementFn = createServerFn({ method: 'GET' })
  .inputValidator((d: { merchantId?: number; from?: string; to?: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser([...STAFF_ROLES, 'merchant'])
    if (user.role !== 'merchant' && !user.perms.includes('merchants')) return null
    const merchantId = user.role === 'merchant' ? user.merchant_id : Number(data.merchantId)
    if (!merchantId) return null
    const st = await getStatement(merchantId, data.from || undefined, data.to || undefined)
    if (!st) return null
    // Never print bank details on the statement
    return { ...st, merchant: { ...st.merchant, account_number: null }, printedBy: user.full_name }
  })
