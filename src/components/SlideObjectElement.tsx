import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, HTMLAttributes, PointerEvent as ReactPointerEvent } from 'react'

import type { DeckObject, ImageObject, TextObject } from '../store'
import { MIN_TEXT_WIDTH, getTextFragmentKey, transactDeck, useDeckActions, useDeckRuntime, useDeckUndoManager } from '../store'
import { useRoom } from '@liveblocks/react'

import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { SharedCollaboration } from '../extensions/SharedCollaboration'
import * as Y from 'yjs'
import { GripVertical, Scaling } from 'lucide-react'

export type SlideObjectElementProps = {
  object: DeckObject
  slideId?: string
  scale?: number
  enableTextScaling?: boolean
  isSelected?: boolean
  onFocusObject?: (objectId: string) => void
  onBlurObject?: (objectId: string) => void
  onTextEditorFocusChange?: (payload: { objectId: string; editor: Editor } | null) => void
  textEditorMode?: 'editable' | 'readonly'
} & HTMLAttributes<HTMLElement>

export function SlideObjectElement({
  object,
  className = '',
  style,
  slideId,
  scale = 1,
  enableTextScaling = false,
  isSelected = false,
  onFocusObject,
  onBlurObject,
  onTextEditorFocusChange,
  textEditorMode = 'readonly',
  ...rest
}: SlideObjectElementProps) {
  if (object.type === 'text') {
    return (
      <SlideTextElement
        object={object}
        className={className}
        style={style}
        slideId={slideId}
        scale={scale}
        enableTextScaling={enableTextScaling}
        isSelected={isSelected}
        onFocusObject={onFocusObject}
        onBlurObject={onBlurObject}
        onTextEditorFocusChange={onTextEditorFocusChange}
        textEditorMode={textEditorMode}
        {...rest}
      />
    )
  }

  return (
    <SlideImageElement
      object={object}
      className={className}
      style={style}
      {...rest}
    />
  )
}

function SlideTextElement({
  object,
  className,
  style,
  slideId,
  scale = 1,
  enableTextScaling = false,
  isSelected = false,
  onFocusObject,
  onBlurObject,
  onTextEditorFocusChange,
  textEditorMode = 'readonly',
  ...rest
}: {
  object: TextObject
  className?: string
  style?: CSSProperties
  slideId?: string
  scale?: number
  enableTextScaling?: boolean
  isSelected?: boolean
  onFocusObject?: (objectId: string) => void
  onBlurObject?: (objectId: string) => void
  onTextEditorFocusChange?: (payload: { objectId: string; editor: Editor } | null) => void
  textEditorMode?: 'editable' | 'readonly'
} & HTMLAttributes<HTMLDivElement>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [selectionRect, setSelectionRect] = useState<{ width: number; height: number } | null>(null)
  const [resizeState, setResizeState] = useState<{
    pointerId: number
    startVisualWidth: number
    startClientX: number
    startScale: number
  } | null>(null)
  const [widthResizeState, setWidthResizeState] = useState<{
    pointerId: number
    startClientX: number
    startWidth: number
  } | null>(null)
  const { updateTextObjectScale, updateTextObjectWidth } = useDeckActions()
  const room = useRoom()
  const { doc } = useDeckRuntime()
  const undoManager = useDeckUndoManager()
  const historyPausedRef = useRef(false)
  const fragmentKey = useMemo(() => getTextFragmentKey(object.id), [object.id])
  const textFragment = useMemo(() => doc.getXmlFragment(fragmentKey), [doc, fragmentKey])

  useEffect(() => {
    undoManager.addToScope([textFragment])
  }, [textFragment, undoManager])

  useEffect(() => {
    if (textFragment.length > 0) return
    transactDeck(doc, () => {
      const paragraph = new Y.XmlElement('paragraph')
      const textNode = new Y.XmlText()
      if (object.text) {
        textNode.insert(0, object.text)
      }
      paragraph.insert(0, [textNode])
      textFragment.insert(0, [paragraph])
    })
  }, [doc, object.text, textFragment])

  const resolvedScale = Number.isFinite(scale) && scale && scale > 0 ? scale : 1
  const textScale = (() => {
    const value = typeof object.scale === 'number' ? object.scale : 1
    if (!Number.isFinite(value) || value <= 0) return 1
    return value
  })()
  const isTextEditorEditable = textEditorMode === 'editable'

  const positionStyle: CSSProperties = {
    left: object.x,
    top: object.y,
    width: typeof object.width === 'number' ? object.width : undefined,
  }

  const { transform: customTransform, transformOrigin, ...restStyle } = style ?? {}

  const layoutStyle: CSSProperties = {
    ...positionStyle,
    ...restStyle,
  }

  if (typeof object.width === 'number') {
    layoutStyle.width = object.width
  } else if (typeof layoutStyle.width === 'undefined') {
    layoutStyle.width = 'fit-content'
  }

  const transformSegments = [customTransform, textScale !== 1 ? `scale(${textScale})` : null].filter(Boolean)
  const contentStyle: CSSProperties = {zIndex: 1}
  if (transformSegments.length) {
    contentStyle.transform = transformSegments.join(' ')
  }
  contentStyle.transformOrigin = transformOrigin ?? 'top left'

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        SharedCollaboration.configure({
          document: doc,
          field: fragmentKey,
          yUndoOptions: { undoManager },
        }),
      ],
      editable: isTextEditorEditable,
    },
    [doc, fragmentKey, undoManager],
  )

  const editorActiveRef = useRef(false)

  useEffect(() => {
    if (!editor) return
    editor.setEditable(isTextEditorEditable)
  }, [editor, isTextEditorEditable])

  const handleFocusCapture = useCallback(() => {
    onFocusObject?.(object.id)
    if (onTextEditorFocusChange && editor) {
      editorActiveRef.current = true
      onTextEditorFocusChange({ objectId: object.id, editor })
    }
  }, [editor, object.id, onFocusObject, onTextEditorFocusChange])

  const handleBlurCapture = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const nextFocused = event.relatedTarget
      if (event.currentTarget.contains(nextFocused as Node)) {
        return
      }
      onBlurObject?.(object.id)
      if (editorActiveRef.current && onTextEditorFocusChange) {
        editorActiveRef.current = false
        onTextEditorFocusChange(null)
      }
    },
    [object.id, onBlurObject, onTextEditorFocusChange],
  )

  const pauseHistory = useCallback(() => {
    if (historyPausedRef.current) return
    room?.history.pause()
    historyPausedRef.current = true
  }, [room])

  const resumeHistory = useCallback(() => {
    if (!historyPausedRef.current) return
    room?.history.resume()
    historyPausedRef.current = false
  }, [room])

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enableTextScaling || !slideId) return
      const node = containerRef.current
      if (!node) return

      event.preventDefault()
      event.stopPropagation()

      const rect = node.getBoundingClientRect()
      const startVisualWidth = Math.max(MIN_TEXT_WIDTH, rect.width / resolvedScale)
      const startScaleValue = typeof object.scale === 'number' ? object.scale : 1
      const startScale = Number.isFinite(startScaleValue) && startScaleValue > 0 ? startScaleValue : 1

      ;(event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId)
      pauseHistory()
      setResizeState({
        pointerId: event.pointerId,
        startVisualWidth,
        startClientX: event.clientX,
        startScale,
      })
    },
    [enableTextScaling, object.scale, pauseHistory, resolvedScale, slideId],
  )

  const handleResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!resizeState || event.pointerId !== resizeState.pointerId) return
      if (!slideId) return

      event.preventDefault()
      const deltaX = (event.clientX - resizeState.startClientX) / resolvedScale
      const nextVisualWidth = Math.max(MIN_TEXT_WIDTH, resizeState.startVisualWidth + deltaX)
      if (!Number.isFinite(nextVisualWidth) || resizeState.startVisualWidth <= 0) return

      const scaleRatio = nextVisualWidth / resizeState.startVisualWidth
      const rawNextScale = resizeState.startScale * scaleRatio
      const nextScale = Number.isFinite(rawNextScale) && rawNextScale > 0 ? rawNextScale : resizeState.startScale

      updateTextObjectScale(slideId, object.id, nextScale)
    },
    [object.id, resizeState, resolvedScale, slideId, updateTextObjectScale],
  )

  const endResize = useCallback(
    (event?: ReactPointerEvent<HTMLDivElement>) => {
      if (resizeState && event && event.pointerId === resizeState.pointerId) {
        event.preventDefault()
        try {
          event.currentTarget.releasePointerCapture(event.pointerId)
        } catch {
          // Swallow release errors if pointer capture was lost
        }
      }
      if (resizeState) {
        setResizeState(null)
      }
      resumeHistory()
    },
    [resizeState, resumeHistory],
  )

  const handleResizePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!resizeState || event.pointerId !== resizeState.pointerId) return
      endResize(event)
    },
    [endResize, resizeState],
  )

  const handleResizePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!resizeState || event.pointerId !== resizeState.pointerId) return
      endResize(event)
    },
    [endResize, resizeState],
  )

  const handleWidthPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enableTextScaling || !slideId) return
      const node = containerRef.current
      if (!node) return

      event.preventDefault()
      event.stopPropagation()

      const rect = node.getBoundingClientRect()
      const visualWidth = rect.width / resolvedScale
      const inferredWidth = visualWidth / (textScale || 1)
      const startWidth = Number.isFinite(inferredWidth) && inferredWidth > 0 ? inferredWidth : MIN_TEXT_WIDTH

      try {
        ;(event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture failures
      }

      pauseHistory()
      setWidthResizeState({
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startWidth,
      })
    },
    [enableTextScaling, pauseHistory, resolvedScale, slideId, textScale],
  )

  const handleWidthPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!widthResizeState || event.pointerId !== widthResizeState.pointerId) return
      if (!slideId) return

      event.preventDefault()
      const deltaX = event.clientX - widthResizeState.startClientX
      const pointerScale = resolvedScale * (textScale || 1)
      const normalizedDelta = pointerScale > 0 ? deltaX / pointerScale : deltaX
      const rawWidth = widthResizeState.startWidth + normalizedDelta
      const nextWidth = Math.max(rawWidth, MIN_TEXT_WIDTH)
      updateTextObjectWidth(slideId, object.id, nextWidth)
    },
    [object.id, resolvedScale, slideId, textScale, updateTextObjectWidth, widthResizeState],
  )

  const endWidthResize = useCallback(
    (event?: ReactPointerEvent<HTMLDivElement>) => {
      if (widthResizeState && event && event.pointerId === widthResizeState.pointerId) {
        event.preventDefault()
        try {
          event.currentTarget.releasePointerCapture(event.pointerId)
        } catch {
          // Ignore release issues
        }
      }
      if (widthResizeState) {
        setWidthResizeState(null)
      }
      resumeHistory()
    },
    [resumeHistory, widthResizeState],
  )

  const handleWidthPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!widthResizeState || event.pointerId !== widthResizeState.pointerId) return
      endWidthResize(event)
    },
    [endWidthResize, widthResizeState],
  )

  const handleWidthPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!widthResizeState || event.pointerId !== widthResizeState.pointerId) return
      endWidthResize(event)
    },
    [endWidthResize, widthResizeState],
  )

  useEffect(() => {
    return () => {
      if (historyPausedRef.current) {
        room?.history.resume()
        historyPausedRef.current = false
      }
      if (editorActiveRef.current && onTextEditorFocusChange) {
        editorActiveRef.current = false
        onTextEditorFocusChange(null)
      }
    }
  }, [onTextEditorFocusChange, room])

  useLayoutEffect(() => {
    const node = containerRef.current
    if (!node) return

    const measure = () => {
      const rect = node.getBoundingClientRect()
      setSelectionRect({ width: rect.width, height: rect.height })
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(() => measure())
    observer.observe(node)
    return () => observer.disconnect()
  }, [object.id, object.width, object.scale, resolvedScale, textScale])

  const inactiveHandleClass = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
  const scaleHandleClassName = enableTextScaling
    ? `absolute -bottom-3 -right-3 flex h-4 w-4 items-center justify-center rounded-sm border border-white bg-sky-500 text-white shadow transition-opacity duration-150 ${
        resizeState ? 'opacity-100' : inactiveHandleClass
      }`
    : 'hidden'
  const widthHandleClassName = enableTextScaling
    ? `absolute top-1/2 -right-3 flex h-5 w-4 items-center justify-center rounded-sm border border-white bg-sky-500 text-white shadow transition-opacity duration-150 ${
        widthResizeState ? 'opacity-100' : inactiveHandleClass
      }`
    : 'hidden'
  const baseHandleStyle: CSSProperties = {
    touchAction: 'none',
    transform:
      Number.isFinite(resolvedScale) && resolvedScale !== 0
        ? `scale(${1 / resolvedScale})`
        : undefined,
  }
  const scaleHandleStyle: CSSProperties = {
    ...baseHandleStyle,
    cursor: 'se-resize',
    transformOrigin: 'bottom right',
    zIndex: 2,
  }
  const widthHandleStyle: CSSProperties = {
    ...baseHandleStyle,
    cursor: 'ew-resize',
    transformOrigin: 'center right',
    transform: baseHandleStyle.transform
      ? `translateY(-50%) ${baseHandleStyle.transform}`
      : 'translateY(-50%)',
    zIndex: 1,
  }

  const scaleNormalizer = Number.isFinite(resolvedScale) && resolvedScale > 0 ? resolvedScale : 1
  const overlayWidth = selectionRect ? selectionRect.width / scaleNormalizer : null
  const overlayHeight = selectionRect ? selectionRect.height / scaleNormalizer : null

  const overlaySizeStyle = {
    width: overlayWidth ? `${overlayWidth}px` : '100%',
    height: overlayHeight ? `${overlayHeight}px` : '100%',
  }

  const selectionRingStyle: CSSProperties | undefined = isSelected
    ? {
        borderWidth: 1,
        width: overlaySizeStyle.width,
        height: overlaySizeStyle.height,
        mixBlendMode: 'multiply',
      }
    : undefined

  return (
    <div
      className={`absolute group ${className}`.trim()}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
      style={layoutStyle}
      {...rest}
    >
      <div ref={containerRef} className="relative" style={contentStyle}>
        <EditorContent editor={editor} data-slide-text-editor="true" />
      </div>
      {enableTextScaling && (
        <div className="absolute left-0 top-0" style={overlaySizeStyle}>
          <div
            role="presentation"
            className={scaleHandleClassName}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
            style={scaleHandleStyle}
            data-slide-text-resize-handle="true"
          >
            <Scaling size={16} />
          </div>
          <div
            role="presentation"
            className={widthHandleClassName}
            onPointerDown={handleWidthPointerDown}
            onPointerMove={handleWidthPointerMove}
            onPointerUp={handleWidthPointerUp}
            onPointerCancel={handleWidthPointerCancel}
            style={widthHandleStyle}
            data-slide-text-width-handle="true"
          >
            <GripVertical size={16} />
          </div>
        </div>
      )}
      {isSelected && (
        <div
          className="pointer-events-none absolute left-0 top-0 rounded-md border border-sky-400"
          style={selectionRingStyle}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

function SlideImageElement({
  object,
  className,
  style,
  ...rest
}: {
  object: ImageObject
  className?: string
  style?: CSSProperties
} & HTMLAttributes<HTMLElement>) {
  const positionStyle: CSSProperties = {
    left: object.x,
    top: object.y,
    width: object.width,
    height: object.height,
  }

  return (
    <figure
      {...rest}
      className={`absolute overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow ${className}`.trim()}
      style={{ ...positionStyle, ...style }}
    >
      <img src={object.src} alt="Slide visual" className="h-full w-full object-cover" />
    </figure>
  )
}
