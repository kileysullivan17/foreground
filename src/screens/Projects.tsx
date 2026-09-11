import { useState } from 'react'
import { useCreateItem, useCreateProject, useItems, useProjects, useUpdateItem, useUpdateProject } from '../hooks/useData'
import { Segmented } from '../components/Segmented'
import { DependencyView } from '../components/DependencyView'
import { QueryStates } from '../components/QueryStates'
import { daysUntilDeadline } from '../scoring/score'
import { effortLabels, formatDate, statusLabels } from '../lib/format'
import type { Area, Effort, Item, Project, Status } from '../types'

const inputCls =
  'w-full min-h-tap rounded-pill border border-line bg-panel px-4 text-[14px] text-text placeholder:text-text-3'
const smallBtn =
  'inline-flex min-h-tap items-center justify-center rounded-pill px-5 text-[14px] font-semibold active:translate-y-px disabled:opacity-45'
const primaryBtn = `${smallBtn} bg-accent text-accent-ink hover:bg-accent-hover`
const outlineBtn = `${smallBtn} border border-line-strong text-text hover:border-text`
const ghostBtn = `${smallBtn} text-text-3 hover:text-text`
const fieldLabel = 'flex items-center gap-2 font-mono text-label uppercase text-text-3'
const checkboxCls =
  'size-[22px] flex-none appearance-none rounded-[7px] border border-line-strong bg-panel checked:border-accent checked:bg-accent'

// Status dots: a ring while waiting, the lit accent when in progress, a
// quiet fill when done, a faint ring when parked.
const statusDot: Record<Status, string> = {
  open: 'border border-line-strong',
  in_progress: 'bg-accent shadow-[0_0_8px_var(--color-accent)]',
  done: 'bg-text-3',
  parked: 'border border-line',
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

/** Open work waiting on something unfinished. */
const isBlocked = (item: Item, all: Item[]) =>
  (item.status === 'open' || item.status === 'in_progress') &&
  item.dependsOn.some((id) => all.find((i) => i.id === id)?.status !== 'done')

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
    <div className="mt-2 space-y-3 rounded-inner bg-raised p-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} aria-label="Title" />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={2}
        className={`${inputCls.replace('rounded-pill', 'rounded-inner')} py-2.5`}
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
        <label className={fieldLabel}>
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
        <label className={fieldLabel}>
          Deadline
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${inputCls} w-auto`} />
        </label>
        <label className={fieldLabel}>
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
          <legend className="font-mono text-label uppercase text-text-3">Change what this waits on</legend>
          <div className="mt-1 max-h-52 overflow-y-auto">
            {depCandidates.map((c) => (
              <label key={c.id} className="flex min-h-tap cursor-pointer items-center gap-3 text-[13.5px] text-text">
                <input
                  type="checkbox"
                  checked={dependsOn.includes(c.id)}
                  onChange={(e) =>
                    setDependsOn((prev) =>
                      e.target.checked ? [...prev, c.id] : prev.filter((d) => d !== c.id),
                    )
                  }
                  className={checkboxCls}
                />
                {c.title}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={update.isPending} className={primaryBtn}>
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
  const now = new Date()

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
    <section className="rounded-panel border border-line bg-panel p-4">
      {editingProject ? (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} aria-label="Project name" />
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal" className={inputCls} aria-label="Goal" />
          <label className={fieldLabel}>
            Target
            <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className={`${inputCls} w-auto`} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={saveProject} className={primaryBtn}>
              Save
            </button>
            <button type="button" onClick={() => setEditingProject(false)} className={ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="block w-full text-left" onClick={() => setEditingProject(true)}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-text">{project.name}</h3>
            <span className="flex-none font-mono text-[12px] tabular-nums text-text-3">
              {openCount} open{project.targetDate ? ` · target ${formatDate(project.targetDate)}` : ''}
            </span>
          </div>
          {project.goal && <p className="mt-1 text-[13.5px] leading-[1.45] text-text-2">{project.goal}</p>}
        </button>
      )}

      <ul className="mt-3 divide-y divide-dotted divide-line-strong border-t border-dotted border-line-strong">
        {mine.map((item) => {
          const blocked = isBlocked(item, items)
          const soon =
            item.hardDeadline !== null &&
            item.status !== 'done' &&
            daysUntilDeadline(item.hardDeadline, now) <= 30
          return (
            <li key={item.id} className="py-0.5">
              <button
                type="button"
                className="grid min-h-tap w-full grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-x-2.5 text-left"
                onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
              >
                <span className={`size-2 shrink-0 rounded-pill ${statusDot[item.status]}`} />
                <span
                  className={`text-[14.5px] leading-[1.3] ${
                    item.status === 'done'
                      ? 'text-text-3 line-through'
                      : blocked
                        ? 'text-text-3'
                        : 'text-text'
                  }`}
                >
                  {item.title}
                </span>
                <span className={`font-mono text-[12px] tabular-nums ${soon ? 'text-accent' : 'text-text-3'}`}>
                  {effortLabels[item.effort][0]}
                  {item.hardDeadline ? ` · ${formatDate(item.hardDeadline)}` : ''}
                  {blocked ? ' · blocked' : ''}
                </span>
              </button>
              {expandedItem === item.id && (
                <ItemEditor item={item} allItems={items} onClose={() => setExpandedItem(null)} />
              )}
            </li>
          )
        })}
      </ul>

      <form onSubmit={addItem} className="mt-3 flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add an item…"
          className={`${inputCls} min-h-[42px] bg-raised`}
        />
        <button
          type="submit"
          disabled={!newTitle.trim() || createItem.isPending}
          className={`${outlineBtn} min-h-[42px] shrink-0`}
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
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-tap items-center px-1.5 text-[14px] font-semibold text-accent hover:underline">
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
    <form onSubmit={submit} className="space-y-2 rounded-panel border border-dotted border-line-strong p-3.5">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className={inputCls} />
      <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Goal (what does done look like?)" className={inputCls} />
      <div className="flex gap-2">
        <button type="submit" disabled={!name.trim()} className={primaryBtn}>
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
    <main className="mx-auto max-w-lg space-y-6 px-3.5 pb-4 pt-[18px]">
      <h1 className="px-1.5 text-title text-text">Projects</h1>
      <QueryStates queries={[projectsQuery, itemsQuery]} loadingLabel="Loading projects…">
      {areas.map(({ area, heading }) => {
        const loose = items.filter((i) => i.area === area && i.projectId === null)
        const count = projects.filter((p) => p.area === area).length
        return (
          <section key={area} className="space-y-3">
            <h2 className="flex items-center justify-between px-1.5 font-mono text-label uppercase text-text-3">
              {heading}
              <span className="tabular-nums">
                {count} {count === 1 ? 'project' : 'projects'}
              </span>
            </h2>
            {projects
              .filter((p) => p.area === area)
              .map((p) => (
                <ProjectCard key={p.id} project={p} items={items} />
              ))}
            {loose.length > 0 && (
              <section className="rounded-panel border border-line bg-panel p-4">
                <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-text-3">No project</h3>
                <ul className="mt-3 divide-y divide-dotted divide-line-strong border-t border-dotted border-line-strong">
                  {loose.map((item) => (
                    <li key={item.id} className="grid min-h-tap grid-cols-[14px_minmax(0,1fr)] items-center gap-x-2.5 text-[14.5px] text-text">
                      <span className={`size-2 shrink-0 rounded-pill ${statusDot[item.status]}`} />
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
