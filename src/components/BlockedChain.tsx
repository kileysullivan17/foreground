import type { Item } from '../types'

// The 1h treatment for a blocked card: the dependency chain replaces the
// score. "Waits on" walks unfinished dependencies down to the actionable
// root, which gets the one warm highlight and a link back into the ranking;
// "Would unblock" lists the open items waiting on this one, each with the
// +8 its completion would feed their score. Pure presentation over the
// same dependency data DependencyView reads.

const LockIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="5" y="11" width="14" height="9" rx="2.5" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

export function BlockedTag() {
  return (
    <span className="inline-flex flex-none items-center gap-1.5 rounded-pill bg-sand-200 px-2.5 py-[3px] text-micro font-semibold normal-case tracking-normal text-sand-800 dark:bg-surface-dark-raised dark:text-sand-300">
      <LockIcon />
      blocked
    </span>
  )
}

const unfinishedDeps = (item: Item, all: Item[]): Item[] =>
  item.dependsOn
    .map((id) => all.find((i) => i.id === id))
    .filter((d): d is Item => d !== undefined && d.status !== 'done')

interface ChainEntry {
  item: Item
  actionable: boolean
}

// Built as a pure step before rendering (same reasoning as DependencyView):
// a Set mutated during render would break under StrictMode's double render
// and hide every node.
function buildChain(root: Item, all: Item[]): ChainEntry[] {
  const out: ChainEntry[] = []
  const visited = new Set([root.id])
  const walk = (item: Item) => {
    for (const dep of unfinishedDeps(item, all)) {
      if (visited.has(dep.id)) continue
      visited.add(dep.id)
      const actionable = unfinishedDeps(dep, all).length === 0
      out.push({ item: dep, actionable })
      if (!actionable) walk(dep)
    }
  }
  walk(root)
  return out
}

function ChainNode({
  entry,
  last,
  rank,
  onJump,
}: {
  entry: ChainEntry
  last: boolean
  rank: number | undefined
  onJump: (id: string) => void
}) {
  if (entry.actionable) {
    return (
      <div className="flex gap-3">
        <span className="flex w-3.5 flex-none flex-col items-center" aria-hidden>
          <span className="mt-3.5 size-2.5 rounded-pill bg-clay dark:bg-clay-400" />
          {!last && <span className="my-[3px] w-0.5 flex-1 bg-ink/20 dark:bg-ink-inverse/20" />}
        </span>
        <div className={`min-w-0 flex-1 rounded-ctl bg-clay-100 px-3 py-2.5 dark:bg-clay-900 ${last ? '' : 'mb-3'}`}>
          <p className="text-[14px] font-semibold leading-[1.35] text-ink dark:text-ink-inverse">
            {entry.item.title}
          </p>
          <p className="mt-[3px] flex items-center gap-1.5 text-meta text-sand-700 dark:text-sand-400">
            actionable now
            {rank !== undefined && (
              <button
                type="button"
                onClick={() => onJump(entry.item.id)}
                className="relative ml-auto min-h-8 text-xs font-semibold text-clay-700 before:absolute before:-inset-x-2 before:-inset-y-1.5 before:content-[''] hover:underline dark:text-clay-300"
              >
                ranked #{rank} →
              </button>
            )}
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-3">
      <span className="flex w-3.5 flex-none flex-col items-center" aria-hidden>
        <span className="mt-[5px] size-2.5 rounded-pill border-2 border-sand-600 dark:border-sand-500" />
        {!last && <span className="my-[3px] w-0.5 flex-1 bg-ink/20 dark:bg-ink-inverse/20" />}
      </span>
      <div className="pb-3">
        <p className="text-[14px] font-semibold leading-[1.35] text-ink dark:text-ink-inverse">
          {entry.item.title}
        </p>
        <p className="text-meta text-sand-700 dark:text-sand-400">next in line, itself waiting</p>
      </div>
    </div>
  )
}

export function BlockedChain({
  item,
  allItems,
  ranks,
  onJump,
}: {
  item: Item
  allItems: Item[]
  ranks: Map<string, number>
  onJump: (id: string) => void
}) {
  const wouldUnblock = allItems.filter(
    (i) =>
      i.id !== item.id &&
      (i.status === 'open' || i.status === 'in_progress') &&
      i.dependsOn.includes(item.id),
  )
  const chain = buildChain(item, allItems)

  return (
    <div>
      <p className="mb-2 mt-3.5 text-micro font-semibold uppercase text-sand-700 dark:text-sand-400">
        Waits on
      </p>
      <div className="flex flex-col">
        {chain.map((entry, i) => (
          <ChainNode
            key={entry.item.id}
            entry={entry}
            last={i === chain.length - 1}
            rank={ranks.get(entry.item.id)}
            onJump={onJump}
          />
        ))}
      </div>
      {wouldUnblock.length > 0 && (
        <>
          <div className="mb-2.5 mt-3 border-t-[1.5px] border-dotted border-ink/25 dark:border-ink-inverse/25" />
          <p className="mb-2 text-micro font-semibold uppercase text-sand-700 dark:text-sand-400">
            Would unblock
          </p>
          <div className="flex flex-col gap-[7px]">
            {wouldUnblock.map((i) => (
              <div key={i.id} className="flex items-baseline gap-2.5">
                <span className="min-w-0 flex-1 text-detail text-ink dark:text-ink-inverse">
                  {i.title}
                </span>
                <span className="flex-none text-[13px] font-bold tabular-nums text-sage-700 dark:text-sage-400">
                  +8
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="mt-3 text-xs leading-[1.5] text-sand-700 dark:text-sand-400">
        Blocked items keep their math: they just wait their turn instead of nagging.
      </p>
    </div>
  )
}
