// Building blocks for the admin Website editor.
import { useRef, useState, type ReactNode } from 'react'
import { uploadMedia } from '~/fns/site'
import { mediaUrl } from '~/lib/site'

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="font-display font-bold text-brand-900">{title}</h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {multiline ? (
        <textarea className="input" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" />
        <input className="input font-mono uppercase" value={value} onChange={(e) => onChange(e.target.value)} maxLength={7} />
      </span>
    </label>
  )
}

/** Upload (or paste a link to) an image or video. Stores the R2 key or the URL. */
export function MediaField({
  label,
  value,
  onChange,
  kind = 'image',
  hint,
  aspect = 'aspect-video',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  kind?: 'image' | 'video' | 'icon'
  hint?: string
  aspect?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const url = mediaUrl(value)
  const accept = kind === 'video' ? 'video/mp4,video/webm' : kind === 'icon' ? 'image/png,image/x-icon,image/vnd.microsoft.icon,image/webp' : 'image/jpeg,image/png,image/webp,image/gif'

  return (
    <div>
      <span className="label">{label}</span>
      <div className={`relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 ${kind === 'icon' ? 'grid h-24 w-24 place-items-center' : aspect}`}>
        {url ? (
          kind === 'video' ? (
            <video src={url} className="h-full w-full object-cover" muted loop autoPlay playsInline />
          ) : (
            <img src={url} alt="" className={`h-full w-full ${kind === 'icon' ? 'object-contain p-3' : 'object-cover'}`} />
          )
        ) : (
          <span className="absolute inset-0 grid place-items-center text-xs text-slate-400">No {kind === 'video' ? 'video' : 'image'}</span>
        )}
        {busy && <span className="absolute inset-0 grid place-items-center bg-white/80 text-sm font-semibold text-brand-900">Uploading…</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => input.current?.click()}>
          ⬆ Upload {kind === 'video' ? 'video' : 'image'}
        </button>
        <button
          type="button"
          className="btn-ghost !px-3 !py-1.5 text-xs"
          disabled={busy}
          onClick={() => {
            const link = prompt('Paste an image/video link (https://…)', /^https?:/.test(value) ? value : '')
            if (link !== null) onChange(link.trim())
          }}
        >
          🔗 Use a link
        </button>
        {value && (
          <button type="button" className="text-xs text-slate-400 hover:text-rose-600" onClick={() => onChange('')}>
            Remove
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          setError('')
          const fd = new FormData()
          fd.append('file', file)
          try {
            const res = await uploadMedia({ data: fd })
            if (!res.ok) setError(res.error)
            else onChange(res.key)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed.')
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
}

/** Editable list of items (services, stats, FAQ…) with add / remove / move. */
export function ListEditor<T>({
  items,
  onChange,
  blank,
  render,
  addLabel,
  columns = 1,
}: {
  items: T[]
  onChange: (items: T[]) => void
  blank: T
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode
  addLabel: string
  columns?: 1 | 2 | 3
}) {
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const grid = columns === 3 ? 'md:grid-cols-3' : columns === 2 ? 'md:grid-cols-2' : ''
  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${grid}`}>
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold">#{i + 1}</span>
              <span className="flex gap-1">
                <button type="button" className="rounded px-1.5 hover:bg-slate-200" onClick={() => move(i, -1)} title="Move up">
                  ↑
                </button>
                <button type="button" className="rounded px-1.5 hover:bg-slate-200" onClick={() => move(i, 1)} title="Move down">
                  ↓
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 hover:bg-rose-100 hover:text-rose-600"
                  onClick={() => confirm('Remove this item?') && onChange(items.filter((_, k) => k !== i))}
                  title="Remove"
                >
                  ✕
                </button>
              </span>
            </div>
            <div className="space-y-3">{render(item, (patch) => onChange(items.map((x, k) => (k === i ? ({ ...x, ...patch } as T) : x))), i)}</div>
          </div>
        ))}
      </div>
      <button type="button" className="btn-ghost w-full border-dashed" onClick={() => onChange([...items, structuredClone(blank)])}>
        ＋ {addLabel}
      </button>
    </div>
  )
}

export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = 'px',
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min: number
  max: number
  step?: number
  unit?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="label flex justify-between">
        {label}
        <span className="font-mono text-brand-900 normal-case">
          {value || '—'}
          {value ? unit : ''}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={Number(value) || min} onChange={(e) => onChange(e.target.value)} className="w-full accent-[var(--color-accent-500)]" />
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}
