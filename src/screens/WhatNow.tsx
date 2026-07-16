import { useMemo, useState } from 'react'
import { rankItems, type ScoredItem } from '../scoring/score'
import { useItems, useProjects } from '../hooks/useData'
import { Segmented } from '../components/Segmented'
import { StatusActions } from '../components/StatusActions'
import { DependencyView } from '../components/DependencyView'
import { QueryStates } from '../components/QueryStates'
import { effortLabels } from '../lib/format'
import type { Area, Item, Project } from '../types'

type AreaFilter = 'all' | Area

const NO_ITEMS: never[] = []

const factorTone: Record<string, string> = {
  deadline: 'text-red-700 dark:text-red-400',
  importance: 'text-indigo-700 dark:text-indigo-400',
  unblocks: 'text-amber-700 dark:text-amber-400',
  momentum: 'text-sky-700 dark:text-sky-400',
}

function ScoredCard({
  scored,
  projects,
  allItems,
}: {
  scored: ScoredItem
  projects: Project[]
  allItems: Item[]
}) {
  const { item, score, delayFactors, size, staleness, blockedBy } = scored
  const project = projects.find((p) => p.id === item.projectId)
  const blocked = blockedBy.length > 0

  return (
    <li
      className={`rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 ${
        blocked ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium leading-snug">{item.title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {project?.name ?? 'No project'} · {effortLabels[item.effort]}
            {item.status === 'in_progress' && ' · in progress'}
          </p>
        </div>
        {!blocked && (
          <span
            className="shrink-0 rounded-lg bg-zinc-100 px-2 py-1 text-sm font-semibold tabular-nums dark:bg-zinc-800"
            title="Priority score"
          >
            {score}
          </span>
        )}
      </div>

      {blocked ? (
        <div className="mt-2">
          <DependencyView item={item} allItems={allItems} />
        </div>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {delayFactors.map((f) => (
            <li key={f.key} className={`text-sm ${factorTone[f.key] ?? ''}`}>
              <span className="inline-block w-11 font-semibold tabular-nums">+{f.points}</span>
              {f.label}
            </li>
          ))}
          <li className="text-sm text-emerald-700 dark:text-emerald-400">
            <span className="inline-block w-11 font-semibold tabular-nums">÷{size.divisor}</span>
            {size.label}
          </li>
          {staleness && (
            <li className="text-sm text-orange-700 dark:text-orange-400">
              <span className="inline-block w-11 font-semibold tabular-nums">
                ×{staleness.multiplier}
              </span>
              {staleness.label}
            </li>
          )}
        </ul>
      )}

      <div className="mt-3">
        <StatusActions item={item} />
      </div>
    </li>
  )
}

export function WhatNow() {
  const [area, setArea] = useState<AreaFilter>('all')
  const [quickWins, setQuickWins] = useState(false)
  const [showBlocked, setShowBlocked] = useState(false)
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

  return (
    <main className="mx-auto max-w-lg px-4 pt-4">
      <h1 className="text-2xl font-bold">What now</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Segmented
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
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            quickWins
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-200/70 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
          }`}
        >
          ⚡ Quick wins
        </button>
      </div>

      <QueryStates queries={[itemsQuery, projectsQuery]}>
        <ul className="mt-4 space-y-3">
          {readyShown.map((s) => (
            <ScoredCard key={s.item.id} scored={s} projects={projects} allItems={items} />
          ))}
          {readyShown.length === 0 && (
            <p className="py-8 text-center text-zinc-500">Nothing workable here. Add something?</p>
          )}
        </ul>

        {blockedShown.length > 0 && (
          <section className="mt-6 pb-4">
            <button
              type="button"
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
              onClick={() => setShowBlocked((v) => !v)}
            >
              {showBlocked ? '▾' : '▸'} Blocked ({blockedShown.length}): waiting on other items
            </button>
            {showBlocked && (
              <ul className="mt-3 space-y-3">
                {blockedShown.map((s) => (
                  <ScoredCard key={s.item.id} scored={s} projects={projects} allItems={items} />
                ))}
              </ul>
            )}
          </section>
        )}
      </QueryStates>
    </main>
  )
}
