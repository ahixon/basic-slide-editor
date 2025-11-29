import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, HTMLAttributes, PointerEvent as ReactPointerEvent } from 'react'

import type { DeckObject, ImageObject, TextObject } from '../store'
import {
  MIN_IMAGE_SIZE,
  MIN_TEXT_WIDTH,
  getTextFragmentKey,
  transactDeck,
  useDeckActions,
  useDeckRuntime,
  useDeckUndoManager,
} from '../store'
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
  enableImageResizing?: boolean
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
  enableImageResizing = false,
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
      slideId={slideId}
      scale={scale}
      enableImageResizing={enableImageResizing}
      isSelected={isSelected}
      onFocusObject={onFocusObject}
      onBlurObject={onBlurObject}
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
  slideId,
  scale = 1,
  enableImageResizing = false,
  isSelected = false,
  onFocusObject,
  onBlurObject,
  ...rest
}: {
  object: ImageObject
  className?: string
  style?: CSSProperties
  slideId?: string
  scale?: number
  enableImageResizing?: boolean
  isSelected?: boolean
  onFocusObject?: (objectId: string) => void
  onBlurObject?: (objectId: string) => void
} & HTMLAttributes<HTMLDivElement>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [selectionRect, setSelectionRect] = useState<{ width: number; height: number } | null>(null)
  const [resizeState, setResizeState] = useState<{
    pointerId: number
    startClientX: number
    startClientY: number
    startWidth: number
    startHeight: number
    aspectRatio: number
  } | null>(null)
  const [intrinsicSize, setIntrinsicSize] = useState<{
    width: number
    height: number
    srcKey: string | null
  } | null>(null)
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null)
  const { updateImageObjectSize } = useDeckActions()
  const room = useRoom()
  const historyPausedRef = useRef(false)
  const imageSrcKey = object.src ?? null
  const intrinsicSizeForCurrentSrc =
    intrinsicSize && intrinsicSize.srcKey === imageSrcKey ? intrinsicSize : null
  const isImageErrored = Boolean(imageSrcKey && failedImageSrc === imageSrcKey)

  const positionStyle: CSSProperties = useMemo(
    () => ({
      left: object.x,
      top: object.y,
      width: object.width,
      height: object.height,
    }),
    [object.height, object.width, object.x, object.y],
  )

  const layoutStyle: CSSProperties = useMemo(
    () => ({ ...positionStyle, ...(style ?? {}) }),
    [positionStyle, style],
  )
  const resolvedScale = Number.isFinite(scale) && scale && scale > 0 ? scale : 1
  const aspectRatio = useMemo(() => {
    const value =
      intrinsicSizeForCurrentSrc && intrinsicSizeForCurrentSrc.height > 0
        ? intrinsicSizeForCurrentSrc.width / intrinsicSizeForCurrentSrc.height
        : object.width / object.height
    if (!Number.isFinite(value) || value <= 0) {
      return 1
    }
    return value
  }, [intrinsicSizeForCurrentSrc, object.height, object.width])

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

  const handleFocusCapture = useCallback(() => {
    onFocusObject?.(object.id)
  }, [object.id, onFocusObject])

  const handleBlurCapture = useCallback(() => {
    onBlurObject?.(object.id)
  }, [object.id, onBlurObject])

  const handleImageLoad = useCallback(() => {
    const node = imageRef.current
    if (!node || !imageSrcKey) return
    if (node.naturalWidth > 0 && node.naturalHeight > 0) {
      setIntrinsicSize({ width: node.naturalWidth, height: node.naturalHeight, srcKey: imageSrcKey })
      setFailedImageSrc((current) => (current === imageSrcKey ? null : current))
    }
  }, [imageSrcKey])

  const handleImageError = useCallback(() => {
    if (!imageSrcKey) return
    setFailedImageSrc(imageSrcKey)
    setIntrinsicSize((current) => (current?.srcKey === imageSrcKey ? null : current))
  }, [imageSrcKey])

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enableImageResizing || !slideId) return
      event.preventDefault()
      event.stopPropagation()

      const pointerTarget = event.currentTarget
      try {
        pointerTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture failures
      }

      pauseHistory()
      setResizeState({
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startWidth: object.width,
        startHeight: object.height,
        aspectRatio,
      })
    },
    [aspectRatio, enableImageResizing, object.height, object.width, pauseHistory, slideId],
  )

  const handleResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!resizeState || event.pointerId !== resizeState.pointerId) return
      if (!slideId) return
      event.preventDefault()

      const pointerScale = resolvedScale || 1
      const deltaX = (event.clientX - resizeState.startClientX) / pointerScale
      const deltaY = (event.clientY - resizeState.startClientY) / pointerScale
      const ratio = resizeState.aspectRatio > 0 ? resizeState.aspectRatio : 1

      const widthCandidate = resizeState.startWidth + deltaX
      const minWidthForRatio = Math.max(MIN_IMAGE_SIZE, MIN_IMAGE_SIZE * ratio)
      const constrainedWidth = Math.max(widthCandidate, minWidthForRatio)
      const derivedHeight = constrainedWidth / ratio

      const heightCandidate = resizeState.startHeight + deltaY
      const minHeightForRatio = Math.max(MIN_IMAGE_SIZE, MIN_IMAGE_SIZE / ratio)
      const constrainedHeight = Math.max(heightCandidate, minHeightForRatio)
      const derivedWidth = constrainedHeight * ratio

      const useHeightDriver = Math.abs(deltaY) > Math.abs(deltaX)
      const nextWidth = useHeightDriver ? derivedWidth : constrainedWidth
      const nextHeight = useHeightDriver ? constrainedHeight : derivedHeight

      if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) return

      updateImageObjectSize(slideId, object.id, {
        width: nextWidth,
        height: nextHeight,
      })
    },
    [object.id, resizeState, resolvedScale, slideId, updateImageObjectSize],
  )

  const endResize = useCallback(
    (event?: ReactPointerEvent<HTMLDivElement>) => {
      if (resizeState && event && event.pointerId === resizeState.pointerId) {
        event.preventDefault()
        try {
          event.currentTarget.releasePointerCapture(event.pointerId)
        } catch {
          // Ignore release failures
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

  useEffect(() => {
    return () => {
      if (historyPausedRef.current) {
        room?.history.resume()
        historyPausedRef.current = false
      }
    }
  }, [room])

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
  }, [object.height, object.width, resolvedScale])

  const scaleNormalizer = resolvedScale || 1
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

  const baseHandleStyle: CSSProperties = {
    touchAction: 'none',
    transform: resolvedScale ? `scale(${1 / resolvedScale})` : undefined,
    cursor: 'nwse-resize',
    transformOrigin: 'bottom right',
    zIndex: 2,
  }

  const handleClassName = enableImageResizing
    ? `absolute -bottom-3 -right-3 flex h-4 w-4 items-center justify-center rounded-sm border border-white bg-sky-500 text-white shadow transition-opacity duration-150 ${
        resizeState ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
      }`
    : 'hidden'

  return (
    <div
      className={`absolute group ${className}`.trim()}
      style={layoutStyle}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
      {...rest}
    >
      <div ref={containerRef} className="relative h-full w-full">
        {object.src && !isImageErrored ? (
          <img
            ref={imageRef}
            src={object.src}
            alt="Slide visual"
            className="block h-full w-full object-contain"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {isImageErrored ? 'Image unavailable' : 'Set image URL'}
          </div>
        )}
      </div>
      {enableImageResizing && (
        <div className="absolute left-0 top-0" style={overlaySizeStyle}>
          <div
            role="presentation"
            className={handleClassName}
            style={baseHandleStyle}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerCancel}
            data-slide-image-resize-handle="true"
          >
            <Scaling size={16} />
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
