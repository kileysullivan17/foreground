import { useEffect, useRef, useState } from 'react'
import { useCreateStory, useStories, useUpdateStory } from '../hooks/useData'
import { QueryStates } from '../components/QueryStates'
import { Sheet } from '../components/Sheet'
import { compareStories, storyWsjf } from '../scoring/wsjf'
import { storyStatusLabels } from '../lib/format'
import { requestGroomDraft } from '../lib/groomClient'
import type { GroomDraft } from '../lib/groomDraft'
import type { Story, StoryStatus } from '../types'

// The app's own roadmap as a managed backlog. Four board columns swipe
// horizontally (snap per column) with a chip bar that jumps between them;
// 'later' is a collapsed shelf below the board. Cards move between columns
// from the story sheet: pick a destination row, then confirm.

const COLUMNS: { status: StoryStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'groomed', label: 'Groomed' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
]

const inputCls =
  'w-full min-h-tap rounded-pill border border-line bg-panel px-4 text-[14px] text-text placeholder:text-text-3'
const smallBtn =
  'inline-flex min-h-tap items-center justify-center rounded-pill px-5 text-[14px] font-semibold active:translate-y-px disabled:opacity-45'
const primaryBtn = `${smallBtn} bg-accent text-accent-ink hover:bg-accent-hover`
const outlineBtn = `${smallBtn} border border-line-strong text-text hover:border-text`
// 26px mono chips: the WSJF score in the soft accent, everything else raised.
const chip = 'inline-flex h-[26px] items-center gap-1.5 rounded-pill px-2.5 font-mono text-label uppercase tabular-nums'
const labelCls = 'font-mono text-label uppercase text-text-3'
const checkboxCls =
  'size-[22px] flex-none appearance-none rounded-[7px] border border-line-strong bg-raised checked:border-accent checked:bg-accent'

// Each draft names its origin honestly: the model, the offline stub, or the
// stub served because a live call failed.
const draftSourceLabel: Record<GroomDraft['source'], string> = {
  llm: 'Proposed draft from the model.',
  stub: 'Proposed draft from the local stub (the model call is not wired yet).',
  'stub-fallback': 'The model call failed, so this is a local stub draft instead.',
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const CheckIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} aria-hidden>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
const TargetIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" {...stroke} aria-hidden>
    <path d="M12 3v2" />
    <path d="M12 19v2" />
    <path d="M3 12h2" />
    <path d="M19 12h2" />
    <circle cx="12" cy="12" r="5" />
  </svg>
)
const SparkIcon = () => (
  <svg className="mt-px flex-none text-accent" width="14" height="14" viewBox="0 0 24 24" {...stroke} aria-hidden>
    <path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
  </svg>
)

function RawCaptureTag() {
  return (
    <span className={`${chip} bg-line text-text`}>
      <TargetIcon />
      raw capture
    </span>
  )
}

function acProgress(story: Story): string | null {
  if (story.acceptanceCriteria.length === 0) return null
  const done = story.acceptanceCriteria.filter((c) => c.done).length
  return `${done} / ${story.acceptanceCriteria.length}`
}

function StoryCard({ story, onOpen }: { story: Story; onOpen: () => void }) {
  const wsjf = storyWsjf(story)
  const ac = acProgress(story)
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`w-full rounded-card border p-4 text-left active:translate-y-px ${
          story.raw ? 'border-dashed border-line-strong' : 'border-line bg-panel'
        }`}
      >
        <p className="text-[15px] leading-[1.45] text-text">{story.title}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {story.raw ? (
            <RawCaptureTag />
          ) : (
            <span
              className={`${chip} bg-accent-soft text-accent`}
              title="WSJF: cost of delay over job size"
            >
              WSJF {wsjf.score}
            </span>
          )}
          <span className={`${chip} bg-raised text-text-2`}>
            {story.jobSize} pt{story.jobSize === 1 ? '' : 's'}
          </span>
          {ac && (
            <span className={`${chip} bg-raised text-text-2`}>
              <CheckIcon />
              {ac}
            </span>
          )}
        </div>
      </button>
    </li>
  )
}

function DraftChip() {
  return (
    <span className="inline-flex h-[18px] items-center rounded-pill bg-accent-soft px-2 font-mono text-[9.5px] font-medium uppercase tracking-[0.1em] text-accent">
      draft
    </span>
  )
}

function FieldLabel({ text, draft, right }: { text: string; draft: boolean; right?: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className={labelCls}>{text}</span>
      {draft && <DraftChip />}
      {right && (
        <span className="ml-auto font-mono text-label tabular-nums text-text-3">
          {right}
        </span>
      )}
    </div>
  )
}

// The story editor. In draft mode every field arrived from the grooming
// assistant: accent chips mark them, the footer offers Accept / Re-draft,
// and Esc discards the draft leaving the raw capture untouched.
function StoryEditor({
  story,
  onClose,
  draftMode = false,
  onRedraft,
  redrafting = false,
}: {
  story: Story
  onClose: () => void
  draftMode?: boolean
  onRedraft?: () => void
  redrafting?: boolean
}) {
  const update = useUpdateStory()
  const [title, setTitle] = useState(story.title)
  const [description, setDescription] = useState(story.description)
  const [businessValue, setBusinessValue] = useState(story.businessValue)
  const [timeCriticality, setTimeCriticality] = useState(story.timeCriticality)
  const [enablement, setEnablement] = useState(story.enablement)
  const [jobSize, setJobSize] = useState(story.jobSize)
  const [criteria, setCriteria] = useState<string[]>(story.acceptanceCriteria.map((c) => c.text))

  useEffect(() => {
    if (!draftMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [draftMode, onClose])

  const areaCls = inputCls.replace('rounded-pill', 'rounded-inner').replace('bg-panel', 'bg-raised') + ' py-2.5'
  const liveWsjf =
    Math.round(((businessValue + timeCriticality + enablement) / jobSize) * 10) / 10

  const save = () => {
    const texts = criteria.map((t) => t.trim()).filter(Boolean)
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

  const pillSelect = (
    label: string,
    value: number,
    set: (v: number) => void,
    options: number[],
    unit = '',
  ) => (
    <label className="flex min-h-tap items-center gap-2 rounded-pill border border-line bg-raised px-3.5">
      <span className={`flex-none ${labelCls}`}>{label}</span>
      <select
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-right font-mono text-[14px] tabular-nums text-text focus:shadow-none focus:outline-none"
      >
        {options.map((v) => (
          <option key={v} value={v}>
            {v}
            {unit && ` ${unit}`}
          </option>
        ))}
      </select>
      <svg
        className="flex-none text-text-3"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        {...stroke}
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  )

  return (
    <div>
      <FieldLabel text="Title" draft={draftMode} />
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        rows={2}
        className={`${areaCls} font-semibold`}
        aria-label="Story title"
        placeholder="As a [user], I want [capability] so that [outcome]"
      />
      <div className="mt-3.5">
        <FieldLabel text="Description" draft={draftMode} />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={areaCls}
          aria-label="Description"
          placeholder="Description"
        />
      </div>
      <div className="mt-3.5">
        <FieldLabel
          text="Acceptance criteria"
          draft={draftMode}
          right={`${
            criteria.filter((t) => story.acceptanceCriteria.find((c) => c.text === t.trim())?.done)
              .length
          } / ${criteria.filter((t) => t.trim()).length}`}
        />
        <div className="flex flex-col">
          {criteria.map((text, i) => (
            <div key={i} className="flex min-h-tap items-center gap-3">
              <span
                className={`size-[22px] flex-none rounded-[7px] border ${
                  story.acceptanceCriteria.find((c) => c.text === text.trim())?.done
                    ? 'border-accent bg-accent'
                    : 'border-line-strong bg-raised'
                }`}
                aria-hidden
              />
              <input
                value={text}
                onChange={(e) =>
                  setCriteria((prev) => prev.map((t, j) => (j === i ? e.target.value : t)))
                }
                aria-label={`Criterion ${i + 1}`}
                className="min-w-0 flex-1 rounded-none border-b border-transparent bg-transparent text-[13.5px] leading-[1.4] text-text focus:border-line-strong focus:shadow-none focus:outline-none"
              />
              <button
                type="button"
                aria-label={`Remove criterion ${i + 1}`}
                onClick={() => setCriteria((prev) => prev.filter((_, j) => j !== i))}
                className="grid size-tap flex-none place-items-center rounded-pill text-text-3 hover:text-text"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" {...stroke} aria-hidden>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setCriteria((prev) => [...prev, ''])}
            className="flex min-h-tap items-center gap-2 text-[13.5px] font-semibold text-accent hover:underline"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" {...stroke} aria-hidden>
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Add a criterion
          </button>
        </div>
      </div>
      <div className="mt-2">
        <FieldLabel text="WSJF inputs" draft={draftMode} />
        <div className="grid grid-cols-2 gap-2">
          {pillSelect('Value', businessValue, setBusinessValue, [1, 2, 3, 4, 5])}
          {pillSelect('Urgency', timeCriticality, setTimeCriticality, [1, 2, 3, 4, 5])}
          {pillSelect('Unblocks', enablement, setEnablement, [1, 2, 3, 4, 5])}
          {pillSelect('Size', jobSize, setJobSize, [1, 2, 3, 5, 8], 'pts')}
        </div>
        <div className="mt-3 flex items-baseline gap-2.5 px-0.5">
          <span className="font-mono text-equation tabular-nums text-text-3">
            ({businessValue} + {timeCriticality} + {enablement}) ÷ {jobSize}
          </span>
          <span className={`${chip} ml-auto bg-accent-soft text-accent`}>
            WSJF {liveWsjf}
          </span>
        </div>
      </div>
      <div className="-mx-5 mt-4 border-t border-line px-5 pt-3">
        {draftMode ? (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onRedraft}
                disabled={redrafting || update.isPending}
                className={`${outlineBtn} flex-1`}
              >
                {redrafting ? 'Drafting…' : 'Re-draft'}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={update.isPending}
                className={`${primaryBtn} flex-[1.5]`}
              >
                Accept draft
              </button>
            </div>
            <p className="pb-1 pt-2.5 text-center text-[12px] text-text-3">
              Esc discards the draft and keeps the raw capture
            </p>
          </>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={`${outlineBtn} flex-1`}>
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={update.isPending}
              className={`${primaryBtn} flex-[1.5]`}
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// The move flow: destination rows with radio semantics, nothing moves
// until the confirm button. Selection resets when the sheet reopens.
function MoveTo({ story }: { story: Story }) {
  const update = useUpdateStory()
  const [picked, setPicked] = useState<StoryStatus | null>(null)
  const statuses = Object.keys(storyStatusLabels) as StoryStatus[]

  const confirm = () => {
    if (picked && picked !== story.status) {
      update.mutate({ id: story.id, patch: { status: picked } })
      setPicked(null)
    }
  }

  return (
    <div className="mt-4">
      <p className={labelCls}>Move to</p>
      <div role="radiogroup" aria-label="Move to" className="mt-2.5 flex flex-col gap-[7px]">
        {statuses.map((s) => {
          const current = s === story.status
          const selected = picked === s
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={current}
              onClick={() => setPicked(selected ? null : s)}
              className={`flex min-h-[52px] items-center gap-3 rounded-inner border px-4 text-left disabled:opacity-60 ${
                selected
                  ? 'border-accent bg-accent-soft'
                  : 'border-line hover:bg-raised disabled:hover:bg-transparent'
              }`}
            >
              <span
                className={`size-[18px] flex-none rounded-pill border ${
                  selected
                    ? 'border-accent bg-accent [box-shadow:inset_0_0_0_4px_var(--color-panel)]'
                    : 'border-line-strong'
                }`}
              />
              <span className="text-[14.5px] font-semibold text-text">
                {storyStatusLabels[s]}
              </span>
              {current && (
                <span className="ml-auto inline-flex h-[22px] items-center rounded-pill bg-raised px-2.5 font-mono text-label uppercase text-text-2">
                  current
                </span>
              )}
              {!current && s === 'later' && (
                <span className="ml-auto font-mono text-[11px] text-text-3">
                  out of the math
                </span>
              )}
              {selected && s !== 'later' && (
                <span className="ml-auto text-accent">
                  <CheckIcon size={17} />
                </span>
              )}
            </button>
          )
        })}
      </div>
      {picked && (
        <div className="mt-3.5 flex gap-2">
          <button type="button" onClick={() => setPicked(null)} className={`${outlineBtn} flex-1`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={update.isPending}
            className={`${primaryBtn} flex-[1.5]`}
          >
            Move to {storyStatusLabels[picked]}
          </button>
        </div>
      )}
    </div>
  )
}

function StorySheet({ story, onClose }: { story: Story; onClose: () => void }) {
  const update = useUpdateStory()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<GroomDraft | null>(null)
  const [draftSeq, setDraftSeq] = useState(0)
  const [drafting, setDrafting] = useState(false)
  const wsjf = storyWsjf(story)

  const groom = async () => {
    setDrafting(true)
    try {
      setDraft(await requestGroomDraft(story.title))
      // Remount the editor so a re-draft's values replace the edited ones.
      setDraftSeq((n) => n + 1)
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

  return (
    <Sheet label="Story detail" onClose={onClose}>
      <div className="flex items-start gap-2.5">
            {story.raw ? (
              <RawCaptureTag />
            ) : (
              <span className={`${chip} bg-raised text-text-2`}>
                {storyStatusLabels[story.status]}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-2 ml-auto grid size-tap flex-none place-items-center rounded-pill text-text-3 hover:text-text"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" {...stroke} aria-hidden>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {draft && draftStory ? (
            <div className="mt-1.5">
              <h2 className="text-[21px] font-semibold leading-[1.2] tracking-[-0.01em] text-text">
                Groom this story
              </h2>
              <p className="mt-3 flex items-start gap-2 rounded-inner bg-raised px-3 py-2.5 text-meta text-text-2">
                <SparkIcon />
                <span>
                  {draftSourceLabel[draft.source]} {draft.rationale} Nothing counts until you
                  accept.
                </span>
              </p>
              <div className="mt-4">
                <StoryEditor
                  key={draftSeq}
                  story={draftStory}
                  onClose={() => setDraft(null)}
                  draftMode
                  onRedraft={groom}
                  redrafting={drafting}
                />
              </div>
            </div>
          ) : editing ? (
            <div className="mt-3">
              <StoryEditor story={story} onClose={() => setEditing(false)} />
            </div>
          ) : (
            <>
              <h2 className="mt-3 text-[15px] font-semibold leading-[1.4] text-text">
                {story.title}
              </h2>
              {story.description && (
                <p className="mt-2 text-[13.5px] leading-[1.5] text-text-2">
                  {story.description}
                </p>
              )}

              {story.raw ? (
                <div className="mt-3 rounded-inner bg-raised px-3.5 py-3">
                  <p className="flex items-start gap-2 text-meta text-text-2">
                    <SparkIcon />
                    <span>
                      Raw capture: not yet in story form, unscored. Grooming drafts a story for
                      review; nothing counts until you accept it.
                    </span>
                  </p>
                  <button type="button" onClick={groom} disabled={drafting} className={`${primaryBtn} mt-3`}>
                    {drafting ? 'Drafting…' : 'Groom this'}
                  </button>
                </div>
              ) : (
                <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="font-mono text-equation tabular-nums text-text-3">
                    value {story.businessValue} + urgency {story.timeCriticality} + unblocks{' '}
                    {story.enablement}, ÷ size {story.jobSize}
                  </span>
                  <span className={`${chip} bg-accent-soft text-accent`}>
                    WSJF {wsjf.score}
                  </span>
                </p>
              )}

              {story.acceptanceCriteria.length > 0 && (
                <fieldset className="mt-4">
                  <legend className={`flex items-center gap-2 ${labelCls}`}>
                    Acceptance criteria
                    <span className="tabular-nums">
                      {acProgress(story)}
                    </span>
                  </legend>
                  <ul className="mt-0.5">
                    {story.acceptanceCriteria.map((c, i) => (
                      <li key={c.text}>
                        <label className="flex min-h-tap cursor-pointer items-center gap-3 text-[13.5px] leading-[1.4] text-text">
                          <input
                            type="checkbox"
                            checked={c.done}
                            onChange={() => toggleCriterion(i)}
                            className={checkboxCls}
                          />
                          <span className={c.done ? 'text-text-3 line-through' : ''}>
                            {c.text}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )}

              <MoveTo story={story} />

              <div className="mt-4 border-t border-line pt-3">
                <button type="button" onClick={() => setEditing(true)} className={outlineBtn}>
                  Edit story
                </button>
              </div>
            </>
          )}
    </Sheet>
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
        className={`${inputCls} min-h-[46px]`}
        aria-label="Capture an idea"
      />
      <button
        type="submit"
        disabled={!title.trim() || create.isPending}
        aria-label="Add idea"
        className="grid size-[46px] flex-none place-items-center rounded-pill bg-accent text-accent-ink hover:bg-accent-hover active:translate-y-px disabled:opacity-45"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" {...stroke} aria-hidden>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>
    </form>
  )
}

export function Product() {
  const storiesQuery = useStories()
  const stories = storiesQuery.data ?? []
  const [openId, setOpenId] = useState<string | null>(null)
  const [showLater, setShowLater] = useState(false)
  const [activeCol, setActiveCol] = useState<StoryStatus>('backlog')
  const boardRef = useRef<HTMLDivElement>(null)

  const open = stories.find((s) => s.id === openId) ?? null
  const later = stories.filter((s) => s.status === 'later').sort(compareStories)

  const jumpTo = (status: StoryStatus) => {
    setActiveCol(status)
    const board = boardRef.current
    const col = board?.querySelector<HTMLElement>(`[data-col="${status}"]`)
    if (board && col) board.scrollTo({ left: col.offsetLeft - board.offsetLeft, behavior: 'smooth' })
  }

  return (
    <main className="pt-title-top">
      <div className="mx-auto max-w-lg px-5">
        <h1 className="text-title text-text">Product</h1>
        <p className="mt-lede text-body text-text-2">
          The app's own roadmap, managed in the open as a kanban board of user-story tickets, each
          with acceptance criteria and a Weighted Shortest Job First (WSJF) score. Tap a card to read
          it or move it between columns; raw captures can be groomed into a full story.
        </p>
      </div>

      <QueryStates
        queries={[storiesQuery]}
        loadingLabel="Loading the backlog…"
        className="mx-auto mt-3 max-w-lg px-5"
      >
        <div className="mx-auto flex max-w-lg gap-1.5 overflow-x-auto px-5 py-4" role="tablist" aria-label="Columns">
          {COLUMNS.map((col) => {
            const n = stories.filter((s) => s.status === col.status).length
            const active = activeCol === col.status
            return (
              <button
                key={col.status}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => jumpTo(col.status)}
                className={`relative inline-flex min-h-[34px] flex-none items-center gap-2 rounded-pill border border-line-strong px-3.5 font-mono text-label uppercase before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] ${
                  active ? 'bg-raised text-text' : 'text-text-3 hover:text-text'
                }`}
              >
                {col.label}
                <span className="tabular-nums text-accent">
                  {n}
                </span>
              </button>
            )
          })}
        </div>

        <div
          ref={boardRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3.5 pb-2"
        >
          {COLUMNS.map((col) => {
            const colStories = stories.filter((s) => s.status === col.status).sort(compareStories)
            return (
              <section
                key={col.status}
                data-col={col.status}
                className="w-[312px] max-w-[85vw] shrink-0 snap-center p-1.5"
              >
                <h2 className="flex items-baseline gap-2 px-1 pb-3 pt-0.5 font-mono text-label uppercase text-text-3">
                  <span>
                    {col.label}
                  </span>
                  <span className="tabular-nums text-accent">
                    {colStories.length}
                  </span>
                </h2>
                {col.status === 'backlog' && (
                  <div className="mb-2.5">
                    <CaptureIdea />
                  </div>
                )}
                <ul className="space-y-2">
                  {colStories.map((s) => (
                    <StoryCard key={s.id} story={s} onOpen={() => setOpenId(s.id)} />
                  ))}
                  {colStories.length === 0 && (
                    <p className="px-1 py-4 text-center text-body text-text-3">
                      Empty
                    </p>
                  )}
                </ul>
              </section>
            )
          })}
        </div>

        <div className="mx-auto max-w-lg px-5 pb-4">
          {later.length > 0 && (
            <section className="mt-2.5 border-t border-dotted border-line-strong">
              <button
                type="button"
                aria-expanded={showLater}
                onClick={() => setShowLater((v) => !v)}
                className="flex min-h-tap w-full items-center gap-2 font-mono text-label uppercase text-text-3 hover:text-text"
              >
                Later ({later.length}): v3 candidates, parked out of the arithmetic
                <svg
                  className={`ml-auto flex-none transition-transform ${showLater ? 'rotate-90' : ''}`}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  {...stroke}
                  aria-hidden
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
              {showLater && (
                <ul className="mt-1 space-y-2 pb-2">
                  {later.map((s) => (
                    <StoryCard key={s.id} story={s} onOpen={() => setOpenId(s.id)} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </QueryStates>

      {open && <StorySheet story={open} onClose={() => setOpenId(null)} />}
    </main>
  )
}
