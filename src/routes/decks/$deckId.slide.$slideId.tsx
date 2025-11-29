import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'

import { SlideEditorView } from '../../components/SlideEditorView'
import { LiveblocksProvider, RoomProvider } from '@liveblocks/react'
import { useDeckStore } from '../../store'

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

  const {
    liveblocks: { enterRoom, leaveRoom },
  } = useDeckStore();

  useEffect(() => {
    enterRoom(`deck-${deckId}`);
    return () => {
      leaveRoom();
    };
  }, [deckId, enterRoom, leaveRoom]);

  return (
    <LiveblocksProvider publicApiKey={import.meta.env.VITE_LIVEBLOCKS_KEY}>
      <RoomProvider id={`deck-${deckId}`}>
        <SlideEditorView
          slideId={slideId}
          navigateToSlide={navigateToSlide}
          navigateToDeckRoot={navigateToDeckRoot}
        />
      </RoomProvider>
    </LiveblocksProvider>
  )
}

