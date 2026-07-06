import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { itemFormSchema, type ItemFormOutput, type ItemFormValues } from '../schemas'
import { useCreateItem, useItems, useProjects } from '../hooks/useData'
import { Segmented } from '../components/Segmented'
import type { Area, Effort } from '../types'

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800'

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
    <main className="mx-auto max-w-lg px-4 pt-4 pb-4">
      <h1 className="text-2xl font-bold">Add item</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Title and area are all it needs. The rest can wait.
      </p>

      {savedTitle && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Added “{savedTitle}” ✓
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <div>
          <input
            {...register('title')}
            autoFocus
            placeholder="What needs doing?"
            className={`${inputCls} text-base`}
            aria-label="Title"
          />
          {formState.errors.title && (
            <p className="mt-1 text-sm text-red-600">{formState.errors.title.message}</p>
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
            className="block text-sm font-medium text-indigo-600 dark:text-indigo-400"
          >
            + More detail (project, deadline, importance…)
          </button>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="font-medium">Project</span>
              <select {...register('projectId')} className={`${inputCls} mt-1`}>
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
                <span className="block text-sm font-medium">Effort</span>
                <div className="mt-1">
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
              <label className="block text-sm">
                <span className="font-medium">Importance</span>
                <select {...register('importance')} className={`${inputCls} mt-1 w-auto`}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Hard deadline</span>
                <input type="date" {...register('hardDeadline')} className={`${inputCls} mt-1 w-auto`} />
              </label>
            </div>

            <label className="block text-sm">
              <span className="font-medium">Notes</span>
              <textarea {...register('notes')} rows={2} className={`${inputCls} mt-1`} />
            </label>

            {depCandidates.length > 0 && (
              <fieldset>
                <legend className="text-sm font-medium">Waits on</legend>
                <div className="mt-1 max-h-36 space-y-1 overflow-y-auto">
                  {depCandidates.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
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
          className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white active:scale-[0.99] disabled:opacity-50"
        >
          Add item
        </button>
      </form>
    </main>
  )
}
