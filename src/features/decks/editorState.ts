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
  id: string
  title: string
  slides: Slide[]
}

export type DeckState = Record<string, Deck>

export const decksById: DeckState = {
  strategy2025: {
    id: 'strategy2025',
    title: '2025 Strategy Brief',
    slides: [
      {
        id: 'strategy2025-intro',
        objects: [
          {
            id: 'headline',
            type: 'text',
            x: 80,
            y: 60,
            text: 'North Star Vision',
            width: 520,
          },
          {
            id: 'supporting-copy',
            type: 'text',
            x: 80,
            y: 140,
            text: 'Deliver a unified collaboration surface for every customer conversation.',
            width: 460,
          },
          {
            id: 'hero-image',
            type: 'image',
            x: 360,
            y: 260,
            src: '/images/mock-canvas.png',
            width: 280,
            height: 180,
          },
        ],
      },
      {
        id: 'strategy2025-roadmap',
        objects: [
          {
            id: 'milestones-headline',
            type: 'text',
            x: 72,
            y: 56,
            text: 'Milestones',
          },
          {
            id: 'milestone-copy',
            type: 'text',
            x: 72,
            y: 120,
            text: 'Q1 - Research, Q2 - Design Sprint, Q3 - Private Preview, Q4 - GA',
            width: 520,
          },
          {
            id: 'timeline-art',
            type: 'image',
            x: 280,
            y: 220,
            src: '/images/timeline.png',
            width: 320,
            height: 140,
          },
        ],
      },
    ],
  },
  salesKickoff: {
    id: 'salesKickoff',
    title: 'Sales Kickoff Highlights',
    slides: [
      {
        id: 'salesKickoff-momentum',
        objects: [
          {
            id: 'title-block',
            type: 'text',
            x: 64,
            y: 48,
            text: 'Pipeline Momentum',
            width: 420,
          },
          {
            id: 'metric-one',
            type: 'text',
            x: 64,
            y: 160,
            text: '$48M sourced pipeline in Q3',
          },
          {
            id: 'logo-wall',
            type: 'image',
            x: 320,
            y: 200,
            src: '/images/logo-wall.png',
            width: 320,
            height: 120,
          },
        ],
      },
      {
        id: 'salesKickoff-wins',
        objects: [
          {
            id: 'wins-headline',
            type: 'text',
            x: 72,
            y: 64,
            text: 'Customer Wins',
          },
          {
            id: 'wins-copy',
            type: 'text',
            x: 72,
            y: 140,
            text: 'FinServe, HealthPro, and Retailio rolled out pilots in under 30 days.',
            width: 500,
          },
          {
            id: 'wins-image',
            type: 'image',
            x: 320,
            y: 240,
            src: '/images/customer-quotes.png',
            width: 300,
            height: 150,
          },
        ],
      },
    ],
  },
  designExploration: {
    id: 'designExploration',
    title: 'Design Exploration Board',
    slides: [
      {
        id: 'designExploration-overview',
        objects: [
          {
            id: 'intro-copy',
            type: 'text',
            x: 96,
            y: 72,
            text: 'Exploring new layout directions for the editor shell.',
            width: 500,
          },
          {
            id: 'notes',
            type: 'text',
            x: 96,
            y: 400,
            text: 'Next: validate with design review and prototype interactions.',
          },
        ],
      },
      {
        id: 'designExploration-wireframes',
        objects: [
          {
            id: 'wireframe-a',
            type: 'image',
            x: 120,
            y: 160,
            src: '/images/wireframe-a.png',
            width: 220,
            height: 160,
          },
          {
            id: 'wireframe-b',
            type: 'image',
            x: 380,
            y: 180,
            src: '/images/wireframe-b.png',
            width: 220,
            height: 140,
          },
          {
            id: 'caption',
            type: 'text',
            x: 120,
            y: 360,
            text: 'Concept A simplifies tool chrome; Concept B emphasizes collaboration.',
            width: 420,
          },
        ],
      },
    ],
  },
}

export function getDeck(deckId: string): Deck | undefined {
  return decksById[deckId]
}

