import { create } from 'zustand'
import { createClient } from "@liveblocks/client";
import { liveblocks } from "@liveblocks/zustand";
import type { WithLiveblocks } from "@liveblocks/zustand";

export const MIN_TEXT_WIDTH = 96

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
    src: string
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

type DeckStoreState = {
    deck: Deck;
    setDeckTitle: (title: string) => void
    addSlide: (slide: Slide) => Slide
    deleteSlide: (slideId: string) => Slide | undefined
    appendObjectToSlide: (slideId: string, object: DeckObject) => void
    updateObjectPosition: (slideId: string, objectId: string, position: { x: number; y: number }) => void
    updateTextObjectScale: (slideId: string, objectId: string, scale: number) => void
    updateTextObjectWidth: (slideId: string, objectId: string, width: number) => void
}

const client = createClient({
    publicApiKey: import.meta.env.VITE_LIVEBLOCKS_KEY,
});

export const useDeckStore = create<WithLiveblocks<DeckStoreState>>()(liveblocks(
    (set) => ({
        deck: {
            title: '',
            slides: {},
            slideOrder: [],
        },
        setDeckTitle: (title) =>
            set((state) => ({
                deck: {
                    ...state.deck,
                    title,
                },
            })),
        addSlide: (slide) => {
            const createdSlide = { ...slide, objects: [...slide.objects] }
            set((state) => ({
                deck: {
                    ...state.deck,
                    slides: {
                        ...state.deck.slides,
                        [createdSlide.id]: createdSlide,
                    },
                    slideOrder: [...state.deck.slideOrder, createdSlide.id],
                },
            }))
            return createdSlide
        },
        deleteSlide: (slideId) => {
            let fallback: Slide | undefined
            set((state) => {
                if (!slideId || !state.deck.slides[slideId]) return state
                const { slides, slideOrder } = state.deck
                const removalIndex = slideOrder.indexOf(slideId)
                const nextSlideOrder = slideOrder.filter((id) => id !== slideId)
                const fallbackId = nextSlideOrder[removalIndex] ?? nextSlideOrder[removalIndex - 1] ?? nextSlideOrder[0]
                const nextSlides = { ...slides }
                delete nextSlides[slideId]
                fallback = fallbackId ? slides[fallbackId] : undefined
                return {
                    deck: { ...state.deck, slides: nextSlides, slideOrder: nextSlideOrder },
                }
            })
            return fallback
        },
        appendObjectToSlide: (slideId, object) =>
            set((state) => {
                const targetSlide = state.deck.slides[slideId]
                if (!targetSlide) return state
                const updatedSlide = { ...targetSlide, objects: [...targetSlide.objects, object] }
                return {
                    deck: {
                        ...state.deck,
                        slides: {
                            ...state.deck.slides,
                            [slideId]: updatedSlide,
                        },
                    },
                }
            }),
        updateObjectPosition: (slideId, objectId, position) =>
            set((state) => {
                const targetSlide = state.deck.slides[slideId]
                if (!targetSlide) return state

                let didUpdate = false
                const nextObjects = targetSlide.objects.map((object) => {
                    if (object.id !== objectId) {
                        return object
                    }
                    didUpdate = true
                    return {
                        ...object,
                        x: position.x,
                        y: position.y,
                    }
                })

                if (!didUpdate) return state

                return {
                    deck: {
                        ...state.deck,
                        slides: {
                            ...state.deck.slides,
                            [slideId]: {
                                ...targetSlide,
                                objects: nextObjects,
                            },
                        },
                    },
                }
            }),
        updateTextObjectScale: (slideId, objectId, scale) =>
            set((state) => {
                const targetSlide = state.deck.slides[slideId]
                if (!targetSlide) return state

                const normalizedScale = Number.isFinite(scale)
                    ? Math.min(Math.max(scale, 0.1), 8)
                    : 1

                let didUpdate = false
                const nextObjects = targetSlide.objects.map((object) => {
                    if (object.id !== objectId || object.type !== 'text') {
                        return object
                    }

                    if (object.scale === normalizedScale) {
                        return object
                    }

                    didUpdate = true
                    return {
                        ...object,
                        scale: normalizedScale,
                    }
                })

                if (!didUpdate) return state

                return {
                    deck: {
                        ...state.deck,
                        slides: {
                            ...state.deck.slides,
                            [slideId]: {
                                ...targetSlide,
                                objects: nextObjects,
                            },
                        },
                    },
                }
            }),
        updateTextObjectWidth: (slideId, objectId, width) =>
            set((state) => {
                const targetSlide = state.deck.slides[slideId]
                if (!targetSlide) return state

                const normalizedWidth = Number.isFinite(width)
                    ? Math.max(width, MIN_TEXT_WIDTH)
                    : MIN_TEXT_WIDTH

                let didUpdate = false
                const nextObjects = targetSlide.objects.map((object) => {
                    if (object.id !== objectId || object.type !== 'text') {
                        return object
                    }

                    if (object.width === normalizedWidth) {
                        return object
                    }

                    didUpdate = true
                    return {
                        ...object,
                        width: normalizedWidth,
                    }
                })

                if (!didUpdate) return state

                return {
                    deck: {
                        ...state.deck,
                        slides: {
                            ...state.deck.slides,
                            [slideId]: {
                                ...targetSlide,
                                objects: nextObjects,
                            },
                        },
                    },
                }
            }),
    }), { client, storageMapping: { deck: true } },
))