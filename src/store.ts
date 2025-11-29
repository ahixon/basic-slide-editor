import { useRoom } from '@liveblocks/react'
import { getYjsProviderForRoom } from '@liveblocks/yjs'
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { LiveblocksYjsProvider } from '@liveblocks/yjs'
import * as Y from 'yjs'

import { ensureHistoryBridge, registerDeckUndoManager, TEXT_HISTORY_ORIGIN } from './history/textHistory'

export const MIN_TEXT_WIDTH = 8
export const MIN_IMAGE_SIZE = 16

const DECK_HISTORY_ORIGIN = Symbol('deck-history')
const isDeckHistoryDebuggingEnabled = Boolean(import.meta.env?.DEV)

function logDeckHistory(message: string, payload?: unknown) {
    if (!isDeckHistoryDebuggingEnabled) return
    const logFn = message === 'stack-change' ? console.trace : console.debug
    if (typeof payload === 'undefined') {
        logFn(`[DeckHistory] ${message}`)
        return
    }
    logFn(`[DeckHistory] ${message}`, payload)
}

function formatTransactionOrigin(origin: unknown) {
    if (origin === DECK_HISTORY_ORIGIN) return 'deck'
    if (typeof origin === 'string') return origin
    const pluginKey = getPluginKeyName(origin)
    if (pluginKey) return pluginKey
    if (typeof origin === 'symbol') return origin.description ?? origin.toString()
    if (typeof origin === 'function') return origin.name || 'function'
    if (origin && typeof origin === 'object') {
        return origin.constructor?.name ?? 'object'
    }
    return origin ?? 'unknown'
}

type PluginOrigin = {
    key?: unknown
    name?: unknown
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
}

function getPluginKeyName(origin: unknown, seen = new Set<unknown>()): string | undefined {
    if (!origin || seen.has(origin)) return undefined
    if (typeof origin === 'string') return origin
    if (typeof origin === 'symbol') return origin.description ?? origin.toString()
    if (typeof origin === 'function') {
        const functionCandidate = origin as PluginOrigin
        return readString(functionCandidate.key) ?? origin.name ?? undefined
    }
    if (typeof origin !== 'object') return undefined
    seen.add(origin)
    const candidate = origin as PluginOrigin
    const direct = readString(candidate.key)
    if (direct) return direct
    if (candidate.key) {
        const nested = getPluginKeyName(candidate.key, seen)
        if (nested) return nested
    }
    return readString(candidate.name)
}

function describeYType(type?: Y.AbstractType<unknown>) {
    if (!type) return 'unknown'
    const name = type.constructor?.name ?? 'YType'
    const item = (type as { _item?: { parent?: Y.AbstractType<unknown> } })._item
    if (item?.parent) {
        const parent = item.parent
        if (parent?.constructor?.name) {
            return `${name}<${parent.constructor.name}>`
        }
    }
    return name
}

function describeTransactionChanges(transaction: Y.Transaction) {
    const changed: Array<{ type: string; keysChanged?: string[] }> = []
    transaction.changed?.forEach((meta, type) => {
        changed.push({
            type: describeYType(type),
            keysChanged: meta?.keysChanged ? Array.from(meta.keysChanged) : undefined,
        })
    })
    const parentTypes = Array.from(transaction.changedParentTypes ? transaction.changedParentTypes.keys() : [], describeYType)
    return { changed, parentTypes }
}

type DebuggableUndoManager = Y.UndoManager & {
    undoStack?: unknown[]
    redoStack?: unknown[]
}

function getUndoManagerSnapshot(undoManager: Y.UndoManager) {
    const manager = undoManager as DebuggableUndoManager
    return {
        undoDepth: manager.undoStack?.length ?? 'unknown',
        redoDepth: manager.redoStack?.length ?? 'unknown',
    }
}

export function transactDeck<T>(doc: Y.Doc, fn: () => T, debugLabel = 'transactDeck'): T {
    logDeckHistory(`transact:start:${debugLabel}`)
    const result = doc.transact(fn, DECK_HISTORY_ORIGIN)
    logDeckHistory(`transact:end:${debugLabel}`)
    return result
}

export function getTextFragmentKey(objectId: string): string {
    return `text-${objectId}`
}

const scheduleMicrotask = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (callback: () => void) => {
        Promise.resolve()
            .then(callback)
            .catch(() => {
                // Match queueMicrotask semantics by swallowing errors
            })
    }

export type DeckObjectBase = {
    id: string
    type: 'text' | 'image'
    x: number
    y: number
}

export type TextObject = DeckObjectBase & {
    type: 'text'
    text: string
    width?: number
    scale?: number
}

export type ImageObject = DeckObjectBase & {
    type: 'image'
    src?: string
    width: number
    height: number
}

export type DeckObject = TextObject | ImageObject

export type Slide = {
    id: string
    objects: DeckObject[]
}

export type Deck = {
    title: string
    slides: Record<string, Slide>
    slideOrder: string[]
}

export type DeckDocumentApi = {
    deck: Deck
    isSynced: boolean
    setDeckTitle: (title: string) => void
    addSlide: (slide: Slide) => Slide
    deleteSlide: (slideId: string) => Slide | undefined
    appendObjectToSlide: (slideId: string, object: DeckObject) => void
    updateObjectPosition: (slideId: string, objectId: string, position: { x: number; y: number }) => void
    updateTextObjectScale: (slideId: string, objectId: string, scale: number) => void
    updateTextObjectWidth: (slideId: string, objectId: string, width: number) => void
    updateImageObjectSource: (slideId: string, objectId: string, src: string) => void
    updateImageObjectSize: (slideId: string, objectId: string, size: { width: number; height: number }) => void
    deleteObjectFromSlide: (slideId: string, objectId: string) => void
}

const DECK_KEY = 'deck'
const TITLE_KEY = 'title'
const SLIDES_KEY = 'slides'
const SLIDE_ORDER_KEY = 'slideOrder'
const OBJECTS_KEY = 'objects'
const OBJECT_ORDER_KEY = 'objectOrder'

type DeckActionHandlers = Omit<DeckDocumentApi, 'deck' | 'isSynced'>

type DeckStructure = {
    deckMap: Y.Map<unknown>
    slideOrder: Y.Array<string>
    slides: Y.Map<Y.Map<unknown>>
}

type PartialDeckStructure = {
    deckMap: Y.Map<unknown>
    slideOrder?: Y.Array<string>
    slides?: Y.Map<Y.Map<unknown>>
}

const undoManagerCache = new WeakMap<Y.Doc, Y.UndoManager>()

export function useDeckUndoManager(): Y.UndoManager {
    const { doc, provider } = useDeckRuntime()
    return useMemo(() => getOrCreateUndoManager(doc, provider), [doc, provider])
}

function getOrCreateUndoManager(doc: Y.Doc, provider: LiveblocksYjsProvider): Y.UndoManager {
    ensureHistoryBridge(doc)
    const scope = collectUndoScope(doc, provider)
    const captureTransaction = createDeckCaptureTransaction()
    let undoManager = undoManagerCache.get(doc)
    if (!undoManager) {
        undoManager = new Y.UndoManager(scope, {
            doc,
            trackedOrigins: new Set([DECK_HISTORY_ORIGIN, TEXT_HISTORY_ORIGIN]),
            captureTransaction,
        })
        undoManagerCache.set(doc, undoManager)
        registerDeckUndoManager(doc, undoManager)
        return undoManager
    }
    undoManager.addToScope(scope)
    ;(undoManager as { captureTransaction?: (transaction: Y.Transaction) => boolean }).captureTransaction = captureTransaction
    registerDeckUndoManager(doc, undoManager)
    return undoManager
}

function createDeckCaptureTransaction() {
    return (transaction: Y.Transaction) => {
        const changedCount = transaction.changed?.size ?? 0
        const parentCount = transaction.changedParentTypes?.size ?? 0
        return changedCount > 0 || parentCount > 0
    }
}

function collectUndoScope(doc: Y.Doc, provider: LiveblocksYjsProvider): (Y.Doc | Y.AbstractType<unknown>)[] {
    const scope: (Y.Doc | Y.AbstractType<unknown>)[] = [doc]

    doc.share.forEach((type, key) => {
        if (shouldIncludeShareEntry(key)) {
            scope.push(type)
        }
    })

    provider.subdocHandlers.forEach((handler) => {
        const subDoc = handler.doc
        scope.push(subDoc)
        subDoc.share.forEach((type, key) => {
            if (shouldIncludeShareEntry(key)) {
                scope.push(type)
            }
        })
    })

    return scope
}

function shouldIncludeShareEntry(key?: string) {
    if (typeof key !== 'string') return true
    return !key.startsWith('text-')
}

function logDocTopology(doc: Y.Doc, provider: LiveblocksYjsProvider) {
    const describeShare = (target: Y.Doc) => {
        const entries: { key: string; type: string }[] = []
        target.share.forEach((type, key) => {
            entries.push({ key, type: type.constructor?.name ?? 'UnknownType' })
        })
        return entries
    }

    const rootEntries = describeShare(doc)
    const subdocs = Array.from(provider.subdocHandlers.entries()).map(([guid, handler]) => ({
        guid,
        share: describeShare(handler.doc),
    }))

    console.debug('[DeckHistory] Y.Doc share snapshot', { root: rootEntries, subdocs })
}

export function useDeckDocument(): DeckDocumentApi {
    const { doc, provider } = useDeckRuntime()
    const deck = useDeckValue(doc)
    const isSynced = useProviderSyncStatus(provider)
    const actions = useMemo(() => createDeckActions(doc), [doc])

    return useMemo(() => ({ deck, isSynced, ...actions }), [actions, deck, isSynced])
}

export function useDeckState() {
    const { doc, provider } = useDeckRuntime()
    const deck = useDeckValue(doc)
    const isSynced = useProviderSyncStatus(provider)
    return { deck, isSynced }
}

export function useDeckActions(): DeckActionHandlers {
    const { doc } = useDeckRuntime()
    return useMemo(() => createDeckActions(doc), [doc])
}

export function useDeckHistory() {
    const { doc, provider } = useDeckRuntime()
    const undoManager = useDeckUndoManager()

    useEffect(() => {
        if (!import.meta.env?.DEV) return
        logDocTopology(doc, provider)
    }, [doc, provider])

    const snapshotRef = useRef<HistorySnapshot | null>(null)

    const subscribe = useCallback(
        (callback: () => void) => {
            let scheduled = false
            const resetSnapshot = () => {
                snapshotRef.current = null
            }
            const notify = () => {
                if (scheduled) return
                scheduled = true
                scheduleMicrotask(() => {
                    scheduled = false
                    resetSnapshot()
                    callback()
                })
            }
            const handleStackChange = (event?: unknown) => {
                logDeckHistory('stack-change', {
                    event,
                    ...getUndoManagerSnapshot(undoManager),
                })
                notify()
            }
            undoManager.on('stack-item-added', handleStackChange)
            undoManager.on('stack-item-popped', handleStackChange)
            undoManager.on('stack-cleared', handleStackChange)
            return () => {
                undoManager.off('stack-item-added', handleStackChange)
                undoManager.off('stack-item-popped', handleStackChange)
                undoManager.off('stack-cleared', handleStackChange)
            }
        },
        [undoManager],
    )

    const buildSnapshot = useCallback((): HistorySnapshot => ({
        canUndo: undoManager.canUndo(),
        canRedo: undoManager.canRedo(),
    }), [undoManager])

    const getSnapshot = useCallback(() => {
        if (!snapshotRef.current) {
            snapshotRef.current = buildSnapshot()
        }
        return snapshotRef.current
    }, [buildSnapshot])

    const historyState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    const undo = useCallback(() => {
        logDeckHistory('undo:invoke', getUndoManagerSnapshot(undoManager))
        undoManager.undo()
    }, [undoManager])

    const redo = useCallback(() => {
        logDeckHistory('redo:invoke', getUndoManagerSnapshot(undoManager))
        undoManager.redo()
    }, [undoManager])

    useEffect(() => {
        if (!isDeckHistoryDebuggingEnabled) return
        const handleAfterTransaction = (transaction: Y.Transaction) => {
            const originLabel = formatTransactionOrigin(transaction.origin)
            const changeSummary = describeTransactionChanges(transaction)
            logDeckHistory('after-transaction', {
                origin: originLabel,
                hasChanged: transaction.changed.size,
                hasChangedParents: transaction.changedParentTypes.size,
                ...changeSummary,
            })
        }
        doc.on('afterTransaction', handleAfterTransaction)
        return () => {
            doc.off('afterTransaction', handleAfterTransaction)
        }
    }, [doc])

    return {
        undo,
        redo,
        canUndo: historyState.canUndo,
        canRedo: historyState.canRedo,
    }
}

type HistorySnapshot = {
    canUndo: boolean
    canRedo: boolean
}

export function useDeckRuntime() {
    const room = useRoom()
    const provider = useMemo(() => getYjsProviderForRoom(room), [room])
    const doc = useMemo(() => provider.getYDoc(), [provider])
    return { provider, doc }
}

function useDeckValue(doc: Y.Doc): Deck {
    const getSnapshot = useCallback(() => serializeDeck(doc), [doc])
    return useDocSubscription(doc, getSnapshot)
}

function useDocSubscription<T>(doc: Y.Doc, buildSnapshot: () => T): T {
    const snapshotRef = useRef<T | null>(null)

    const subscribe = useCallback(
        (callback: () => void) => {
            const { deckMap } = getDeckStructure(doc)
            let scheduled = false
            const notify = () => {
                if (scheduled) return
                scheduled = true
                scheduleMicrotask(() => {
                    scheduled = false
                    snapshotRef.current = null
                    callback()
                })
            }
            const handler = () => notify()
            deckMap.observeDeep(handler)
            return () => {
                deckMap.unobserveDeep(handler)
            }
        },
        [doc],
    )

    const getSnapshot = useCallback(() => {
        if (!snapshotRef.current) {
            snapshotRef.current = buildSnapshot()
        }
        return snapshotRef.current
    }, [buildSnapshot])

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function serializeDeck(doc: Y.Doc): Deck {
    const { deckMap, slideOrder, slides } = getDeckStructure(doc)
    const order = slideOrder?.toArray() ?? []
    const slidesRecord: Record<string, Slide> = {}

    order.forEach((slideId) => {
        const ySlide = slides?.get(slideId)
        if (!ySlide) return
        slidesRecord[slideId] = ySlideToSlide(ySlide)
    })

    const titleValue = deckMap.get(TITLE_KEY)
    const title = typeof titleValue === 'string' ? titleValue : ''

    return {
        title,
        slideOrder: order,
        slides: slidesRecord,
    }
}

function ySlideToSlide(ySlide: Y.Map<unknown>): Slide {
    const id = (ySlide.get('id') as string) ?? ''
    const { objects: objectsMap, order } = ensureSlideContainers(ySlide)
    const orderedIds = order.toArray()
    const objects: DeckObject[] = []

    orderedIds.forEach((objectId) => {
        const yObject = objectsMap.get(objectId)
        if (yObject) {
            objects.push(yObjectToDeckObject(yObject))
        }
    })

    // Fallback for stray objects without ordering entries
    objectsMap.forEach((yObject, objectId) => {
        if (!orderedIds.includes(objectId)) {
            objects.push(yObjectToDeckObject(yObject))
        }
    })

    return {
        id,
        objects,
    }
}

function yObjectToDeckObject(yObject: Y.Map<unknown>): DeckObject {
    const base = {
        id: (yObject.get('id') as string) ?? '',
        x: (yObject.get('x') as number) ?? 0,
        y: (yObject.get('y') as number) ?? 0,
    }
    const type = yObject.get('type')

    if (type === 'image') {
        const rawSrc = yObject.get('src')
        return {
            ...base,
            type: 'image',
            src: typeof rawSrc === 'string' ? rawSrc : undefined,
            width: (yObject.get('width') as number) ?? 0,
            height: (yObject.get('height') as number) ?? 0,
        }
    }

    return {
        ...base,
        type: 'text',
        text: (yObject.get('text') as string) ?? '',
        width: yObject.get('width') as number | undefined,
        scale: yObject.get('scale') as number | undefined,
    }
}

function createDeckActions(doc: Y.Doc): DeckActionHandlers {
    return {
        setDeckTitle: (title: string) => setDeckTitle(doc, title),
        addSlide: (slide: Slide) => addSlide(doc, slide),
        deleteSlide: (slideId: string) => deleteSlide(doc, slideId),
        appendObjectToSlide: (slideId: string, object: DeckObject) => appendObjectToSlide(doc, slideId, object),
        updateObjectPosition: (slideId: string, objectId: string, position: { x: number; y: number }) =>
            updateObjectPosition(doc, slideId, objectId, position),
        updateTextObjectScale: (slideId: string, objectId: string, scale: number) =>
            updateTextObjectScale(doc, slideId, objectId, scale),
        updateTextObjectWidth: (slideId: string, objectId: string, width: number) =>
            updateTextObjectWidth(doc, slideId, objectId, width),
        updateImageObjectSource: (slideId: string, objectId: string, src: string) =>
            updateImageObjectSource(doc, slideId, objectId, src),
        updateImageObjectSize: (slideId: string, objectId: string, size: { width: number; height: number }) =>
            updateImageObjectSize(doc, slideId, objectId, size),
        deleteObjectFromSlide: (slideId: string, objectId: string) => deleteObjectFromSlide(doc, slideId, objectId),
    }
}

function setDeckTitle(doc: Y.Doc, title: string) {
    transactDeck(doc, () => {
        const { deckMap } = ensureDeckStructure(doc)
        deckMap.set(TITLE_KEY, title)
    }, 'setDeckTitle')
}

function addSlide(doc: Y.Doc, slide: Slide): Slide {
    transactDeck(doc, () => {
        const { slides, slideOrder } = ensureDeckStructure(doc)
        const ySlide = createYSlide(slide)
        slides.set(slide.id, ySlide)
        slideOrder.push([slide.id])
    }, 'addSlide')
    return slide
}

function deleteSlide(doc: Y.Doc, slideId: string): Slide | undefined {
    let fallback: Slide | undefined
    transactDeck(doc, () => {
        const { slides, slideOrder } = ensureDeckStructure(doc)
        const ySlide = slides.get(slideId)
        if (!ySlide) return

        const currentOrder = slideOrder.toArray()
        const removalIndex = currentOrder.indexOf(slideId)
        if (removalIndex === -1) return

        slideOrder.delete(removalIndex, 1)
        slides.delete(slideId)

        const nextOrder = slideOrder.toArray()
        const fallbackId = nextOrder[removalIndex] ?? nextOrder[removalIndex - 1] ?? nextOrder[0]
        if (fallbackId) {
            const fallbackSlide = slides.get(fallbackId)
            if (fallbackSlide) {
                fallback = ySlideToSlide(fallbackSlide)
            }
        }
    }, 'deleteSlide')
    return fallback
}

function appendObjectToSlide(doc: Y.Doc, slideId: string, object: DeckObject) {
    transactDeck(doc, () => {
        const { slides } = ensureDeckStructure(doc)
        const ySlide = slides.get(slideId)
        if (!ySlide) return
        const { objects, order } = ensureSlideContainers(ySlide)
        objects.set(object.id, createYObject(object))
        if (!order.toArray().includes(object.id)) {
            order.push([object.id])
        }
        if (object.type === 'text') {
            ensureTextFragmentInitialized(doc, object, { insideTransaction: true })
        }
    }, 'appendObjectToSlide')
}

function updateObjectPosition(doc: Y.Doc, slideId: string, objectId: string, position: { x: number; y: number }) {
    transactDeck(doc, () => {
        const yObject = findObject(doc, slideId, objectId)
        if (!yObject) return
        yObject.set('x', position.x)
        yObject.set('y', position.y)
    }, 'updateObjectPosition')
}

function updateTextObjectScale(doc: Y.Doc, slideId: string, objectId: string, scale: number) {
    const normalizedScale = Number.isFinite(scale) && scale > 0 ? scale : 1
    transactDeck(doc, () => {
        const yObject = findObject(doc, slideId, objectId)
        if (!yObject || yObject.get('type') !== 'text') return
        yObject.set('scale', normalizedScale)
    }, 'updateTextObjectScale')
}

function updateTextObjectWidth(doc: Y.Doc, slideId: string, objectId: string, width: number) {
    const normalizedWidth = Number.isFinite(width) ? Math.max(width, MIN_TEXT_WIDTH) : MIN_TEXT_WIDTH
    transactDeck(doc, () => {
        const yObject = findObject(doc, slideId, objectId)
        if (!yObject || yObject.get('type') !== 'text') return
        yObject.set('width', normalizedWidth)
    }, 'updateTextObjectWidth')
}

function updateImageObjectSource(doc: Y.Doc, slideId: string, objectId: string, src: string) {
    const normalizedSrc = typeof src === 'string' ? src.trim() : ''
    transactDeck(doc, () => {
        const yObject = findObject(doc, slideId, objectId)
        if (!yObject || yObject.get('type') !== 'image') return
        if (normalizedSrc) {
            yObject.set('src', normalizedSrc)
        } else {
            yObject.delete('src')
        }
    }, 'updateImageObjectSource')
}

function updateImageObjectSize(doc: Y.Doc, slideId: string, objectId: string, size: { width: number; height: number }) {
    const normalizedWidth = Number.isFinite(size.width) ? Math.max(size.width, MIN_IMAGE_SIZE) : MIN_IMAGE_SIZE
    const normalizedHeight = Number.isFinite(size.height) ? Math.max(size.height, MIN_IMAGE_SIZE) : MIN_IMAGE_SIZE
    transactDeck(doc, () => {
        const yObject = findObject(doc, slideId, objectId)
        if (!yObject || yObject.get('type') !== 'image') return
        yObject.set('width', normalizedWidth)
        yObject.set('height', normalizedHeight)
    }, 'updateImageObjectSize')
}

function deleteObjectFromSlide(doc: Y.Doc, slideId: string, objectId: string) {
    transactDeck(doc, () => {
        const { slides } = ensureDeckStructure(doc)
        const ySlide = slides.get(slideId)
        if (!ySlide) return
        const { objects, order } = ensureSlideContainers(ySlide)
        if (!objects.has(objectId)) return
        objects.delete(objectId)
        const orderedIds = order.toArray()
        const removalIndex = orderedIds.indexOf(objectId)
        if (removalIndex >= 0) {
            order.delete(removalIndex, 1)
        }
    }, 'deleteObjectFromSlide')
}

function createYSlide(slide: Slide): Y.Map<unknown> {
    const ySlide = new Y.Map<unknown>()
    ySlide.set('id', slide.id)
    const objects = new Y.Map<Y.Map<unknown>>()
    const order = new Y.Array<string>()
    slide.objects.forEach((object) => {
        objects.set(object.id, createYObject(object))
        order.push([object.id])
    })
    ySlide.set(OBJECTS_KEY, objects)
    ySlide.set(OBJECT_ORDER_KEY, order)
    return ySlide
}

function createYObject(object: DeckObject): Y.Map<unknown> {
    const yObject = new Y.Map<unknown>()
    yObject.set('id', object.id)
    yObject.set('type', object.type)
    yObject.set('x', object.x)
    yObject.set('y', object.y)

    if (object.type === 'text') {
        yObject.set('text', object.text)
        if (typeof object.width === 'number') {
            yObject.set('width', object.width)
        }
        if (typeof object.scale === 'number') {
            yObject.set('scale', object.scale)
        }
    } else {
        if (typeof object.src === 'string' && object.src.trim()) {
            yObject.set('src', object.src.trim())
        }
        yObject.set('width', object.width)
        yObject.set('height', object.height)
    }

    return yObject
}

export function ensureTextFragmentInitialized(doc: Y.Doc, object: TextObject, options?: { insideTransaction?: boolean }) {
    const seedFragment = () => {
        const fragment = doc.getXmlFragment(getTextFragmentKey(object.id))
        if (fragment.length > 0) return

        const paragraph = new Y.XmlElement('paragraph')
        const textNode = new Y.XmlText()
        if (object.text) {
            textNode.insert(0, object.text)
        }
        paragraph.insert(0, [textNode])
        fragment.insert(0, [paragraph])
    }

    if (options?.insideTransaction) {
        seedFragment()
        return
    }

    transactDeck(doc, seedFragment, 'ensureTextFragmentInitialized')
}

function findObject(doc: Y.Doc, slideId: string, objectId: string): Y.Map<unknown> | null {
    const { slides } = ensureDeckStructure(doc)
    const ySlide = slides.get(slideId)
    if (!ySlide) return null
    const { objects } = ensureSlideContainers(ySlide)
    return objects.get(objectId) ?? null
}

function useProviderSyncStatus(provider: LiveblocksYjsProvider): boolean {
    return useSyncExternalStore(
        (callback) => {
            const handleSync = () => callback()
            provider.on('sync', handleSync)
            return () => {
                provider.off('sync', handleSync)
            }
        },
        () => provider.synced,
        () => true,
    )
}

function getDeckStructure(doc: Y.Doc): PartialDeckStructure {
    const deckMap = doc.getMap<unknown>(DECK_KEY)
    const slideOrderValue = deckMap.get(SLIDE_ORDER_KEY)
    const slidesValue = deckMap.get(SLIDES_KEY)

    return {
        deckMap,
        slideOrder: slideOrderValue instanceof Y.Array ? (slideOrderValue as Y.Array<string>) : undefined,
        slides: slidesValue instanceof Y.Map ? (slidesValue as Y.Map<Y.Map<unknown>>) : undefined,
    }
}

function ensureDeckStructure(doc: Y.Doc): DeckStructure {
    const { deckMap, slideOrder: existingOrder, slides: existingSlides } = getDeckStructure(doc)

    let slideOrder = existingOrder
    if (!slideOrder) {
        slideOrder = new Y.Array<string>()
        deckMap.set(SLIDE_ORDER_KEY, slideOrder)
    }

    let slides = existingSlides
    if (!slides) {
        slides = new Y.Map<Y.Map<unknown>>()
        deckMap.set(SLIDES_KEY, slides)
    }

    if (typeof deckMap.get(TITLE_KEY) !== 'string') {
        deckMap.set(TITLE_KEY, '')
    }

    return {
        deckMap,
        slideOrder,
        slides,
    }
}

function ensureSlideContainers(ySlide: Y.Map<unknown>): {
    objects: Y.Map<Y.Map<unknown>>
    order: Y.Array<string>
} {
    let objectsValue = ySlide.get(OBJECTS_KEY)
    let orderValue = ySlide.get(OBJECT_ORDER_KEY)

    if (objectsValue instanceof Y.Array) {
        const legacyArray = objectsValue as Y.Array<Y.Map<unknown>>
        const migratedObjects = new Y.Map<Y.Map<unknown>>()
        const migratedOrder = new Y.Array<string>()
        legacyArray.toArray().forEach((yObject) => {
            const objectId = (yObject.get('id') as string) ?? ''
            if (!objectId) return
            migratedObjects.set(objectId, yObject)
            migratedOrder.push([objectId])
        })
        ySlide.set(OBJECTS_KEY, migratedObjects)
        ySlide.set(OBJECT_ORDER_KEY, migratedOrder)
        objectsValue = migratedObjects
        orderValue = migratedOrder
    }

    let objects: Y.Map<Y.Map<unknown>>
    if (objectsValue instanceof Y.Map) {
        objects = objectsValue as Y.Map<Y.Map<unknown>>
    } else {
        objects = new Y.Map<Y.Map<unknown>>()
        ySlide.set(OBJECTS_KEY, objects)
    }

    let order: Y.Array<string>
    if (orderValue instanceof Y.Array) {
        order = orderValue as Y.Array<string>
    } else {
        order = new Y.Array<string>()
        objects.forEach((_, key) => {
            if (key) {
                order.push([key])
            }
        })
        ySlide.set(OBJECT_ORDER_KEY, order)
    }

    return { objects, order }
}