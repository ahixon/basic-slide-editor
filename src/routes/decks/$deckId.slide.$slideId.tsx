import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { SlideMeta } from '../../features/decks/editorState'
import { Route as DeckRoute } from './$deckId'

export const Route = createFileRoute('/decks/$deckId/slide/$slideId')({
  component: SlideEditor,
})

function SlideEditor() {
  const { deckId, slideId } = Route.useParams()
  const navigate = Route.useNavigate()
  const { slides: initialSlides } = DeckRoute.useLoaderData()
  const [slides, setSlides] = useState<SlideMeta[]>(initialSlides)

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
    const newSlide: SlideMeta = {
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${deckId}-${Date.now()}`,
      title: `New Slide ${slides.length + 1}`,
      summary: 'Start outlining your story here.',
      presenterNotes: 'Add presenter notes to capture key talking points.',
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

  const handleAddTextbox = useCallback(() => {
    console.info('Add textbox tool coming soon')
  }, [])

  const handleAddImage = useCallback(() => {
    console.info('Add image tool coming soon')
  }, [])

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
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden md:flex-row">
        <div className="flex min-h-0 flex-col md:w-60 md:min-w-[240px] md:max-w-[240px]">
          <SlideSidebar
            slides={slides}
            activeId={activeId}
            onSelect={handleSidebarSelect}
            onAddSlide={handleAddSlide}
            onDeleteSlide={handleDeleteSlide}
            canDeleteSlide={slides.length > 1}
          />
        </div>
        <div className="flex flex-1 min-h-0 flex-col gap-3">
          <SlideToolbar onAddTextbox={handleAddTextbox} onAddImage={handleAddImage} />
          <div className="flex flex-1 min-h-0">
            <SlideViewport
              slides={slides}
              activeId={activeId}
              onVisibleChange={updateVisibleSlide}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

type SlideSidebarProps = {
  slides: SlideMeta[]
  activeId: string
  onSelect: (slideId: string) => void
  onAddSlide: () => void
  onDeleteSlide: () => void
  canDeleteSlide: boolean
}

function SlideSidebar({
  slides,
  activeId,
  onSelect,
  onAddSlide,
  onDeleteSlide,
  canDeleteSlide,
}: SlideSidebarProps) {
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const registerButtonRef = useCallback((slideId: string, node: HTMLButtonElement | null) => {
    const map = buttonRefs.current
    if (!node) {
      map.delete(slideId)
    } else {
      map.set(slideId, node)
    }
  }, [])

  useEffect(() => {
    const activeButton = buttonRefs.current.get(activeId)
    if (!activeButton) return
    activeButton.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeId])

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/80">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-300">Slides</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddSlide}
            className="rounded-full border border-sky-500 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700 transition hover:bg-sky-50 dark:border-sky-400 dark:text-sky-200 dark:hover:bg-sky-500/10"
          >
            Add
          </button>
          {canDeleteSlide && (
            <button
              type="button"
              onClick={onDeleteSlide}
              className="rounded-full border border-neutral-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 transition hover:bg-neutral-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {slides.map((slide, index) => {
          const isActive = slide.id === activeId
          return (
            <button
              key={slide.id}
              type="button"
              ref={(node) => registerButtonRef(slide.id, node)}
              onClick={() => onSelect(slide.id)}
              className={`w-full rounded-md border ${
                isActive
                  ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-500/10 dark:text-sky-200'
                  : 'border-transparent bg-neutral-50 text-neutral-700 hover:border-neutral-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700'
              } p-2 text-left transition`}
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                <span>Slide {index + 1}</span>
                {isActive && <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-200">Active</span>}
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{slide.title}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{slide.summary}</p>
              <div className="mt-2 h-20 rounded border border-dashed border-neutral-300 bg-white/70 dark:border-slate-700 dark:bg-slate-800/70" />
            </button>
          )
        })}
      </div>
    </aside>
  )
}

type SlideToolbarProps = {
  onAddTextbox: () => void
  onAddImage: () => void
}

function SlideToolbar({ onAddTextbox, onAddImage }: SlideToolbarProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddTextbox}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-sky-500"
        >
          <span className="text-xs font-bold text-sky-600 dark:text-sky-300">T</span>
          Textbox
        </button>
        <button
          type="button"
          onClick={onAddImage}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-sky-500"
        >
          <span className="text-xs font-bold text-sky-600 dark:text-sky-300">Img</span>
          Image
        </button>
      </div>
    </div>
  )
}

type SlideViewportProps = {
  slides: SlideMeta[]
  activeId: string
  onVisibleChange: (slideId: string) => void
}

function SlideViewport({ slides, activeId, onVisibleChange }: SlideViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const activeIdRef = useRef(activeId)
  const syncingFromUrlRef = useRef(false)
  const syncTimeoutRef = useRef<number | null>(null)
  const measurementFrameRef = useRef<number | null>(null)
  const changeOriginRef = useRef<'external' | 'viewport'>('external')
  const panelRefs = useRef<Map<string, HTMLElement>>(new Map())

  const registerPanelRef = useCallback((slideId: string, node: HTMLElement | null) => {
    const map = panelRefs.current
    if (!node) {
      map.delete(slideId)
    } else {
      map.set(slideId, node)
    }
  }, [])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const activePanel = panelRefs.current.get(activeId)
    if (!activePanel) return

    if (changeOriginRef.current === 'viewport') {
      changeOriginRef.current = 'external'
      return
    }

    syncingFromUrlRef.current = true
    const frame = requestAnimationFrame(() => {
      activePanel.scrollIntoView({ behavior: 'auto', block: 'center' })
      syncTimeoutRef.current = window.setTimeout(() => {
        syncingFromUrlRef.current = false
      }, 200)
    })

    return () => {
      cancelAnimationFrame(frame)
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }
    }
  }, [activeId])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const handleScroll = () => {
      if (syncingFromUrlRef.current) return
      if (measurementFrameRef.current !== null) return

      measurementFrameRef.current = requestAnimationFrame(() => {
        measurementFrameRef.current = null
        const nextId = findClosestSlideId(viewport, panelRefs.current)
        if (nextId && nextId !== activeIdRef.current) {
          changeOriginRef.current = 'viewport'
          onVisibleChange(nextId)
        }
      })
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      viewport.removeEventListener('scroll', handleScroll)
      if (measurementFrameRef.current !== null) {
        cancelAnimationFrame(measurementFrameRef.current)
        measurementFrameRef.current = null
      }
    }
  }, [slides, onVisibleChange])

  return (
    <div
      ref={viewportRef}
      className="slide-viewport relative flex-1 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="space-y-6">
        {slides.map((slide) => (
          <article
            key={slide.id}
            data-slide-id={slide.id}
            ref={(node) => registerPanelRef(slide.id, node)}
            onClick={() => {
              changeOriginRef.current = 'viewport'
              onVisibleChange(slide.id)
            }}
            className={`rounded-lg border bg-white shadow-sm transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 ${
              slide.id === activeId
                ? 'border-sky-400 ring-2 ring-sky-200 dark:border-sky-400 dark:ring-sky-400/40'
                : 'border-neutral-200 dark:border-slate-800'
            }`}
          >
            <div className="mt-4">
              <div className="aspect-[16/9] w-full from-white to-neutral-100 dark:from-slate-950 dark:to-slate-900">
                <div className="flex h-full w-full items-center justify-center p-10 text-center text-sm text-neutral-400 dark:text-slate-500">
                  Editable 1920×1080 slide surface placeholder.
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function findClosestSlideId(
  viewport: HTMLDivElement,
  panelRefs: Map<string, HTMLElement>,
): string | null {
  const viewportRect = viewport.getBoundingClientRect()
  const viewportCenter = viewportRect.top + viewportRect.height / 2

  let closestId: string | null = null
  let closestDistance = Number.POSITIVE_INFINITY

  panelRefs.forEach((panel, slideId) => {
    const rect = panel.getBoundingClientRect()
    const isVisible = rect.bottom >= viewportRect.top && rect.top <= viewportRect.bottom
    if (!isVisible) return

    const panelCenter = rect.top + rect.height / 2
    const distance = Math.abs(panelCenter - viewportCenter)
    if (distance < closestDistance) {
      closestDistance = distance
      closestId = slideId
    }
  })

  return closestId
}
