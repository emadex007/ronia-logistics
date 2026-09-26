import { createServerFn } from '@tanstack/react-start'
import { all, first, run, audit } from '~/server/db'
import { hashPassword, requireUser } from '~/server/auth'
import type { Role } from '~/lib/types'

export type StaffRow = {
  id: number
  full_name: string
  email: string
  phone: string | null
  role: Role
  branch: string | null
  is_active: number
  last_login_at: string | null
  created_at: string
  shipments_handled: number
  can_edit_site: number
}

const STAFF_ASSIGNABLE: Role[] = ['admin', 'manager', 'staff', 'rider']

export const listStaff = createServerFn({ method: 'GET' }).handler(async () => {
  await requireUser(['admin', 'manager'])
  return all<StaffRow>(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.branch, u.is_active, u.last_login_at, u.created_at, u.can_edit_site,
            (SELECT COUNT(*) FROM shipment_events e WHERE e.staff_id = u.id) AS shipments_handled
       FROM users u WHERE u.role NOT IN ('merchant', 'customer') ORDER BY u.is_active DESC, u.full_name`,
  )
})

export const createStaff = createServerFn({ method: 'POST' })
  .inputValidator((d: { full_name: string; email: string; phone?: string; role: Role; branch?: string; password: string }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser(['admin'])
    if (!data.full_name?.trim() || !data.email?.trim()) return { ok: false as const, error: 'Name and email are required.' }
    if (!STAFF_ASSIGNABLE.includes(data.role)) return { ok: false as const, error: 'Choose a valid role.' }
    if ((data.password ?? '').length < 8) return { ok: false as const, error: 'Password must be at least 8 characters.' }
    const exists = await first('SELECT 1 FROM users WHERE email = ?', data.email.trim().toLowerCase())
    if (exists) return { ok: false as const, error: 'A user with this email already exists.' }
    const res = await run(
      'INSERT INTO users (full_name, email, phone, password_hash, role, branch) VALUES (?, ?, ?, ?, ?, ?)',
      data.full_name.trim(),
      data.email.trim().toLowerCase(),
      data.phone?.trim() || null,
      await hashPassword(data.password),
      data.role,
      data.branch?.trim() || null,
    )
    await audit(me.id, 'staff.create', 'user', Number(res.meta.last_row_id), { role: data.role })
    return { ok: true as const }
  })

export const updateStaff = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: number; role?: Role; branch?: string; is_active?: boolean; password?: string; can_edit_site?: boolean }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser(['admin'])
    const target = await first<{ id: number; role: Role }>('SELECT id, role FROM users WHERE id = ?', Number(data.id))
    if (!target || target.role === 'merchant' || target.role === 'customer') return { ok: false as const, error: 'Staff member not found.' }
    if (target.id === me.id && (data.is_active === false || (data.role && data.role !== 'admin'))) {
      return { ok: false as const, error: "You can't disable or demote your own account." }
    }
    if (data.role && STAFF_ASSIGNABLE.includes(data.role)) await run('UPDATE users SET role = ? WHERE id = ?', data.role, target.id)
    if (data.branch !== undefined) await run('UPDATE users SET branch = ? WHERE id = ?', data.branch.trim() || null, target.id)
    if (data.is_active !== undefined) {
      await run('UPDATE users SET is_active = ? WHERE id = ?', data.is_active ? 1 : 0, target.id)
      if (!data.is_active) await run('DELETE FROM sessions WHERE user_id = ?', target.id)
    }
    if (data.can_edit_site !== undefined) await run('UPDATE users SET can_edit_site = ? WHERE id = ?', data.can_edit_site ? 1 : 0, target.id)
    if (data.password) {
      if (data.password.length < 8) return { ok: false as const, error: 'Password must be at least 8 characters.' }
      await run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(data.password), target.id)
      await run('DELETE FROM sessions WHERE user_id = ?', target.id)
    }
    await audit(me.id, 'staff.update', 'user', target.id, { ...data, password: data.password ? '***' : undefined })
    return { ok: true as const }
  })
