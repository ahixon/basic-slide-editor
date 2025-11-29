import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'

import { SlideEditorView } from '../../components/SlideEditorView'

export const Route = createFileRoute('/decks/$deckId/slide/$slideId')({
  component: SlideEditor,
})

function SlideEditor() {
  const { deckId, slideId } = Route.useParams()
  const navigate = Route.useNavigate()
  const navigateToSlide = useCallback(
    (nextSlideId: string, options?: { replace?: boolean }) => {
      navigate({
        to: '/decks/$deckId/slide/$slideId',
        params: { deckId, slideId: nextSlideId },
        replace: options?.replace ?? false,
      })
    },
    [deckId, navigate],
  )

  const navigateToDeckRoot = useCallback(
    (options?: { replace?: boolean }) => {
      navigate({
        to: '/decks/$deckId',
        params: { deckId },
        replace: options?.replace ?? false,
      })
    },
    [deckId, navigate],
  )

  return (
    <SlideEditorView
      slideId={slideId}
      navigateToSlide={navigateToSlide}
      navigateToDeckRoot={navigateToDeckRoot}
    />
  )
}

