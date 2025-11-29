import { Bold, Image, Italic, List, Redo2, Trash2, Type, Undo2, ZoomIn } from 'lucide-react'
import { useCallback, useEffect, useReducer, useState } from 'react'
import type { ButtonHTMLAttributes, ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import type { NodeType, ResolvedPos } from 'prosemirror-model'

import { useDeckHistory } from '../store'
import type { TextEditorHandle } from '../textEditor'
import type { EditorView } from 'prosemirror-view'
import { toggleMark } from 'prosemirror-commands'
import { liftListItem, wrapInList } from 'prosemirror-schema-list'

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
  activeTextEditor?: TextEditorHandle | null
  onDeleteSelectedObject?: () => void
  canDeleteObject?: boolean
  canAddObjects?: boolean
  selectedImage?: { id: string; src?: string } | null
  onSaveSelectedImageSrc?: (src: string) => void
}

const TOOLBAR_BUTTON_CLASS =
  'inline-flex h-8 items-center gap-2 rounded-sm border border-neutral-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

export function SlideToolbar({
  onAddTextbox,
  onAddImage,
  zoomOverride,
  onZoomOverrideChange,
  activeTextEditor = null,
  onDeleteSelectedObject,
  canDeleteObject = false,
  canAddObjects = true,
  selectedImage = null,
  onSaveSelectedImageSrc,
}: SlideToolbarProps) {
  const { undo, redo, canUndo, canRedo } = useDeckHistory()
  const [, forceUpdate] = useReducer((count) => count + 1, 0)
  const editorView = activeTextEditor && !activeTextEditor.view.destroyed ? activeTextEditor.view : null

  const handleZoomChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target
    if (value === 'auto') {
      onZoomOverrideChange(null)
      return
    }
    const numericValue = Number.parseFloat(value)
    onZoomOverrideChange(Number.isFinite(numericValue) ? numericValue : null)
  }

  useEffect(() => {
    if (!activeTextEditor) return
    const rerender = () => forceUpdate()
    const unsubscribe = activeTextEditor.subscribe(rerender)
    rerender()
    return () => unsubscribe()
  }, [activeTextEditor])

  const isTextEditorActive = editorView?.hasFocus() ?? false
  const isBoldActive = isMarkActive(editorView, 'strong')
  const isItalicActive = isMarkActive(editorView, 'em')
  const isBulletListActive = isBulletListSelection(editorView)
  const selectedImageKey = selectedImage ? `${selectedImage.id}:${selectedImage.src ?? ''}` : null
  const showImageToolbar = Boolean(selectedImage && onSaveSelectedImageSrc)

  const handleToggleBold = useCallback(() => {
    toggleMarkOnView(editorView, 'strong')
  }, [editorView])

  const handleToggleItalic = useCallback(() => {
    toggleMarkOnView(editorView, 'em')
  }, [editorView])

  const handleToggleBulletList = useCallback(() => {
    toggleBulletList(editorView)
  }, [editorView])


  useEffect(() => {
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
          <ToolbarButton onClick={() => undo()} disabled={!canUndo} aria-label="Undo">
            <Undo2 size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => redo()} disabled={!canRedo} aria-label="Redo">
            <Redo2 size={16} />
          </ToolbarButton>
        </div>
        {(isTextEditorActive || showImageToolbar) && (
          <>
            <span className="h-6 w-px bg-neutral-200 dark:bg-slate-700" aria-hidden="true" />
            {isTextEditorActive ? (
              <div className="flex items-center gap-2" role="group" aria-label="Text formatting">
                <ToolbarButton
                  onClick={handleToggleBold}
                  aria-pressed={isBoldActive}
                  aria-label="Bold"
                  isActive={isBoldActive}
                >
                  <Bold size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={handleToggleItalic}
                  aria-pressed={isItalicActive}
                  aria-label="Italic"
                  isActive={isItalicActive}
                >
                  <Italic size={16} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={handleToggleBulletList}
                  aria-pressed={isBulletListActive}
                  aria-label="Toggle bullet list"
                  isActive={isBulletListActive}
                >
                  <List size={16} />
                </ToolbarButton>
              </div>
            ) : showImageToolbar && selectedImage && onSaveSelectedImageSrc ? (
              <ImageSourceEditor
                key={selectedImageKey}
                initialUrl={selectedImage.src ?? ''}
                onSave={onSaveSelectedImageSrc}
              />
            ) : null}
          </>
        )}
        <span className="h-6 w-px bg-neutral-200 dark:bg-slate-700" aria-hidden="true" />
        <ToolbarButton onClick={onAddTextbox} aria-label="Add textbox" disabled={!canAddObjects}>
          <Type size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={onAddImage} aria-label="Add image" disabled={!canAddObjects}>
          <Image size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => onDeleteSelectedObject?.()}
          disabled={!canDeleteObject}
          aria-label="Delete selected object"
        >
          <Trash2 size={16} />
        </ToolbarButton>
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

type ImageSourceEditorProps = {
  initialUrl: string
  onSave: (src: string) => void
}

function ImageSourceEditor({ initialUrl, onSave }: ImageSourceEditorProps) {
  const [draft, setDraft] = useState(initialUrl)
  const trimmedDraft = draft.trim()
  const trimmedInitial = initialUrl.trim()
  const canSave = trimmedDraft.length > 0 && trimmedDraft !== trimmedInitial

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!canSave) return
      onSave(trimmedDraft)
    },
    [canSave, onSave, trimmedDraft],
  )

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value)
  }, [])

  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={handleSubmit}>
      <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
        Image URL
      </label>
      <input
        type="url"
        name="image-url"
        value={draft}
        onChange={handleChange}
        placeholder="https://example.com/photo.jpg"
        className="h-8 w-56 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 outline-none transition focus:border-sky-500 focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
      <ToolbarButton type="submit" disabled={!canSave}>
        Save
      </ToolbarButton>
    </form>
  )
}

type ToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isActive?: boolean
  children: ReactNode
}

function ToolbarButton({
  isActive = false,
  className = '',
  type,
  children,
  onMouseDown,
  ...rest
}: ToolbarButtonProps) {
  const activeClass = isActive
    ? 'border-sky-400 bg-sky-50 text-sky-600 dark:border-sky-500 dark:bg-slate-800 dark:text-sky-200'
    : ''

  const resolvedType = type ?? 'button'

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      onMouseDown?.(event)
      if (!event.defaultPrevented) {
        event.preventDefault()
      }
    },
    [onMouseDown],
  )

  return (
    <button
      type={resolvedType}
      className={`${TOOLBAR_BUTTON_CLASS} ${activeClass} ${className}`.trim()}
      onMouseDown={handleMouseDown}
      {...rest}
    >
      {children}
    </button>
  )
}

function getUsableView(handleView: EditorView | null): EditorView | null {
  if (!handleView || handleView.destroyed) {
    return null
  }
  return handleView
}

function resolveMark(view: EditorView | null, markName: 'strong' | 'em') {
  return view?.state.schema.marks[markName]
}

function isMarkActive(view: EditorView | null, markName: 'strong' | 'em'): boolean {
  const usableView = getUsableView(view)
  if (!usableView) return false
  const markType = resolveMark(usableView, markName)
  if (!markType) return false
  const { from, $from, to, empty } = usableView.state.selection
  if (empty) {
    return Boolean(markType.isInSet(usableView.state.storedMarks || $from.marks()))
  }
  return usableView.state.doc.rangeHasMark(from, to, markType)
}

function toggleMarkOnView(view: EditorView | null, markName: 'strong' | 'em') {
  const usableView = getUsableView(view)
  if (!usableView) return
  const markType = resolveMark(usableView, markName)
  if (!markType) return
  usableView.focus()
  toggleMark(markType)(usableView.state, usableView.dispatch, usableView)
}

function isBulletListSelection(view: EditorView | null): boolean {
  const usableView = getUsableView(view)
  if (!usableView) return false
  const { bullet_list } = usableView.state.schema.nodes
  if (!bullet_list) return false

  const { selection } = usableView.state
  if (isSelectionPosInNode(selection.$from, bullet_list) || isSelectionPosInNode(selection.$to, bullet_list)) {
    return true
  }

  let isActive = false
  usableView.state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (node.type === bullet_list) {
      isActive = true
      return false
    }
    return undefined
  })
  return isActive
}

function isSelectionPosInNode($pos: ResolvedPos, nodeType: NodeType): boolean {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type === nodeType) {
      return true
    }
  }
  return false
}

function toggleBulletList(view: EditorView | null) {
  const usableView = getUsableView(view)
  if (!usableView) return
  const { bullet_list, list_item } = usableView.state.schema.nodes
  if (!bullet_list || !list_item) return
  usableView.focus()
  if (isBulletListSelection(usableView)) {
    liftListItem(list_item)(usableView.state, usableView.dispatch, usableView)
  } else {
    wrapInList(bullet_list)(usableView.state, usableView.dispatch, usableView)
  }
}
