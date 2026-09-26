import type { ShipmentStatus } from './types'

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 })

/** Amounts are stored in kobo. */
export const money = (kobo: number | null | undefined) => naira.format((kobo ?? 0) / 100)
export const toKobo = (naira: string | number) => Math.round(Number(naira || 0) * 100)
export const fromKobo = (kobo: number | null | undefined) => ((kobo ?? 0) / 100).toString()

export function dateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function dateOnly(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso).toLocaleDateString('en-NG', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const STATUSES: { value: ShipmentStatus; label: string; tone: string }[] = [
  { value: 'pending', label: 'Pending pickup', tone: 'bg-slate-100 text-slate-700' },
  { value: 'received', label: 'Received at office', tone: 'bg-sky-100 text-sky-800' },
  { value: 'in_transit', label: 'In transit', tone: 'bg-amber-100 text-amber-800' },
  { value: 'arrived_hub', label: 'Arrived at hub', tone: 'bg-indigo-100 text-indigo-800' },
  { value: 'out_for_delivery', label: 'Out for delivery', tone: 'bg-orange-100 text-orange-800' },
  { value: 'delivered', label: 'Delivered', tone: 'bg-emerald-100 text-emerald-800' },
  { value: 'returned', label: 'Returned to sender', tone: 'bg-rose-100 text-rose-800' },
  { value: 'cancelled', label: 'Cancelled', tone: 'bg-zinc-200 text-zinc-700' },
]

export const statusLabel = (s: string) => STATUSES.find((x) => x.value === s)?.label ?? s
export const statusTone = (s: string) => STATUSES.find((x) => x.value === s)?.tone ?? 'bg-slate-100 text-slate-700'

/** Order of the happy path, used to draw the progress bar on the tracking page. */
export const PROGRESS: ShipmentStatus[] = ['received', 'in_transit', 'arrived_hub', 'out_for_delivery', 'delivered']

export const SERVICE_TYPES = [
  { value: 'same_day', label: 'Same-day (Abuja)' },
  { value: 'standard', label: 'Standard interstate' },
  { value: 'express', label: 'Express interstate' },
  { value: 'international', label: 'International' },
]
export const serviceLabel = (s: string) => SERVICE_TYPES.find((x) => x.value === s)?.label ?? s

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  staff: 'Front desk / Warehouse',
  rider: 'Rider / Driver',
  merchant: 'Merchant',
}

export const MOVEMENT_TYPES = [
  { value: 'received', label: 'Stock received', sign: 1, tone: 'bg-emerald-100 text-emerald-800' },
  { value: 'sold', label: 'Sold', sign: -1, tone: 'bg-orange-100 text-orange-800' },
  { value: 'dispatched', label: 'Sent out / delivered', sign: -1, tone: 'bg-sky-100 text-sky-800' },
  { value: 'returned', label: 'Returned to stock', sign: 1, tone: 'bg-violet-100 text-violet-800' },
  { value: 'adjustment', label: 'Adjustment', sign: 0, tone: 'bg-slate-100 text-slate-700' },
] as const
export const movementLabel = (t: string) => MOVEMENT_TYPES.find((x) => x.value === t)?.label ?? t
export const movementTone = (t: string) => MOVEMENT_TYPES.find((x) => x.value === t)?.tone ?? 'bg-slate-100 text-slate-700'

export const INCOME_CATEGORIES = [
  'Shipping fee',
  'Storage / warehousing fee',
  'Handling & packaging fee',
  'COD commission',
  'Pickup fee',
  'Other income',
]
export const EXPENSE_CATEGORIES = [
  'Fuel',
  'Vehicle maintenance',
  'Rider / driver payments',
  'Salaries & wages',
  'Rent',
  'Electricity / diesel',
  'Internet & phone',
  'Packaging materials',
  'Office supplies',
  'Taxes & levies',
  'Other expense',
]
export const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'transfer', label: 'Bank transfer' },
  { value: 'pos', label: 'POS' },
  { value: 'paystack', label: 'Paystack (online)' },
]
export const methodLabel = (m: string | null | undefined) => PAY_METHODS.find((x) => x.value === m)?.label ?? m ?? '—'

/** First and last day (YYYY-MM-DD) of a YYYY-MM month. */
export function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` }
}
