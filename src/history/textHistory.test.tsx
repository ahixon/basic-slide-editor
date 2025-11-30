import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { EditorView } from 'prosemirror-view'
import { TextSelection } from 'prosemirror-state'

import { createTextEditorState } from '../textEditor'
import { ySyncPluginKey } from '../extensions/SharedCollaboration'
import { ensureTextFragmentInitialized, getTextFragmentKey } from '../store'
import { ensureHistoryBridge, getTextUndoManager, registerDeckUndoManager, TEXT_HISTORY_ORIGIN } from './textHistory'

function waitForEditorTick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function waitForDocText(view: EditorView, predicate: (text: string) => boolean, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    const text = view.state.doc.textContent
    if (predicate(text)) {
      return text
    }
    await waitForEditorTick()
  }
  throw new Error('Timed out waiting for editor content to sync')
}

function setupDeckStructure(doc: Y.Doc) {
  const deckMap = doc.getMap<unknown>('deck')
  const slides = new Y.Map<Y.Map<unknown>>()
  deckMap.set('slides', slides)
  const slide = new Y.Map<unknown>()
  slides.set('slide-1', slide)
  const objects = new Y.Map<Y.Map<unknown>>()
  const objectOrder = new Y.Array<string>()
  slide.set('objects', objects)
  slide.set('objectOrder', objectOrder)
  return { objects, objectOrder }
}

function appendTextObject(doc: Y.Doc, objects: Y.Map<Y.Map<unknown>>, objectOrder: Y.Array<string>) {
  doc.transact(() => {
    const textObject = new Y.Map<unknown>()
    textObject.set('id', 'text-1')
    textObject.set('type', 'text')
    textObject.set('x', 0)
    textObject.set('y', 0)
    objects.set('text-1', textObject)
    objectOrder.push(['text-1'])
  }, 'test-add-text')
}

function createDeckUndoManager(doc: Y.Doc) {
  const trackedOrigins = new Set<unknown>([null, TEXT_HISTORY_ORIGIN, ySyncPluginKey])
  const deckUndoManager = new Y.UndoManager(doc, {
    doc,
    trackedOrigins,
    captureTransaction: (transaction) => {
      const changedCount = transaction.changed?.size ?? 0
      const parentCount = transaction.changedParentTypes?.size ?? 0
      return changedCount > 0 || parentCount > 0
    },
  })
  registerDeckUndoManager(doc, deckUndoManager)
  return deckUndoManager
}

function readFragmentText(fragment: Y.XmlFragment): string {
  let text = ''
  for (let index = 0; index < fragment.length; index += 1) {
    const node = fragment.get(index)
    if (node instanceof Y.XmlText) {
      text += node.toString()
      continue
    }
    if (node instanceof Y.XmlElement) {
      for (let childIndex = 0; childIndex < node.length; childIndex += 1) {
        const child = node.get(childIndex)
        if (child instanceof Y.XmlText) {
          text += child.toString()
        }
      }
    }
  }
  return text
}

describe('text history bridge', () => {
  it('retains redo stack after undoing a text object addition even when the editor tears down', async () => {
    const doc = new Y.Doc()
    ensureHistoryBridge(doc)
    type TransactionSummary = { origin: unknown; changed: number; parents: number }
    const transactions: TransactionSummary[] = []
    let lastTransaction: TransactionSummary | null = null
    doc.on('afterTransaction', (transaction) => {
      const record = {
        origin: transaction.origin,
        changed: transaction.changed?.size ?? 0,
        parents: transaction.changedParentTypes?.size ?? 0,
      }
      lastTransaction = record
      transactions.push(record)
    })
    const deckUndoManager = createDeckUndoManager(doc)
    const captureDecisions: Array<{ origin: unknown; result: boolean; originType: string; originKey?: unknown }> = []
    const originalCapture = (deckUndoManager as { captureTransaction?: (transaction: Y.Transaction) => boolean }).captureTransaction
    if (originalCapture) {
      ;(deckUndoManager as { captureTransaction?: (transaction: Y.Transaction) => boolean }).captureTransaction = (transaction) => {
        const result = originalCapture(transaction)
        captureDecisions.push({
          origin: transaction.origin,
          originType: typeof transaction.origin,
          originKey: typeof transaction.origin === 'object' && transaction.origin
            ? (transaction.origin as { key?: unknown }).key
            : undefined,
          result,
        })
        return result
      }
    }
    const stackClears: Array<{ undoStackCleared: boolean; redoStackCleared: boolean; lastTransaction: TransactionSummary | null }> = []
    deckUndoManager.on('stack-cleared', (event) => {
      stackClears.push({ ...event, lastTransaction })
    })
    const { objects, objectOrder } = setupDeckStructure(doc)

    appendTextObject(doc, objects, objectOrder)

    const fragmentKey = getTextFragmentKey('text-1')
    ensureTextFragmentInitialized(
      doc,
      {
        id: 'text-1',
        type: 'text',
        text: 'hello world',
        x: 0,
        y: 0,
      },
      { insideTransaction: true },
    )

    const textUndoManager = getTextUndoManager(doc, fragmentKey)
    const textStackEvents: Array<{ origin?: unknown; type?: 'undo' | 'redo' }> = []
    textUndoManager.on('stack-item-added', (event: { origin?: unknown; type?: 'undo' | 'redo' }) => {
      textStackEvents.push({ origin: event.origin, type: event.type })
    })

    const mount = document.createElement('div')
    document.body.appendChild(mount)
    const state = createTextEditorState({
      document: doc,
      field: fragmentKey,
      yUndoOptions: { undoManager: textUndoManager },
    })
    const editorView = new EditorView(mount, {
      state,
    })

    expect(deckUndoManager.undoStack.length).toBeGreaterThan(0)

    deckUndoManager.undo()
    expect(deckUndoManager.redoStack.length).toBeGreaterThan(0)

    editorView.destroy()
    mount.remove()
      await waitForEditorTick()

    expect(deckUndoManager.redoStack.length).toBeGreaterThan(0)
  })

  it('mirrors text edits into the deck undo history', async () => {
    const doc = new Y.Doc()
    ensureHistoryBridge(doc)
    const { objects, objectOrder } = setupDeckStructure(doc)
    appendTextObject(doc, objects, objectOrder)

    const fragmentKey = getTextFragmentKey('text-1')
    ensureTextFragmentInitialized(
      doc,
      {
        id: 'text-1',
        type: 'text',
        text: 'hello world',
        x: 0,
        y: 0,
      },
      { insideTransaction: true },
    )

    const deckUndoManager = createDeckUndoManager(doc)
    const textUndoManager = getTextUndoManager(doc, fragmentKey)
    const textStackEvents: Array<{ origin?: unknown; type?: 'undo' | 'redo' }> = []
    textUndoManager.on('stack-item-added', (event: { origin?: unknown; type?: 'undo' | 'redo' }) => {
      textStackEvents.push({ origin: event.origin, type: event.type })
    })

    const mount = document.createElement('div')
    document.body.appendChild(mount)
    const state = createTextEditorState({
      document: doc,
      field: fragmentKey,
      yUndoOptions: { undoManager: textUndoManager },
    })
    const editorView = new EditorView(mount, {
      state,
    })
      await waitForEditorTick()

    const fragment = doc.getXmlFragment(fragmentKey)
    const initialText = readFragmentText(fragment)
    expect(initialText).toBe('hello world')
    await waitForDocText(editorView, (text) => text === 'hello world')
    const initialUndoDepth = deckUndoManager.undoStack.length

    const endSelection = TextSelection.atEnd(editorView.state.doc)
    const insertTransaction = editorView.state.tr.setSelection(endSelection).insertText('!')
    editorView.dispatch(insertTransaction)
      await waitForEditorTick()

    const editedText = readFragmentText(fragment)
    expect(editedText).not.toBe(initialText)
    expect(editedText.length).toBeGreaterThan(initialText.length)
    expect(deckUndoManager.undoStack.length).toBeGreaterThan(initialUndoDepth)
    expect(textUndoManager.undoStack.length).toBeGreaterThan(0)

    deckUndoManager.undo()
    expect(readFragmentText(fragment)).toBe(initialText)
    expect(deckUndoManager.canRedo()).toBe(true)

    deckUndoManager.redo()
    expect(readFragmentText(fragment)).toBe(editedText)

    editorView.destroy()
    mount.remove()
  })
})
