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

export const login = createServerFn({ method: 'POST' })
  .inputValidator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const user = await first<{ id: number; password_hash: string; role: string; is_active: number }>(
      'SELECT id, password_hash, role, is_active FROM users WHERE email = ?',
      (data.email ?? '').trim().toLowerCase(),
    )
    if (!user || !(await verifyPassword(data.password ?? '', user.password_hash))) {
      return { ok: false as const, error: 'Incorrect email or password.' }
    }
    if (!user.is_active) return { ok: false as const, error: 'This account has been disabled. Contact your administrator.' }
    await createSession(user.id)
    await audit(user.id, 'auth.login', 'user', user.id)
    return { ok: true as const, role: user.role }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await destroySession()
  return { ok: true }
})
