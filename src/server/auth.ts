// Server-only authentication: password hashing (PBKDF2) and D1-backed sessions.
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import { first, run, nowIso } from './db'
import type { Role, SessionUser } from '~/lib/types'
import { effectivePerms, type Perm } from '~/lib/permissions'

const COOKIE = 'ronia_session'
const SESSION_DAYS = 30
const ITERATIONS = 100_000 // Cloudflare Workers maximum for PBKDF2

const enc = new TextEncoder()

function toB64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
function fromB64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

async function pbkdf2(password: string, salt: BufferSource, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iter, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'pbkdf2') return false
  const hash = new Uint8Array(await pbkdf2(password, fromB64(saltB64), Number(iter)))
  const expected = fromB64(hashB64)
  if (hash.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ expected[i]
  return diff === 0
}

async function sha256(text: string) {
  return toB64(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

export async function createSession(userId: number) {
  const token = toB64(crypto.getRandomValues(new Uint8Array(32))).replace(/[^a-zA-Z0-9]/g, '')
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000)
  await run('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', await sha256(token), userId, expires.toISOString())
  await run('UPDATE users SET last_login_at = ? WHERE id = ?', nowIso(), userId)
  setCookie(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires,
  })
}

export async function destroySession() {
  const token = getCookie(COOKIE)
  if (token) await run('DELETE FROM sessions WHERE id = ?', await sha256(token))
  deleteCookie(COOKIE, { path: '/' })
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(COOKIE)
  if (!token) return null
  const row = await first<Omit<SessionUser, 'perms'> & { expires_at: string }>(
    `SELECT u.id, u.full_name, u.email, u.role, u.branch, u.merchant_id, u.can_edit_site, u.permissions, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND u.is_active = 1`,
    await sha256(token),
  )
  if (!row) return null
  if (row.expires_at < nowIso()) {
    await destroySession()
    return null
  }
  const { expires_at: _e, ...user } = row
  return { ...user, perms: effectivePerms(user) }
}

export class AuthError extends Error {}

/** Throws if not logged in, or if the user's role is not in `roles`. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('Please log in to continue.')
  if (roles && !roles.includes(user.role)) throw new AuthError('You do not have permission to do this.')
  return user
}

export const STAFF_ROLES: Role[] = ['admin', 'manager', 'staff', 'rider']

/** Throws unless a logged-in staff member has access to this part of the admin. */
export async function requirePerm(...anyOf: Perm[]): Promise<SessionUser> {
  const user = await requireUser(STAFF_ROLES)
  if (!anyOf.some((p) => user.perms.includes(p))) throw new AuthError('You do not have access to this section. Ask the Administrator.')
  return user
}
