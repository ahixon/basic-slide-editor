import { Link, useRouterState } from '@tanstack/react-router'
import { type ReactNode, useCallback } from 'react'

import { useDeckDocument } from '../store'
import { useOthers } from '@liveblocks/react'
import { DeckTitleInput } from './DeckTitleInput'
import { Presentation } from 'lucide-react'

type DeckNavigationFrameProps = {
  children: ReactNode
}

const avatarColors = ['bg-sky-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-indigo-500']

const getAvatarColor = (connectionId: number) =>
  avatarColors[Math.abs(connectionId) % avatarColors.length]

const getAvatarInitial = (connectionId: number) =>
  String.fromCharCode(65 + (Math.abs(connectionId) % 26))

export const DeckNavigationFrame = ({ children }: DeckNavigationFrameProps) => {
  const deckMatch = useRouterState({
    select: (state) => state.matches.find((match) => match.routeId === '/decks/$deckId') ?? null,
  })

  const activeDeckId = deckMatch?.params?.deckId as string | undefined
  const showDeckControls = Boolean(activeDeckId)

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <nav className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-1 items-center">
          {showDeckControls ? (
            <DeckTitleSection />
          ) : (
            <Link to="/" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Basic Slide Editor
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showDeckControls ? <DeckPresenceSection deckId={activeDeckId!} /> : null}
        </div>
      </nav>
      {children}
    </div>
  )
}

const DeckTitleInputFallback = () => (
  <div className="h-11 w-full animate-pulse rounded-lg bg-neutral-200/80 dark:bg-slate-800/80" />
)

const DeckTitleSection = () => {
  const { deck, isSynced, setDeckTitle } = useDeckDocument()
  const deckTitle = deck.title

  const handleDeckTitleChange = useCallback(
    (nextTitle: string) => {
      setDeckTitle(nextTitle)
    },
    [setDeckTitle],
  )

  if (!isSynced) {
    return <DeckTitleInputFallback />
  }

  return <DeckTitleInput value={deckTitle} onChange={handleDeckTitleChange} />
}

const DeckPresenceSection = ({ deckId }: { deckId: string }) => {
  const others = useOthers()

  return (
    <>
      {others.length > 0 && (
        <div className="flex items-center gap-1 pr-1">
          {others.map((other) => (
            <div
              key={other.connectionId}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm ${getAvatarColor(
                other.connectionId,
              )}`}
              title={`User ${other.connectionId}`}
              aria-label={`Connected user ${other.connectionId}`}
            >
              {getAvatarInitial(other.connectionId)}
            </div>
          ))}
        </div>
      )}
      <Link
        to="/decks/$deckId/presenter"
        params={{ deckId }}
        className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm font-semibold text-neutral-700 transition hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-sky-500"
      >
        <Presentation />
      </Link>
    </>
  )
}
