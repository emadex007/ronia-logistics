// Which parts of the admin each staff member can open. The Administrator always has everything.
export const PERMISSIONS = [
  { key: 'shipments', label: 'Shipments', hint: 'Create shipments, update status, take payments, print receipts & labels' },
  { key: 'merchants', label: 'Merchants & stock', hint: 'Merchants, products, stock in/out, statements, merchant applications' },
  { key: 'record_money', label: 'Record income & expenses', hint: 'Add money in/out entries (sees only their own entries)' },
  { key: 'finance', label: 'All finances & reports', hint: 'See every income/expense entry, totals, reports, and pay merchants' },
  { key: 'staff', label: 'View staff', hint: 'See the staff list (only the Administrator can add or change staff)' },
  { key: 'inbox', label: 'Messages & chat', hint: 'Read and reply to website chats and contact-form messages' },
  { key: 'website', label: 'Website editor', hint: 'Change pictures, text, colours, logo and footer' },
] as const

export type Perm = (typeof PERMISSIONS)[number]['key']
export const ALL_PERMS: Perm[] = PERMISSIONS.map((p) => p.key)

/** What each role gets when the Administrator hasn't set custom access. */
export const ROLE_DEFAULTS: Record<string, Perm[]> = {
  admin: ALL_PERMS,
  manager: ['shipments', 'merchants', 'record_money', 'finance', 'staff', 'inbox'],
  staff: ['shipments', 'merchants', 'record_money', 'inbox'],
  rider: ['shipments', 'record_money'],
  merchant: [],
  customer: [],
}

export function effectivePerms(u: { role: string; permissions?: string | null; can_edit_site?: number | null }): Perm[] {
  if (u.role === 'admin') return ALL_PERMS
  if (u.permissions) {
    try {
      const list = JSON.parse(u.permissions)
      if (Array.isArray(list)) return ALL_PERMS.filter((p) => list.includes(p))
    } catch {
      /* fall back to role defaults */
    }
  }
  const base = [...(ROLE_DEFAULTS[u.role] ?? [])]
  if (u.can_edit_site && !base.includes('website')) base.push('website')
  return base
}

export const permLabel = (p: string) => PERMISSIONS.find((x) => x.key === p)?.label ?? p
