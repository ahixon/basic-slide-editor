import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/decks/$deckId/presenter')({
  component: PresenterConsole,
})

function PresenterConsole() {
  const { deckId } = Route.useParams()

  return (
    <section className="space-y-3 bg-slate-50 p-4 dark:bg-slate-950">
      <header>
        <p className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Presenter Console
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Deck {deckId}</h1>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-h-[200px] rounded border border-dashed border-neutral-300 p-4 text-slate-700 dark:border-slate-700 dark:text-slate-300">
          Current slide preview placeholder.
        </div>
        <div className="min-h-[200px] rounded border border-dashed border-neutral-300 p-4 text-slate-700 dark:border-slate-700 dark:text-slate-300">
          Next slide preview + timers placeholder.
        </div>
      </div>
      <div className="rounded border border-dashed border-neutral-300 p-4 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">
        Speaker notes + live controls placeholder.
      </div>
    </section>
  )
}
