import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { redo, undo, ySyncPlugin, ySyncPluginKey, yUndoPlugin, yUndoPluginKey } from 'y-prosemirror'
import type { Transaction, UndoManager, XmlFragment as XmlFragmentType } from 'yjs'
import { Doc, UndoManager as YUndoManager, XmlElement, XmlFragment as YXmlFragment, XmlText } from 'yjs'

type YSyncOpts = Parameters<typeof ySyncPlugin>[1]
type YUndoOpts = Parameters<typeof yUndoPlugin>[0]
type YUndoOptsExtended = YUndoOpts & {
  captureTransaction?: (transaction: Transaction) => boolean
}

type StackItemEvent = {
  stackItem: { meta: Map<unknown, unknown> }
}

export interface SharedCollaborationOptions {
  document?: Doc | null
  field?: string
  fragment?: XmlFragmentType | null
  provider?: unknown | null
  onFirstRender?: () => void
  ySyncOptions?: YSyncOpts
  yUndoOptions?: YUndoOpts
}

function transactionTouchesXmlContent(transaction: Transaction): boolean {
  const matchesXmlType = (type: unknown) =>
    type instanceof YXmlFragment || type instanceof XmlElement || type instanceof XmlText

  let touched = false
  transaction.changedParentTypes?.forEach((_, type) => {
    if (matchesXmlType(type)) {
      touched = true
    }
  })
  if (touched) return true
  transaction.changed?.forEach((_, type) => {
    if (matchesXmlType(type)) {
      touched = true
    }
  })
  return touched
}

export function createSharedCollaborationPlugins(options: SharedCollaborationOptions): Plugin[] {
  const field = options.field ?? 'default'
  const fragment = options.fragment ?? options.document?.getXmlFragment(field)
  if (!fragment) {
    throw new Error('SharedCollaboration requires a Yjs fragment or document/field pair')
  }

  const userCaptureTransaction = (options.yUndoOptions as YUndoOptsExtended | undefined)?.captureTransaction
  let editorUndoManagerRef: UndoManager | null = null

  const captureTransaction = (transaction: Transaction) => {
    const changedCount = transaction.changed?.size ?? 0
    const changedParents = transaction.changedParentTypes?.size ?? 0
    const origin = transaction.origin as PluginKey | undefined
    const isYSyncOrigin =
      origin === ySyncPluginKey || (!!origin && origin instanceof PluginKey && pluginKeysMatch(origin, ySyncPluginKey))

    if (!transactionTouchesXmlContent(transaction)) {
      return false
    }

    if (changedCount === 0 && changedParents === 0) {
      return false
    }

    if (isYSyncOrigin && changedParents === 0) {
      return false
    }

    if (origin instanceof YUndoManager && origin !== editorUndoManagerRef) {
      return false
    }

    return typeof userCaptureTransaction === 'function' ? userCaptureTransaction(transaction) : true
  }

  const yUndoOptions: YUndoOptsExtended = {
    ...(options.yUndoOptions as YUndoOptsExtended),
    captureTransaction,
  }

  const yUndoPluginInstance = yUndoPlugin(yUndoOptions)

  yUndoPluginInstance.spec.view = (view: EditorView) => {
    const yState = ySyncPluginKey.getState(view.state)
    const undoState = yUndoPluginKey.getState(view.state)

    if (!yState || !undoState) {
      return {
        destroy: () => undefined,
      }
    }

    const undoManager = undoState.undoManager

    if (!undoManager) {
      return {
        destroy: () => undefined,
      }
    }

    editorUndoManagerRef = undoManager

    if (undoManager && typeof undoManager.trackedOrigins?.add === 'function') {
      undoManager.trackedOrigins.add(ySyncPluginKey)
    }

    const handleStackItemAdded = (event: StackItemEvent) => {
      const binding = yState.binding
      if (binding) {
        event.stackItem.meta.set(binding, undoState.prevSel)
      }
    }

    const handleStackItemPopped = (event: StackItemEvent) => {
      const binding = yState.binding
      if (binding) {
        binding.beforeTransactionSelection =
          event.stackItem.meta.get(binding) || binding.beforeTransactionSelection
      }
    }

    const handleStackCleared = (event: { undoStackCleared: boolean; redoStackCleared: boolean }) => {
      if (!event.undoStackCleared && !event.redoStackCleared) return
    }

    undoManager.on('stack-item-added', handleStackItemAdded)
    undoManager.on('stack-item-popped', handleStackItemPopped)
    undoManager.on('stack-cleared', handleStackCleared)

    return {
      destroy: () => {
        undoManager.off('stack-item-added', handleStackItemAdded)
        undoManager.off('stack-item-popped', handleStackItemPopped)
        undoManager.off('stack-cleared', handleStackCleared)
      },
    }
  }

  const ySyncPluginOptions: YSyncOpts = {
    ...options.ySyncOptions,
    onFirstRender: options.onFirstRender,
  }

  const ySyncPluginInstance = ySyncPlugin(fragment, ySyncPluginOptions)

  return [ySyncPluginInstance, yUndoPluginInstance]
}

export { redo, undo, ySyncPluginKey, yUndoPluginKey }

function pluginKeysMatch(first: PluginKey | undefined, second: PluginKey | undefined): boolean {
  if (!first || !second) return false
  const firstKey = readPluginKeyIdentifier(first)
  const secondKey = readPluginKeyIdentifier(second)
  return Boolean(firstKey && secondKey && firstKey === secondKey)
}

function readPluginKeyIdentifier(key: PluginKey): string | undefined {
  return (key as PluginKey & { key?: string }).key
}
