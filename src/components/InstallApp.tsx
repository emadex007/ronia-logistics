import { useEffect, useState } from 'react'
import { useSiteSettings } from './useSite'
import { mediaUrl } from '~/lib/site'

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

// The browser fires this once per page load; keep it globally so any button on the page can use it.
let deferred: PromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as PromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

export function useInstall() {
  const [, force] = useState(0)
  const [env, setEnv] = useState({ standalone: false, ios: false, ready: false })
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    const nav = navigator as Navigator & { standalone?: boolean }
    setEnv({
      standalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
      ios: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
      ready: true,
    })
    return () => {
      listeners.delete(l)
    }
  }, [])
  return {
    ...env,
    canPrompt: !!deferred,
    async install() {
      if (!deferred) return false
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      deferred = null
      return outcome === 'accepted'
    },
  }
}

/** "Install app" button. Android/Chrome: real install prompt. iPhone: shows Add-to-Home-Screen steps. Hidden once installed. */
export function InstallAppButton({ className = '', label = '📲 Install our app', alwaysShow = false }: { className?: string; label?: string; alwaysShow?: boolean }) {
  const app = useInstall()
  const [help, setHelp] = useState(false)
  if (!app.ready || app.standalone) return null
  if (!app.canPrompt && !app.ios && !alwaysShow) return null
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          if (app.canPrompt) await app.install()
          else setHelp(true)
        }}
      >
        {label}
      </button>
      {help && <InstallHelp ios={app.ios} onClose={() => setHelp(false)} />}
    </>
  )
}

export function InstallHelp({ ios, onClose }: { ios: boolean; onClose: () => void }) {
  const site = useSiteSettings()
  const icon = site.app_icon_key ? mediaUrl(site.app_icon_key) : '/icon-192.png'
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-slate-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <img src={icon} alt="" className="h-12 w-12 rounded-xl" />
          <p className="font-display text-lg font-bold text-brand-900">Install the app</p>
        </div>
        {ios ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Open this page in <b>Safari</b>.
            </li>
            <li>
              Tap the <b>Share</b> button{' '}
              <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-text-bottom text-sky-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              </svg>{' '}
              at the bottom of the screen.
            </li>
            <li>
              Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
            </li>
          </ol>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Open this page in <b>Chrome</b>.
            </li>
            <li>
              Tap the <b>⋮</b> menu at the top right.
            </li>
            <li>
              Tap <b>Install app</b> (or <b>Add to Home screen</b>), then <b>Install</b>.
            </li>
          </ol>
        )}
        <p className="mt-3 text-xs text-slate-500">The app icon appears on your home screen. It opens full screen, like any other app.</p>
        <button className="btn btn-primary mt-4 w-full" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  )
}
