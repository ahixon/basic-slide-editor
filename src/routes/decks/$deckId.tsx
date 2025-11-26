import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'

import type { SlideMeta } from '../../features/decks/editorState'
import { DeckEditorStateProvider, buildMockSlides } from '../../features/decks/editorState'

type DeckLoaderData = {
  deckId: string
  slides: SlideMeta[]
}

export const Route = createFileRoute('/decks/$deckId')({
  loader: ({ params }): DeckLoaderData => ({
    deckId: params.deckId,
    slides: buildMockSlides(params.deckId),
  }),
  component: DeckRouteShell,
})

function DeckRouteShell() {
  const { deckId } = Route.useParams()
  const { slides } = Route.useLoaderData() as DeckLoaderData
  const navigate = Route.useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

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

  return (
    <DeckEditorStateProvider deckId={deckId}>
      <Outlet />
    </DeckEditorStateProvider>
  )
}
