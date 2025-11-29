import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter, useNavigate } from '@tanstack/react-router'

import './index.css'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

const NotFoundView = () => {
  const navigate = useNavigate()

  const handleCreateDeck = () => {
    const deckId = generateDeckId()
    void navigate({
      to: '/decks/$deckId',
      params: { deckId },
    })
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Missing Deck</p>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Let's start a fresh deck</h1>
      <p className="max-w-md text-base text-slate-600 dark:text-slate-300">
        We couldn't find that page, but you can spin up a brand-new deck instantly and jump back into editing.
      </p>
      <button
        type="button"
        onClick={handleCreateDeck}
        className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
      >
        Create a new deck
      </button>
    </div>
  )
}

function generateDeckId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const randomSuffix = Math.round(Math.random() * 1_000_000)
  return `deck-${Date.now()}-${randomSuffix}`
}

// Create a new router instance
const router = createRouter({ routeTree, defaultNotFoundComponent: NotFoundView })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}