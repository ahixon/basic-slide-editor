import type { CSSProperties } from 'react'

import type { Slide } from '../store'
import { SlideObjectElement } from './SlideObjectElement'
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
  const roundedShellClass = rounded ? 'shadow-inner' : ''

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
          <SlideObjectElement key={object.id} object={object} />
        ))}
      </div>
    </article>
  )
}

export type { SlideCanvasProps }
