import { useState } from 'react'
import { useCreateItem, useCreateProject, useItems, useProjects, useUpdateItem, useUpdateProject } from '../hooks/useData'
import { Segmented } from '../components/Segmented'
import { DependencyView } from '../components/DependencyView'
import { QueryStates } from '../components/QueryStates'
import { effortLabels, formatDate, statusLabels } from '../lib/format'
import type { Area, Effort, Item, Project, Status } from '../types'

const inputCls =
  'w-full min-h-tap rounded-pill border border-ink/15 bg-surface-raised px-4 text-detail text-ink placeholder:text-sand-600 dark:border-ink-inverse/20 dark:bg-surface-dark-raised dark:text-ink-inverse dark:placeholder:text-sand-400'
const smallBtn =
  'inline-flex min-h-tap items-center justify-center rounded-pill px-5 font-display text-[14.5px] active:scale-95 disabled:opacity-50'
const clayBtn = `${smallBtn} bg-clay-500 text-ink hover:bg-clay-400 dark:bg-clay-400 dark:hover:bg-clay-300`
const ghostBtn = `${smallBtn} text-sand-700 hover:bg-ink/5 dark:text-sand-400 dark:hover:bg-ink-inverse/8`

// Status reads in the palette's roles: sage for finished or moving work,
// clay for in progress, sand for waiting.
const statusDot: Record<Status, string> = {
  open: 'bg-sand-500',
  in_progress: 'bg-clay-500 dark:bg-clay-400',
  done: 'bg-sage-500',
  parked: 'bg-sand-300 dark:bg-sand-700',
}

/** Ids of everything that transitively depends on `id` (kept out of the
 *  dependency picker so edits can't create a cycle). */
function transitiveDependents(id: string, items: Item[]): Set<string> {
  const result = new Set<string>()
  const queue = [id]
  while (queue.length > 0) {
    const current = queue.pop()!
    for (const item of items) {
      if (!result.has(item.id) && item.dependsOn.includes(current)) {
        result.add(item.id)
        queue.push(item.id)
      }
    }
  }
  return result
}

function ItemEditor({ item, allItems, onClose }: { item: Item; allItems: Item[]; onClose: () => void }) {
  const update = useUpdateItem()
  const [title, setTitle] = useState(item.title)
  const [notes, setNotes] = useState(item.notes)
  const [effort, setEffort] = useState<Effort>(item.effort)
  const [importance, setImportance] = useState(item.importance)
  const [deadline, setDeadline] = useState(item.hardDeadline ?? '')
  const [status, setStatus] = useState<Status>(item.status)
  const [dependsOn, setDependsOn] = useState<string[]>(item.dependsOn)

  const forbidden = transitiveDependents(item.id, allItems)
  const depCandidates = allItems.filter(
    (i) => i.id !== item.id && i.status !== 'done' && i.area === item.area && !forbidden.has(i.id),
  )

  const save = () => {
    // Recompute the forbidden set from the current item list at save time, not
    // just when building the picker: another editor may have added edges since
    // this editor opened, so filtering here is what actually stops two
    // concurrent edits from committing a dependency cycle.
    const forbiddenNow = transitiveDependents(item.id, allItems)
    const safeDependsOn = dependsOn.filter((id) => id !== item.id && !forbiddenNow.has(id))
    update.mutate(
      {
        id: item.id,
        patch: {
          title: title.trim() || item.title,
          notes,
          effort,
          importance,
          hardDeadline: deadline || null,
          status,
          dependsOn: safeDependsOn,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="mt-2 space-y-3 rounded-ctl bg-surface-raised p-3 dark:bg-surface-dark-raised/60">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} aria-label="Title" />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={2}
        className={`${inputCls.replace('rounded-pill', 'rounded-ctl')} py-2.5`}
        aria-label="Notes"
      />
      <div className="flex flex-wrap items-center gap-3 text-detail">
        <Segmented
          label="Effort"
          options={[
            { value: 'S', label: 'S' },
            { value: 'M', label: 'M' },
            { value: 'L', label: 'L' },
          ]}
          value={effort}
          onChange={setEffort}
        />
        <label className="flex items-center gap-2 text-sm">
          Importance
          <select
            value={importance}
            onChange={(e) => setImportance(Number(e.target.value))}
            className={`${inputCls} w-auto`}
          >
            {[1, 2, 3, 4, 5].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Deadline
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${inputCls} w-auto`} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={`${inputCls} w-auto`}>
            {Object.entries(statusLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DependencyView item={item} allItems={allItems} />
      {depCandidates.length > 0 && (
        <fieldset>
          <legend className="text-detail font-semibold">Change what this waits on</legend>
          <div className="mt-1 max-h-52 overflow-y-auto">
            {depCandidates.map((c) => (
              <label key={c.id} className="flex min-h-tap cursor-pointer items-center gap-3 text-detail">
                <input
                  type="checkbox"
                  checked={dependsOn.includes(c.id)}
                  onChange={(e) =>
                    setDependsOn((prev) =>
                      e.target.checked ? [...prev, c.id] : prev.filter((d) => d !== c.id),
                    )
                  }
                  className="size-[22px] flex-none appearance-none rounded-[7px] border-2 border-sand-500 bg-surface-raised checked:border-sage-600 checked:bg-sage-600 dark:border-sand-600 dark:bg-surface-dark-raised dark:checked:border-sage-500 dark:checked:bg-sage-500"
                />
                {c.title}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={update.isPending} className={clayBtn}>
          Save
        </button>
        <button type="button" onClick={onClose} className={ghostBtn}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ProjectCard({ project, items }: { project: Project; items: Item[] }) {
  const createItem = useCreateItem()
  const updateProject = useUpdateProject()
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [editingProject, setEditingProject] = useState(false)
  const [name, setName] = useState(project.name)
  const [goal, setGoal] = useState(project.goal)
  const [target, setTarget] = useState(project.targetDate ?? '')

  const mine = items.filter((i) => i.projectId === project.id)
  const openCount = mine.filter((i) => i.status === 'open' || i.status === 'in_progress').length

  const addItem = (e: React.FormEvent) => {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    createItem.mutate(
      {
        title,
        notes: '',
        area: project.area,
        projectId: project.id,
        section: null,
        assignee: null,
        effort: 'M',
        hardDeadline: null,
        importance: 3,
        dependsOn: [],
        status: 'open',
      },
      { onSuccess: () => setNewTitle('') },
    )
  }

  const saveProject = () => {
    updateProject.mutate(
      { id: project.id, patch: { name: name.trim() || project.name, goal, targetDate: target || null } },
      { onSuccess: () => setEditingProject(false) },
    )
  }

  return (
    <section className="rounded-card bg-surface p-4 dark:bg-surface-dark">
      {editingProject ? (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} aria-label="Project name" />
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className={inputCls} aria-label="Goal" />
          <label className="flex items-center gap-2 text-sm">
            Target
            <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputCls} w-auto`} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={saveProject} className={clayBtn}>
              Save
            </button>
            <button type="button" onClick={() => setEditingProject(false)} className={ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="block w-full text-left" onClick={() => setEditingProject(true)}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-semibold">{project.name}</h3>
            <span className="text-xs text-sand-700 dark:text-sand-400">
              {openCount} open{project.targetDate ? ` · target ${formatDate(project.targetDate)}` : ''}
            </span>
          </div>
          {project.goal && <p className="mt-0.5 text-detail text-sand-700 dark:text-sand-400">{project.goal}</p>}
        </button>
      )}

      <ul className="mt-2 divide-y divide-ink/8 dark:divide-ink-inverse/10">
        {mine.map((item) => (
          <li key={item.id} className="py-2">
            <button
              type="button"
              className="flex min-h-tap w-full items-center gap-2 text-left"
              onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[item.status]}`} />
              <span className={`flex-1 text-sm ${item.status === 'done' ? 'text-sand-600 line-through dark:text-sand-500' : ''}`}>
                {item.title}
              </span>
              <span className="text-xs text-sand-600 dark:text-sand-500">
                {effortLabels[item.effort][0]}
                {item.hardDeadline ? ` · ${formatDate(item.hardDeadline)}` : ''}
              </span>
            </button>
            {expandedItem === item.id && (
              <ItemEditor item={item} allItems={items} onClose={() => setExpandedItem(null)} />
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={addItem} className="mt-2 flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add an item…"
          className={inputCls}
        />
        <button
          type="submit"
          disabled={!newTitle.trim() || createItem.isPending}
          className={`${smallBtn} shrink-0 border-[1.5px] border-ink/25 text-ink hover:bg-ink/6 dark:border-ink-inverse/30 dark:text-ink-inverse dark:hover:bg-ink-inverse/8`}
        >
          Add
        </button>
      </form>
    </section>
  )
}

function NewProjectForm({ area }: { area: Area }) {
  const createProject = useCreateProject()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-tap items-center text-detail font-semibold text-clay-700 dark:text-clay-300">
        + New project
      </button>
    )
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createProject.mutate(
      { name: name.trim(), area, goal: goal.trim(), targetDate: null },
      { onSuccess: () => { setName(''); setGoal(''); setOpen(false) } },
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-card border-[1.5px] border-dashed border-sand-600 p-3.5 dark:border-sand-500">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className={inputCls} />
      <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal (what does done look like?)" className={inputCls} />
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim()} className={clayBtn}>
          Create
        </button>
        <button type="button" onClick={() => setOpen(false)} className={ghostBtn}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export function Projects() {
  const projectsQuery = useProjects()
  const itemsQuery = useItems()
  const projects = projectsQuery.data ?? []
  const items = itemsQuery.data ?? []

  const areas: { area: Area; heading: string }[] = [
    { area: 'work', heading: 'Work' },
    { area: 'home', heading: 'Home' },
  ]

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 pt-4 pb-4">
      <h1 className="font-display text-display">Projects</h1>
      <QueryStates queries={[projectsQuery, itemsQuery]} loadingLabel="Loading projects…">
      {areas.map(({ area, heading }) => {
        const loose = items.filter((i) => i.area === area && i.projectId === null)
        return (
          <section key={area} className="space-y-3">
            <h2 className="text-micro font-semibold uppercase text-sand-700 dark:text-sand-400">{heading}</h2>
            {projects
              .filter((p) => p.area === area)
              .map((p) => (
                <ProjectCard key={p.id} project={p} items={items} />
              ))}
            {loose.length > 0 && (
              <section className="rounded-card bg-surface p-4 dark:bg-surface-dark">
                <h3 className="font-semibold text-sand-700 dark:text-sand-400">No project</h3>
                <ul className="mt-1 divide-y divide-ink/8 dark:divide-ink-inverse/10">
                  {loose.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[item.status]}`} />
                      {item.title}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <NewProjectForm area={area} />
          </section>
        )
      })}
      </QueryStates>
    </main>
  )
}
