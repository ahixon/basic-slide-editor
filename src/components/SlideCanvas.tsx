import type { CSSProperties } from 'react'

import type { DeckObject, ImageObject, Slide, TextObject } from '../features/decks/editorState'
import { SLIDE_BASE_HEIGHT, SLIDE_BASE_WIDTH } from './slideDimensions'

type SlideCanvasProps = {
  slide: Slide
  scale?: number
  className?: string
  style?: CSSProperties
  rounded?: boolean
}
export function SlideCanvas({
  slide,
  scale = 1,
  className = '',
  style,
  rounded = true,
}: SlideCanvasProps) {
  const scaledWidth = SLIDE_BASE_WIDTH * scale
  const scaledHeight = SLIDE_BASE_HEIGHT * scale
  const roundedShellClass = rounded ? 'rounded-[32px] shadow-inner' : ''

  return (
    <article
      className={`slide-canvas relative overflow-hidden ${roundedShellClass} bg-white text-left text-slate-900 ${className}`}
      style={{
        width: scaledWidth,
        height: scaledHeight,
        ...style,
      }}
    >
      <div
        className="relative"
        style={{
          width: SLIDE_BASE_WIDTH,
          height: SLIDE_BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {slide.objects.map((object) => (
          <SlideObject key={object.id} object={object} />
        ))}
        {!slide.objects.length && (
          <div
            className={`absolute inset-0 flex items-center justify-center border-2 border-dashed border-slate-200 text-xl font-semibold uppercase tracking-wide text-slate-300 ${rounded ? 'rounded-2xl' : ''}`}
          >
            Drop objects to start designing
          </div>
        )}
      </div>
    </article>
  )
}

function SlideObject({ object }: { object: DeckObject }) {
  if (object.type === 'text') {
    return <SlideText object={object} />
  }
  return <SlideImage object={object} />
}

function SlideText({ object }: { object: TextObject }) {
  const style: CSSProperties = {
    left: object.x,
    top: object.y,
    width: typeof object.width === 'number' ? object.width : undefined,
  }

  return (
    <p
      className="absolute whitespace-pre-wrap text-4xl font-semibold leading-snug text-slate-900"
      style={style}
    >
      {object.text}
    </p>
  )
}

function SlideImage({ object }: { object: ImageObject }) {
  const style: CSSProperties = {
    left: object.x,
    top: object.y,
    width: object.width,
    height: object.height,
  }

  return (
    <figure
      className="absolute overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow"
      style={style}
    >
      <img src={object.src} alt="Slide visual" className="h-full w-full object-cover" />
    </figure>
  )
}

export type { SlideCanvasProps }
