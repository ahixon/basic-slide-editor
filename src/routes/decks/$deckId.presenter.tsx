import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SlideCanvas } from '../../components/SlideCanvas'
import { SLIDE_BASE_HEIGHT, SLIDE_BASE_WIDTH } from '../../components/slideDimensions'
import type { Slide } from '../../store'
import { useDeckState } from '../../store'
import { Expand } from 'lucide-react'
import { LiveblocksProvider, RoomProvider } from '@liveblocks/react'

type PresenterLoaderData = {
  deckId: string
}

export const Route = createFileRoute('/decks/$deckId/presenter')({
  loader: ({ params }): PresenterLoaderData => {
    return {
      deckId: params.deckId,
    }
  },
  component: PresenterConsole,
})

function PresenterConsole() {
  const { deckId } = Route.useLoaderData() as PresenterLoaderData

  return (
    <LiveblocksProvider publicApiKey={import.meta.env.VITE_LIVEBLOCKS_KEY}>
      <RoomProvider id={`deck-${deckId}`}>
        <PresenterRoom deckId={deckId} />
      </RoomProvider>
    </LiveblocksProvider>
  )
}

function PresenterRoom({ deckId }: { deckId: string }) {
  const { deck, isSynced } = useDeckState()
  const slidesById = deck?.slides ?? {}
  const slideOrder = deck?.slideOrder ?? []
  const slides = slideOrder.map((id) => slidesById[id]).filter((slide): slide is Slide => Boolean(slide))
  const resetKey = `${deckId}:${slideOrder.join(',')}`

  return <PresenterStage key={resetKey} slides={slides} isLoading={!isSynced} />
}

type PresenterStageProps = {
  slides: Slide[]
  isLoading?: boolean
}

function PresenterStage({ slides, isLoading = false }: PresenterStageProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement))

  useEffect(() => {
    const node = stageRef.current
    if (!node) return

    const measure = () => {
      const rect = node.getBoundingClientRect()
      setStageSize({ width: rect.width, height: rect.height })
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(() => measure())
    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  const handleAdvance = useCallback(() => {
    if (isLoading || !slides.length) return
    setActiveIndex((prev) => Math.min(prev + 1, slides.length - 1))
  }, [slides.length, isLoading])

  const handleRetreat = useCallback(() => {
    if (isLoading || !slides.length) return
    setActiveIndex((prev) => Math.max(prev - 1, 0))
  }, [slides.length, isLoading])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!slides.length) return

      const key = event.key
      const advanceKeys = key === 'ArrowRight' || key === 'ArrowDown'
      const retreatKeys = key === 'ArrowLeft' || key === 'ArrowUp'
      const spaceKey = key === ' ' || key === 'Spacebar'

      if (advanceKeys || spaceKey) {
        event.preventDefault()
        handleAdvance()
        return
      }

      if (retreatKeys) {
        event.preventDefault()
        handleRetreat()
      }
    }

    if (isLoading) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleAdvance, handleRetreat, slides.length, isLoading])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleEnterFullscreen = useCallback(() => {
    const element = stageRef.current
    if (!element || document.fullscreenElement) return
    element.requestFullscreen().catch(() => {
      // ignore failures
    })
  }, [])

  const slideScale = useMemo(() => {
    if (!stageSize.width || !stageSize.height) {
      return 0.5
    }
    const widthRatio = stageSize.width / SLIDE_BASE_WIDTH
    const heightRatio = stageSize.height / SLIDE_BASE_HEIGHT
    const nextScale = Math.min(widthRatio, heightRatio)
    return Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 0.5
  }, [stageSize])

  const activeSlide = slides[activeIndex]
  return (
    <div className="relative min-h-screen w-full bg-slate-100">
      {!isFullscreen && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end p-3">
          <button
            type="button"
            onClick={handleEnterFullscreen}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm font-semibold text-neutral-700 transition hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-sky-500"
          >
            <Expand />
          </button>
        </div>
      )}
      <div ref={stageRef} className="flex min-h-screen w-full items-center justify-center">
        {isLoading ? (
          <div
            className="border border-neutral-200 bg-neutral-200/80 shadow-sm animate-pulse dark:border-slate-800 dark:bg-slate-800/60"
            style={{
              width: SLIDE_BASE_WIDTH * slideScale,
              height: SLIDE_BASE_HEIGHT * slideScale,
            }}
          />
        ) : activeSlide ? (
          <SlideCanvas slide={activeSlide} scale={slideScale} rounded={false} />
        ) : (
          <div className="text-center text-slate-400">
            This deck does not have any slides yet.
          </div>
        )}
      </div>
    </div>
  )
}
