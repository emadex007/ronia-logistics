import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultErrorComponent: ({ error }) => (
      <div className="mx-auto max-w-xl p-10 text-center">
        <h1 className="text-xl font-bold text-rose-700">Something went wrong</h1>
        <p className="mt-2 text-slate-600">{error.message}</p>
        <a href="/" className="btn-ghost mt-6">
          Go home
        </a>
      </div>
    ),
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
