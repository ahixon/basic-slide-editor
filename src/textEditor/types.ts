import type { EditorView } from 'prosemirror-view'

export type TextEditorHandle = {
  view: EditorView
  subscribe: (listener: () => void) => () => void
}
