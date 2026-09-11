import type { Item } from '../types'

// The treatment for a blocked row: the dependency chain replaces the score.
// "Waits on" walks unfinished dependencies down to the actionable root,
// which reads in plain text with an accent link back into the ranking;
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
    strokeWidth="2.5"
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
    <span className="inline-flex h-[26px] flex-none items-center gap-1.5 rounded-pill bg-raised px-2.5 font-mono text-label uppercase text-text-2">
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
          <span className="mt-[5px] size-2.5 rounded-pill bg-accent shadow-[0_0_8px_var(--color-accent)]" />
          {!last && <span className="my-[3px] w-px flex-1 bg-line-strong" />}
        </span>
        <div className={`min-w-0 flex-1 ${last ? '' : 'pb-3'}`}>
          <p className="text-[14px] font-semibold leading-[1.35] text-text">
            {entry.item.title}
          </p>
          <p className="mt-[3px] flex items-center gap-1.5 text-meta text-text-2">
            actionable now
            {rank !== undefined && (
              <button
                type="button"
                onClick={() => onJump(entry.item.id)}
                className="relative ml-auto min-h-8 font-mono text-[11px] font-medium text-accent before:absolute before:-inset-x-2 before:-inset-y-1.5 before:content-[''] hover:underline"
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
        <span className="mt-[5px] size-2.5 rounded-pill border border-line-strong" />
        {!last && <span className="my-[3px] w-px flex-1 bg-line-strong" />}
      </span>
      <div className="pb-3">
        <p className="text-[14px] font-semibold leading-[1.35] text-text-2">
          {entry.item.title}
        </p>
        <p className="text-meta text-text-3">next in line, itself waiting</p>
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
      <p className="mb-2.5 mt-3.5 font-mono text-label uppercase text-text-3">
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
          <div className="mb-3 mt-3 border-t border-dotted border-line-strong" />
          <p className="mb-2.5 font-mono text-label uppercase text-text-3">
            Would unblock
          </p>
          <div className="flex flex-col gap-[7px]">
            {wouldUnblock.map((i) => (
              <div key={i.id} className="flex items-baseline gap-2.5">
                <span className="min-w-0 flex-1 text-[13.5px] text-text">
                  {i.title}
                </span>
                <span className="flex-none font-mono text-[12.5px] tabular-nums text-text">
                  +8
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="mt-3 text-[12px] leading-[1.5] text-text-3">
        Blocked items keep their math: they just wait their turn instead of nagging.
      </p>
    </div>
  )
}
