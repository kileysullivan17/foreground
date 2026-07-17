import type { ReactNode } from 'react'

interface FilterChipsProps<T extends string> {
  options: readonly { value: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (value: T) => void
  label?: string
}

/** Pill-shaped filter chips (the Organic replacement for the old segmented
 *  control on list screens). Radio semantics, 38px minimum height. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: FilterChipsProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-pill px-4 text-[13.5px] ${
              active
                ? 'bg-clay-500 font-semibold text-ink dark:bg-clay-400'
                : 'border border-ink/20 text-sand-800 hover:bg-ink/5 dark:border-ink-inverse/25 dark:text-sand-300 dark:hover:bg-ink-inverse/8'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
