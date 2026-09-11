import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTour } from '../components/Tour'
import { rankItems, type ScoredItem } from '../scoring/score'
import { useItems, useProjects } from '../hooks/useData'
import { FilterChips } from '../components/FilterChips'
import { StatusActions } from '../components/StatusActions'
import { BlockedChain, BlockedTag } from '../components/BlockedChain'
import { QueryStates } from '../components/QueryStates'
import { ScoreLedger } from '../components/ScoreLedger'
import { EmptyState } from '../components/EmptyState'
import { teaserParts, type TeaserTone } from '../lib/scoreDisplay'
import { effortLabels } from '../lib/format'
import {
  comparePromotion,
  trackRankingReordered,
  trackScoreBreakdownExpanded,
  trackWeightsAdjusted,
} from '../analytics/events'
import type { Area, Item, Project } from '../types'

type AreaFilter = 'all' | Area

const NO_ITEMS: never[] = []

// One-time orientation for a first-time visitor landing on the demo. Dismissal
// persists per browser, so a returning or daily user never sees it twice; each
// fresh visitor (the app is local-first, one seeded copy per browser) sees it
// once. Rendered above the ranking so it shows before any data query resolves.
const DEMO_INTRO_KEY = 'fg-demo-intro-v1'

function DemoIntro() {
  const { startTour } = useTour()
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(DEMO_INTRO_KEY) === '1',
  )
  if (dismissed) return null
  const dismiss = () => {
    try {
      localStorage.setItem(DEMO_INTRO_KEY, '1')
    } catch {
      // private-mode storage failure is harmless; just hide it for the session
    }
    setDismissed(true)
  }
  return (
    <div className="mb-block flex items-start gap-3 rounded-panel border border-line bg-panel px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-[1.5] text-text-2">
          You're in a live demo of Foreground. Every item is editable sample data, ranked by a
          Weighted Shortest Job First (WSJF) score that also surfaces work you keep putting off.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <button
            type="button"
            onClick={startTour}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-accent px-3.5 text-[12.5px] font-semibold text-accent-ink hover:bg-accent-hover active:translate-y-px"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
            Take the tour
          </button>
          <Link to="/about" className="text-[12.5px] font-semibold text-accent underline underline-offset-2">
            How it works
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss demo intro"
        className="-mr-1.5 -mt-1 grid size-tap flex-none place-items-center rounded-pill text-text-3 hover:text-text"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}

/** The in-progress marker: the lit dot and a mono label. Terracotta means
 *  action, so this is the one place a row carries the accent besides time. */
function InProgressTag() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accent">
      <span className="size-[5px] rounded-pill bg-accent shadow-[0_0_8px_var(--color-accent)]" aria-hidden />
      in progress
    </span>
  )
}

const itemMeta = (item: Item, projects: Project[]) =>
  `${projects.find((p) => p.id === item.projectId)?.name ?? 'No project'} · ${effortLabels[item.effort]}`

const teaserTone: Record<TeaserTone, string> = {
  accent: 'text-accent',
  overdue: 'text-overdue',
  text: '',
}

/** The collapsed factor line, in full, with time pressure in the accent.
 *  Wraps freely; never truncates. */
function FactorLine({ scored }: { scored: ScoredItem }) {
  return (
    <span className="col-span-2 col-start-2 mt-1 block font-mono text-factor text-text-2">
      {teaserParts(scored).map((p, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          <span className={teaserTone[p.tone]}>{p.text}</span>
        </span>
      ))}
    </span>
  )
}

// The one lit panel on screen: rank #1, ledger always open. It carries the
// accent border and glow; everything else sits in shadow on the ground.
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
      className="rounded-panel border border-accent-line bg-panel p-[18px] shadow-lit lg:grid lg:grid-cols-[1fr_360px] lg:gap-10 lg:p-8"
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2 font-mono text-label uppercase">
          <span className="fg-blink size-[7px] flex-none rounded-pill bg-accent shadow-[0_0_10px_var(--color-accent-glow)]" aria-hidden />
          <span className="text-accent">In the foreground</span>
          <span className="ml-auto tabular-nums text-text-3 lg:ml-0">#1 of {total}</span>
        </div>
        <h2 className="mt-3 text-readout text-text lg:text-[25px] lg:leading-[1.2]">
          {item.title}
        </h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-meta text-text-2">
          {itemMeta(item, projects)}
          {item.status === 'in_progress' && <InProgressTag />}
        </p>
        <div className="mt-auto hidden max-w-[420px] pt-[18px] lg:block">
          <StatusActions item={item} context="foreground" />
        </div>
      </div>
      <div className="mt-3.5 border-t border-dotted border-line-strong pt-3.5 lg:mt-0 lg:border-0 lg:pt-0" data-tour="fg-ledger">
        <ScoreLedger scored={scored} context="foreground" size="lg" />
      </div>
      <div className="mt-4 lg:hidden">
        <StatusActions item={item} context="foreground" />
      </div>
    </section>
  )
}

// Queue rows keep their arithmetic behind a tap: the full factor line when
// closed, the raised inner ledger and actions when open. Rows are
// separated by dotted rules, not cards.
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
    <li id={`ranked-${item.id}`} className="border-t border-dotted border-line-strong py-row">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full text-left"
      >
        <span className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-baseline gap-x-2">
          <span
            className={`font-mono text-[11px] font-medium leading-[1.6] tabular-nums ${
              rank === 2 ? 'text-accent' : 'text-text-3'
            }`}
          >
            {String(rank).padStart(2, '0')}
          </span>
          <span className="min-w-0">
            <span className="block text-row text-text">{item.title}</span>
            <span className="mt-[3px] flex flex-wrap items-center gap-2 font-mono text-[11px] leading-[1.6] text-text-3">
              {itemMeta(item, projects)}
              {item.status === 'in_progress' && <InProgressTag />}
            </span>
          </span>
          <span className="font-display text-score-row tabular-nums text-text">
            {scored.score}
          </span>
          {!open && <FactorLine scored={scored} />}
        </span>
      </button>
      {open && (
        <div className="ml-[34px] mt-3 lg:grid lg:grid-cols-[1fr_220px] lg:gap-[22px]">
          <ScoreLedger scored={scored} context="card" />
          <div className="mt-3 lg:mt-0 lg:flex lg:flex-col lg:justify-end">
            <StatusActions item={item} context="card" className="lg:flex-col" />
          </div>
        </div>
      )}
    </li>
  )
}

// A blocked row: the dependency chain replaces the score. Closed, it is one
// quiet row; open, "Waits on" walks to the actionable root (which links
// back into the ranking) and "Would unblock" lists what its completion
// would feed.
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
    <li className="border-t border-dotted border-line-strong py-row">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full text-left"
      >
        <span className="flex items-center gap-2.5">
          <span className="min-w-0 flex-1 text-row text-text-2">
            {item.title}
          </span>
          {!open && (
            <span className="flex-none font-mono text-[11px] text-text-3">
              waits on {scored.blockedBy.length}
            </span>
          )}
          <BlockedTag />
        </span>
        {open && (
          <span className="mt-[3px] block font-mono text-[11px] leading-[1.6] text-text-3">
            {itemMeta(item, projects)}
          </span>
        )}
      </button>
      {open && (
        <div>
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
  // The same list with staleness switched off: the order the user would have
  // seen if nothing were ever put off. Analytics only; never rendered.
  const readyWithoutStaleness = useMemo(() => {
    void today
    return rankItems(items, { quickWins, staleness: false }).ready
  }, [items, quickWins, today])
  const readyShown = useMemo(
    () => ready.filter((s) => area === 'all' || s.item.area === area),
    [ready, area],
  )
  const blockedShown = blocked.filter((s) => area === 'all' || s.item.area === area)

  // ranking_reordered_by_staleness: did the multiplier change the order the
  // user is looking at? Deduped per distinct promoted set inside events.ts.
  useEffect(() => {
    if (!itemsQuery.data) return
    const shownWithout = readyWithoutStaleness.filter(
      (s) => area === 'all' || s.item.area === area,
    )
    trackRankingReordered(comparePromotion(readyShown, shownWithout))
  }, [itemsQuery.data, readyShown, readyWithoutStaleness, area])
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
    <main className="mx-auto max-w-lg px-3.5 pt-title-top lg:max-w-[1060px] lg:px-8 lg:pt-title-top-lg">
      <DemoIntro />
      <div className="px-1.5 lg:mb-block-lg lg:flex lg:items-end lg:gap-4 lg:px-0">
        <h1 className="text-title text-text lg:text-[56px] lg:leading-[0.9] lg:tracking-[-0.045em]">What now</h1>
        <p className="hidden pb-1.5 text-meta text-text-2 lg:block">
          ranked by the arithmetic, open any row to check it
        </p>
        <div className="mb-block mt-lede flex flex-wrap items-center gap-2 lg:mb-1 lg:ml-auto lg:mt-0">
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
            data-tour="quickwins"
            aria-pressed={quickWins}
            onClick={() => {
              const next = !quickWins
              setQuickWins(next)
              // Quick wins steepens the job-size divisors (1/2/3 to 1/3/6).
              trackWeightsAdjusted('job_size_divisor', next ? 'up' : 'down')
            }}
            className={`relative inline-flex min-h-[42px] items-center gap-2 rounded-pill border border-line-strong px-4 font-mono text-label uppercase transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] ${
              quickWins ? 'text-text' : 'text-text-3 hover:text-text'
            }`}
          >
            <span
              className={`size-[6px] flex-none rounded-pill ${
                quickWins ? 'bg-accent shadow-[0_0_8px_var(--color-accent)]' : 'border border-text-3'
              }`}
              aria-hidden
            />
            Quick wins
          </button>
        </div>
      </div>

      <QueryStates
        queries={[itemsQuery, projectsQuery]}
        variant="foreground"
        loadingLabel="Ranking your list: the math runs locally, give it a second."
      >
        {first ? (
          <>
            <ForegroundCard scored={first} total={readyShown.length} projects={projects} />
            <ul className="mx-1.5 mt-block lg:mt-block-lg border-b border-dotted border-line-strong" data-tour="queue">
              {queue.map((s, i) => (
                <QueueCard
                  key={s.item.id}
                  scored={s}
                  rank={i + 2}
                  projects={projects}
                  open={openId === s.item.id}
                  onToggle={() => {
                    const opening = openId !== s.item.id
                    setOpenId(opening ? s.item.id : null)
                    if (opening) trackScoreBreakdownExpanded(s)
                  }}
                />
              ))}
            </ul>
          </>
        ) : (
          <EmptyState
            title="Nothing needs you"
            body="No open loops right now. Add something, or go poke at what you've been avoiding."
            actionLabel="Add an item"
            actionTo="/add"
            secondaryLabel="See stuff I've put off"
            secondaryTo="/put-off"
          />
        )}

        {blockedShown.length > 0 && (
          <section className="mx-1.5 mt-lede pb-4">
            <button
              type="button"
              aria-expanded={showBlocked}
              onClick={() => setShowBlocked((v) => !v)}
              className="flex min-h-tap w-full items-center gap-2 font-mono text-label uppercase text-text-3 hover:text-text"
            >
              Blocked ({blockedShown.length}): waiting on other items
              <svg
                className={`ml-auto flex-none transition-transform ${showBlocked ? 'rotate-90' : ''}`}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
            {showBlocked && (
              <ul className="border-b border-dotted border-line-strong">
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
