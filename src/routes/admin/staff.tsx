import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { createStaff, listStaff, updateStaff } from '~/fns/staff'
import { Alert, Field, PageHeader } from '~/components/ui'
import { ROLE_LABELS, dateTime } from '~/lib/format'
import type { Role } from '~/lib/types'

export const Route = createFileRoute('/admin/staff')({
  beforeLoad: ({ context }) => {
    if (!['admin', 'manager'].includes(context.user.role)) throw redirect({ to: '/admin' })
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
              <th className="px-4 py-3" title="Can change the website's pictures, text, logo and colours">Website editor</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((s) => (
              <tr key={s.id} className={s.is_active ? '' : 'opacity-50'}>
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
                    <span className="text-xs text-slate-500">Always</span>
                  ) : isAdmin ? (
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--color-accent-500)]"
                        checked={!!s.can_edit_site}
                        disabled={busy}
                        onChange={(e) =>
                          act(
                            () => updateStaff({ data: { id: s.id, can_edit_site: e.target.checked } }),
                            e.target.checked ? `${s.full_name} can now edit the website.` : `${s.full_name} can no longer edit the website.`,
                          )
                        }
                      />
                      {s.can_edit_site ? 'Yes' : 'No'}
                    </label>
                  ) : (
                    <span className="text-xs">{s.can_edit_site ? 'Yes' : 'No'}</span>
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
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
