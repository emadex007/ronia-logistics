import { getRouteApi } from '@tanstack/react-router'
import type { Settings } from '~/lib/types'

const rootApi = getRouteApi('__root__')

/** Site settings loaded once by the root route (company name, logo, colours, contact…). */
export function useSiteSettings(): Settings {
  return (rootApi.useLoaderData() as { settings?: Settings } | undefined)?.settings ?? {}
}
