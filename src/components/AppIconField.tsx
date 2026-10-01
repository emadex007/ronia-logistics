// App icon for the installable phone app.
// Phones need exact square PNGs: 192×192 and 512×512 for normal icons, plus a "maskable" 512×512 for Android,
// which crops icons into circles/squircles — so the logo must sit inside a safe zone with background around it.
// We build all three in the browser from whatever logo the user uploads.
import { useEffect, useRef, useState } from 'react'
import { uploadMedia } from '~/fns/site'
import { mediaUrl } from '~/lib/site'
import { ColorField } from './SiteEditorFields'

type Props = { v: (k: string) => string; set: (k: string) => (x: string) => void }

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = src
  })
}

/** Draw the logo centred on a square background. `fill` = share of the square the logo may use. */
function render(img: HTMLImageElement, size: number, bg: string, fill: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  const box = size * fill
  const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
  return c
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not make the icon.'))), 'image/png'))

async function upload(blob: Blob, name: string) {
  const fd = new FormData()
  fd.append('file', new File([blob], name, { type: 'image/png' }))
  const res = await uploadMedia({ data: fd })
  if (!res.ok) throw new Error(res.error)
  return res.key
}

export function AppIconField({ v, set }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ any: string; mask: string } | null>(null)
  const bg = /^#[0-9a-f]{6}$/i.test(v('app_icon_bg')) ? v('app_icon_bg') : '#000000'
  const fill = Math.min(100, Math.max(40, Number(v('app_icon_fill')) || 84)) / 100
  // Older setups stored only one icon: offer to rebuild the phone sizes from it
  const source = v('app_icon_source_key') || (v('app_icon_192_key') ? '' : v('app_icon_key'))

  // Live preview of what phones will show, redrawn when colour/size change
  useEffect(() => {
    let alive = true
    const src = source ? mediaUrl(source) : ''
    if (!src) return setPreview(null)
    loadImage(src)
      .then((img) => {
        if (!alive) return
        setPreview({ any: render(img, 256, bg, fill).toDataURL(), mask: render(img, 256, bg, fill * 0.72).toDataURL() })
      })
      .catch(() => alive && setPreview(null))
    return () => {
      alive = false
    }
  }, [source, bg, fill])

  async function build(src: string) {
    setBusy(true)
    setError('')
    try {
      const img = await loadImage(src)
      const [k512, k192, kMask] = await Promise.all([
        toBlob(render(img, 512, bg, fill)).then((b) => upload(b, 'app-icon-512.png')),
        toBlob(render(img, 192, bg, fill)).then((b) => upload(b, 'app-icon-192.png')),
        // Android's safe zone is the middle ~80% circle, so the logo gets extra room around it
        toBlob(render(img, 512, bg, fill * 0.72)).then((b) => upload(b, 'app-icon-maskable.png')),
      ])
      set('app_icon_key')(k512)
      set('app_icon_192_key')(k192)
      set('app_icon_maskable_key')(kMask)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make the icon.')
    } finally {
      setBusy(false)
    }
  }

  const stale = !!source && !!preview && !busy && v('app_icon_built_for') !== `${source}|${bg}|${fill}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-6">
        <div className="text-center">
          <div className="h-24 w-24 overflow-hidden rounded-[22px] bg-slate-100 shadow ring-1 ring-slate-200">
            {preview ? (
              <img src={preview.any} alt="" className="h-full w-full" />
            ) : (
              <img src={v('app_icon_key') ? mediaUrl(v('app_icon_key')) : '/icon-512.png'} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">iPhone</p>
        </div>
        <div className="text-center">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-slate-100 shadow ring-1 ring-slate-200">
            {preview ? (
              <img src={preview.mask} alt="" className="h-full w-full" />
            ) : (
              <img src={v('app_icon_maskable_key') ? mediaUrl(v('app_icon_maskable_key')) : '/icon-maskable-512.png'} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Android</p>
        </div>
        {busy && <p className="text-sm font-semibold text-brand-900">Making icons…</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => input.current?.click()}>
          ⬆ Upload logo for the app
        </button>
        {source && (
          <button
            type="button"
            className="btn-ghost !px-3 !py-1.5 text-xs"
            disabled={busy}
            onClick={() => {
              const k = source
              set('app_icon_source_key')(k)
              build(mediaUrl(k)).then(() => set('app_icon_built_for')(`${k}|${bg}|${fill}`))
            }}
          >
            ↻ Apply colour & size
          </button>
        )}
        {(source || v('app_icon_key')) && (
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-rose-600"
            onClick={() => ['app_icon_source_key', 'app_icon_key', 'app_icon_192_key', 'app_icon_maskable_key', 'app_icon_built_for'].forEach((k) => set(k)(''))}
          >
            Use the built-in icon
          </button>
        )}
      </div>
      {stale && <p className="text-xs font-semibold text-amber-700">You changed the colour or size — click “Apply colour & size”, then Save changes.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField label="Icon background" value={bg} onChange={set('app_icon_bg')} />
        <label className="block">
          <span className="label">Logo size inside the icon: {Math.round(fill * 100)}%</span>
          <input type="range" min={40} max={100} value={Math.round(fill * 100)} onChange={(e) => set('app_icon_fill')(e.target.value)} className="w-full accent-[var(--color-accent-500)]" />
        </label>
      </div>
      <p className="text-xs text-slate-500">
        Any logo works — wide or square, PNG or JPG. We make the exact sizes phones need. Pick a background that matches the logo (black for a gold logo, for example).
      </p>
      {error && <p className="text-xs text-rose-600">{error}</p>}

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          setError('')
          try {
            const fd = new FormData()
            fd.append('file', file)
            const res = await uploadMedia({ data: fd })
            if (!res.ok) throw new Error(res.error)
            set('app_icon_source_key')(res.key)
            await build(URL.createObjectURL(file))
            set('app_icon_built_for')(`${res.key}|${bg}|${fill}`)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed.')
            setBusy(false)
          }
        }}
      />
    </div>
  )
}
