import { createServerFn } from '@tanstack/react-start'
import { all, first, run, audit, todayLagos } from '~/server/db'
import { requirePerm, requireUser } from '~/server/auth'
import type { Transaction } from '~/lib/types'

export type FinanceFilters = { from: string; to: string; type?: 'income' | 'expense'; category?: string; staff?: number }

type Group = { key: string; income: number; expense: number; count: number }

/** Full finance view — admin and manager only. */
export const getFinance = createServerFn({ method: 'GET' })
  .validator((d: FinanceFilters) => d)
  .handler(async ({ data }) => {
    const me = await requirePerm('finance', 'record_money')
    const isManager = me.perms.includes('finance')

    const where = ['t.txn_date >= ?', 't.txn_date <= ?']
    const params: unknown[] = [data.from, data.to]
    if (!isManager) {
      // Front desk / riders only see what they recorded themselves
      where.push('t.handled_by = ?')
      params.push(me.id)
    }
    const baseWhere = where.join(' AND ')
    const baseParams = [...params]

    if (data.type) {
      where.push('t.type = ?')
      params.push(data.type)
    }
    if (data.category) {
      where.push('t.category = ?')
      params.push(data.category)
    }
    if (data.staff && isManager) {
      where.push('t.handled_by = ?')
      params.push(data.staff)
    }

    const rows = await all<Transaction>(
      `SELECT t.*, u.full_name AS handled_by_name, s.tracking_code, m.business_name
         FROM transactions t
         LEFT JOIN users u ON u.id = t.handled_by
         LEFT JOIN shipments s ON s.id = t.shipment_id
         LEFT JOIN merchants m ON m.id = t.merchant_id
        WHERE ${where.join(' AND ')}
        ORDER BY t.txn_date DESC, t.id DESC
        LIMIT 1000`,
      ...params,
    )

    const sums = `COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount END),0) AS income,
                  COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END),0) AS expense,
                  COUNT(*) AS count`
    const [totals, byCategory, byStaff, byMethod, byDay] = await Promise.all([
      first<{ income: number; expense: number; count: number }>(`SELECT ${sums} FROM transactions t WHERE ${baseWhere}`, ...baseParams),
      all<Group>(`SELECT t.category AS key, ${sums} FROM transactions t WHERE ${baseWhere} GROUP BY t.category ORDER BY (income + expense) DESC`, ...baseParams),
      all<Group>(
        `SELECT COALESCE(u.full_name, 'Online / system') AS key, ${sums}
           FROM transactions t LEFT JOIN users u ON u.id = t.handled_by
          WHERE ${baseWhere} GROUP BY t.handled_by ORDER BY (income + expense) DESC`,
        ...baseParams,
      ),
      all<Group>(`SELECT COALESCE(t.method, 'other') AS key, ${sums} FROM transactions t WHERE ${baseWhere} GROUP BY t.method ORDER BY (income + expense) DESC`, ...baseParams),
      all<Group>(`SELECT t.txn_date AS key, ${sums} FROM transactions t WHERE ${baseWhere} GROUP BY t.txn_date ORDER BY t.txn_date`, ...baseParams),
    ])

    const staff = isManager
      ? await all<{ id: number; full_name: string }>("SELECT id, full_name FROM users WHERE role != 'merchant' AND is_active = 1 ORDER BY full_name")
      : [{ id: me.id, full_name: me.full_name }]

    return {
      isManager,
      rows,
      totals: totals ?? { income: 0, expense: 0, count: 0 },
      byCategory,
      byStaff,
      byMethod,
      byDay,
      staff,
      filters: data,
    }
  })

export type NewTransaction = {
  type: 'income' | 'expense'
  category: string
  amount: number // kobo
  description?: string
  method?: string
  reference?: string
  txn_date?: string
  handled_by?: number
  merchant_id?: number | null
}

export const addTransaction = createServerFn({ method: 'POST' })
  .validator((d: NewTransaction) => d)
  .handler(async ({ data }) => {
    const me = await requirePerm('finance', 'record_money')
    const isManager = me.perms.includes('finance')
    if (data.type !== 'income' && data.type !== 'expense') return { ok: false as const, error: 'Choose income or expense.' }
    if (!data.category?.trim()) return { ok: false as const, error: 'Choose a category.' }
    const amount = Math.round(Number(data.amount))
    if (!amount || amount <= 0) return { ok: false as const, error: 'Enter an amount greater than zero.' }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(data.txn_date ?? '') ? data.txn_date! : todayLagos()
    if (date > todayLagos()) return { ok: false as const, error: "The date can't be in the future." }
    // Managers can record on behalf of another staff member; everyone else records as themselves.
    const handledBy = isManager && data.handled_by ? Number(data.handled_by) : me.id

    const res = await run(
      `INSERT INTO transactions (type, category, amount, description, method, reference, merchant_id, handled_by, txn_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      data.type,
      data.category.trim(),
      amount,
      data.description?.trim() || null,
      data.method || 'cash',
      data.reference?.trim() || null,
      data.merchant_id ? Number(data.merchant_id) : null,
      handledBy,
      date,
    )
    await audit(me.id, `finance.${data.type}`, 'transaction', Number(res.meta.last_row_id), { amount, category: data.category, handledBy })
    return { ok: true as const }
  })

export const deleteTransaction = createServerFn({ method: 'POST' })
  .validator((d: { id: number; reason: string }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser(['admin'])
    const t = await first<Transaction>('SELECT * FROM transactions WHERE id = ?', Number(data.id))
    if (!t) return { ok: false as const, error: 'Entry not found.' }
    if (!data.reason?.trim()) return { ok: false as const, error: 'Give a reason for deleting this entry.' }
    await run('DELETE FROM transactions WHERE id = ?', t.id)
    // Keep a full copy in the audit log so nothing disappears without a trace
    await audit(me.id, 'finance.delete', 'transaction', t.id, { ...t, reason: data.reason.trim() })
    return { ok: true as const }
  })
