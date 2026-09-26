// Helpers for the editable website content (stored in the `settings` table).
import type { Settings } from './types'

/** A media value is either an uploaded R2 key or a full https URL. */
export function mediaUrl(v: string | null | undefined) {
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `/media/${v}`
}

export function jsonSetting<T>(s: Settings, key: string, fallback: T): T {
  try {
    const v = s[key]
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

export type Stat = { value: string; label: string }
export type Service = { title: string; description: string; image: string }
export type Step = { title: string; description: string }
export type Faq = { q: string; a: string }

export const HEX = /^#[0-9a-fA-F]{6}$/

/** CSS that re-colours the whole site from the two brand colours chosen in the admin. */
export function brandCss(s: Settings) {
  const p = HEX.test(s.primary_color ?? '') ? s.primary_color : '#0b2545'
  const a = HEX.test(s.accent_color ?? '') ? s.accent_color : '#f97316'
  const mix = (c: string, other: string, pct: number) => `color-mix(in oklab, ${c}, ${other} ${pct}%)`
  return `:root{
  --color-brand-950:${mix(p, 'black', 35)};
  --color-brand-900:${p};
  --color-brand-800:${mix(p, 'white', 10)};
  --color-brand-700:${mix(p, 'white', 22)};
  --color-brand-500:${mix(p, 'white', 40)};
  --color-brand-200:${mix(p, 'white', 70)};
  --color-brand-100:${mix(p, 'white', 85)};
  --color-brand-50:${mix(p, 'white', 93)};
  --color-accent-400:${mix(a, 'white', 20)};
  --color-accent-500:${a};
  --color-accent-600:${mix(a, 'black', 12)};
}`
}

export const SOCIALS = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'x_twitter', label: 'X (Twitter)' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'linkedin', label: 'LinkedIn' },
] as const

/** Every key the Website editor is allowed to change. */
export const EDITABLE_KEYS = [
  'company_name', 'tagline', 'seo_description', 'logo_key', 'favicon_key', 'primary_color', 'accent_color',
  'hero_badge', 'hero_title', 'hero_subtitle', 'hero_media_type', 'hero_image', 'hero_video', 'hero_cta_label', 'stats_json',
  'services_title', 'services_subtitle', 'services_json', 'steps_title', 'steps_json',
  'about_title', 'about_body', 'about_image', 'about_points_json',
  'merchant_title', 'merchant_body', 'merchant_image',
  'gallery_title', 'gallery_json', 'faq_json', 'cta_title', 'cta_body',
  'phone', 'whatsapp', 'email', 'address', 'office_hours', 'map_query',
  'facebook', 'instagram', 'x_twitter', 'tiktok', 'linkedin',
  'receipt_footer', 'tracking_prefix',
] as const
