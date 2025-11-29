import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Slide } from '../store'
import { SlideEditorCanvas } from './SlideEditorCanvas'
import { SLIDE_BASE_HEIGHT, SLIDE_BASE_WIDTH } from './slideDimensions'
import type { Editor } from '@tiptap/core'

const SLIDE_VERTICAL_GAP = 24
const VIEWPORT_PADDING = 32 // matches p-4 (16px * 2)

type SlideViewportProps = {
  slides: Slide[]
  activeSlideId: string | null
  onVisibleChange: (slideId: string) => void
  scaleOverride?: number | null
  isLoading?: boolean
  onActiveTextEditorChange?: (payload: { slideId: string; objectId: string; editor: Editor } | null) => void
  onSelectionChange?: (payload: { slideId: string; objectId: string | null }) => void
}

export function SlideViewport({
  slides,
  activeSlideId,
  onVisibleChange,
  scaleOverride = null,
  isLoading = false,
  onActiveTextEditorChange,
  onSelectionChange,
}: SlideViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const activeSlideIdRef = useRef<string | null>(activeSlideId)
  const syncingFromUrlRef = useRef(false)
  const syncTimeoutRef = useRef<number | null>(null)
  const measurementFrameRef = useRef<number | null>(null)
  const changeOriginRef = useRef<'external' | 'viewport'>('external')
  const panelRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })

  const registerPanelRef = useCallback((slideId: string, node: HTMLElement | null) => {
    const map = panelRefs.current
    if (!node) {
      map.delete(slideId)
    } else {
      map.set(slideId, node)
    }
  }, [])

  useEffect(() => {
    activeSlideIdRef.current = activeSlideId
  }, [activeSlideId])

  useEffect(() => {
    if (isLoading) return
    const viewport = viewportRef.current
    if (!viewport) return
    if (!activeSlideId) return
    const activePanel = panelRefs.current.get(activeSlideId)
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
  }, [activeSlideId, isLoading])

  useEffect(() => {
    if (isLoading) return
    const viewport = viewportRef.current
    if (!viewport) return

    const handleScroll = () => {
      if (syncingFromUrlRef.current) return
      if (measurementFrameRef.current !== null) return

      measurementFrameRef.current = requestAnimationFrame(() => {
        measurementFrameRef.current = null
        const nextSlideId = findClosestSlideId(viewport, panelRefs.current)
        if (nextSlideId && nextSlideId !== activeSlideIdRef.current) {
          changeOriginRef.current = 'viewport'
          onVisibleChange(nextSlideId)
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
  }, [slides, onVisibleChange, isLoading])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const measure = () => {
      const { clientWidth, clientHeight } = viewport

      setViewportSize({
        width: Math.max(clientWidth, 0),
        height: Math.max(clientHeight, 0),
      })
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(() => measure())
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [])

  const fitScale = useMemo(() => {
    if (!viewportSize.width || !viewportSize.height) return 1
    const maxWidth = Math.max(viewportSize.width - VIEWPORT_PADDING, 0)
    const maxHeight = Math.max(viewportSize.height - VIEWPORT_PADDING - SLIDE_VERTICAL_GAP, 0)
    const widthRatio = maxWidth / SLIDE_BASE_WIDTH
    const heightRatio = maxHeight / SLIDE_BASE_HEIGHT
    const nextScale = Math.min(widthRatio, heightRatio)
    return Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1
  }, [viewportSize])

  const slideScale = useMemo(() => {
    if (typeof scaleOverride === 'number' && Number.isFinite(scaleOverride) && scaleOverride > 0) {
      return scaleOverride
    }
    return fitScale
  }, [fitScale, scaleOverride])

  const scaledWidth = SLIDE_BASE_WIDTH * slideScale
  const scaledHeight = SLIDE_BASE_HEIGHT * slideScale

  const placeholderCount = 3
  const placeholderIndices = Array.from({ length: placeholderCount })
  const viewportOverflowClass = isLoading ? 'overflow-hidden' : 'overflow-auto'

  return (
    <div
      ref={viewportRef}
      className={`slide-viewport relative flex-1 min-w-0 rounded-lg border border-neutral-200 bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 ${viewportOverflowClass}`}
    >
      <div className="space-y-6 p-4 w-fit min-w-full min-h-full">
        {isLoading
          ? placeholderIndices.map((_, index) => (
              <div
                key={`placeholder-${index}`}
                className="slide-shell rounded-lg border border-neutral-200 bg-neutral-200/80 shadow-none animate-pulse dark:border-slate-800 dark:bg-slate-800/60"
                style={{ width: scaledWidth, height: scaledHeight }}
              />
            ))
          : slides.map((slide) => {
              const isActiveSlide = slide.id === activeSlideId
              return (
                <div
                  key={slide.id}
                  data-slide-id={slide.id}
                  ref={(node) => registerPanelRef(slide.id, node)}
                  onClick={() => {
                    changeOriginRef.current = 'viewport'
                    onVisibleChange(slide.id)
                  }}
                  className={`slide-shell rounded-lg border bg-white shadow-sm transition dark:bg-white ${
                    isActiveSlide
                      ? 'border-sky-500 ring-1 ring-sky-500 dark:border-sky-400 dark:ring-sky-400'
                      : 'border-neutral-200 dark:border-slate-800'
                  }`}
                  style={{ width: scaledWidth, height: scaledHeight }}
                >
                  <SlideEditorCanvas
                    slide={slide}
                    scale={slideScale}
                    onTextEditorFocusChange={onActiveTextEditorChange}
                    isActive={isActiveSlide}
                    onSelectedObjectChange={onSelectionChange}
                  />
                </div>
              )
            })}
      </div>
    </div>
  )
}

function findClosestSlideId(viewport: HTMLDivElement, panelRefs: Map<string, HTMLElement>): string | null {
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

export type { SlideViewportProps }
