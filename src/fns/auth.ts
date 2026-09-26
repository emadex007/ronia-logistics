import { createServerFn } from '@tanstack/react-start'
import { first, run, audit } from '~/server/db'
import { createSession, destroySession, getSessionUser, hashPassword, verifyPassword } from '~/server/auth'

export const getMe = createServerFn({ method: 'GET' }).handler(async () => {
  return getSessionUser()
})

export const needsSetup = createServerFn({ method: 'GET' }).handler(async () => {
  const row = await first<{ n: number }>('SELECT COUNT(*) AS n FROM users')
  return (row?.n ?? 0) === 0
})

type SetupInput = { full_name: string; email: string; phone?: string; password: string }

/** Creates the very first administrator. Refuses once any user exists. */
export const setupFirstAdmin = createServerFn({ method: 'POST' })
  .inputValidator((d: SetupInput) => d)
  .handler(async ({ data }) => {
    const row = await first<{ n: number }>('SELECT COUNT(*) AS n FROM users')
    if ((row?.n ?? 0) > 0) return { ok: false as const, error: 'Setup has already been completed. Please log in.' }
    if (!data.full_name?.trim() || !data.email?.trim()) return { ok: false as const, error: 'Name and email are required.' }
    if ((data.password ?? '').length < 8) return { ok: false as const, error: 'Password must be at least 8 characters.' }

    const res = await run(
      `INSERT INTO users (full_name, email, phone, password_hash, role, branch) VALUES (?, ?, ?, ?, 'admin', 'Abuja HQ')`,
      data.full_name.trim(),
      data.email.trim().toLowerCase(),
      data.phone?.trim() || null,
      await hashPassword(data.password),
    )
    const id = Number(res.meta.last_row_id)
    await audit(id, 'setup.admin_created', 'user', id)
    await createSession(id)
    return { ok: true as const }
  })

export type Portal = 'staff' | 'merchant' | 'customer'

const PORTAL_ROLES: Record<Portal, string[]> = {
  staff: ['admin', 'manager', 'staff', 'rider'],
  merchant: ['merchant'],
  customer: ['customer'],
}
const PORTAL_HOME: Record<Portal, string> = { staff: '/admin', merchant: '/merchant', customer: '/account' }
const PORTAL_NAME: Record<Portal, string> = { staff: 'staff', merchant: 'merchant', customer: 'customer' }

/** Where each role belongs, so a wrong-door login can point people to the right page. */
function portalOf(role: string): Portal {
  return role === 'merchant' ? 'merchant' : role === 'customer' ? 'customer' : 'staff'
}

export const login = createServerFn({ method: 'POST' })
  .inputValidator((d: { email: string; password: string; portal: Portal }) => d)
  .handler(async ({ data }) => {
    const portal: Portal = data.portal in PORTAL_ROLES ? data.portal : 'customer'
    const email = (data.email ?? '').trim().toLowerCase()
    const user = await first<{ id: number; password_hash: string; role: string; is_active: number }>(
      'SELECT id, password_hash, role, is_active FROM users WHERE email = ?',
      email,
    )

    if (!user) {
      // Merchant who applied but isn't approved yet
      if (portal === 'merchant') {
        const app = await first<{ status: string; reject_reason: string | null; password_hash: string }>(
          'SELECT status, reject_reason, password_hash FROM merchant_applications WHERE email = ? ORDER BY id DESC LIMIT 1',
          email,
        )
        if (app && (await verifyPassword(data.password ?? '', app.password_hash))) {
          if (app.status === 'pending') return { ok: false as const, error: 'Your merchant application is still being reviewed. We will contact you once it is approved.' }
          if (app.status === 'rejected')
            return { ok: false as const, error: `Your merchant application was not approved${app.reject_reason ? `: ${app.reject_reason}` : '.'} Contact us for more information.` }
        }
      }
      return { ok: false as const, error: 'Incorrect email or password.' }
    }
    if (!(await verifyPassword(data.password ?? '', user.password_hash))) {
      return { ok: false as const, error: 'Incorrect email or password.' }
    }
    if (!PORTAL_ROLES[portal].includes(user.role)) {
      const right = portalOf(user.role)
      return {
        ok: false as const,
        error: `This is a ${PORTAL_NAME[right]} account. Please use the ${PORTAL_NAME[right]} login page.`,
        redirectTo: right === 'staff' ? '/staff/login' : right === 'merchant' ? '/merchant/login' : '/login',
      }
    }
    if (!user.is_active) return { ok: false as const, error: 'This account has been disabled. Please contact Ronia Logistics.' }
    await createSession(user.id)
    await audit(user.id, 'auth.login', 'user', user.id, { portal })
    return { ok: true as const, role: user.role, home: PORTAL_HOME[portal] }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await destroySession()
  return { ok: true }
})
