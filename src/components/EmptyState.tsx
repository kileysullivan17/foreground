import { Link } from 'react-router-dom'

// Empty states share one shape across screens: the bullseye mark, a
// Caprasimo line, one quiet sentence, one clay action (plus an optional
// ghost link). Derived from the tokens; only What Now's copy comes
// straight from the reference.

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
      <span className="grid size-24 place-items-center rounded-pill border-[2.5px] border-sand-400 dark:border-sand-600" aria-hidden>
        <span className="grid size-16 place-items-center rounded-pill bg-sage-200 dark:bg-sage-800">
          <span className="size-[30px] rounded-pill bg-clay-500 dark:bg-clay-400" />
        </span>
      </span>
      <p className="mb-1.5 mt-[18px] font-display text-[22px] text-ink dark:text-ink-inverse">
        {title}
      </p>
      <p className="text-detail leading-[1.55] text-sand-700 dark:text-sand-400">{body}</p>
      <Link
        to={actionTo}
        className="mt-5 inline-flex min-h-12 items-center justify-center rounded-pill bg-clay-500 px-[26px] font-display text-[15px] text-ink hover:bg-clay-400 dark:bg-clay-400 dark:hover:bg-clay-300"
      >
        {actionLabel}
      </Link>
      {secondaryLabel && secondaryTo && (
        <Link
          to={secondaryTo}
          className="mt-1 inline-flex min-h-tap items-center text-detail font-semibold text-clay-700 hover:underline dark:text-clay-300"
        >
          {secondaryLabel}
        </Link>
      )}
    </div>
  )
}
