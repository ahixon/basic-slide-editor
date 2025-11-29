import { Image, Redo2, Type, Undo2, ZoomIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'

import { useDeckStore } from '../store'

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
  const room = useDeckStore((state) => state.liveblocks.room)
  const history = room?.history
  const undo = history?.undo
  const redo = history?.redo
  const [historyState, setHistoryState] = useState<HistoryState>(() => ({
    canUndo: history?.canUndo?.() ?? false,
    canRedo: history?.canRedo?.() ?? false,
  }))

  const handleZoomChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target
    if (value === 'auto') {
      onZoomOverrideChange(null)
      return
    }
    const numericValue = Number.parseFloat(value)
    onZoomOverrideChange(Number.isFinite(numericValue) ? numericValue : null)
  }

  const toolbarButtonClass =
    'inline-flex items-center gap-2 rounded-sm border border-neutral-300 px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

  useEffect(() => {
    const historyApi = room?.history
    if (!historyApi) {
      // Safe to reset here because toolbar mirrors room.history state exclusively.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistoryState(DEFAULT_HISTORY_STATE)
      return
    }

    setHistoryState({
      canUndo: historyApi.canUndo?.() ?? false,
      canRedo: historyApi.canRedo?.() ?? false,
    })

    const unsubscribe = room.subscribe('history', ({ canUndo, canRedo }) => {
      setHistoryState((previous) =>
        previous.canUndo === canUndo && previous.canRedo === canRedo
          ? previous
          : { canUndo, canRedo },
      )
    })

    return () => unsubscribe?.()
  }, [room])

  useEffect(() => {
    if (!undo && !redo) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const hasModifier = event.metaKey || event.ctrlKey
      if (!hasModifier) return

      const target = event.target as HTMLElement | null
      if (target) {
        const tagName = target.tagName
        const isEditable =
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          target.isContentEditable
        if (isEditable) return
      }

      const wantsUndo = key === 'z' && !event.shiftKey
      const wantsRedo = key === 'y' || (key === 'z' && event.shiftKey)

      if (wantsUndo && undo) {
        event.preventDefault()
        undo()
        return
      }

      if (wantsRedo && redo) {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [undo, redo])

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => undo?.()}
            className={toolbarButtonClass}
            disabled={!historyState.canUndo}
            aria-label="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => redo?.()}
            className={toolbarButtonClass}
            disabled={!historyState.canRedo}
            aria-label="Redo"
          >
            <Redo2 size={16} />
          </button>
        </div>
        <span className="h-6 w-px bg-neutral-200 dark:bg-slate-700" aria-hidden="true" />
        <button
          type="button"
          onClick={onAddTextbox}
          className={toolbarButtonClass}
          aria-label="Add textbox"
        >
          <Type size={16} />
        </button>
        <button
          type="button"
          onClick={onAddImage}
          className={toolbarButtonClass}
          aria-label="Add image"
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

type HistoryState = {
  canUndo: boolean
  canRedo: boolean
}

const DEFAULT_HISTORY_STATE: HistoryState = { canUndo: false, canRedo: false }

export type { SlideToolbarProps }
