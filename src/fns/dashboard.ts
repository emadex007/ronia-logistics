import { createServerFn } from '@tanstack/react-start'
import { all, first, todayLagos } from '~/server/db'
import { requireUser, STAFF_ROLES } from '~/server/auth'
import type { Shipment } from '~/lib/types'

export const getDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireUser(STAFF_ROLES)
  const today = todayLagos()
  const monthStart = today.slice(0, 8) + '01'

  const byStatus = await all<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM shipments GROUP BY status')
  // created_at is UTC; Lagos is UTC+1 so shift by one hour for "today"
  const todayCount =
    (await first<{ n: number }>("SELECT COUNT(*) AS n FROM shipments WHERE date(created_at, '+1 hour') = ?", today))?.n ?? 0
  const deliveredToday =
    (await first<{ n: number }>("SELECT COUNT(*) AS n FROM shipments WHERE status = 'delivered' AND date(delivered_at, '+1 hour') = ?", today))?.n ?? 0

  const canSeeMoney = user.role === 'admin' || user.role === 'manager'
  let finance = null as null | { income: number; expense: number }
  if (canSeeMoney) {
    const f = await first<{ income: number; expense: number }>(
      `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount END),0) AS income,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount END),0) AS expense
         FROM transactions WHERE txn_date >= ?`,
      monthStart,
    )
    finance = f ?? { income: 0, expense: 0 }
  }

  const unpaid =
    (await first<{ n: number; total: number }>(
      "SELECT COUNT(*) AS n, COALESCE(SUM(shipping_fee),0) AS total FROM shipments WHERE payment_status != 'paid' AND status != 'cancelled'",
    )) ?? { n: 0, total: 0 }

  const recent = await all<Shipment>(
    `SELECT id, tracking_code, receiver_name, destination_city, destination_country, status, payment_status, created_at
       FROM shipments ORDER BY created_at DESC LIMIT 8`,
  )

  return {
    statusCounts: Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Record<string, number>,
    todayCount,
    deliveredToday,
    finance,
    unpaid,
    recent,
  }
})
