import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { itemFormSchema, type ItemFormOutput, type ItemFormValues } from '../schemas'
import { useCreateItem, useItems, useProjects } from '../hooks/useData'
import { Segmented } from '../components/Segmented'
import type { Area, Effort } from '../types'

const inputCls =
  'w-full min-h-tap rounded-pill border border-line bg-panel px-4 text-[14px] text-text placeholder:text-text-3'
const fieldLabel = 'mb-1.5 block font-mono text-label uppercase text-text-3'
const checkboxCls =
  'size-[22px] flex-none appearance-none rounded-[7px] border border-line-strong bg-panel checked:border-accent checked:bg-accent'

const emptyValues: ItemFormValues = {
  title: '',
  area: 'home',
  notes: '',
  projectId: null,
  effort: 'M',
  hardDeadline: null,
  importance: 3,
  dependsOn: [],
}

export function AddItem() {
  const createItem = useCreateItem()
  const projects = useProjects().data ?? []
  const items = useItems().data ?? []
  const [savedTitle, setSavedTitle] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(false)

  const form = useForm<ItemFormValues, unknown, ItemFormOutput>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: emptyValues,
  })
  const { register, handleSubmit, watch, setValue, reset, formState } = form

  const area = watch('area') as Area
  const effort = watch('effort') as Effort
  const dependsOn = watch('dependsOn') ?? []

  const areaProjects = projects.filter((p) => p.area === area)
  const depCandidates = items.filter((i) => i.area === area && i.status !== 'done')

  const onSubmit = (values: ItemFormOutput) => {
    createItem.mutate(
      { ...values, section: null, assignee: null, status: 'open' },
      {
        onSuccess: (item) => {
          setSavedTitle(item.title)
          reset(emptyValues)
          setShowMore(false)
        },
      },
    )
  }

  return (
    <main className="mx-auto max-w-lg px-5 pb-4 pt-title-top">
      <h1 className="text-title text-text">Add item</h1>
      <p className="mt-lede text-body text-text-2">
        Title and area are all it needs. The rest can wait. Got a whole list?{' '}
        <Link to="/import" className="font-semibold text-accent underline underline-offset-2">
          Import it
        </Link>
        .
      </p>

      {savedTitle && (
        <p className="mt-3 inline-flex min-h-11 items-center rounded-pill border border-line bg-panel px-4 text-[13.5px] text-accent">
          Added “{savedTitle}” ✓
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <div>
          <input
            {...register('title')}
            autoFocus
            placeholder="What needs doing?"
            className={`${inputCls} min-h-14 px-5 text-[15px]`}
            aria-label="Title"
          />
          {formState.errors.title && (
            <p className="mt-1.5 px-2 text-[13px] text-overdue">
              {formState.errors.title.message}
            </p>
          )}
        </div>

        <Segmented
          label="Area"
          size="md"
          className="flex w-full"
          options={[
            { value: 'home', label: 'Home' },
            { value: 'work', label: 'Work' },
          ]}
          value={area}
          onChange={(v) => {
            setValue('area', v)
            setValue('projectId', null)
            setValue('dependsOn', [])
          }}
        />

        {!showMore ? (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="flex min-h-[52px] w-full flex-wrap items-center gap-x-2.5 gap-y-1 rounded-pill border border-dotted border-line-strong px-5 text-left hover:border-text"
          >
            <span className="text-[14px] font-semibold text-accent">+ More detail</span>{' '}
            <span className="font-mono text-label uppercase text-text-3">
              (project, deadline, importance…)
            </span>
          </button>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className={fieldLabel}>Project</span>
              <select {...register('projectId')} className={inputCls}>
                <option value="">None</option>
                {areaProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-end gap-4">
              <div>
                <span className={fieldLabel}>Effort</span>
                <Segmented
                  label="Effort"
                  size="md"
                  options={[
                    { value: 'S', label: 'S' },
                    { value: 'M', label: 'M' },
                    { value: 'L', label: 'L' },
                  ]}
                  value={effort}
                  onChange={(v) => setValue('effort', v)}
                />
              </div>
              <label className="block">
                <span className={fieldLabel}>Importance</span>
                <select {...register('importance')} className={`${inputCls} w-auto`}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={fieldLabel}>Hard deadline</span>
                <input
                  type="date"
                  {...register('hardDeadline')}
                  className={`${inputCls} w-auto`}
                />
              </label>
            </div>

            <label className="block">
              <span className={fieldLabel}>Notes</span>
              <textarea
                {...register('notes')}
                rows={2}
                className={`${inputCls.replace('rounded-pill', 'rounded-inner')} py-2.5`}
              />
            </label>

            {depCandidates.length > 0 && (
              <fieldset>
                <legend className="font-mono text-label uppercase text-text-3">Waits on</legend>
                <div className="mt-1 max-h-52 overflow-y-auto">
                  {depCandidates.map((c) => (
                    <label
                      key={c.id}
                      className="flex min-h-tap cursor-pointer items-center gap-3 text-[13.5px] text-text"
                    >
                      <input
                        type="checkbox"
                        checked={dependsOn.includes(c.id)}
                        onChange={(e) =>
                          setValue(
                            'dependsOn',
                            e.target.checked
                              ? [...dependsOn, c.id]
                              : dependsOn.filter((d) => d !== c.id),
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
          </div>
        )}

        <button
          type="submit"
          disabled={createItem.isPending}
          className="w-full min-h-[50px] rounded-pill bg-accent text-[15px] font-semibold text-accent-ink hover:bg-accent-hover active:translate-y-px disabled:opacity-45"
        >
          Add item
        </button>
      </form>
    </main>
  )
}
