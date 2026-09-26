// Cloudflare Worker entry. TanStack Start handles every request.
// (Phase 4 adds a `scheduled` handler here to send queued SMS/email notifications.)
import handler from '@tanstack/react-start/server-entry'

export default {
  fetch(request: Request) {
    return handler.fetch(request)
  },
}
