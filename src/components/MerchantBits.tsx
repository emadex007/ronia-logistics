import { movementLabel, movementTone, money, dateTime } from '~/lib/format'
import { Field } from './ui'
import type { Merchant, StockMovement } from '~/lib/types'

export function MerchantFields({ m }: { m?: Partial<Merchant> }) {
  return (
    <>
      <Field label="Business name *">
        <input name="business_name" required defaultValue={m?.business_name ?? ''} className="input" />
      </Field>
      <Field label="Contact person">
        <input name="contact_name" defaultValue={m?.contact_name ?? ''} className="input" />
      </Field>
      <Field label="Phone">
        <input name="phone" defaultValue={m?.phone ?? ''} className="input" />
      </Field>
      <Field label="Email">
        <input name="email" type="email" defaultValue={m?.email ?? ''} className="input" />
      </Field>
      <Field label="Address" className="sm:col-span-2">
        <input name="address" defaultValue={m?.address ?? ''} className="input" />
      </Field>
      <Field label="Bank name">
        <input name="bank_name" defaultValue={m?.bank_name ?? ''} className="input" />
      </Field>
      <Field label="Account name">
        <input name="account_name" defaultValue={m?.account_name ?? ''} className="input" />
      </Field>
      <Field label="Account number">
        <input name="account_number" defaultValue={m?.account_number ?? ''} className="input" />
      </Field>
      <Field label="Notes (terms, storage fee, etc.)" className="sm:col-span-2 lg:col-span-3">
        <textarea name="notes" rows={2} defaultValue={m?.notes ?? ''} className="input" />
      </Field>
    </>
  )
}

export function MovementBadge({ type }: { type: string }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${movementTone(type)}`}>{movementLabel(type)}</span>
}

/** Movement table used by admin, portal and printable statement. */
export function MovementsTable({ rows, showStaff = true, compact = false }: { rows: StockMovement[]; showStaff?: boolean; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-sm ${compact ? '' : 'min-w-[720px]'}`}>
        <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase print:bg-white">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Value</th>
            <th className="px-3 py-2">Ref / note</th>
            {showStaff && <th className="px-3 py-2">By</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                No stock movements yet.
              </td>
            </tr>
          )}
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-500">{dateTime(m.created_at)}</td>
              <td className="px-3 py-2">
                {m.product_name}
                {m.sku && <span className="ml-1 text-xs text-slate-400">({m.sku})</span>}
              </td>
              <td className="px-3 py-2">
                <MovementBadge type={m.type} />
              </td>
              <td className={`px-3 py-2 text-right font-semibold ${m.quantity < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
              </td>
              <td className="px-3 py-2 text-right">{m.type === 'sold' ? money(Math.abs(m.quantity) * m.unit_price) : '—'}</td>
              <td className="px-3 py-2 text-xs text-slate-600">
                {m.tracking_code && <span className="mr-1 font-mono font-semibold text-brand-700">{m.tracking_code}</span>}
                {m.reference && <span className="mr-1">{m.reference}</span>}
                {m.note}
              </td>
              {showStaff && <td className="px-3 py-2 text-xs text-slate-500">{m.handled_by_name ?? '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
