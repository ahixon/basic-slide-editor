import { Link, useRouterState } from '@tanstack/react-router'
import { type ReactNode, useCallback, useState } from 'react'

import type { Deck } from '../features/decks/editorState'
import { DeckTitleInput } from './DeckTitleInput'
import { Presentation } from 'lucide-react'

type DeckMatchLoaderData = {
  deckId: string
  deck: Deck
}

type DeckNavigationFrameProps = {
  children: ReactNode
}

export const DeckNavigationFrame = ({ children }: DeckNavigationFrameProps) => {
  const [deckTitles, setDeckTitles] = useState<Record<string, string>>({})

  const deckMatch = useRouterState({
    select: (state) => state.matches.find((match) => match.routeId === '/decks/$deckId') ?? null,
  })

  const activeDeckId = deckMatch?.params?.deckId as string | undefined
  const loaderData = deckMatch?.loaderData as DeckMatchLoaderData | undefined
  const loaderTitle = loaderData?.deck?.title ?? ''

  const fallbackTitle = activeDeckId ? `Deck ${activeDeckId}` : ''
  const deckTitle = activeDeckId ? deckTitles[activeDeckId] ?? loaderTitle ?? fallbackTitle : ''

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
            <DeckTitleInput value={deckTitle} onChange={handleDeckTitleChange} />
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
              className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm font-semibold text-neutral-700 transition hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-sky-500"
            >
              <Presentation />
            </Link>
          )}
        </div>
      </nav>
      {children}
    </div>
  )
}
