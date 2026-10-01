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
  const hex = (k: string, d: string) => (HEX.test(s[k] ?? '') ? s[k] : d)
  const num = (k: string, d: number, min: number, max: number) => {
    const n = Number(s[k])
    return Number.isFinite(n) && s[k] !== '' ? Math.min(max, Math.max(min, n)) : d
  }
  return `html{font-size:${num('base_font_size', 16, 14, 20)}px}
:root{
  --logo-h:${num('logo_height', 44, 24, 120)}px;
  --logo-name:${num('logo_name_size', 20, 12, 40)}px;
  --footer-bg:${hex('footer_bg', '#000000')};
  --footer-text:${hex('footer_text', '#cbd5e1')};
  --footer-heading:${hex('footer_heading', '#ffffff')};
  --container-6xl:${num('site_width', 1200, 960, 1600)}px;
  --header-bg:${hex('header_bg', '#000000')};
  --header-text:${hex('header_text', '#ffffff')};
  --header-h:${num('header_height', 76, 56, 120)}px;
  --btn-radius:${num('btn_radius', 10, 0, 30)}px;
  --btn-p-bg:${hex('btn_primary_bg', p)};
  --btn-p-text:${hex('btn_primary_text', '#ffffff')};
  --btn-p-hover:${hex('btn_primary_hover', mix(p, 'white', 12))};
  --btn-a-bg:${hex('btn_accent_bg', a)};
  --btn-a-text:${hex('btn_accent_text', '#ffffff')};
  --btn-a-hover:${hex('btn_accent_hover', mix(a, 'black', 12))};
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
  { key: 'youtube', label: 'YouTube' },
] as const

/** Is a #rrggbb colour dark? (decides light/dark logo and text on the header) */
export function isDark(hex: string | undefined) {
  if (!hex || !HEX.test(hex)) return true
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b < 150
}

export const COLOR_KEYS = ['primary_color', 'accent_color', 'header_bg', 'header_text', 'btn_primary_bg', 'btn_primary_text', 'btn_primary_hover', 'btn_accent_bg', 'btn_accent_text', 'btn_accent_hover', 'footer_bg', 'footer_text', 'footer_heading']
export const NUMBER_KEYS: Record<string, [number, number]> = {
  site_width: [960, 1600],
  header_height: [56, 120],
  hero_height: [0, 100],
  btn_radius: [0, 30],
  logo_height: [24, 120],
  logo_name_size: [12, 40],
  base_font_size: [14, 20],
}

/** Every key the Website editor is allowed to change. */
export const EDITABLE_KEYS = [
  'company_name', 'tagline', 'seo_description', 'logo_key', 'favicon_key', 'primary_color', 'accent_color',
  'hero_badge', 'hero_title', 'hero_subtitle', 'hero_media_type', 'hero_image', 'hero_video', 'hero_cta_label', 'stats_json',
  'services_title', 'services_subtitle', 'services_json', 'steps_title', 'steps_json',
  'about_title', 'about_body', 'about_image', 'about_points_json',
  'merchant_title', 'merchant_body', 'merchant_image',
  'gallery_title', 'gallery_json', 'faq_json', 'cta_title', 'cta_body',
  'phone', 'whatsapp', 'email', 'address', 'office_hours', 'map_query',
  'facebook', 'instagram', 'x_twitter', 'tiktok', 'linkedin', 'youtube',
  'receipt_footer', 'tracking_prefix',
  'header_bg', 'header_text', 'header_height', 'site_width', 'hero_height',
  'btn_primary_bg', 'btn_primary_text', 'btn_primary_hover', 'btn_accent_bg', 'btn_accent_text', 'btn_accent_hover', 'btn_radius',
  'logo_height', 'logo_show_name', 'logo_name_size', 'base_font_size',
  'footer_bg', 'footer_text', 'footer_heading', 'footer_about', 'footer_copyright', 'footer_show_logo',
  'chat_enabled', 'chat_title', 'chat_greeting', 'contact_form_title',
  'app_icon_key', 'app_name', 'app_short_name', 'app_icon_source_key', 'app_icon_192_key', 'app_icon_maskable_key', 'app_icon_bg', 'app_icon_fill', 'app_icon_built_for', 'site_url', 'email_from', 'notify_email', 'email_office_on', 'email_customers_on', 'email_merchants_on', 'forward_email_to',
] as const
