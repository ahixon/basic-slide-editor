import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EditorView } from 'prosemirror-view'

import type { DeckObject, Slide } from '../store'
import { useDeckDocument } from '../store'
import { SlideSidebar } from './SlideSidebar'
import { SlideToolbar } from './SlideToolbar'
import { SlideViewport } from './SlideViewport'
import type { TextEditorHandle } from '../textEditor'

type NavigateOptions = {
  replace?: boolean
}

type SlideEditorViewProps = {
  slideId?: string
  navigateToSlide: (slideId: string, options?: NavigateOptions) => void
  navigateToDeckRoot: (options?: NavigateOptions) => void
}

type ActiveTextEditor = {
  slideId: string
  objectId: string
  editor: TextEditorHandle
}

type SelectedObject = {
  slideId: string
  objectId: string
}

function generateId(seed: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${seed}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`
}

export function SlideEditorView({
  slideId,
  navigateToSlide,
  navigateToDeckRoot,
}: SlideEditorViewProps) {
  const {
    deck,
    addSlide,
    deleteSlide,
    appendObjectToSlide,
    deleteObjectFromSlide,
    updateImageObjectSource,
    isSynced,
  } = useDeckDocument()
  const { slides: slidesById, slideOrder } = deck
  const orderedSlides = useMemo(
    () => slideOrder.map((id) => slidesById[id]).filter((slide): slide is Slide => Boolean(slide)),
    [slideOrder, slidesById],
  )
  const totalSlides = slideOrder.length
  const isStorageLoading = !isSynced
  const [zoomOverride, setZoomOverride] = useState<number | null>(null)
  const [activeTextEditor, setActiveTextEditor] = useState<ActiveTextEditor | null>(null)
  const [selectedObject, setSelectedObject] = useState<SelectedObject | null>(null)

  const activeSlideId = useMemo(() => {
    if (!totalSlides) return null
    if (slideId && slidesById[slideId]) {
      return slideId
    }
    return slideOrder[0] ?? null
  }, [slideId, slideOrder, slidesById, totalSlides])

  useEffect(() => {
    if (!totalSlides) return
    if (slideId && slidesById[slideId]) return
    const fallbackId = slideOrder[0]
    if (!fallbackId) return
    navigateToSlide(fallbackId, { replace: true })
  }, [slideId, slideOrder, slidesById, totalSlides, navigateToSlide])

  const handleSidebarSelect = useCallback(
    (nextSlideId: string) => {
      if (!activeSlideId || nextSlideId === activeSlideId) return
      navigateToSlide(nextSlideId, { replace: false })
    },
    [activeSlideId, navigateToSlide],
  )

  const updateVisibleSlide = useCallback(
    (nextVisibleSlideId: string) => {
      if (!activeSlideId || nextVisibleSlideId === activeSlideId) return
      navigateToSlide(nextVisibleSlideId, { replace: true })
    },
    [activeSlideId, navigateToSlide],
  )

  const handleAddSlide = useCallback(() => {
    const newSlide: Slide = {
      id: generateId('slide'),
      objects: [],
    }

    const createdSlide = addSlide(newSlide)
    navigateToSlide(createdSlide.id, { replace: false })
  }, [addSlide, navigateToSlide])

  const handleDeleteSlide = useCallback(() => {
    if (totalSlides < 1 || !activeSlideId) return
    const fallbackSlide = deleteSlide(activeSlideId)
    if (fallbackSlide) {
      navigateToSlide(fallbackSlide.id, { replace: true })
    } else {
      navigateToDeckRoot({ replace: true })
    }
  }, [activeSlideId, deleteSlide, navigateToDeckRoot, navigateToSlide, totalSlides])

  const appendObjectToActiveSlide = useCallback(
    (object: DeckObject) => {
      if (!activeSlideId) return
      appendObjectToSlide(activeSlideId, object)
    },
    [activeSlideId, appendObjectToSlide],
  )

  const handleAddTextbox = useCallback(() => {
    appendObjectToActiveSlide({
      id: generateId('text'),
      type: 'text',
      x: 80,
      y: 80,
      text: 'Click to edit text',
      // width: 360,
      scale: 5,
    })
  }, [appendObjectToActiveSlide])

  const handleAddImage = useCallback(() => {
    appendObjectToActiveSlide({
      id: generateId('image'),
      type: 'image',
      x: 280,
      y: 200,
      width: 240,
      height: 160,
    })
  }, [appendObjectToActiveSlide])

  const handleActiveTextEditorChange = useCallback((payload: ActiveTextEditor | null) => {
    setActiveTextEditor(payload)
  }, [])

  const handleSelectionChange = useCallback(
    ({ slideId: sourceSlideId, objectId }: { slideId: string; objectId: string | null }) => {
      setSelectedObject((current) => {
        if (objectId) {
          if (sourceSlideId !== activeSlideId) {
            return current
          }
          return { slideId: sourceSlideId, objectId }
        }
        if (current?.slideId === sourceSlideId) {
          return null
        }
        return current
      })
    },
    [activeSlideId],
  )

  useEffect(() => {
    if (!activeTextEditor) return
    if (
      selectedObject &&
      selectedObject.slideId === activeTextEditor.slideId &&
      selectedObject.objectId === activeTextEditor.objectId
    ) {
      return
    }
    const view = activeTextEditor.editor.view
    if (!view || isEditorViewDestroyed(view)) return
    view.dom.blur()
  }, [activeTextEditor, selectedObject])

  const selectedImage = useMemo(() => {
    if (!selectedObject) return null
    const slide = slidesById[selectedObject.slideId]
    if (!slide) return null
    const object = slide.objects.find((item) => item.id === selectedObject.objectId)
    if (!object || object.type !== 'image') return null
    return { slideId: selectedObject.slideId, object }
  }, [selectedObject, slidesById])

  const handleSaveSelectedImageSrc = useCallback(
    (src: string) => {
      if (!selectedImage) return
      const normalized = src.trim()
      if (!normalized) return
      updateImageObjectSource(selectedImage.slideId, selectedImage.object.id, normalized)
    },
    [selectedImage, updateImageObjectSource],
  )

  const handleDeleteSelectedObject = useCallback(() => {
    if (!selectedObject) return
    if (selectedObject.slideId !== activeSlideId) return
    deleteObjectFromSlide(selectedObject.slideId, selectedObject.objectId)
    setSelectedObject(null)
  }, [activeSlideId, deleteObjectFromSlide, selectedObject])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const wantsDelete = event.key === 'Delete' || event.key === 'Backspace'
      if (!wantsDelete) return

      const target = event.target as HTMLElement | null
      if (target) {
        const tagName = target.tagName
        const isEditable = tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable
        if (isEditable) return
      }

      if (activeTextEditor?.editor?.view.hasFocus()) return
      if (!selectedObject || selectedObject.slideId !== activeSlideId) return

      event.preventDefault()
      handleDeleteSelectedObject()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSlideId, activeTextEditor, handleDeleteSelectedObject, selectedObject])

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden bg-slate-50 p-4 dark:bg-slate-950">
      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:min-w-0">
        <div className="slide-sidebar flex min-h-0 flex-col md:w-60 md:min-w-[240px] md:max-w-[240px]">
          {isStorageLoading ? (
            <SlideSidebarFallback />
          ) : (
            <SlideSidebar
              slides={orderedSlides}
              activeSlideId={activeSlideId}
              onSelect={handleSidebarSelect}
              onAddSlide={handleAddSlide}
              onDeleteSlide={handleDeleteSlide}
              canDeleteSlide={orderedSlides.length >= 1}
            />
          )}
        </div>
        <div className="flex flex-1 min-h-0 min-w-0 flex-col gap-3">
          <SlideToolbar
            onAddTextbox={handleAddTextbox}
            onAddImage={handleAddImage}
            zoomOverride={zoomOverride}
            onZoomOverrideChange={setZoomOverride}
            activeTextEditor={activeTextEditor?.editor ?? null}
            onDeleteSelectedObject={selectedObject ? handleDeleteSelectedObject : undefined}
            canDeleteObject={Boolean(selectedObject)}
            canAddObjects={Boolean(activeSlideId)}
            selectedImage={selectedImage ? { id: selectedImage.object.id, src: selectedImage.object.src } : null}
            onSaveSelectedImageSrc={selectedImage ? handleSaveSelectedImageSrc : undefined}
          />
          <div className="flex flex-1 min-h-0 min-w-0">
            <SlideViewport
              slides={orderedSlides}
              activeSlideId={activeSlideId}
              onVisibleChange={updateVisibleSlide}
              scaleOverride={zoomOverride}
              isLoading={isStorageLoading}
              onActiveTextEditorChange={handleActiveTextEditorChange}
              onSelectionChange={handleSelectionChange}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

const SlideSidebarFallback = () => (
  <div className="flex h-full animate-pulse flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <div className="h-11 border-b border-neutral-100 bg-neutral-100/80 dark:border-slate-800 dark:bg-slate-800/60" />
    <div className="flex-1 space-y-3 overflow-hidden bg-neutral-50 p-3 dark:bg-slate-950/60">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-20 rounded-md bg-white/80 dark:bg-slate-800/60" />
      ))}
    </div>
  </div>
)

function isEditorViewDestroyed(view: EditorView): boolean {
  return Boolean((view as EditorView & { destroyed?: boolean }).destroyed)
}
