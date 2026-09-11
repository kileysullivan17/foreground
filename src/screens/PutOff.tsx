import { useMemo, useState } from 'react'
import { daysSinceTouched, rankByStaleness, stalenessMultiplier } from '../scoring/score'
import { useItems, useProjects, useTouchItem } from '../hooks/useData'
import { FilterChips } from '../components/FilterChips'
import { QueryStates } from '../components/QueryStates'
import { EmptyState } from '../components/EmptyState'
import type { Area, Item, Project } from '../types'

type AreaFilter = 'all' | Area

const NO_ITEMS: never[] = []

// Staleness is an instrument, not an alarm: the day count lights up in the
// accent once it passes 21 days, and a 3px gauge at the foot of the row
// shows how far the multiplier has climbed toward its 1.5 cap.
const STALENESS_CAP = 1.5

function PutOffRow({
  item,
  projects,
  stalest,
}: {
  item: Item
  projects: Project[]
  stalest: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const touch = useTouchItem()
  const days = daysSinceTouched(item, new Date())
  const project = projects.find((p) => p.id === item.projectId)
  const multiplier = stalenessMultiplier(days)
  const gauge = Math.max(0, Math.min(1, (multiplier - 1) / (STALENESS_CAP - 1)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = note.trim()
    if (!trimmed) return
    touch.mutate(
      { id: item.id, note: trimmed },
      { onSuccess: () => { setEditing(false); setNote('') } },
    )
  }

  return (
    <li className="border-t border-dotted border-line-strong py-[14px]">
      <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-start gap-x-2">
        <span className="flex items-baseline gap-[3px] pt-px">
          <span
            className={`font-display text-days tabular-nums ${
              days >= 21 ? 'text-accent' : 'text-text'
            }`}
          >
            {days}
          </span>
          <span className="font-mono text-[11px] text-text-3">d</span>
        </span>
        <span className="min-w-0 pt-0.5">
          <span className="block text-row text-text">{item.title}</span>
        </span>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`inline-flex min-h-[34px] flex-none items-center justify-center rounded-pill border px-4 font-mono text-label uppercase text-text transition-colors hover:border-text active:translate-y-px ${
              stalest ? 'border-text' : 'border-line-strong'
            }`}
          >
            Touch it
          </button>
        )}
      </div>
      {item.lastTouchNote && !editing && (
        <p className="mt-2 pl-[60px] text-[12.5px] leading-[1.45] text-text-2">
          “{item.lastTouchNote}”
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-3 pl-[60px]">
        <span className="flex-none font-mono text-[12.5px] text-text-3">
          {project?.name ?? 'No project'}
        </span>
        <span className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-pill bg-line-strong" aria-hidden>
          <span className="block h-full rounded-pill bg-accent" style={{ width: `${gauge * 100}%` }} />
        </span>
        <span className="flex-none font-mono text-[12.5px] font-medium tabular-nums text-accent">
          ×{multiplier.toFixed(2)}
        </span>
      </div>

      {editing && (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One line: where does this stand?"
            className="min-h-tap min-w-0 flex-1 rounded-pill border border-line bg-raised px-4 text-[14px] text-text placeholder:text-text-3"
          />
          <button
            type="submit"
            disabled={!note.trim() || touch.isPending}
            className="inline-flex min-h-tap flex-none items-center justify-center rounded-pill bg-accent px-5 text-[14px] font-semibold text-accent-ink hover:bg-accent-hover active:translate-y-px disabled:opacity-45"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex min-h-tap flex-none items-center justify-center rounded-pill border border-line-strong px-4 text-[14px] font-semibold text-text hover:border-text"
          >
            Cancel
          </button>
        </form>
      )}
    </li>
  )
}

export function PutOff() {
  const [area, setArea] = useState<AreaFilter>('all')
  const itemsQuery = useItems()
  const projectsQuery = useProjects()
  const items = itemsQuery.data ?? NO_ITEMS
  const projects = projectsQuery.data ?? NO_ITEMS

  const stale = useMemo(() => rankByStaleness(items), [items])
  const shown = stale.filter((i) => area === 'all' || i.area === area)

  return (
    <main className="mx-auto max-w-lg px-3.5 pb-4 pt-[18px]">
      <div className="px-1.5">
        <h1 className="text-title text-text">Stuff I've put off</h1>
        <p className="mt-3 text-body text-text-2">
          Stalest first. “Touch it” resets the clock and keeps a one-line note of where things
          stand.
        </p>
        <div className="mb-[18px] mt-4 flex items-center justify-between gap-3">
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
          <span className="font-mono text-label uppercase tabular-nums text-text-3">
            {shown.length} open
          </span>
        </div>
      </div>

      <QueryStates queries={[itemsQuery, projectsQuery]} loadingLabel="Sorting by staleness…">
        <ul className="mx-1.5 border-b border-dotted border-line-strong">
          {shown.map((item, i) => (
            <PutOffRow key={item.id} item={item} projects={projects} stalest={i === 0} />
          ))}
        </ul>
        {shown.length === 0 && (
          <EmptyState
            title="Nothing lingering"
            body="Suspicious. When something stalls, it surfaces here, stalest first."
            actionLabel="Add an item"
            actionTo="/add"
          />
        )}
      </QueryStates>
    </main>
  )
}
