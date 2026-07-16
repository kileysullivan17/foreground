import { useState } from 'react'
import { useCreateItem, useCreateProject, useItems, useProjects, useUpdateItem, useUpdateProject } from '../hooks/useData'
import { Segmented } from '../components/Segmented'
import { DependencyView } from '../components/DependencyView'
import { QueryStates } from '../components/QueryStates'
import { effortLabels, formatDate, statusLabels } from '../lib/format'
import type { Area, Effort, Item, Project, Status } from '../types'

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800'
const smallBtn = 'rounded-lg px-3 py-1.5 text-sm font-medium active:scale-95'

const statusDot: Record<Status, string> = {
  open: 'bg-zinc-400',
  in_progress: 'bg-sky-500',
  done: 'bg-emerald-500',
  parked: 'bg-zinc-300 dark:bg-zinc-600',
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
          dependsOn,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} aria-label="Title" />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={2}
        className={inputCls}
        aria-label="Notes"
      />
      <div className="flex flex-wrap items-center gap-3">
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
          <legend className="text-sm font-medium">Change what this waits on</legend>
          <div className="mt-1 max-h-36 space-y-1 overflow-y-auto">
            {depCandidates.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dependsOn.includes(c.id)}
                  onChange={(e) =>
                    setDependsOn((prev) =>
                      e.target.checked ? [...prev, c.id] : prev.filter((d) => d !== c.id),
                    )
                  }
                />
                {c.title}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={update.isPending} className={`${smallBtn} bg-indigo-600 text-white disabled:opacity-50`}>
          Save
        </button>
        <button type="button" onClick={onClose} className={`${smallBtn} text-zinc-500`}>
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
    <section className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      {editingProject ? (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} aria-label="Project name" />
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className={inputCls} aria-label="Goal" />
          <label className="flex items-center gap-2 text-sm">
            Target
            <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputCls} w-auto`} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={saveProject} className={`${smallBtn} bg-indigo-600 text-white`}>
              Save
            </button>
            <button type="button" onClick={() => setEditingProject(false)} className={`${smallBtn} text-zinc-500`}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="block w-full text-left" onClick={() => setEditingProject(true)}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-semibold">{project.name}</h3>
            <span className="text-xs text-zinc-500">
              {openCount} open{project.targetDate ? ` · target ${formatDate(project.targetDate)}` : ''}
            </span>
          </div>
          {project.goal && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{project.goal}</p>}
        </button>
      )}

      <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
        {mine.map((item) => (
          <li key={item.id} className="py-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[item.status]}`} />
              <span className={`flex-1 text-sm ${item.status === 'done' ? 'text-zinc-400 line-through' : ''}`}>
                {item.title}
              </span>
              <span className="text-xs text-zinc-400">
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
          className={`${smallBtn} shrink-0 bg-zinc-200 dark:bg-zinc-700 disabled:opacity-50`}
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
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
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
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className={inputCls} />
      <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal (what does done look like?)" className={inputCls} />
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim()} className={`${smallBtn} bg-indigo-600 text-white disabled:opacity-50`}>
          Create
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`${smallBtn} text-zinc-500`}>
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
      <h1 className="text-2xl font-bold">Projects</h1>
      <QueryStates queries={[projectsQuery, itemsQuery]}>
      {areas.map(({ area, heading }) => {
        const loose = items.filter((i) => i.area === area && i.projectId === null)
        return (
          <section key={area} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{heading}</h2>
            {projects
              .filter((p) => p.area === area)
              .map((p) => (
                <ProjectCard key={p.id} project={p} items={items} />
              ))}
            {loose.length > 0 && (
              <section className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="font-semibold text-zinc-500">No project</h3>
                <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
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
