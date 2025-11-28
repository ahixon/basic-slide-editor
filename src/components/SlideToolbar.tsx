import { Image, Type, ZoomIn } from 'lucide-react'
import type { ChangeEvent } from 'react'

const ZOOM_OPTIONS = [
  { label: 'Fit', value: 'auto' },
  { label: '25%', value: '0.25' },
  { label: '50%', value: '0.5' },
  { label: '75%', value: '0.75' },
  { label: '100%', value: '1' },
  { label: '125%', value: '1.25' },
  { label: '150%', value: '1.5' },
  { label: '200%', value: '2' },
]

type SlideToolbarProps = {
  onAddTextbox: () => void
  onAddImage: () => void
  zoomOverride: number | null
  onZoomOverrideChange: (value: number | null) => void
}

export function SlideToolbar({
  onAddTextbox,
  onAddImage,
  zoomOverride,
  onZoomOverrideChange,
}: SlideToolbarProps) {
  const handleZoomChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target
    if (value === 'auto') {
      onZoomOverrideChange(null)
      return
    }
    const numericValue = Number.parseFloat(value)
    onZoomOverrideChange(Number.isFinite(numericValue) ? numericValue : null)
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddTextbox}
          className="inline-flex items-center gap-2 rounded-sm border border-neutral-300 px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 transition hover:bg-neutral-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Type size={16} />
        </button>
        <button
          type="button"
          onClick={onAddImage}
          className="inline-flex items-center gap-2 rounded-sm border border-neutral-300 px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 transition hover:bg-neutral-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Image size={16} />
        </button>
      </div>
      <div className="ml-auto flex items-center gap-2 text-sm text-neutral-600 dark:text-slate-200">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
          <ZoomIn size={16} />
        </span>
        <select
          value={zoomOverride !== null ? zoomOverride.toString() : 'auto'}
          onChange={handleZoomChange}
          className="rounded-md border border-neutral-200 bg-white px-1 text-xs font-medium text-neutral-700 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {ZOOM_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export type { SlideToolbarProps }
