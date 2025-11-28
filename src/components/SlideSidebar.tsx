import { useCallback, useEffect, useRef, useState } from 'react'

import type { Slide } from '../features/decks/editorState'
import { SlideCanvas } from './SlideCanvas'
import { SLIDE_BASE_HEIGHT, SLIDE_BASE_WIDTH } from './slideDimensions'
import { Minus, Plus } from 'lucide-react'

const parsePixels = (value: string) => {
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

type SlideSidebarProps = {
  slides: Slide[]
  activeId: string
  onSelect: (slideId: string) => void
  onAddSlide: () => void
  onDeleteSlide: () => void
  canDeleteSlide: boolean
}

export function SlideSidebar({
  slides,
  activeId,
  onSelect,
  onAddSlide,
  onDeleteSlide,
  canDeleteSlide,
}: SlideSidebarProps) {
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const listRef = useRef<HTMLDivElement | null>(null)
  const [previewScale, setPreviewScale] = useState(0)

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const measure = () => {
      const rect = list.getBoundingClientRect()
      const styles = window.getComputedStyle(list)
      const paddingX = parsePixels(styles.paddingLeft) + parsePixels(styles.paddingRight)
      const buttonWidth = Math.max(rect.width - paddingX, 0)
      const availableWidth = Math.max(buttonWidth, 0)
      const nextScale = availableWidth > 0 ? Math.min(availableWidth / SLIDE_BASE_WIDTH, 1) : 0
      setPreviewScale(nextScale)
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(() => measure())
    observer.observe(list)

    return () => observer.disconnect()
  }, [])

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
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/80">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-300">Slides</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddSlide}
            className="rounded-sm border border-neutral-300 px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 transition hover:bg-neutral-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Plus size={16} />
          </button>
          {canDeleteSlide && (
            <button
              type="button"
              onClick={onDeleteSlide}
              className="rounded-sm border border-neutral-300 px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 transition hover:bg-red-50 hover:border-red-300 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-900"
            >
              <Minus size={16} />
            </button>
          )}
        </div>
      </div>
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2 bg-neutral-50 dark:bg-slate-900">
        {slides.map((slide) => {
          const isActive = slide.id === activeId
          const previewDimensions =
            previewScale > 0
              ? {
                  width: SLIDE_BASE_WIDTH * previewScale,
                  height: SLIDE_BASE_HEIGHT * previewScale,
                }
              : undefined

          return (
            <button
              key={slide.id}
              type="button"
              ref={(node) => registerButtonRef(slide.id, node)}
              onClick={() => onSelect(slide.id)}
              className={`w-full overflow-hidden rounded-md border transition ${
                isActive
                  ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-500/10 dark:text-sky-200'
                  : 'bg-neutral-50 text-neutral-700 dark:bg-slate-900 dark:text-slate-200 border-neutral-200 hover:border-neutral-300 dark:hover:bg-slate-800'
              }`}
              style={previewDimensions}
            >
              {previewScale > 0 ? <SlideCanvas slide={slide} scale={previewScale} /> : null}
            </button>
          )
        })}
      </div>
    </aside>
  )
}

export type { SlideSidebarProps }
