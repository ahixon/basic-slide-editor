import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'

import { DeckNavigationFrame } from '../components/DeckNavigationFrame'

const RootLayout = () => {
  const isPresenterRoute = useRouterState({
    select: (state) => state.matches.some((match) => match.routeId === '/decks/$deckId/presenter'),
  })

  const content = (
    <main className="flex flex-1 overflow-hidden">
      <Outlet />
    </main>
  )

  if (isPresenterRoute) {
    return content
  }

  return <DeckNavigationFrame>{content}</DeckNavigationFrame>
}

export const Route = createRootRoute({ component: RootLayout })
