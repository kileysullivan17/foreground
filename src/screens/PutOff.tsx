import { useMemo, useState } from 'react'
import { daysSinceTouched, rankByStaleness } from '../scoring/score'
import { useItems, useProjects, useTouchItem } from '../hooks/useData'
import { Segmented } from '../components/Segmented'
import { QueryStates } from '../components/QueryStates'
import type { Area, Item, Project } from '../types'

type AreaFilter = 'all' | Area

const NO_ITEMS: never[] = []

function staleTone(days: number): string {
  if (days >= 21) return 'text-red-700 dark:text-red-400'
  if (days >= 10) return 'text-orange-700 dark:text-orange-400'
  return 'text-zinc-500 dark:text-zinc-400'
}

function PutOffRow({ item, projects }: { item: Item; projects: Project[] }) {
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const touch = useTouchItem()
  const days = daysSinceTouched(item, new Date())
  const project = projects.find((p) => p.id === item.projectId)

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
    <li className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium leading-snug">{item.title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {project?.name ?? 'No project'}
          </p>
          <p className={`mt-1 text-sm font-medium ${staleTone(days)}`}>
            {days === 0 ? 'Touched today' : `Untouched for ${days} day${days === 1 ? '' : 's'}`}
          </p>
          {item.lastTouchNote && (
            <p className="mt-1 text-sm italic text-zinc-500 dark:text-zinc-400">
              “{item.lastTouchNote}”
            </p>
          )}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white active:scale-95"
          >
            Touch it
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="One line: where does this stand?"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="submit"
            disabled={!note.trim() || touch.isPending}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg px-2 py-2 text-sm text-zinc-500"
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
    <main className="mx-auto max-w-lg px-4 pt-4 pb-4">
      <h1 className="text-2xl font-bold">Stuff I've put off</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Stalest first. “Touch it” resets the clock and keeps a one-line note of where things stand.
      </p>
      <div className="mt-3">
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
      </div>

      <QueryStates queries={[itemsQuery, projectsQuery]}>
        <ul className="mt-4 space-y-3">
          {shown.map((item) => (
            <PutOffRow key={item.id} item={item} projects={projects} />
          ))}
          {shown.length === 0 && (
            <p className="py-8 text-center text-zinc-500">Nothing lingering. Suspicious.</p>
          )}
        </ul>
      </QueryStates>
    </main>
  )
}
