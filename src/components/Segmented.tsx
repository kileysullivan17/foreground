interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label?: string
  /** 'sm' is the 34px in-row control; 'md' is the 40px form field. */
  size?: 'sm' | 'md'
  className?: string
}

/** Form-level segmented control in the Ember language: one outlined pill
 *  with 3px inset, the checked option on the raised fill, mono uppercase
 *  labels. List screens use FilterChips for the same look with a filter's
 *  radio semantics. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'sm',
  className = '',
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex rounded-pill border border-line-strong p-[3px] ${className}`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-pill px-4 font-mono text-label uppercase transition-colors ${
            size === 'md' ? 'min-h-10' : 'min-h-[34px]'
          } ${opt.value === value ? 'bg-raised text-text' : 'text-text-3 hover:text-text'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
