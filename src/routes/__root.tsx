import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { type ReactNode, useCallback, useState } from 'react'

const RootLayout = () => (
  <DeckNavigationFrame>
    <main className="flex flex-1 overflow-hidden">
      <Outlet />
    </main>
  </DeckNavigationFrame>
)

export const Route = createRootRoute({ component: RootLayout })

const DeckNavigationFrame = ({ children }: { children: ReactNode }) => {
  const [deckTitles, setDeckTitles] = useState<Record<string, string>>({})
  const deckMatch = useRouterState({
    select: (state) => state.matches.find((match) => match.routeId === '/decks/$deckId') ?? null,
  })

  const activeDeckId = deckMatch?.params?.deckId as string | undefined
  const deckTitle = activeDeckId ? deckTitles[activeDeckId] ?? `Deck ${activeDeckId}` : ''

  const handleDeckTitleChange = useCallback(
    (nextTitle: string) => {
      if (!activeDeckId) return
      setDeckTitles((prev) => ({ ...prev, [activeDeckId]: nextTitle }))
    },
    [activeDeckId],
  )

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <nav className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-1 items-center">
          {activeDeckId ? (
            <label className="w-full">
              <span className="sr-only">Slide deck title</span>
              <input
                aria-label="Slide deck title"
                value={deckTitle}
                onChange={(event) => handleDeckTitleChange(event.target.value)}
                className="w-full rounded-lg border border-transparent bg-white/80 px-3 py-2 text-lg font-semibold text-neutral-800 shadow-sm outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:ring-sky-400/30"
              />
            </label>
          ) : (
            <Link to="/" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Basic Slide Editor
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeDeckId && (
            <Link
              to="/decks/$deckId/presenter"
              params={{ deckId: activeDeckId }}
              className="rounded-lg border border-transparent bg-sky-600 px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 dark:hover:bg-sky-400"
            >
              Present
            </Link>
          )}
        </div>
      </nav>
      {children}
    </div>
  )
}
