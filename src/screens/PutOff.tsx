import { useMemo, useState } from 'react'
import { daysSinceTouched, rankByStaleness } from '../scoring/score'
import { useItems, useProjects, useTouchItem } from '../hooks/useData'
import { FilterChips } from '../components/FilterChips'
import { QueryStates } from '../components/QueryStates'
import { EmptyState } from '../components/EmptyState'
import type { Area, Item, Project } from '../types'

type AreaFilter = 'all' | Area

const NO_ITEMS: never[] = []

// Staleness reads as a warm disc, not an alarm: the longer untouched, the
// warmer the clay. Sand for anything under the boost thresholds.
function discTone(days: number): { disc: string; num: string; unit: string } {
  if (days >= 21)
    return {
      disc: 'bg-clay-200 dark:bg-clay-900',
      num: 'text-clay-800 dark:text-clay-300',
      unit: 'text-clay-700 dark:text-clay-400',
    }
  if (days >= 10)
    return {
      disc: 'bg-clay-100 dark:bg-clay-900/60',
      num: 'text-clay-800 dark:text-clay-300',
      unit: 'text-clay-700 dark:text-clay-400',
    }
  return {
    disc: 'bg-sand-200 dark:bg-surface-dark-raised',
    num: 'text-sand-800 dark:text-sand-300',
    unit: 'text-sand-700 dark:text-sand-400',
  }
}

function PutOffRow({ item, projects }: { item: Item; projects: Project[] }) {
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const touch = useTouchItem()
  const days = daysSinceTouched(item, new Date())
  const project = projects.find((p) => p.id === item.projectId)
  const tone = discTone(days)

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
    <li className="rounded-card bg-surface p-3.5 dark:bg-surface-dark">
      <div className="flex items-center gap-3.5">
        <span
          className={`flex size-14 flex-none flex-col items-center justify-center rounded-pill ${tone.disc}`}
        >
          <span className={`font-display text-[19px] leading-none tabular-nums ${tone.num}`}>
            {days}
          </span>
          <span className={`mt-px text-[8.5px] font-semibold uppercase tracking-[0.09em] ${tone.unit}`}>
            {days === 1 ? 'day' : 'days'}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-[1.3] text-ink dark:text-ink-inverse">
            {item.title}
          </span>
          <span className="mt-0.5 block text-meta text-sand-700 dark:text-sand-400">
            {project?.name ?? 'No project'}
          </span>
        </span>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-tap flex-none items-center justify-center rounded-pill bg-sage-200 px-[18px] font-display text-[14px] text-sage-800 hover:bg-sage-300 hover:text-ink active:scale-95 dark:bg-sage-300 dark:text-ink dark:hover:bg-sage-200 dark:hover:text-sage-800"
          >
            Touch it
          </button>
        )}
      </div>
      {item.lastTouchNote && !editing && (
        <p className="ml-[70px] mt-2 text-meta italic leading-[1.45] text-sand-700 dark:text-sand-400">
          “{item.lastTouchNote}”
        </p>
      )}

      {editing && (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One line: where does this stand?"
            className="min-h-tap min-w-0 flex-1 rounded-pill border border-ink/15 bg-surface-raised px-4 text-detail text-ink placeholder:text-sand-600 dark:border-ink-inverse/20 dark:bg-surface-dark-raised dark:text-ink-inverse dark:placeholder:text-sand-400"
          />
          <button
            type="submit"
            disabled={!note.trim() || touch.isPending}
            className="inline-flex min-h-tap flex-none items-center justify-center rounded-pill bg-clay-500 px-5 font-display text-[14px] text-ink hover:bg-clay-400 disabled:opacity-50 dark:bg-clay-400 dark:hover:bg-clay-300"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex min-h-tap flex-none items-center justify-center rounded-pill border-[1.5px] border-ink/25 px-4 font-display text-[14px] text-ink hover:bg-ink/6 dark:border-ink-inverse/30 dark:text-ink-inverse dark:hover:bg-ink-inverse/8"
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
    <main className="mx-auto max-w-lg px-3.5 pb-4 pt-3">
      <div className="px-1.5">
        <h1 className="font-display text-display">Stuff I've put off</h1>
        <p className="mt-1 text-[13px] leading-[1.5] text-sand-700 dark:text-sand-400">
          Stalest first. “Touch it” resets the clock and keeps a one-line note of where things
          stand.
        </p>
        <div className="mb-3.5 mt-3">
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
        </div>
      </div>

      <QueryStates queries={[itemsQuery, projectsQuery]} loadingLabel="Sorting by staleness…">
        <ul className="space-y-2.5">
          {shown.map((item) => (
            <PutOffRow key={item.id} item={item} projects={projects} />
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
