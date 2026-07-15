import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../data'
import type {
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

export function useCreateItem() {
  const invalidate = useItemsInvalidator()
  return useMutation({
    mutationFn: (input: NewItem) => db.createItem(input),
    onSuccess: invalidate,
  })
}

export function useUpdateItem() {
  const invalidate = useItemsInvalidator()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ItemPatch }) => db.updateItem(id, patch),
    onSuccess: invalidate,
  })
}

/** Status changes also reset the staleness clock — acting on an item is touching it. */
export function useSetStatus() {
  const invalidate = useItemsInvalidator()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      db.updateItem(id, { status, lastTouchedAt: new Date().toISOString() }),
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
