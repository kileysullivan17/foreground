import { Link } from 'react-router-dom'

// Empty states share one shape across screens: the paired-discs mark, one
// Archivo line, one quiet sentence, one accent action (plus an optional
// ghost link). Only What Now's copy comes straight from the reference.

export function EmptyState({
  title,
  body,
  actionLabel,
  actionTo,
  secondaryLabel,
  secondaryTo,
}: {
  title: string
  body: string
  actionLabel: string
  actionTo: string
  secondaryLabel?: string
  secondaryTo?: string
}) {
  return (
    <div className="flex flex-col items-center px-10 py-12 text-center">
      <span className="grid size-24 place-items-center rounded-pill border border-line-strong" aria-hidden>
        <span className="grid size-16 place-items-center rounded-pill bg-raised">
          <span className="size-[30px] rounded-pill bg-accent shadow-[0_0_24px_var(--color-accent-glow)]" />
        </span>
      </span>
      <p className="mb-1.5 mt-[18px] text-[20px] font-semibold tracking-[-0.01em] text-text">
        {title}
      </p>
      <p className="text-body text-text-2">{body}</p>
      <Link
        to={actionTo}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-pill bg-accent px-5 text-[14px] font-semibold text-accent-ink hover:bg-accent-hover active:translate-y-px"
      >
        {actionLabel}
      </Link>
      {secondaryLabel && secondaryTo && (
        <Link
          to={secondaryTo}
          className="mt-1 inline-flex min-h-tap items-center text-[13.5px] font-semibold text-accent hover:underline"
        >
          {secondaryLabel}
        </Link>
      )}
    </div>
  )
}
