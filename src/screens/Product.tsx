import { useEffect, useRef, useState } from 'react'
import { useCreateStory, useStories, useUpdateStory } from '../hooks/useData'
import { QueryStates } from '../components/QueryStates'
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
  'w-full min-h-tap rounded-pill border border-ink/15 bg-surface-raised px-4 text-detail text-ink placeholder:text-sand-600 dark:border-ink-inverse/20 dark:bg-surface-dark-raised dark:text-ink-inverse dark:placeholder:text-sand-400'
const smallBtn =
  'inline-flex min-h-tap items-center justify-center rounded-pill px-5 font-display text-[14.5px] active:scale-95 disabled:opacity-50'
const clayBtn = `${smallBtn} bg-clay-500 text-ink hover:bg-clay-400 dark:bg-clay-400 dark:hover:bg-clay-300`
const outlineBtn = `${smallBtn} border-[1.5px] border-ink/25 text-ink hover:bg-ink/6 dark:border-ink-inverse/30 dark:text-ink-inverse dark:hover:bg-ink-inverse/8`

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
  strokeWidth: 2.75,
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
  <svg className="mt-px flex-none" width="14" height="14" viewBox="0 0 24 24" {...stroke} aria-hidden>
    <path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
  </svg>
)

function RawCaptureTag() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-sand-200 px-2.5 py-[3px] text-[11.5px] font-semibold text-sand-800 dark:bg-ink-inverse/12 dark:text-sand-300">
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
        className={`w-full rounded-[20px] p-3.5 text-left active:scale-[0.99] ${
          story.raw
            ? 'border-[1.5px] border-dashed border-sand-600 dark:border-sand-500'
            : 'bg-surface-raised shadow-sm dark:bg-surface-dark-raised'
        }`}
      >
        <p className="text-detail leading-[1.45] text-ink dark:text-ink-inverse">{story.title}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {story.raw ? (
            <RawCaptureTag />
          ) : (
            <span
              className="inline-flex items-center rounded-pill bg-clay-100 px-2.5 py-[3px] text-[11.5px] font-bold tabular-nums text-clay-800 dark:bg-clay-900 dark:text-clay-300"
              title="WSJF: cost of delay over job size"
            >
              WSJF {wsjf.score}
            </span>
          )}
          <span className="inline-flex items-center rounded-pill bg-sand-200 px-2.5 py-[3px] text-[11.5px] font-semibold tabular-nums text-sand-800 dark:bg-ink-inverse/12 dark:text-sand-300">
            {story.jobSize} pt{story.jobSize === 1 ? '' : 's'}
          </span>
          {ac && (
            <span className="inline-flex items-center gap-1 px-1 text-[11.5px] font-semibold tabular-nums text-sand-700 dark:text-sand-400">
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
    <span className="inline-flex rounded-pill bg-sage-200 px-2 py-px text-[10px] font-semibold uppercase tracking-[0.06em] text-sage-800 dark:bg-sage-800 dark:text-sage-200">
      draft
    </span>
  )
}

function FieldLabel({ text, draft, right }: { text: string; draft: boolean; right?: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-micro font-semibold uppercase text-sand-700 dark:text-sand-400">
        {text}
      </span>
      {draft && <DraftChip />}
      {right && (
        <span className="ml-auto text-[11.5px] font-semibold tabular-nums text-sand-700 dark:text-sand-400">
          {right}
        </span>
      )}
    </div>
  )
}

// The 1f editor. In draft mode every field arrived from the grooming
// assistant: sage chips mark them, the footer offers Accept / Re-draft,
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

  const areaCls = inputCls.replace('rounded-pill', 'rounded-ctl') + ' py-2.5'
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
    <label className="flex min-h-tap items-center gap-2 rounded-pill border border-ink/15 bg-surface px-3.5 dark:border-ink-inverse/20 dark:bg-surface-dark-raised">
      <span className="flex-none text-xs text-sand-700 dark:text-sand-400">{label}</span>
      <select
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="min-w-0 flex-1 appearance-none bg-transparent text-right text-[14px] font-semibold tabular-nums text-ink focus:outline-none dark:text-ink-inverse"
      >
        {options.map((v) => (
          <option key={v} value={v}>
            {v}
            {unit && ` ${unit}`}
          </option>
        ))}
      </select>
      <svg
        className="flex-none text-sand-600 dark:text-sand-500"
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
                className={`size-[22px] flex-none rounded-[7px] border-2 ${
                  story.acceptanceCriteria.find((c) => c.text === text.trim())?.done
                    ? 'border-sage-600 bg-sage-600 dark:border-sage-500 dark:bg-sage-500'
                    : 'border-sand-500 bg-surface-raised dark:border-sand-600 dark:bg-surface-dark-raised'
                }`}
                aria-hidden
              />
              <input
                value={text}
                onChange={(e) =>
                  setCriteria((prev) => prev.map((t, j) => (j === i ? e.target.value : t)))
                }
                aria-label={`Criterion ${i + 1}`}
                className="min-w-0 flex-1 border-b border-transparent bg-transparent text-detail leading-[1.4] text-ink focus:border-ink/25 focus:outline-none dark:text-ink-inverse dark:focus:border-ink-inverse/30"
              />
              <button
                type="button"
                aria-label={`Remove criterion ${i + 1}`}
                onClick={() => setCriteria((prev) => prev.filter((_, j) => j !== i))}
                className="grid size-tap flex-none place-items-center rounded-pill text-sand-600 hover:bg-ink/6 dark:text-sand-500 dark:hover:bg-ink-inverse/8"
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
            className="flex min-h-tap items-center gap-2 text-detail font-semibold text-clay-700 dark:text-clay-300"
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
        <div className="mt-2.5 flex items-baseline gap-2.5 px-0.5">
          <span className="text-meta tabular-nums text-sand-700 dark:text-sand-400">
            ({businessValue} + {timeCriticality} + {enablement}) ÷ {jobSize}
          </span>
          <span className="ml-auto inline-flex items-center rounded-pill bg-clay-100 px-3 py-[3px] text-[12.5px] font-bold tabular-nums text-clay-800 dark:bg-clay-900 dark:text-clay-300">
            WSJF {liveWsjf}
          </span>
        </div>
      </div>
      <div className="-mx-5 mt-3.5 border-t border-ink/12 px-5 pt-3 dark:border-ink-inverse/15">
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
                className={`${clayBtn} flex-[1.5]`}
              >
                Accept draft
              </button>
            </div>
            <p className="pb-1 pt-2 text-center text-[11.5px] text-sand-700 dark:text-sand-400">
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
              className={`${clayBtn} flex-[1.5]`}
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// The 1e move flow: destination rows with radio semantics, nothing moves
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
      <p className="text-micro font-semibold uppercase text-sand-700 dark:text-sand-400">Move to</p>
      <div role="radiogroup" aria-label="Move to" className="mt-2 flex flex-col gap-[7px]">
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
              className={`flex min-h-[52px] items-center gap-3 rounded-[18px] px-4 text-left ${
                selected
                  ? 'border-2 border-clay-500 bg-clay-100 dark:border-clay-400 dark:bg-clay-900'
                  : 'border-[1.5px] border-ink/16 hover:bg-ink/4 disabled:hover:bg-transparent dark:border-ink-inverse/20 dark:hover:bg-ink-inverse/6'
              }`}
            >
              <span
                className={`size-[18px] flex-none rounded-pill ${
                  selected
                    ? 'border-[1.5px] border-clay bg-clay [box-shadow:inset_0_0_0_4px_var(--color-clay-100)] dark:[box-shadow:inset_0_0_0_4px_var(--color-clay-900)]'
                    : 'border-[1.5px] border-sand-500'
                }`}
              />
              <span className="text-[14.5px] font-semibold text-ink dark:text-ink-inverse">
                {storyStatusLabels[s]}
              </span>
              {current && (
                <span className="ml-auto inline-flex items-center rounded-pill bg-sand-200 px-2.5 py-0.5 text-micro font-semibold normal-case tracking-normal text-sand-800 dark:bg-ink-inverse/12 dark:text-sand-300">
                  current
                </span>
              )}
              {!current && s === 'later' && (
                <span className="ml-auto text-xs text-sand-700 dark:text-sand-400">
                  out of the math
                </span>
              )}
              {selected && s !== 'later' && (
                <span className="ml-auto text-clay-700 dark:text-clay-300">
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
            className={`${clayBtn} flex-[1.5]`}
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
    <div className="fixed inset-0 z-20" role="dialog" aria-label="Story detail">
      <button
        type="button"
        aria-label="Dismiss story detail"
        onClick={onClose}
        className="absolute inset-0 bg-ink/48"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-sheet bg-surface-raised px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-sheet dark:bg-surface-dark">
        <div className="mx-auto max-w-lg">
          <div className="grid min-h-[26px] place-items-center pt-2.5">
            <span className="h-[4.5px] w-11 rounded-pill bg-sand-400 dark:bg-sand-600" aria-hidden />
          </div>
          <div className="flex items-start gap-2.5">
            {story.raw ? (
              <RawCaptureTag />
            ) : (
              <span className="inline-flex items-center rounded-pill bg-sand-200 px-2.5 py-[3px] text-[11.5px] font-semibold text-sand-800 dark:bg-ink-inverse/12 dark:text-sand-300">
                {storyStatusLabels[story.status]}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-2 ml-auto grid size-tap flex-none place-items-center rounded-pill text-sand-800 hover:bg-ink/7 dark:text-sand-300 dark:hover:bg-ink-inverse/10"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" {...stroke} aria-hidden>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {draft && draftStory ? (
            <div className="mt-1.5">
              <h2 className="font-display text-[21px] text-ink dark:text-ink-inverse">
                Groom this story
              </h2>
              <p className="mt-3 flex items-start gap-2 rounded-ctl bg-sage-100 px-3 py-2.5 text-meta leading-[1.45] text-sage-800 dark:bg-sage-900 dark:text-sage-200">
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
              <h2 className="mt-2.5 text-[14.5px] font-semibold leading-[1.4] text-ink dark:text-ink-inverse">
                {story.title}
              </h2>
              {story.description && (
                <p className="mt-2 text-detail text-sand-800 dark:text-sand-300">
                  {story.description}
                </p>
              )}

              {story.raw ? (
                <div className="mt-3 rounded-ctl bg-sage-100 px-3.5 py-3 dark:bg-sage-900">
                  <p className="flex items-start gap-2 text-meta leading-[1.45] text-sage-800 dark:text-sage-200">
                    <SparkIcon />
                    <span>
                      Raw capture: not yet in story form, unscored. Grooming drafts a story for
                      review; nothing counts until you accept it.
                    </span>
                  </p>
                  <button type="button" onClick={groom} disabled={drafting} className={`${clayBtn} mt-2.5`}>
                    {drafting ? 'Drafting…' : 'Groom this'}
                  </button>
                </div>
              ) : (
                <p className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-meta text-sand-700 dark:text-sand-400">
                  <span className="tabular-nums">
                    value {story.businessValue} + urgency {story.timeCriticality} + unblocks{' '}
                    {story.enablement}, ÷ size {story.jobSize}
                  </span>
                  <span className="inline-flex items-center rounded-pill bg-clay-100 px-3 py-[3px] text-[12.5px] font-bold tabular-nums text-clay-800 dark:bg-clay-900 dark:text-clay-300">
                    WSJF {wsjf.score}
                  </span>
                </p>
              )}

              {story.acceptanceCriteria.length > 0 && (
                <fieldset className="mt-3">
                  <legend className="flex items-center gap-1.5 text-micro font-semibold uppercase text-sand-700 dark:text-sand-400">
                    Acceptance criteria
                    <span className="tabular-nums normal-case tracking-normal">
                      {acProgress(story)}
                    </span>
                  </legend>
                  <ul className="mt-0.5">
                    {story.acceptanceCriteria.map((c, i) => (
                      <li key={c.text}>
                        <label className="flex min-h-tap cursor-pointer items-center gap-3 text-detail leading-[1.4] text-ink dark:text-ink-inverse">
                          <input
                            type="checkbox"
                            checked={c.done}
                            onChange={() => toggleCriterion(i)}
                            className="size-[22px] flex-none appearance-none rounded-[7px] border-2 border-sand-500 bg-surface-raised checked:border-sage-600 checked:bg-sage-600 dark:border-sand-600 dark:bg-surface-dark-raised dark:checked:border-sage-500 dark:checked:bg-sage-500"
                          />
                          <span className={c.done ? 'text-sand-600 line-through dark:text-sand-500' : ''}>
                            {c.text}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )}

              <MoveTo story={story} />

              <div className="mt-4 border-t border-ink/12 pt-3 dark:border-ink-inverse/15">
                <button type="button" onClick={() => setEditing(true)} className={outlineBtn}>
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
        aria-label="Add idea"
        className="grid size-tap flex-none place-items-center rounded-pill bg-clay-500 text-ink hover:bg-clay-400 active:scale-95 disabled:opacity-50 dark:bg-clay-400 dark:hover:bg-clay-300"
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
    <main className="pt-3">
      <div className="mx-auto max-w-lg px-5">
        <h1 className="font-display text-display">Product</h1>
        <p className="mt-1 text-[13px] leading-[1.5] text-sand-700 dark:text-sand-400">
          The app's own backlog, managed in the open: user stories, acceptance criteria, and WSJF
          scores. Tap a card to read, move, or groom it.
        </p>
      </div>

      <QueryStates
        queries={[storiesQuery]}
        loadingLabel="Loading the backlog…"
        className="mx-auto mt-3 max-w-lg px-5"
      >
        <div className="mx-auto flex max-w-lg gap-1.5 overflow-x-auto px-5 py-3" role="tablist" aria-label="Columns">
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
                className={`inline-flex min-h-9 flex-none items-center gap-1.5 rounded-pill px-3.5 text-[12.5px] ${
                  active
                    ? 'bg-ink font-semibold text-ink-inverse dark:bg-ink-inverse dark:text-ink'
                    : 'border border-ink/20 text-sand-800 hover:bg-ink/5 dark:border-ink-inverse/25 dark:text-sand-300 dark:hover:bg-ink-inverse/8'
                }`}
              >
                {col.label}
                <span className={`tabular-nums ${active ? 'text-sand-400 dark:text-sand-600' : 'text-sand-600 dark:text-sand-500'}`}>
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
                className="w-[312px] max-w-[85vw] shrink-0 snap-center rounded-card bg-sand-200 p-3 dark:bg-surface-dark"
              >
                <h2 className="flex items-baseline gap-2 px-1.5 pb-2.5 pt-0.5">
                  <span className="font-display text-card font-normal text-ink dark:text-ink-inverse">
                    {col.label}
                  </span>
                  <span className="text-xs font-semibold text-sand-700 dark:text-sand-400">
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
                    <p className="px-1 py-4 text-center text-detail text-sand-600 dark:text-sand-500">
                      Empty
                    </p>
                  )}
                </ul>
              </section>
            )
          })}
        </div>

        <div className="mx-auto max-w-lg px-3.5 pb-4">
          {later.length > 0 && (
            <section className="mt-2.5">
              <button
                type="button"
                aria-expanded={showLater}
                onClick={() => setShowLater((v) => !v)}
                className="flex min-h-tap w-full items-center gap-2 rounded-pill bg-sand-200 px-[18px] text-[13px] text-sand-800 hover:bg-sand-300 dark:bg-surface-dark dark:text-sand-300 dark:hover:bg-surface-dark-raised"
              >
                <svg
                  className={`flex-none text-sand-600 dark:text-sand-500 ${showLater ? 'rotate-90' : ''}`}
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  {...stroke}
                  aria-hidden
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
                Later ({later.length}): v3 candidates, parked out of the arithmetic
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
      </QueryStates>

      {open && <StorySheet story={open} onClose={() => setOpenId(null)} />}
    </main>
  )
}
