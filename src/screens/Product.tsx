import { useState } from 'react'
import { useCreateStory, useStories, useUpdateStory } from '../hooks/useData'
import { compareStories, storyWsjf } from '../scoring/wsjf'
import { storyStatusLabels } from '../lib/format'
import { requestGroomDraft } from '../lib/groomClient'
import type { GroomDraft } from '../lib/groomDraft'
import type { Story, StoryStatus } from '../types'

// The app's own roadmap as a managed backlog. Four board columns swipe
// horizontally (snap per column); 'later' is a collapsed shelf below the
// board. Cards move between columns by tap, from the story sheet.

const COLUMNS: { status: StoryStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'groomed', label: 'Groomed' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
]

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800'
const smallBtn = 'rounded-lg px-3 py-1.5 text-sm font-medium active:scale-95'

function acProgress(story: Story): string | null {
  if (story.acceptanceCriteria.length === 0) return null
  const done = story.acceptanceCriteria.filter((c) => c.done).length
  return `${done}/${story.acceptanceCriteria.length}`
}

function StoryCard({ story, onOpen }: { story: Story; onOpen: () => void }) {
  const wsjf = storyWsjf(story)
  const ac = acProgress(story)
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-left active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
      >
        <p className="text-sm font-medium leading-snug">{story.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          {story.raw ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              raw capture
            </span>
          ) : (
            <span
              className="rounded bg-indigo-100 px-1.5 py-0.5 font-semibold tabular-nums text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
              title="WSJF: cost of delay over job size"
            >
              WSJF {wsjf.score}
            </span>
          )}
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {story.jobSize} pt{story.jobSize === 1 ? '' : 's'}
          </span>
          {ac && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              ✓ {ac}
            </span>
          )}
        </div>
      </button>
    </li>
  )
}

function StoryEditor({ story, onClose }: { story: Story; onClose: () => void }) {
  const update = useUpdateStory()
  const [title, setTitle] = useState(story.title)
  const [description, setDescription] = useState(story.description)
  const [businessValue, setBusinessValue] = useState(story.businessValue)
  const [timeCriticality, setTimeCriticality] = useState(story.timeCriticality)
  const [enablement, setEnablement] = useState(story.enablement)
  const [jobSize, setJobSize] = useState(story.jobSize)
  const [criteria, setCriteria] = useState(story.acceptanceCriteria.map((c) => c.text).join('\n'))

  const save = () => {
    const texts = criteria
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)
    // Saving criteria into a raw capture is grooming it, whether the words
    // came from the assistant's draft or by hand: the raw flag clears and a
    // backlog story moves to Groomed.
    const becomesGroomed = story.raw && texts.length > 0
    update.mutate(
      {
        id: story.id,
        patch: {
          title: title.trim() || story.title,
          description,
          businessValue,
          timeCriticality,
          enablement,
          jobSize,
          // Keep done-state for criteria whose text survives the edit.
          acceptanceCriteria: texts.map((text) => ({
            text,
            done: story.acceptanceCriteria.find((c) => c.text === text)?.done ?? false,
          })),
          raw: story.raw && !becomesGroomed,
          ...(becomesGroomed && story.status === 'backlog' ? { status: 'groomed' as const } : {}),
        },
      },
      { onSuccess: onClose },
    )
  }

  const scoreSelect = (label: string, value: number, set: (v: number) => void) => (
    <label className="flex items-center justify-between gap-2 text-sm">
      {label}
      <select value={value} onChange={(e) => set(Number(e.target.value))} className={`${inputCls} w-auto`}>
        {[1, 2, 3, 4, 5].map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="space-y-3">
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        rows={3}
        className={inputCls}
        aria-label="Story title"
        placeholder="As a [user], I want [capability] so that [outcome]"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className={inputCls}
        aria-label="Description"
        placeholder="Description"
      />
      <textarea
        value={criteria}
        onChange={(e) => setCriteria(e.target.value)}
        rows={4}
        className={inputCls}
        aria-label="Acceptance criteria"
        placeholder={'Acceptance criteria, one per line'}
      />
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {scoreSelect('Value', businessValue, setBusinessValue)}
        {scoreSelect('Urgency', timeCriticality, setTimeCriticality)}
        {scoreSelect('Unblocks', enablement, setEnablement)}
        <label className="flex items-center justify-between gap-2 text-sm">
          Size
          <select value={jobSize} onChange={(e) => setJobSize(Number(e.target.value))} className={`${inputCls} w-auto`}>
            {[1, 2, 3, 5, 8].map((v) => (
              <option key={v} value={v}>
                {v} pt{v === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={update.isPending}
          className={`${smallBtn} bg-indigo-600 text-white disabled:opacity-50`}
        >
          Save
        </button>
        <button type="button" onClick={onClose} className={`${smallBtn} text-zinc-500`}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function StorySheet({ story, onClose }: { story: Story; onClose: () => void }) {
  const update = useUpdateStory()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<GroomDraft | null>(null)
  const [drafting, setDrafting] = useState(false)
  const wsjf = storyWsjf(story)

  const groom = async () => {
    setDrafting(true)
    try {
      setDraft(await requestGroomDraft(story.title))
    } finally {
      setDrafting(false)
    }
  }

  // The draft is only a proposal: it lives in the editor, prefilled, and
  // touches the story exclusively through an explicit Save.
  const draftStory: Story | null = draft && {
    ...story,
    title: draft.title,
    description: draft.description,
    acceptanceCriteria: draft.acceptanceCriteria.map((text) => ({ text, done: false })),
    businessValue: draft.businessValue,
    timeCriticality: draft.timeCriticality,
    enablement: draft.enablement,
    jobSize: draft.jobSize,
  }

  const toggleCriterion = (index: number) => {
    update.mutate({
      id: story.id,
      patch: {
        acceptanceCriteria: story.acceptanceCriteria.map((c, i) =>
          i === index ? { ...c, done: !c.done } : c,
        ),
      },
    })
  }

  const moveTo = (status: StoryStatus) => {
    update.mutate({ id: story.id, patch: { status } })
  }

  return (
    <div className="fixed inset-0 z-20" role="dialog" aria-label="Story detail">
      <button
        type="button"
        aria-label="Dismiss story detail"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:bg-zinc-900">
        <div className="mx-auto max-w-lg">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {storyStatusLabels[story.status]}
            </span>
            <button type="button" onClick={onClose} className="text-sm font-medium text-zinc-500">
              Close
            </button>
          </div>

          {draft && draftStory ? (
            <div className="mt-3">
              <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">
                {draft.source === 'stub'
                  ? 'Proposed draft from the local stub (the model call is not wired yet). '
                  : 'Proposed draft from the model. '}
                {draft.rationale} Nothing applies until you save.
              </p>
              <div className="mt-3">
                <StoryEditor story={draftStory} onClose={() => setDraft(null)} />
              </div>
            </div>
          ) : editing ? (
            <div className="mt-3">
              <StoryEditor story={story} onClose={() => setEditing(false)} />
            </div>
          ) : (
            <>
              <h2 className="mt-2 font-semibold leading-snug">{story.title}</h2>
              {story.description && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{story.description}</p>
              )}

              {story.raw ? (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <p>Raw capture: not yet in story form, unscored.</p>
                  <button
                    type="button"
                    onClick={groom}
                    disabled={drafting}
                    className={`${smallBtn} mt-2 bg-indigo-600 text-white disabled:opacity-50`}
                  >
                    {drafting ? 'Drafting…' : 'Groom this'}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                    WSJF {wsjf.score}
                  </span>{' '}
                  = cost of delay {wsjf.costOfDelay} (value {story.businessValue} + urgency{' '}
                  {story.timeCriticality} + unblocks {story.enablement}) ÷ size {story.jobSize}
                </p>
              )}

              {story.acceptanceCriteria.length > 0 && (
                <fieldset className="mt-3">
                  <legend className="text-sm font-semibold">Acceptance criteria</legend>
                  <ul className="mt-1 space-y-1">
                    {story.acceptanceCriteria.map((c, i) => (
                      <li key={c.text}>
                        <label className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={c.done}
                            onChange={() => toggleCriterion(i)}
                            className="mt-0.5"
                          />
                          <span className={c.done ? 'text-zinc-400 line-through' : ''}>{c.text}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )}

              <div className="mt-4">
                <p className="text-sm font-semibold">Move to</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(Object.keys(storyStatusLabels) as StoryStatus[])
                    .filter((s) => s !== story.status)
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => moveTo(s)}
                        className={`${smallBtn} bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200`}
                      >
                        {storyStatusLabels[s]}
                      </button>
                    ))}
                </div>
              </div>

              <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className={`${smallBtn} bg-zinc-200 dark:bg-zinc-700`}
                >
                  Edit story
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CaptureIdea() {
  const create = useCreateStory()
  const [title, setTitle] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    create.mutate(
      {
        title: trimmed,
        description: '',
        acceptanceCriteria: [],
        businessValue: 3,
        timeCriticality: 3,
        enablement: 3,
        jobSize: 3,
        status: 'backlog',
        raw: true,
      },
      { onSuccess: () => setTitle('') },
    )
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Capture an idea…"
        className={inputCls}
        aria-label="Capture an idea"
      />
      <button
        type="submit"
        disabled={!title.trim() || create.isPending}
        className={`${smallBtn} shrink-0 bg-zinc-200 dark:bg-zinc-700 disabled:opacity-50`}
      >
        Add
      </button>
    </form>
  )
}

export function Product() {
  const stories = useStories().data ?? []
  const [openId, setOpenId] = useState<string | null>(null)
  const [showLater, setShowLater] = useState(false)

  const open = stories.find((s) => s.id === openId) ?? null
  const later = stories.filter((s) => s.status === 'later').sort(compareStories)

  return (
    <main className="pt-4">
      <div className="mx-auto max-w-lg px-4">
        <h1 className="text-2xl font-bold">Product</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          This app's own backlog, managed in the open: user stories, acceptance criteria, and WSJF
          scores. Tap a card to read, move, or groom it.
        </p>
      </div>

      <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
        {COLUMNS.map((col) => {
          const colStories = stories.filter((s) => s.status === col.status).sort(compareStories)
          return (
            <section
              key={col.status}
              className="w-[80vw] max-w-xs shrink-0 snap-center rounded-xl bg-zinc-100 p-2.5 dark:bg-zinc-900/60"
            >
              <h2 className="flex items-baseline justify-between px-1 text-sm font-semibold">
                {col.label}
                <span className="text-xs font-normal text-zinc-500">{colStories.length}</span>
              </h2>
              {col.status === 'backlog' && (
                <div className="mt-2">
                  <CaptureIdea />
                </div>
              )}
              <ul className="mt-2 space-y-2">
                {colStories.map((s) => (
                  <StoryCard key={s.id} story={s} onOpen={() => setOpenId(s.id)} />
                ))}
                {colStories.length === 0 && (
                  <p className="px-1 py-4 text-center text-sm text-zinc-400">Empty</p>
                )}
              </ul>
            </section>
          )
        })}
      </div>

      <div className="mx-auto max-w-lg px-4 pb-4">
        {later.length > 0 && (
          <section className="mt-4">
            <button
              type="button"
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400"
              onClick={() => setShowLater((v) => !v)}
            >
              {showLater ? '▾' : '▸'} Later ({later.length}): v3 candidates
            </button>
            {showLater && (
              <ul className="mt-3 space-y-2">
                {later.map((s) => (
                  <StoryCard key={s.id} story={s} onOpen={() => setOpenId(s.id)} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {open && <StorySheet story={open} onClose={() => setOpenId(null)} />}
    </main>
  )
}
