import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { redo, undo, ySyncPlugin, ySyncPluginKey, yUndoPlugin, yUndoPluginKey, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap'
import type { Doc, UndoManager, XmlFragment } from 'yjs'

type YSyncOpts = Parameters<typeof ySyncPlugin>[1]
type YUndoOpts = Parameters<typeof yUndoPlugin>[0]

export interface CollaborationStorage {
  isDisabled: boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sharedCollaboration: {
      undo: () => ReturnType
      redo: () => ReturnType
    }
  }

  interface Storage {
    sharedCollaboration: CollaborationStorage
  }
}

export interface SharedCollaborationOptions {
  document?: Doc | null
  field?: string
  fragment?: XmlFragment | null
  provider?: unknown | null
  onFirstRender?: () => void
  ySyncOptions?: YSyncOpts
  yUndoOptions?: YUndoOpts
}

export const SharedCollaboration = Extension.create<SharedCollaborationOptions, CollaborationStorage>({
  name: 'sharedCollaboration',

  priority: 1000,

  addOptions() {
    return {
      document: null,
      field: 'default',
      fragment: null,
      provider: null,
    }
  },

  addStorage() {
    return {
      isDisabled: false,
    }
  },

  addCommands() {
    return {
      undo:
        () =>
        ({ tr, state, dispatch }) => {
          tr.setMeta('preventDispatch', true)

          const undoManager: UndoManager = yUndoPluginKey.getState(state).undoManager

          if (undoManager.undoStack.length === 0) {
            return false
          }

          if (!dispatch) {
            return true
          }

          return undo(state)
        },
      redo:
        () =>
        ({ tr, state, dispatch }) => {
          tr.setMeta('preventDispatch', true)

          const undoManager: UndoManager = yUndoPluginKey.getState(state).undoManager

          if (undoManager.redoStack.length === 0) {
            return false
          }

          if (!dispatch) {
            return true
          }

          return redo(state)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-z': () => this.editor.commands.undo(),
      'Mod-y': () => this.editor.commands.redo(),
      'Shift-Mod-z': () => this.editor.commands.redo(),
    }
  },

  addProseMirrorPlugins() {
    const fragment = this.options.fragment
      ? this.options.fragment
      : (this.options.document as Doc).getXmlFragment(this.options.field)

    const yUndoPluginInstance = yUndoPlugin(this.options.yUndoOptions)

    yUndoPluginInstance.spec.view = (view: EditorView) => {
      const yState = ySyncPluginKey.getState(view.state)
      const undoState = yUndoPluginKey.getState(view.state)
      const undoManager = undoState.undoManager
      if (undoManager && ySyncPluginKey && typeof undoManager.trackedOrigins?.add === 'function') {
        undoManager.trackedOrigins.add(ySyncPluginKey)
      }

      type UndoStackEvent = { stackItem: { meta: Map<unknown, unknown> } }
      const handleStackItemAdded = ({ stackItem }: UndoStackEvent) => {
        const binding = yState.binding
        if (binding) {
          stackItem.meta.set(binding, undoState.prevSel)
        }
      }

      const handleStackItemPopped = ({ stackItem }: UndoStackEvent) => {
        const binding = yState.binding
        if (binding) {
          binding.beforeTransactionSelection =
            stackItem.meta.get(binding) || binding.beforeTransactionSelection
        }
      }

      undoManager.on('stack-item-added', handleStackItemAdded)
      undoManager.on('stack-item-popped', handleStackItemPopped)

      return {
        destroy: () => {
          undoManager.off('stack-item-added', handleStackItemAdded)
          undoManager.off('stack-item-popped', handleStackItemPopped)
        },
      }
    }

    const ySyncPluginOptions: YSyncOpts = {
      ...this.options.ySyncOptions,
      onFirstRender: this.options.onFirstRender,
    }

    const ySyncPluginInstance = ySyncPlugin(fragment, ySyncPluginOptions)

    if (this.editor.options.enableContentCheck) {
      fragment.doc?.on('beforeTransaction', () => {
        try {
          const jsonContent = yXmlFragmentToProsemirrorJSON(fragment)

          if (jsonContent.content.length === 0) {
            return
          }

          this.editor.schema.nodeFromJSON(jsonContent).check()
        } catch (error) {
          this.editor.emit('contentError', {
            error: error as Error,
            editor: this.editor,
            disableCollaboration: () => {
              fragment.doc?.destroy()
              this.storage.isDisabled = true
            },
          })
          return false
        }
      })
    }

    return [
      ySyncPluginInstance,
      yUndoPluginInstance,
      this.editor.options.enableContentCheck &&
        new Plugin({
          key: new PluginKey('filterInvalidContent'),
          filterTransaction: () => {
            if (this.storage.isDisabled !== false) {
              fragment.doc?.destroy()
              return true
            }

            return true
          },
        }),
    ].filter(Boolean)
  },
})
