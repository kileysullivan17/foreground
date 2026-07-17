interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label?: string
}

/** Small form-level segmented control in the Organic language: one pill
 *  outline, the checked option filled clay. List screens use FilterChips
 *  instead; this stays for compact form fields (area, effort). */
export function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-pill border border-ink/18 dark:border-ink-inverse/22"
    >
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={`min-h-tap px-4 text-[13.5px] transition-colors ${
            i > 0 ? 'border-l border-ink/18 dark:border-ink-inverse/22' : ''
          } ${
            opt.value === value
              ? 'bg-clay-500 font-semibold text-ink dark:bg-clay-400'
              : 'text-sand-800 hover:bg-ink/5 dark:text-sand-300 dark:hover:bg-ink-inverse/8'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
