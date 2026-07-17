import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { itemFormSchema, type ItemFormOutput, type ItemFormValues } from '../schemas'
import { useCreateItem, useItems, useProjects } from '../hooks/useData'
import { Segmented } from '../components/Segmented'
import type { Area, Effort } from '../types'

const inputCls =
  'w-full min-h-tap rounded-pill border border-ink/15 bg-surface-raised px-4 text-detail text-ink placeholder:text-sand-600 dark:border-ink-inverse/20 dark:bg-surface-dark-raised dark:text-ink-inverse dark:placeholder:text-sand-400'

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
    <main className="mx-auto max-w-lg px-5 pb-4 pt-3">
      <h1 className="font-display text-display">Add item</h1>
      <p className="mt-1 text-[13px] leading-[1.5] text-sand-700 dark:text-sand-400">
        Title and area are all it needs. The rest can wait.
      </p>

      {savedTitle && (
        <p className="mt-3 rounded-ctl bg-sage-100 px-3.5 py-2.5 text-detail text-sage-800 dark:bg-sage-900 dark:text-sage-200">
          Added “{savedTitle}” ✓
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <div>
          <input
            {...register('title')}
            autoFocus
            placeholder="What needs doing?"
            className={`${inputCls} text-[15px]`}
            aria-label="Title"
          />
          {formState.errors.title && (
            <p className="mt-1 px-2 text-detail text-overdue dark:text-overdue-dark">
              {formState.errors.title.message}
            </p>
          )}
        </div>

        <Segmented
          label="Area"
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
            className="flex min-h-tap items-center text-detail font-semibold text-clay-700 dark:text-clay-300"
          >
            + More detail (project, deadline, importance…)
          </button>
        ) : (
          <div className="space-y-4">
            <label className="block text-detail">
              <span className="font-semibold">Project</span>
              <select {...register('projectId')} className={`${inputCls} mt-1.5`}>
                <option value="">None</option>
                {areaProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="block text-detail font-semibold">Effort</span>
                <div className="mt-1.5">
                  <Segmented
                    label="Effort"
                    options={[
                      { value: 'S', label: 'S' },
                      { value: 'M', label: 'M' },
                      { value: 'L', label: 'L' },
                    ]}
                    value={effort}
                    onChange={(v) => setValue('effort', v)}
                  />
                </div>
              </div>
              <label className="block text-detail">
                <span className="font-semibold">Importance</span>
                <select {...register('importance')} className={`${inputCls} mt-1.5 w-auto`}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-detail">
                <span className="font-semibold">Hard deadline</span>
                <input
                  type="date"
                  {...register('hardDeadline')}
                  className={`${inputCls} mt-1.5 w-auto`}
                />
              </label>
            </div>

            <label className="block text-detail">
              <span className="font-semibold">Notes</span>
              <textarea
                {...register('notes')}
                rows={2}
                className={`${inputCls.replace('rounded-pill', 'rounded-ctl')} mt-1.5 py-2.5`}
              />
            </label>

            {depCandidates.length > 0 && (
              <fieldset>
                <legend className="text-detail font-semibold">Waits on</legend>
                <div className="mt-1 max-h-52 overflow-y-auto">
                  {depCandidates.map((c) => (
                    <label
                      key={c.id}
                      className="flex min-h-tap cursor-pointer items-center gap-3 text-detail"
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
                        className="size-[22px] flex-none appearance-none rounded-[7px] border-2 border-sand-500 bg-surface-raised checked:border-sage-600 checked:bg-sage-600 dark:border-sand-600 dark:bg-surface-dark-raised dark:checked:border-sage-500 dark:checked:bg-sage-500"
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
          className="w-full rounded-pill bg-clay-500 py-3.5 font-display text-[15px] text-ink hover:bg-clay-400 active:scale-[0.99] disabled:opacity-50 dark:bg-clay-400 dark:hover:bg-clay-300"
        >
          Add item
        </button>
      </form>
    </main>
  )
}
