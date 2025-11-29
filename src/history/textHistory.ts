import * as Y from 'yjs'

const TEXT_HISTORY_ORIGIN = Symbol('text-history')
const TEXT_HISTORY_META_KEY = Symbol('text-history-meta')
const HISTORY_BRIDGE_KEY = '__deckHistoryBridge'

export type TextHistoryPayload = {
    fragmentKey: string
}

type TextFragmentHistory = {
    fragmentKey: string
    fragment: Y.XmlFragment
    undoManager: Y.UndoManager
}

const fragmentRegistry = new WeakMap<Y.Doc, Map<string, TextFragmentHistory>>()
const pendingPayloads = new WeakMap<Y.Doc, TextHistoryPayload[]>()
const bridgedDeckManagers = new WeakSet<Y.UndoManager>()

type UndoManagerWithCurrStack = Y.UndoManager & {
    currStackItem?: {
        meta?: Map<unknown, unknown>
    } | null
}

function getFragmentRegistry(doc: Y.Doc) {
    let registry = fragmentRegistry.get(doc)
    if (!registry) {
        registry = new Map()
        fragmentRegistry.set(doc, registry)
    }
    return registry
}

function getFragmentHistory(doc: Y.Doc, fragmentKey: string): TextFragmentHistory {
    const registry = getFragmentRegistry(doc)
    let entry = registry.get(fragmentKey)
    if (entry) {
        return entry
    }
    const fragment = doc.getXmlFragment(fragmentKey)
    const undoManager = new Y.UndoManager(fragment)
    entry = {
        fragmentKey,
        fragment,
        undoManager,
    }
    registry.set(fragmentKey, entry)
    attachLocalListeners(doc, entry)
    return entry
}

type StackItemAddedEvent = {
    type?: 'undo' | 'redo'
}

function attachLocalListeners(doc: Y.Doc, entry: TextFragmentHistory) {
    entry.undoManager.on('stack-item-added', (event: StackItemAddedEvent) => {
        if (event.type === 'redo') return
        enqueueTextHistoryPayload(doc, { fragmentKey: entry.fragmentKey })
    })
}

function getBridgeMap(doc: Y.Doc): Y.Map<unknown> {
    return doc.getMap(HISTORY_BRIDGE_KEY)
}

function enqueueTextHistoryPayload(doc: Y.Doc, payload: TextHistoryPayload) {
    let queue = pendingPayloads.get(doc)
    if (!queue) {
        queue = []
        pendingPayloads.set(doc, queue)
    }
    queue.push(payload)
    doc.transact(() => {
        const bridge = getBridgeMap(doc)
        const counter = (bridge.get('textCounter') as number | undefined) ?? 0
        bridge.set('textCounter', counter + 1)
    }, TEXT_HISTORY_ORIGIN)
}

function dequeuePayload(doc: Y.Doc): TextHistoryPayload | undefined {
    const queue = pendingPayloads.get(doc)
    if (!queue || queue.length === 0) {
        return undefined
    }
    return queue.shift()
}

export function getTextUndoManager(doc: Y.Doc, fragmentKey: string): Y.UndoManager {
    return getFragmentHistory(doc, fragmentKey).undoManager
}

export function registerDeckUndoManager(doc: Y.Doc, undoManager: Y.UndoManager) {
    if (bridgedDeckManagers.has(undoManager)) return
    bridgedDeckManagers.add(undoManager)

    const deckUndoManager = undoManager as UndoManagerWithCurrStack

    type StackEvent = {
        origin?: unknown
        type?: 'undo' | 'redo'
        stackItem: { meta: Map<unknown, unknown> }
    }

    const handleStackItemAdded = (event: StackEvent) => {
        if (event.origin === TEXT_HISTORY_ORIGIN) {
            const payload = dequeuePayload(doc)
            if (!payload) return
            event.stackItem.meta.set(TEXT_HISTORY_META_KEY, payload)
            return
        }

        if (event.origin === deckUndoManager) {
            const currStackItem = deckUndoManager.currStackItem
            const payload = currStackItem?.meta?.get(TEXT_HISTORY_META_KEY) as TextHistoryPayload | undefined
            if (!payload) return
            event.stackItem.meta.set(TEXT_HISTORY_META_KEY, payload)
        }
    }

    const handleStackItemPopped = (event: StackEvent) => {
        const payload = event.stackItem.meta.get(TEXT_HISTORY_META_KEY) as TextHistoryPayload | undefined
        if (!payload) return
        const entry = getFragmentHistory(doc, payload.fragmentKey)
        if (event.type === 'undo') {
            entry.undoManager.undo()
        } else {
            entry.undoManager.redo()
        }
    }

    undoManager.on('stack-item-added', handleStackItemAdded)
    undoManager.on('stack-item-popped', handleStackItemPopped)
}

export function ensureHistoryBridge(doc: Y.Doc) {
    return getBridgeMap(doc)
}

export { TEXT_HISTORY_ORIGIN }
