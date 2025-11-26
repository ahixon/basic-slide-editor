import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <h3 className="text-lg font-semibold">Welcome Home!</h3>
    </div>
  )
}