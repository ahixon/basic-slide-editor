import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { LiveblocksProvider, RoomProvider } from '@liveblocks/react'

import { useDeckStore } from '../../store'
import { SlideEditorView } from '../../components/SlideEditorView'

export type DeckLoaderData = {
  deckId: string
}

export const Route = createFileRoute('/decks/$deckId')({
  loader: ({ params }): DeckLoaderData => {
    return {
      deckId: params.deckId,
    }
  },
  component: DeckRouteShell,
})

function DeckRouteShell() {
  const { deckId } = Route.useParams()
  const deck = useDeckStore((state) => state.deck)
  const navigate = Route.useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const firstSlideId = deck?.slideOrder?.[0] ?? null
  const deckRoot = `/decks/${deckId}`
  const atDeckRoot = pathname === deckRoot || pathname === `${deckRoot}/`

  useEffect(() => {
    if (!atDeckRoot) return
    if (!firstSlideId) return
    navigate({
      to: '/decks/$deckId/slide/$slideId',
      params: { deckId, slideId: firstSlideId },
      replace: true,
    })
  }, [atDeckRoot, deckId, firstSlideId, navigate])

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

  if (atDeckRoot) {
    return (
      <LiveblocksProvider publicApiKey={import.meta.env.VITE_LIVEBLOCKS_KEY}>
        <RoomProvider id={`deck-${deckId}`}>
          <SlideEditorView
            navigateToSlide={navigateToSlide}
            navigateToDeckRoot={navigateToDeckRoot}
          />
        </RoomProvider >
      </LiveblocksProvider>
    )
  }

  return <Outlet />
}
