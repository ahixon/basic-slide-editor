import type { ReactNode } from 'react'
import { createContext, createElement, useContext, useMemo } from 'react'

export type SlideMeta = {
  id: string
  title: string
  summary: string
  presenterNotes: string
}

type DeckEditorState = {
  deckId: string
  layers: Record<string, unknown>
  properties: Record<string, unknown>
}

type DeckEditorStateProviderProps = {
  deckId: string
  children: ReactNode
}

const deckEditorStateCache = new Map<string, DeckEditorState>()
const DeckEditorStateContext = createContext<DeckEditorState | null>(null)

export function DeckEditorStateProvider({
  deckId,
  children,
}: DeckEditorStateProviderProps) {
  const value = useMemo(() => ensureDeckEditorState(deckId), [deckId])
  return createElement(DeckEditorStateContext.Provider, { value }, children)
}

export function useDeckEditorState() {
  const state = useContext(DeckEditorStateContext)
  if (!state) {
    throw new Error('useDeckEditorState must be used within DeckEditorStateProvider')
  }
  return state
}

export function buildMockSlides(deckId: string): SlideMeta[] {
  const templates = [
    'Opening narrative',
    'Problem framing',
    'Opportunity snapshot',
    'Solution overview',
    'Architecture sketch',
    'Roadmap + milestones',
    'Metrics + KPIs',
    'Closing next steps',
  ]

  return templates.map((title, index) => ({
    id: `${deckId}-${index + 1}`,
    title,
    summary: 'Editable summary placeholder awaiting rich text content.',
    presenterNotes: 'Use the presenter console to expand on this talking point.',
  }))
}

function ensureDeckEditorState(deckId: string): DeckEditorState {
  if (deckEditorStateCache.has(deckId)) {
    return deckEditorStateCache.get(deckId) as DeckEditorState
  }

  const freshState: DeckEditorState = {
    deckId,
    layers: {},
    properties: {},
  }
  deckEditorStateCache.set(deckId, freshState)
  return freshState
}
