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
import type { DataProvider } from './provider'
import { buildSeed, buildStorySeed } from './seed'

const STORE_KEY = 'planner-db-v1'

interface Store {
  projects: Project[]
  items: Item[]
  stories: Story[]
}

function load(): Store {
  const rawStore = localStorage.getItem(STORE_KEY)
  if (rawStore) {
    try {
      const store = JSON.parse(rawStore) as Store
      // v1 stores predate the Product module: seed stories in, keep the rest.
      if (!Array.isArray(store.stories)) {
        store.stories = buildStorySeed()
        localStorage.setItem(STORE_KEY, JSON.stringify(store))
      }
      return store
    } catch {
      // corrupted store: fall through and reseed
    }
  }
  const seeded = buildSeed()
  localStorage.setItem(STORE_KEY, JSON.stringify(seeded))
  return seeded
}

function save(store: Store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export class LocalProvider implements DataProvider {
  private store: Store = load()

  async listProjects(): Promise<Project[]> {
    return [...this.store.projects]
  }

  async listItems(): Promise<Item[]> {
    return [...this.store.items]
  }

  async createItem(input: NewItem): Promise<Item> {
    const now = new Date().toISOString()
    const item: Item = {
      ...input,
      id: newId('itm'),
      createdAt: now,
      lastTouchedAt: now,
      lastTouchNote: null,
    }
    this.store.items.push(item)
    save(this.store)
    return item
  }

  async updateItem(id: string, patch: ItemPatch): Promise<Item> {
    // Replace, never mutate in place: TanStack Query's structural sharing
    // compares old and new results, and a mutated shared object would make
    // them "equal", freezing every derived view (ranking included).
    const idx = this.store.items.findIndex((i) => i.id === id)
    const existing = this.store.items[idx]
    if (!existing) throw new Error(`item not found: ${id}`)
    const updated = { ...existing, ...patch }
    this.store.items[idx] = updated
    save(this.store)
    return updated
  }

  async createProject(input: NewProject): Promise<Project> {
    const project: Project = {
      ...input,
      id: newId('proj'),
      createdAt: new Date().toISOString(),
    }
    this.store.projects.push(project)
    save(this.store)
    return project
  }

  async updateProject(id: string, patch: ProjectPatch): Promise<Project> {
    const idx = this.store.projects.findIndex((p) => p.id === id)
    const existing = this.store.projects[idx]
    if (!existing) throw new Error(`project not found: ${id}`)
    const updated = { ...existing, ...patch }
    this.store.projects[idx] = updated
    save(this.store)
    return updated
  }

  async touchItem(id: string, note: string): Promise<Item> {
    return this.updateItem(id, {
      lastTouchedAt: new Date().toISOString(),
      lastTouchNote: note,
    })
  }

  async listStories(): Promise<Story[]> {
    return [...this.store.stories]
  }

  async createStory(input: NewStory): Promise<Story> {
    const story: Story = {
      ...input,
      id: newId('story'),
      createdAt: new Date().toISOString(),
    }
    this.store.stories.push(story)
    save(this.store)
    return story
  }

  async updateStory(id: string, patch: StoryPatch): Promise<Story> {
    // Same immutability rule as updateItem: replace, never mutate in place.
    const idx = this.store.stories.findIndex((s) => s.id === id)
    const existing = this.store.stories[idx]
    if (!existing) throw new Error(`story not found: ${id}`)
    const updated = { ...existing, ...patch }
    this.store.stories[idx] = updated
    save(this.store)
    return updated
  }
}
