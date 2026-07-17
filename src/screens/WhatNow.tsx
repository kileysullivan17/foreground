import { useMemo, useState } from 'react'
import { rankItems, type ScoredItem } from '../scoring/score'
import { useItems, useProjects } from '../hooks/useData'
import { FilterChips } from '../components/FilterChips'
import { StatusActions } from '../components/StatusActions'
import { BlockedChain, BlockedTag } from '../components/BlockedChain'
import { QueryStates } from '../components/QueryStates'
import { ScoreLedger } from '../components/ScoreLedger'
import { teaserLine } from '../lib/scoreDisplay'
import { effortLabels } from '../lib/format'
import type { Area, Item, Project } from '../types'

type AreaFilter = 'all' | Area

const NO_ITEMS: never[] = []

function Chevron({ open, className = '' }: { open?: boolean; className?: string }) {
  return (
    <svg
      className={`${className} ${open ? 'rotate-180' : ''}`}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function InProgressTag() {
  return (
    <span className="inline-flex items-center rounded-pill bg-sage-200 px-2 py-0.5 text-micro font-semibold normal-case tracking-normal text-sage-800 dark:bg-sage-800 dark:text-sage-200">
      in progress
    </span>
  )
}

const itemMeta = (item: Item, projects: Project[]) =>
  `${projects.find((p) => p.id === item.projectId)?.name ?? 'No project'} · ${effortLabels[item.effort]}`

// The one ink panel on screen: rank #1, ledger always open. Inverts with
// the theme (ink on cream ground, cream on ink ground).
function ForegroundCard({
  scored,
  total,
  projects,
}: {
  scored: ScoredItem
  total: number
  projects: Project[]
}) {
  const { item } = scored
  return (
    <section
      id={`ranked-${item.id}`}
      aria-label="In the foreground"
      className="rounded-hero bg-ink p-5 shadow-lg lg:grid lg:grid-cols-[1fr_360px] lg:gap-[30px] lg:p-7 dark:bg-ink-inverse"
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-micro font-semibold uppercase text-clay-300 dark:text-clay-700">
            In the foreground
          </span>
          <span className="ml-auto text-[11.5px] font-semibold text-sand-500 lg:ml-0 dark:text-sand-700">
            #1 of {total}
          </span>
        </div>
        <h2 className="mt-2.5 font-display text-title text-ink-inverse lg:text-score-lg dark:text-ink">
          {item.title}
        </h2>
        <p className="mt-1.5 flex items-center gap-2 text-detail text-sand-400 dark:text-sand-700">
          {itemMeta(item, projects)}
          {item.status === 'in_progress' && <InProgressTag />}
        </p>
        <div className="mt-auto hidden max-w-[420px] pt-[18px] lg:block">
          <StatusActions item={item} context="foreground" />
        </div>
      </div>
      <div className="mt-3.5 lg:mt-0">
        <ScoreLedger scored={scored} context="foreground" size="lg" />
      </div>
      <div className="mt-3.5 lg:hidden">
        <StatusActions item={item} context="foreground" />
      </div>
    </section>
  )
}

// Queue cards keep their arithmetic behind a tap: a one-line teaser when
// closed, the full ledger and actions when open.
function QueueCard({
  scored,
  rank,
  projects,
  open,
  onToggle,
}: {
  scored: ScoredItem
  rank: number
  projects: Project[]
  open: boolean
  onToggle: () => void
}) {
  const { item } = scored
  return (
    <li id={`ranked-${item.id}`} className="rounded-card bg-surface dark:bg-surface-dark">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full rounded-card px-[18px] py-4 text-left hover:shadow-md"
      >
        <span className="flex items-baseline gap-2.5">
          <span className="inline-flex size-[22px] flex-none translate-y-[3px] items-center justify-center rounded-pill border-[1.5px] border-sand-500 text-[11.5px] font-semibold text-sand-700 dark:border-sand-600 dark:text-sand-400">
            {rank}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-card text-ink dark:text-ink-inverse">{item.title}</span>
            <span className="mt-[3px] flex items-center gap-2 text-[13px] text-sand-700 dark:text-sand-400">
              {itemMeta(item, projects)}
              {item.status === 'in_progress' && <InProgressTag />}
            </span>
          </span>
          <span className="hidden max-w-72 truncate text-meta text-sand-700 lg:block dark:text-sand-400">
            {!open && teaserLine(scored)}
          </span>
          <span className="font-display text-[19px] tabular-nums text-ink dark:text-ink-inverse">
            {scored.score}
          </span>
          <Chevron open={open} className="hidden flex-none self-center text-sand-600 lg:block dark:text-sand-500" />
        </span>
        {!open && (
          <span className="mt-[7px] ml-8 flex items-center gap-1.5 text-meta text-sand-700 lg:hidden dark:text-sand-400">
            <span className="truncate">{teaserLine(scored)}</span>
            <Chevron className="ml-auto flex-none text-sand-600 dark:text-sand-500" />
          </span>
        )}
      </button>
      {open && (
        <div className="px-[18px] pb-4 lg:ml-8 lg:grid lg:grid-cols-[1fr_220px] lg:gap-[22px]">
          <ScoreLedger scored={scored} context="card" />
          <div className="mt-3 lg:mt-0 lg:flex lg:flex-col lg:justify-end">
            <StatusActions item={item} context="card" className="lg:flex-col" />
          </div>
        </div>
      )}
    </li>
  )
}

// A blocked card per 1h: the dependency chain replaces the score. Closed,
// it is one quiet row; open, "Waits on" walks to the actionable root
// (which links back into the ranking) and "Would unblock" lists what its
// completion would feed.
function BlockedCard({
  scored,
  projects,
  allItems,
  ranks,
  onJump,
  open,
  onToggle,
}: {
  scored: ScoredItem
  projects: Project[]
  allItems: Item[]
  ranks: Map<string, number>
  onJump: (id: string) => void
  open: boolean
  onToggle: () => void
}) {
  const { item } = scored
  return (
    <li className="rounded-card bg-surface dark:bg-surface-dark">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full rounded-card px-[18px] py-3.5 text-left hover:shadow-md"
      >
        <span className="flex items-center gap-2.5">
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink dark:text-ink-inverse">
            {item.title}
          </span>
          {!open && (
            <span className="flex-none text-meta text-sand-700 dark:text-sand-400">
              waits on {scored.blockedBy.length}
            </span>
          )}
          <BlockedTag />
        </span>
        {open && (
          <span className="mt-[3px] block text-[13px] text-sand-700 dark:text-sand-400">
            {itemMeta(item, projects)}
          </span>
        )}
      </button>
      {open && (
        <div className="px-[18px] pb-4">
          <BlockedChain item={item} allItems={allItems} ranks={ranks} onJump={onJump} />
          <div className="mt-3.5">
            <StatusActions item={item} context="card" />
          </div>
        </div>
      )}
    </li>
  )
}

export function WhatNow() {
  const [area, setArea] = useState<AreaFilter>('all')
  const [quickWins, setQuickWins] = useState(false)
  const [showBlocked, setShowBlocked] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [openBlockedId, setOpenBlockedId] = useState<string | null>(null)
  const itemsQuery = useItems()
  const projectsQuery = useProjects()
  const items = itemsQuery.data ?? NO_ITEMS
  const projects = projectsQuery.data ?? NO_ITEMS

  // Rank against the full item set (so cross-area dependencies count),
  // then filter the display by area. `today` is a memo dependency so a tab
  // left open across midnight re-ranks for the new day (deadlines and
  // staleness both move) instead of holding yesterday's ranking. rankItems
  // reads the clock itself, so `today` only needs to trigger recomputation.
  const today = new Date().toDateString()
  const { ready, blocked } = useMemo(() => {
    void today // recompute trigger at the day boundary; see above
    return rankItems(items, { quickWins })
  }, [items, quickWins, today])
  const inArea = (s: ScoredItem) => area === 'all' || s.item.area === area
  const readyShown = ready.filter(inArea)
  const blockedShown = blocked.filter(inArea)
  const [first, ...queue] = readyShown
  const ranks = new Map(readyShown.map((s, i) => [s.item.id, i + 1]))

  // "ranked #N →" on a blocked card's actionable root: open that card in
  // the queue and bring it into view.
  const jumpToRanked = (id: string) => {
    if ((ranks.get(id) ?? 1) > 1) setOpenId(id)
    requestAnimationFrame(() =>
      document.getElementById(`ranked-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
  }

  return (
    <main className="mx-auto max-w-lg px-3.5 pt-3 lg:max-w-[1060px] lg:px-8 lg:pt-4">
      <div className="px-1.5 lg:flex lg:items-end lg:gap-4 lg:px-0">
        <h1 className="font-display text-display lg:text-[38px] lg:leading-[1.1]">What now</h1>
        <p className="hidden pb-1.5 text-detail text-sand-700 lg:block dark:text-sand-400">
          ranked by the arithmetic, open any row to check it
        </p>
        <div className="mt-2 mb-4 flex flex-wrap items-center gap-1.5 lg:mt-0 lg:mb-1 lg:ml-auto">
          <FilterChips
            label="Area"
            options={[
              { value: 'all', label: 'All' },
              { value: 'work', label: 'Work' },
              { value: 'home', label: 'Home' },
            ]}
            value={area}
            onChange={setArea}
          />
          <button
            type="button"
            aria-pressed={quickWins}
            onClick={() => setQuickWins((v) => !v)}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-pill px-4 text-[13.5px] ${
              quickWins
                ? 'bg-clay-500 font-semibold text-ink dark:bg-clay-400'
                : 'border border-ink/20 text-sand-800 hover:bg-ink/5 dark:border-ink-inverse/25 dark:text-sand-300 dark:hover:bg-ink-inverse/8'
            }`}
          >
            <svg
              className={quickWins ? '' : 'text-clay-600 dark:text-clay-400'}
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
            Quick wins
          </button>
        </div>
      </div>

      <QueryStates queries={[itemsQuery, projectsQuery]}>
        {first ? (
          <>
            <ForegroundCard scored={first} total={readyShown.length} projects={projects} />
            <ul className="mt-3.5 space-y-2.5">
              {queue.map((s, i) => (
                <QueueCard
                  key={s.item.id}
                  scored={s}
                  rank={i + 2}
                  projects={projects}
                  open={openId === s.item.id}
                  onToggle={() => setOpenId(openId === s.item.id ? null : s.item.id)}
                />
              ))}
            </ul>
          </>
        ) : (
          <p className="py-8 text-center text-sand-700 dark:text-sand-400">
            Nothing workable here. Add something?
          </p>
        )}

        {blockedShown.length > 0 && (
          <section className="mt-4 pb-4">
            <button
              type="button"
              aria-expanded={showBlocked}
              onClick={() => setShowBlocked((v) => !v)}
              className="flex min-h-tap w-full items-center gap-2 rounded-pill border-[1.5px] border-dashed border-ink/22 px-[18px] text-[13px] text-sand-700 hover:bg-ink/4 dark:border-ink-inverse/25 dark:text-sand-400 dark:hover:bg-ink-inverse/6"
            >
              <svg
                className={`flex-none text-sand-600 dark:text-sand-500 ${showBlocked ? 'rotate-90' : ''}`}
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              Blocked ({blockedShown.length}): waiting on other items
            </button>
            {showBlocked && (
              <ul className="mt-3 space-y-2.5">
                {blockedShown.map((s) => (
                  <BlockedCard
                    key={s.item.id}
                    scored={s}
                    projects={projects}
                    allItems={items}
                    ranks={ranks}
                    onJump={jumpToRanked}
                    open={openBlockedId === s.item.id}
                    onToggle={() => setOpenBlockedId(openBlockedId === s.item.id ? null : s.item.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
      </QueryStates>
    </main>
  )
}
