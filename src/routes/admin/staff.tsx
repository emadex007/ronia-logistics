import { Fragment, useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { createStaff, listStaff, updateStaff } from '~/fns/staff'
import { Alert, Field, PageHeader } from '~/components/ui'
import { ROLE_LABELS, dateTime } from '~/lib/format'
import type { Role } from '~/lib/types'
import { PERMISSIONS, ROLE_DEFAULTS, effectivePerms, permLabel, type Perm } from '~/lib/permissions'

export const Route = createFileRoute('/admin/staff')({
  beforeLoad: ({ context }) => {
    if (!context.user.perms.includes('staff')) throw redirect({ to: '/admin' })
  },
  loader: () => listStaff(),
  head: () => ({ meta: [{ title: 'Staff — Ronia Logistics' }] }),
  component: StaffPage,
})

const ROLES: Role[] = ['staff', 'rider', 'manager', 'admin']

function StaffPage() {
  const staff = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()
  const isAdmin = user.role === 'admin'
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    setMsg(res.ok ? { tone: 'success', text: success } : { tone: 'error', text: res.error ?? 'Something went wrong.' })
    if (res.ok) router.invalidate()
    return res.ok
  }

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Everyone who can log in to the dashboard. Every package update is recorded against the staff member who made it."
        actions={
          isAdmin && (
            <button className="btn-accent" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Close' : '＋ Add staff'}
            </button>
          )
        }
      />

      {msg && (
        <div className="mb-4">
          <Alert tone={msg.tone}>{msg.text}</Alert>
        </div>
      )}

      {showForm && isAdmin && (
        <form
          className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const form = e.currentTarget
            const f = Object.fromEntries(new FormData(form)) as Record<string, string>
            const ok = await act(
              () => createStaff({ data: { full_name: f.full_name, email: f.email, phone: f.phone, role: f.role as Role, branch: f.branch, password: f.password } }),
              `${f.full_name} can now log in with ${f.email}.`,
            )
            if (ok) {
              form.reset()
              setShowForm(false)
            }
          }}
        >
          <Field label="Full name">
            <input name="full_name" required className="input" />
          </Field>
          <Field label="Email (used to log in)">
            <input name="email" type="email" required className="input" />
          </Field>
          <Field label="Phone">
            <input name="phone" className="input" />
          </Field>
          <Field label="Role">
            <select name="role" className="input" defaultValue="staff">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch / location">
            <input name="branch" className="input" placeholder="e.g. Abuja HQ, Wuse" />
          </Field>
          <Field label="Temporary password (min. 8)">
            <input name="password" type="text" minLength={8} required className="input" />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Create staff account'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Updates made</th>
              <th className="px-4 py-3">Access</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((s) => (
              <Fragment key={s.id}>
              <tr className={s.is_active ? '' : 'opacity-50'}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{s.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {s.email}
                    {s.phone ? ` · ${s.phone}` : ''}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {isAdmin && s.id !== user.id ? (
                    <select
                      className="input !py-1"
                      value={s.role}
                      disabled={busy}
                      onChange={(e) => act(() => updateStaff({ data: { id: s.id, role: e.target.value as Role } }), `Role updated for ${s.full_name}.`)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ROLE_LABELS[s.role]
                  )}
                </td>
                <td className="px-4 py-3">{s.branch ?? '—'}</td>
                <td className="px-4 py-3">{s.shipments_handled}</td>
                <td className="px-4 py-3">
                  {s.role === 'admin' ? (
                    <span className="text-xs text-slate-500">Everything</span>
                  ) : (
                    <button
                      type="button"
                      className="text-left text-xs"
                      disabled={!isAdmin}
                      onClick={() => setEditing(editing === s.id ? null : s.id)}
                      title={effectivePerms(s).map(permLabel).join(', ') || 'No sections'}
                    >
                      <span className="font-semibold text-brand-900">
                        {effectivePerms(s).length} of {PERMISSIONS.length} sections
                      </span>
                      {s.permissions ? <span className="ml-1 text-accent-600">(custom)</span> : null}
                      {isAdmin && <span className="block text-brand-500 hover:underline">{editing === s.id ? 'Close' : 'Change access'}</span>}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{dateTime(s.last_login_at)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {s.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {s.id !== user.id && (
                      <>
                        <button
                          className="btn-ghost !px-2.5 !py-1 text-xs"
                          disabled={busy}
                          onClick={() => {
                            const pw = prompt(`New password for ${s.full_name} (min. 8 characters):`)
                            if (pw) act(() => updateStaff({ data: { id: s.id, password: pw } }), `Password reset for ${s.full_name}.`)
                          }}
                        >
                          Reset password
                        </button>{' '}
                        <button
                          className="btn-ghost !px-2.5 !py-1 text-xs"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () => updateStaff({ data: { id: s.id, is_active: !s.is_active } }),
                              `${s.full_name} ${s.is_active ? 'disabled' : 'enabled'}.`,
                            )
                          }
                        >
                          {s.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
              {editing === s.id && isAdmin && s.role !== 'admin' && (
                <tr className="bg-orange-50/60">
                  <td colSpan={9} className="px-4 py-4">
                    <AccessEditor
                      key={s.id + (s.permissions ?? '')}
                      name={s.full_name}
                      role={s.role}
                      current={effectivePerms(s)}
                      custom={!!s.permissions}
                      busy={busy}
                      onSave={(perms) => act(() => updateStaff({ data: { id: s.id, permissions: perms } }), `Access updated for ${s.full_name}.`).then((ok) => ok && setEditing(null))}
                      onReset={() => act(() => updateStaff({ data: { id: s.id, permissions: null } }), `${s.full_name} is back to the default access for their role.`).then((ok) => ok && setEditing(null))}
                    />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function AccessEditor({
  name,
  role,
  current,
  custom,
  busy,
  onSave,
  onReset,
}: {
  name: string
  role: string
  current: Perm[]
  custom: boolean
  busy: boolean
  onSave: (perms: Perm[]) => void
  onReset: () => void
}) {
  const [sel, setSel] = useState<Perm[]>(current)
  const toggle = (p: Perm) => setSel((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-brand-900">
        What can {name} open?{' '}
        <span className="font-normal text-slate-500">
          ({custom ? 'custom access' : `default for ${ROLE_LABELS[role] ?? role}: ${(ROLE_DEFAULTS[role] ?? []).map(permLabel).join(', ') || 'nothing'}`})
        </span>
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISSIONS.map((p) => (
          <label key={p.key} className={`flex cursor-pointer gap-3 rounded-xl border bg-white p-3 text-sm ${sel.includes(p.key) ? 'border-accent-400' : 'border-slate-200'}`}>
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-accent-500)]" checked={sel.includes(p.key)} onChange={() => toggle(p.key)} />
            <span>
              <span className="block font-semibold">{p.label}</span>
              <span className="block text-xs text-slate-500">{p.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => onSave(sel)}>
          Save access
        </button>
        {custom && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={onReset}>
            Reset to role default
          </button>
        )}
        <span className="self-center text-xs text-slate-500">The Dashboard is always available. Changes apply on their next page load.</span>
      </div>
    </div>
  )
}
