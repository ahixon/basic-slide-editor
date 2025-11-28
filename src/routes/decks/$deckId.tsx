import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'

import type { Deck } from '../../features/decks/editorState'
import { getDeck } from '../../features/decks/editorState'

export type DeckLoaderData = {
  deckId: string
  deck: Deck
}

export const Route = createFileRoute('/decks/$deckId')({
  loader: ({ params }): DeckLoaderData => {
    const deck =
      getDeck(params.deckId) ?? {
        id: params.deckId,
        title: 'Untitled Deck',
        slides: [],
      }

    return {
      deckId: params.deckId,
      deck,
    }
  },
  component: DeckRouteShell,
})

function DeckRouteShell() {
  const { deckId } = Route.useParams()
  const { deck } = Route.useLoaderData() as DeckLoaderData
  const navigate = Route.useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const slides = useMemo(() => deck.slides ?? [], [deck])

  useEffect(() => {
    if (!slides.length) return
    const deckRoot = `/decks/${deckId}`
    const atDeckRoot = pathname === deckRoot || pathname === `${deckRoot}/`
    if (atDeckRoot) {
      navigate({
        to: '/decks/$deckId/slide/$slideId',
        params: { deckId, slideId: slides[0].id },
        replace: true,
      })
    }
  }, [deckId, slides, pathname, navigate])

  return <Outlet />
}
