import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import type { DeckObject, Slide } from '../store'
import { useDeckActions } from '../store'
import { useRoom } from '@liveblocks/react'
import { SlideObjectElement } from './SlideObjectElement'
import { SLIDE_BASE_HEIGHT, SLIDE_BASE_WIDTH } from './slideDimensions'

type SlideEditorCanvasProps = {
  slide: Slide
  scale?: number
  className?: string
  style?: CSSProperties
  rounded?: boolean
}

type DragState = {
  objectId: string
  pointerId: number
  offsetX: number
  offsetY: number
  activated: boolean
  startClientX: number
  startClientY: number
  captured: boolean
}

const DRAG_ACTIVATION_DISTANCE = 4

export function SlideEditorCanvas({
  slide,
  scale = 1,
  className = '',
  style,
  rounded = true,
}: SlideEditorCanvasProps) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [focusedObjectId, setFocusedObjectId] = useState<string | null>(null)
  const { updateObjectPosition } = useDeckActions()
  const room = useRoom()
  const historyPausedRef = useRef(false)

  const scaledWidth = SLIDE_BASE_WIDTH * scale
  const scaledHeight = SLIDE_BASE_HEIGHT * scale
  const roundedShellClass = rounded ? 'rounded-[32px] shadow-inner' : ''

  const activeObjectId = dragState?.activated ? dragState.objectId : focusedObjectId

  const getPointerPosition = useCallback(
    (clientX: number, clientY: number) => {
      const node = contentRef.current
      if (!node) return null
      if (!scale || Number.isNaN(scale)) return null

      const rect = node.getBoundingClientRect()
      const relativeX = (clientX - rect.left) / scale
      const relativeY = (clientY - rect.top) / scale
      return { x: relativeX, y: relativeY }
    },
    [scale],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return

      let currentState = dragState
      if (!dragState.activated) {
        const distance = Math.hypot(
          event.clientX - dragState.startClientX,
          event.clientY - dragState.startClientY,
        )
        if (distance < DRAG_ACTIVATION_DISTANCE) {
          return
        }

        if (!historyPausedRef.current) {
          room?.history.pause()
          historyPausedRef.current = true
        }

        if (!dragState.captured) {
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
            currentState = { ...dragState, activated: true, captured: true }
          } catch {
            currentState = { ...dragState, activated: true }
          }
        } else {
          currentState = { ...dragState, activated: true }
        }
        setDragState(currentState)
      }

      const coords = getPointerPosition(event.clientX, event.clientY)
      if (!coords) return

      event.preventDefault()
      updateObjectPosition(slide.id, currentState.objectId, {
        x: coords.x - currentState.offsetX,
        y: coords.y - currentState.offsetY,
      })
    },
    [dragState, getPointerPosition, room, slide.id, updateObjectPosition],
  )

  const endDrag = useCallback(() => {
    if (historyPausedRef.current) {
      room?.history.resume()
      historyPausedRef.current = false
    }
    setDragState(null)
  }, [room])

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return
      if (dragState.activated) {
        event.preventDefault()
      }
      if (dragState.captured) {
        try {
          ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
        } catch {
          // Ignore release failures when capture was already lost
        }
      }
      endDrag()
    },
    [dragState, endDrag],
  )

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return
      if (dragState.captured) {
        try {
          ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
        } catch {
          // Ignore release failures when capture was already lost
        }
      }
      endDrag()
    },
    [dragState, endDrag],
  )

  const createPointerDownHandler = useCallback(
    (object: DeckObject) =>
      (event: React.PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return
        const isObjectActive = activeObjectId === object.id
        const clickedEditorContent = (() => {
          if (object.type !== 'text') return false
          if (!isObjectActive) return false
          if (!(event.target instanceof Element)) return false
          const editorRoot = event.target.closest(
            '[data-slide-text-editor="true"], [contenteditable="true"], .ProseMirror',
          )
          return Boolean(editorRoot)
        })()

        const coords = getPointerPosition(event.clientX, event.clientY)
        if (!coords) return

        event.stopPropagation()

        if (!clickedEditorContent) {
          event.preventDefault()
        }

        setFocusedObjectId(object.id)

        let captured = false
        if (!clickedEditorContent) {
          try {
            // Capture immediately so quick drags keep delivering pointer events.
            ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
            captured = true
          } catch {
            captured = false
          }
        }

        setDragState({
          objectId: object.id,
          pointerId: event.pointerId,
          offsetX: coords.x - object.x,
          offsetY: coords.y - object.y,
          activated: !clickedEditorContent,
          startClientX: event.clientX,
          startClientY: event.clientY,
          captured,
        })
      },
    [activeObjectId, getPointerPosition],
  )

  const handleObjectFocus = useCallback((objectId: string) => {
    setFocusedObjectId(objectId)
  }, [])

  const handleObjectBlur = useCallback((objectId: string) => {
    setFocusedObjectId((current) => (current === objectId ? null : current))
  }, [])

  const handleCanvasPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setFocusedObjectId(null)
    }
  }, [])

  useEffect(() => {
    if (!focusedObjectId) return
    if (!slide.objects.some((object) => object.id === focusedObjectId)) {
      // Safe to reset because this effect only responds to external slide changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusedObjectId(null)
    }
  }, [focusedObjectId, slide.objects])

  useEffect(() => {
    return () => {
      if (historyPausedRef.current) {
        room?.history.resume()
        historyPausedRef.current = false
      }
    }
  }, [room])

  return (
    <article
      className={`slide-editor-canvas relative overflow-hidden ${roundedShellClass} bg-white text-left text-slate-900 ${className}`}
      style={{
        width: scaledWidth,
        height: scaledHeight,
        ...style,
      }}
    >
      <div
        ref={contentRef}
        className="relative"
        onPointerDown={handleCanvasPointerDown}
        style={{
          width: SLIDE_BASE_WIDTH,
          height: SLIDE_BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {slide.objects.map((object) => {
          const isActive = activeObjectId === object.id
          const selectionClass = object.type === 'text' ? 'select-text' : 'select-none'
          return (
            <SlideObjectElement
              key={object.id}
              object={object}
              slideId={slide.id}
              scale={scale}
              enableTextScaling={object.type === 'text'}
              isSelected={isActive}
              onPointerDown={createPointerDownHandler(object)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              className={`${isActive ? 'cursor-grabbing' : 'cursor-grab'} ${selectionClass}`}
              style={{ touchAction: 'none' }}
              onFocusObject={handleObjectFocus}
              onBlurObject={handleObjectBlur}
            />
          )
        })}
        {!slide.objects.length && (
          <div className={`absolute inset-0 flex items-center justify-center border-2 border-dashed border-slate-200 text-xl font-semibold uppercase tracking-wide text-slate-300 ${rounded ? 'rounded-2xl' : ''}`}>
            Drop objects to start designing
          </div>
        )}
      </div>
    </article>
  )
}

export type { SlideEditorCanvasProps }
