import type {
  Item,
  ItemPatch,
  NewItem,
  NewProject,
  NewStory,
  Project,
  ProjectPatch,
  Story,
  StoryPatch,
} from '../types'

// One interface, two backends. The local adapter (localStorage, seeded from
// seed-data.json) is the default so the app runs with zero infrastructure.
// The Supabase adapter activates when VITE_SUPABASE_URL/_ANON_KEY are set.
export interface DataProvider {
  listProjects(): Promise<Project[]>
  listItems(): Promise<Item[]>
  createItem(input: NewItem): Promise<Item>
  updateItem(id: string, patch: ItemPatch): Promise<Item>
  createProject(input: NewProject): Promise<Project>
  updateProject(id: string, patch: ProjectPatch): Promise<Project>
  /** Reset the staleness clock: stamps lastTouchedAt=now and records the note. */
  touchItem(id: string, note: string): Promise<Item>
  listStories(): Promise<Story[]>
  createStory(input: NewStory): Promise<Story>
  updateStory(id: string, patch: StoryPatch): Promise<Story>
}
