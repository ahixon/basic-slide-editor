import type { ChangeEventHandler } from 'react'

type DeckTitleInputProps = {
  value: string
  onChange: (nextTitle: string) => void
}

export const DeckTitleInput = ({ value, onChange }: DeckTitleInputProps) => {
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onChange(event.target.value)
  }

  return (
    <label className="w-full">
      <span className="sr-only">Slide deck title</span>
      <input
        aria-label="Slide deck title"
        placeholder='Slide deck title'
        value={value}
        onChange={handleChange}
        className="w-full rounded-lg border border-transparent bg-white/80 px-3 py-2 text-lg font-semibold text-neutral-800 outline-none transition-colors focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:bg-slate-900 dark:focus:ring-sky-400/30"
      />
    </label>
  )
}
