import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { LiveblocksProvider, RoomProvider } from '@liveblocks/react'

import { DeckNavigationFrame } from '../components/DeckNavigationFrame'

const RootLayout = () => {
  const isPresenterRoute = useRouterState({
    select: (state) => state.matches.some((match) => match.routeId === '/decks/$deckId/presenter'),
  })
  const deckMatch = useRouterState({
    select: (state) => state.matches.find((match) => match.routeId === '/decks/$deckId') ?? null,
  })
  const activeDeckId = deckMatch?.params?.deckId as string | undefined

  const content = (
    <main className="flex flex-1 overflow-hidden">
      <Outlet />
    </main>
  )

  if (isPresenterRoute) {
    return content
  }

  if (activeDeckId) {
    return (
      <LiveblocksProvider publicApiKey={import.meta.env.VITE_LIVEBLOCKS_KEY}>
        <RoomProvider id={`deck-${activeDeckId}`}>
          <DeckNavigationFrame>{content}</DeckNavigationFrame>
        </RoomProvider>
      </LiveblocksProvider>
    )
  }

  return <DeckNavigationFrame>{content}</DeckNavigationFrame>
}

export const Route = createRootRoute({ component: RootLayout })
