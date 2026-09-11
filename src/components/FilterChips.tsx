import type { ReactNode } from 'react'

interface FilterChipsProps<T extends string> {
  options: readonly { value: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (value: T) => void
  label?: string
}

/** The Area filter on list screens: a segmented pill group (outer pill on
 *  a `line-strong` border, 34px options, the active one on the raised
 *  fill). Mono uppercase labels; radio semantics. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: FilterChipsProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-pill border border-line-strong p-[3px]"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`relative inline-flex min-h-[34px] items-center gap-1.5 rounded-pill px-4 font-mono text-label uppercase transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] ${
              active ? 'bg-raised text-text' : 'text-text-3 hover:text-text'
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
