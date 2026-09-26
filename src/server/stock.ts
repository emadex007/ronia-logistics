// Server-only stock helpers shared by the admin side and the merchant portal.
import { all, first } from './db'
import type { Merchant, Payout, Product, StockMovement } from '~/lib/types'

export type StatementTotals = {
  received: number
  sold: number
  sold_value: number
  dispatched: number
  returned: number
  adjusted: number
}

/** Lagos-date range filter on an ISO created_at column. */
function rangeSql(col: string, from?: string, to?: string) {
  const where: string[] = []
  const params: unknown[] = []
  if (from) {
    where.push(`date(${col}, '+1 hour') >= ?`)
    params.push(from)
  }
  if (to) {
    where.push(`date(${col}, '+1 hour') <= ?`)
    params.push(to)
  }
  return { where, params }
}

export async function getMovements(merchantId: number, opts: { from?: string; to?: string; productId?: number; limit?: number } = {}) {
  const r = rangeSql('m.created_at', opts.from, opts.to)
  const where = ['m.merchant_id = ?', ...r.where]
  const params: unknown[] = [merchantId, ...r.params]
  if (opts.productId) {
    where.push('m.product_id = ?')
    params.push(opts.productId)
  }
  return all<StockMovement>(
    `SELECT m.*, p.name AS product_name, p.sku, u.full_name AS handled_by_name, s.tracking_code
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.handled_by
       LEFT JOIN shipments s ON s.id = m.shipment_id
      WHERE ${where.join(' AND ')}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ?`,
    ...params,
    opts.limit ?? 500,
  )
}

export async function getTotals(merchantId: number, from?: string, to?: string): Promise<StatementTotals> {
  const r = rangeSql('created_at', from, to)
  const where = ['merchant_id = ?', ...r.where].join(' AND ')
  const row = await first<StatementTotals>(
    `SELECT
        COALESCE(SUM(CASE WHEN type='received' THEN quantity END),0) AS received,
        COALESCE(SUM(CASE WHEN type='sold' THEN -quantity END),0) AS sold,
        COALESCE(SUM(CASE WHEN type='sold' THEN -quantity * unit_price END),0) AS sold_value,
        COALESCE(SUM(CASE WHEN type='dispatched' THEN -quantity END),0) AS dispatched,
        COALESCE(SUM(CASE WHEN type='returned' THEN quantity END),0) AS returned,
        COALESCE(SUM(CASE WHEN type='adjustment' THEN quantity END),0) AS adjusted
       FROM stock_movements WHERE ${where}`,
    merchantId,
    ...r.params,
  )
  return row ?? { received: 0, sold: 0, sold_value: 0, dispatched: 0, returned: 0, adjusted: 0 }
}

export async function getMerchantProducts(merchantId: number) {
  return all<Product>('SELECT * FROM products WHERE merchant_id = ? ORDER BY name', merchantId)
}

export async function getStatement(merchantId: number, from?: string, to?: string) {
  const merchant = await first<Merchant>('SELECT * FROM merchants WHERE id = ?', merchantId)
  if (!merchant) return null
  const [products, movements, totals, payouts, balance] = await Promise.all([
    getMerchantProducts(merchantId),
    getMovements(merchantId, { from, to, limit: 2000 }),
    getTotals(merchantId, from, to),
    getPayouts(merchantId, from, to),
    getBalance(merchantId),
  ])
  return { merchant, products, movements, totals, payouts, balance, from: from ?? null, to: to ?? null }
}

export async function getPayouts(merchantId: number, from?: string, to?: string) {
  const r = rangeSql('p.paid_at', from, to)
  return all<Payout>(
    `SELECT p.*, u.full_name AS handled_by_name
       FROM merchant_payouts p LEFT JOIN users u ON u.id = p.handled_by
      WHERE ${['p.merchant_id = ?', ...r.where].join(' AND ')}
      ORDER BY p.paid_at DESC, p.id DESC LIMIT 500`,
    merchantId,
    ...r.params,
  )
}

/** What Ronia owes the merchant: all sales recorded minus all payouts made. */
export async function getBalance(merchantId: number) {
  const row = await first<{ sales: number; paid: number }>(
    `SELECT
       (SELECT COALESCE(SUM(-quantity * unit_price),0) FROM stock_movements WHERE merchant_id = ? AND type = 'sold') AS sales,
       (SELECT COALESCE(SUM(amount),0) FROM merchant_payouts WHERE merchant_id = ?) AS paid`,
    merchantId,
    merchantId,
  )
  const sales = row?.sales ?? 0
  const paid = row?.paid ?? 0
  return { sales, paid, owed: sales - paid }
}
