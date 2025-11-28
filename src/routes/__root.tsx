import { createRootRoute, Outlet } from '@tanstack/react-router'

import { DeckNavigationFrame } from '../components/DeckNavigationFrame'

const RootLayout = () => (
  <DeckNavigationFrame>
    <main className="flex flex-1 overflow-hidden">
      <Outlet />
    </main>
  </DeckNavigationFrame>
)

export const Route = createRootRoute({ component: RootLayout })
