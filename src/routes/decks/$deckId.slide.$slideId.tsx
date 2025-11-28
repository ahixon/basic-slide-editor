import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { DeckObject, Slide } from '../../features/decks/editorState'
import { Route as DeckRoute } from './$deckId'
import type { DeckLoaderData } from './$deckId'
import { SlideSidebar } from '../../components/SlideSidebar'
import { SlideToolbar } from '../../components/SlideToolbar'
import { SlideViewport } from '../../components/SlideViewport'

export const Route = createFileRoute('/decks/$deckId/slide/$slideId')({
  component: SlideEditor,
})

function generateId(seed: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${seed}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`
}

function SlideEditor() {
  const { deckId, slideId } = Route.useParams()
  const navigate = Route.useNavigate()
  const { deck } = DeckRoute.useLoaderData() as DeckLoaderData
  const initialSlides = useMemo(() => deck.slides ?? [], [deck])
  const [slides, setSlides] = useState<Slide[]>(initialSlides)
  const [zoomOverride, setZoomOverride] = useState<number | null>(null)

  useEffect(() => {
    setSlides(initialSlides)
  }, [initialSlides])

  const activeId = slideId ?? slides[0]?.id ?? ''

  const handleSidebarSelect = useCallback(
    (nextId: string) => {
      if (!nextId || nextId === activeId) return
      navigate({
        to: '/decks/$deckId/slide/$slideId',
        params: { deckId, slideId: nextId },
        replace: false,
      })
    },
    [activeId, deckId, navigate],
  )

  const updateVisibleSlide = useCallback(
    (nextVisibleId: string) => {
      if (!nextVisibleId || nextVisibleId === activeId) return
      navigate({
        to: '/decks/$deckId/slide/$slideId',
        params: { deckId, slideId: nextVisibleId },
        replace: true,
      })
    },
    [activeId, deckId, navigate],
  )

  const handleAddSlide = useCallback(() => {
    const newSlide: Slide = {
      id: generateId('slide'),
      objects: [
        {
          id: generateId('text'),
          type: 'text',
          x: 96,
          y: 96,
          text: 'Describe your idea...',
          width: 520,
        },
      ],
    }

    setSlides([...slides, newSlide])
    navigate({
      to: '/decks/$deckId/slide/$slideId',
      params: { deckId, slideId: newSlide.id },
      replace: false,
    })
  }, [deckId, navigate, slides])

  const handleDeleteSlide = useCallback(() => {
    if (slides.length <= 1) return
    const removalIndex = slides.findIndex((slide) => slide.id === activeId)
    if (removalIndex === -1) return

    const nextSlides = slides.filter((slide) => slide.id !== activeId)
    setSlides(nextSlides)

    const fallbackSlide = nextSlides[removalIndex] ?? nextSlides[removalIndex - 1] ?? nextSlides[0]
    const fallbackId = fallbackSlide?.id ?? ''

    if (fallbackId) {
      navigate({
        to: '/decks/$deckId/slide/$slideId',
        params: { deckId, slideId: fallbackId },
        replace: true,
      })
    }
  }, [activeId, deckId, navigate, slides])

  const appendObjectToActiveSlide = useCallback(
    (object: DeckObject) => {
      if (!activeId) return
      setSlides((current) =>
        current.map((slide) =>
          slide.id === activeId ? { ...slide, objects: [...slide.objects, object] } : slide,
        ),
      )
    },
    [activeId],
  )

  const handleAddTextbox = useCallback(() => {
    appendObjectToActiveSlide({
      id: generateId('text'),
      type: 'text',
      x: 80,
      y: 80,
      text: 'New textbox',
      width: 360,
    })
  }, [appendObjectToActiveSlide])

  const handleAddImage = useCallback(() => {
    appendObjectToActiveSlide({
      id: generateId('image'),
      type: 'image',
      x: 280,
      y: 200,
      src: '/images/placeholder.png',
      width: 240,
      height: 160,
    })
  }, [appendObjectToActiveSlide])
  if (!slides.length || !activeId) {
    return (
      <section className="bg-slate-50 p-4 dark:bg-slate-950">
        <div className="rounded border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-slate-700 dark:text-slate-300">
          There are no slides for this deck yet.
        </div>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden bg-slate-50 p-4 dark:bg-slate-950">
      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:min-w-0">
        <div className="slide-sidebar flex min-h-0 flex-col md:w-60 md:min-w-[240px] md:max-w-[240px]">
          <SlideSidebar
            slides={slides}
            activeId={activeId}
            onSelect={handleSidebarSelect}
            onAddSlide={handleAddSlide}
            onDeleteSlide={handleDeleteSlide}
            canDeleteSlide={slides.length > 1}
          />
        </div>
        <div className="flex flex-1 min-h-0 min-w-0 flex-col gap-3">
          <SlideToolbar
            onAddTextbox={handleAddTextbox}
            onAddImage={handleAddImage}
            zoomOverride={zoomOverride}
            onZoomOverrideChange={setZoomOverride}
          />
          <div className="flex flex-1 min-h-0 min-w-0">
            <SlideViewport
              slides={slides}
              activeId={activeId}
              onVisibleChange={updateVisibleSlide}
              scaleOverride={zoomOverride}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

