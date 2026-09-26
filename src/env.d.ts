// Types for the Cloudflare bindings declared in wrangler.toml.
// (You can also run `npm run cf-typegen` to generate these automatically.)
declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    MEDIA: R2Bucket
    SITE_ENV: string
    PAYSTACK_SECRET_KEY?: string
    RESEND_API_KEY?: string
    TERMII_API_KEY?: string
  }
}
