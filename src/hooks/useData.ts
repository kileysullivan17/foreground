import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../data'
import { trackItemCompleted, trackItemCreated } from '../analytics/events'
import type {
  Item,
  ItemPatch,
  NewItem,
  NewProject,
  NewStory,
  ProjectPatch,
  Status,
  StoryPatch,
} from '../types'

export function useItems() {
  return useQuery({ queryKey: ['items'], queryFn: () => db.listItems() })
}

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: () => db.listProjects() })
}

function useItemsInvalidator() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['items'] })
}

// The item list as the cache currently holds it. Analytics reads it before a
// mutation lands so an event describes the state the user acted on.
function useCachedItems() {
  const qc = useQueryClient()
  return () => qc.getQueryData<Item[]>(['items']) ?? []
}

export function useCreateItem() {
  const invalidate = useItemsInvalidator()
  const cached = useCachedItems()
  return useMutation({
    mutationFn: async (input: NewItem) => {
      const item = await db.createItem(input)
      trackItemCreated(item, [...cached(), item])
      return item
    },
    onSuccess: invalidate,
  })
}

/** Bulk import save path: create every reviewed item, then refresh once. */
export function useCreateItemsBulk() {
  const invalidate = useItemsInvalidator()
  const cached = useCachedItems()
  return useMutation({
    mutationFn: async (inputs: NewItem[]) => {
      const items = await Promise.all(inputs.map((input) => db.createItem(input)))
      const all = [...cached(), ...items]
      for (const item of items) trackItemCreated(item, all)
      return items
    },
    onSuccess: invalidate,
  })
}

export function useUpdateItem() {
  const invalidate = useItemsInvalidator()
  const cached = useCachedItems()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ItemPatch }) => {
      const before = cached()
      const item = await db.updateItem(id, patch)
      // The Projects editor can mark an item done through a full patch. The
      // event fires only once the save has landed, so a failed save that is
      // retried from the toast cannot count twice.
      if (patch.status === 'done') trackItemCompleted(id, before)
      return item
    },
    onSuccess: invalidate,
  })
}

/** Status changes also reset the staleness clock — acting on an item is touching it. */
export function useSetStatus() {
  const invalidate = useItemsInvalidator()
  const cached = useCachedItems()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const before = cached()
      const item = await db.updateItem(id, { status, lastTouchedAt: new Date().toISOString() })
      if (status === 'done') trackItemCompleted(id, before)
      return item
    },
    onSuccess: invalidate,
  })
}

export function useTouchItem() {
  const invalidate = useItemsInvalidator()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => db.touchItem(id, note),
    onSuccess: invalidate,
  })
}

export function useStories() {
  return useQuery({ queryKey: ['stories'], queryFn: () => db.listStories() })
}

export function useCreateStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewStory) => db.createStory(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories'] }),
  })
}

export function useUpdateStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: StoryPatch }) => db.updateStory(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories'] }),
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewProject) => db.createProject(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProjectPatch }) => db.updateProject(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}
