import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateItemsBulk } from '../hooks/useData'
import {
  structureLocally,
  structureWithAI,
  type ReviewRow,
  type StructureResult,
} from '../lib/importClient'
import { MAX_IMPORT_CHARS } from '../lib/importDraft'
import type { Area, Effort, NewItem } from '../types'

const inputCls =
  'w-full min-h-tap rounded-pill border border-line bg-panel px-4 text-[14px] text-text placeholder:text-text-3'
const smallBtn =
  'inline-flex min-h-tap items-center justify-center rounded-pill px-5 text-[14px] font-semibold active:translate-y-px disabled:opacity-45'
const primaryBtn = `${smallBtn} bg-accent text-accent-ink hover:bg-accent-hover`
const outlineBtn = `${smallBtn} border border-line-strong text-text hover:border-text`
const chip = 'inline-flex h-[18px] items-center rounded-pill px-1.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.1em]'

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const SparkIcon = () => (
  <svg className="mt-px flex-none text-accent" width="14" height="14" viewBox="0 0 24 24" {...stroke} aria-hidden>
    <path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
  </svg>
)
const LockIcon = () => (
  <svg className="mt-px flex-none text-text-3" width="13" height="13" viewBox="0 0 24 24" {...stroke} aria-hidden>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)

const SAMPLE = `- Email the accountant about Q3
1. Fix the leaking tap
2. Book the dentist by 2026-08-14
* Draft the launch post`

// Honest, per-source banner copy: the model, the not-yet-wired stub, or the
// stub served after a live call failed. Mirrors grooming's draftSourceLabel.
const sourceLabel: Record<StructureResult['source'], string> = {
  llm: 'Structured by the model. Every field below is an AI proposal, edit anything.',
  stub: 'The model is not wired here, so this is a local parse: titles split out, other fields left at defaults for you to set.',
  'stub-fallback':
    'The model call failed, so this is a local parse instead: titles split out, other fields left at defaults for you to set.',
}

/** Tiny per-field provenance chip so AI proposals are never mistaken for parsed values. */
function FieldTag({ row, field }: { row: ReviewRow; field: 'title' | 'other' }) {
  if (row.origin === 'ai') {
    return <span className={`${chip} bg-accent-soft text-accent`}>AI</span>
  }
  return (
    <span className={`${chip} bg-raised text-text-2`}>
      {field === 'title' ? 'parsed' : 'default'}
    </span>
  )
}

function fieldLabel(text: string, row: ReviewRow, field: 'title' | 'other') {
  return (
    <span className="mb-1.5 flex items-center gap-1.5">
      <span className="font-mono text-label uppercase text-text-3">
        {text}
      </span>
      <FieldTag row={row} field={field} />
    </span>
  )
}

function ReviewRowCard({
  row,
  index,
  onChange,
}: {
  row: ReviewRow
  index: number
  onChange: (index: number, patch: Partial<ReviewRow>) => void
}) {
  const cellSelect =
    'min-h-tap w-full rounded-pill border border-line bg-raised px-3 text-[14px] text-text'
  return (
    <li
      className={`rounded-card border p-3.5 ${
        row.include
          ? 'border-line bg-panel'
          : 'border-dashed border-line-strong bg-transparent opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={row.include}
          onChange={(e) => onChange(index, { include: e.target.checked })}
          aria-label={`Include "${row.title}"`}
          className="mt-1 size-[22px] flex-none appearance-none rounded-[7px] border border-line-strong bg-raised checked:border-accent checked:bg-accent"
        />
        <div className="min-w-0 flex-1">
          {fieldLabel('Title', row, 'title')}
          <input
            value={row.title}
            onChange={(e) => onChange(index, { title: e.target.value })}
            aria-label={`Title for row ${index + 1}`}
            className={`${inputCls} rounded-inner bg-raised`}
          />
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
            <label className="block">
              {fieldLabel('Area', row, 'other')}
              <select
                value={row.area}
                onChange={(e) => onChange(index, { area: e.target.value as Area })}
                className={cellSelect}
              >
                <option value="home">Home</option>
                <option value="work">Work</option>
              </select>
            </label>
            <label className="block">
              {fieldLabel('Effort', row, 'other')}
              <select
                value={row.effort}
                onChange={(e) => onChange(index, { effort: e.target.value as Effort })}
                className={cellSelect}
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
              </select>
            </label>
            <label className="block">
              {fieldLabel('Importance', row, 'other')}
              <select
                value={row.importance}
                onChange={(e) => onChange(index, { importance: Number(e.target.value) })}
                className={cellSelect}
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              {fieldLabel('Deadline', row, 'other')}
              <input
                type="date"
                value={row.deadline ?? ''}
                onChange={(e) => onChange(index, { deadline: e.target.value || null })}
                className={cellSelect}
              />
            </label>
          </div>
        </div>
      </div>
    </li>
  )
}

export function Import() {
  const navigate = useNavigate()
  const createItems = useCreateItemsBulk()
  const [text, setText] = useState('')
  const [structuring, setStructuring] = useState(false)
  // null = still on the paste step; the review step is the accept gate.
  const [result, setResult] = useState<StructureResult | null>(null)

  const overCap = text.length > MAX_IMPORT_CHARS
  const capped = text.slice(0, MAX_IMPORT_CHARS)
  const canStructure = capped.trim().length > 0 && !structuring

  const runLocal = () => setResult({ source: 'stub', rows: structureLocally(capped) })

  const runAI = async () => {
    setStructuring(true)
    try {
      setResult(await structureWithAI(capped))
    } finally {
      setStructuring(false)
    }
  }

  const patchRow = (index: number, patch: Partial<ReviewRow>) =>
    setResult((prev) =>
      prev ? { ...prev, rows: prev.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) } : prev,
    )

  const setAreaForAll = (area: Area) =>
    setResult((prev) => (prev ? { ...prev, rows: prev.rows.map((r) => ({ ...r, area })) } : prev))

  const setIncludeAll = (include: boolean) =>
    setResult((prev) => (prev ? { ...prev, rows: prev.rows.map((r) => ({ ...r, include })) } : prev))

  const rows = result?.rows ?? []
  const includedRows = rows.filter((r) => r.include && r.title.trim())

  const save = () => {
    const inputs: NewItem[] = includedRows.map((r) => ({
      title: r.title.trim(),
      notes: '',
      area: r.area,
      projectId: null,
      section: null,
      assignee: null,
      effort: r.effort,
      hardDeadline: r.deadline,
      importance: r.importance,
      dependsOn: [],
      status: 'open',
    }))
    // Save creates every reviewed item, then routes to What Now so the new
    // items are ranked immediately.
    createItems.mutate(inputs, { onSuccess: () => navigate('/') })
  }

  // ---- Paste step ----
  if (!result) {
    return (
      <main className="mx-auto max-w-lg px-5 pb-4 pt-[18px]">
        <h1 className="text-title text-text">Import a list</h1>
        <p className="mt-3 text-body text-text-2">
          Paste a messy list, one thing per line. Bullets, numbers, and trailing notes are fine.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          autoFocus
          placeholder={SAMPLE}
          aria-label="Paste your list"
          className={`${inputCls.replace('rounded-pill', 'rounded-panel').replace('min-h-tap', '')} mt-4 py-3 leading-[1.5]`}
        />
        <div className="mt-1.5 flex items-center justify-between px-1 font-mono text-[11px] text-text-3">
          <span className="tabular-nums">
            {text.length.toLocaleString()} / {MAX_IMPORT_CHARS.toLocaleString()}
          </span>
          {overCap && (
            <span className="text-overdue">
              That is a big paste. Only the first {MAX_IMPORT_CHARS.toLocaleString()} characters
              will be used.
            </span>
          )}
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-inner border border-line bg-panel px-3 py-2.5 text-[12px] leading-[1.45] text-text-2">
          <LockIcon />
          <span>
            AI structuring sends your pasted text to the Anthropic API. Local parse stays in your
            browser and never leaves the device.
          </span>
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={runLocal} disabled={!canStructure} className={`${outlineBtn} flex-1`}>
            Parse locally
          </button>
          <button
            type="button"
            onClick={runAI}
            disabled={!canStructure}
            className={`${primaryBtn} flex-1 gap-2 [&_svg]:text-accent-ink`}
          >
            <SparkIcon />
            {structuring ? 'Structuring…' : 'Structure with AI'}
          </button>
        </div>
        <p className="mt-2 px-1 text-[12px] text-text-3">
          Both open a review step first. Nothing is saved until you confirm it there.
        </p>
      </main>
    )
  }

  // ---- Review step (the accept gate) ----
  return (
    <main className="mx-auto max-w-lg px-5 pb-6 pt-[18px] lg:max-w-[900px]">
      <div className="flex items-baseline gap-3">
        <h1 className="text-title text-text">Review</h1>
        <span className="font-mono text-[12px] tabular-nums text-text-3">
          {includedRows.length} of {rows.length} to import
        </span>
      </div>

      <p className="mt-3 flex items-start gap-2 rounded-inner bg-raised px-3 py-2.5 text-meta text-text-2">
        <SparkIcon />
        <span>{sourceLabel[result.source]} Nothing counts until you save.</span>
      </p>

      {rows.length === 0 ? (
        <div className="mt-5">
          <p className="text-body text-text-2">
            Nothing to import from that paste. Go back and try another list.
          </p>
          <button type="button" onClick={() => setResult(null)} className={`${outlineBtn} mt-3`}>
            Back to paste
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-label uppercase text-text-3">
                Set area for all
              </span>
              <div className="inline-flex rounded-pill border border-line-strong p-[3px]">
                <button
                  type="button"
                  onClick={() => setAreaForAll('home')}
                  className="min-h-[34px] rounded-pill px-4 font-mono text-label uppercase text-text-3 hover:bg-raised hover:text-text"
                >
                  All home
                </button>
                <button
                  type="button"
                  onClick={() => setAreaForAll('work')}
                  className="min-h-[34px] rounded-pill px-4 font-mono text-label uppercase text-text-3 hover:bg-raised hover:text-text"
                >
                  All work
                </button>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3 text-[12.5px] font-semibold text-accent">
              <button type="button" onClick={() => setIncludeAll(true)} className="min-h-tap hover:underline">
                Include all
              </button>
              <button type="button" onClick={() => setIncludeAll(false)} className="min-h-tap hover:underline">
                Exclude all
              </button>
            </div>
          </div>

          <ul className="mt-3 space-y-2.5">
            {rows.map((row, i) => (
              <ReviewRowCard key={i} row={row} index={i} onChange={patchRow} />
            ))}
          </ul>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => setResult(null)} className={`${outlineBtn} flex-1`}>
              Back to paste
            </button>
            <button
              type="button"
              onClick={save}
              disabled={includedRows.length === 0 || createItems.isPending}
              className={`${primaryBtn} flex-[1.5]`}
            >
              {createItems.isPending
                ? 'Saving…'
                : `Save ${includedRows.length} item${includedRows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </main>
  )
}
