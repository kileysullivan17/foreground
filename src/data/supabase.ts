import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Area, Effort, Item, ItemPatch, NewItem, NewProject, Project, ProjectPatch, Status } from '../types'
import type { DataProvider } from './provider'

// Row shapes match supabase/migrations/0001_init.sql (snake_case).
interface ProjectRow {
  id: string
  name: string
  area: Area
  goal: string
  target_date: string | null
  created_at: string
}

interface ItemRow {
  id: string
  title: string
  notes: string
  area: Area
  project_id: string | null
  section: string | null
  assignee: string | null
  effort: Effort
  hard_deadline: string | null
  importance: number
  depends_on: string[]
  status: Status
  created_at: string
  last_touched_at: string
  last_touch_note: string | null
}

function projectFromRow(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    area: r.area,
    goal: r.goal,
    targetDate: r.target_date,
    createdAt: r.created_at,
  }
}

function itemFromRow(r: ItemRow): Item {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes,
    area: r.area,
    projectId: r.project_id,
    section: r.section,
    assignee: r.assignee,
    effort: r.effort,
    hardDeadline: r.hard_deadline,
    importance: r.importance,
    dependsOn: r.depends_on,
    status: r.status,
    createdAt: r.created_at,
    lastTouchedAt: r.last_touched_at,
    lastTouchNote: r.last_touch_note,
  }
}

function itemToRow(patch: ItemPatch): Partial<ItemRow> {
  const row: Partial<ItemRow> = {}
  if (patch.title !== undefined) row.title = patch.title
  if (patch.notes !== undefined) row.notes = patch.notes
  if (patch.area !== undefined) row.area = patch.area
  if (patch.projectId !== undefined) row.project_id = patch.projectId
  if (patch.section !== undefined) row.section = patch.section
  if (patch.assignee !== undefined) row.assignee = patch.assignee
  if (patch.effort !== undefined) row.effort = patch.effort
  if (patch.hardDeadline !== undefined) row.hard_deadline = patch.hardDeadline
  if (patch.importance !== undefined) row.importance = patch.importance
  if (patch.dependsOn !== undefined) row.depends_on = patch.dependsOn
  if (patch.status !== undefined) row.status = patch.status
  if (patch.lastTouchedAt !== undefined) row.last_touched_at = patch.lastTouchedAt
  if (patch.lastTouchNote !== undefined) row.last_touch_note = patch.lastTouchNote
  return row
}

function projectToRow(patch: ProjectPatch): Partial<ProjectRow> {
  const row: Partial<ProjectRow> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.area !== undefined) row.area = patch.area
  if (patch.goal !== undefined) row.goal = patch.goal
  if (patch.targetDate !== undefined) row.target_date = patch.targetDate
  return row
}

export class SupabaseProvider implements DataProvider {
  private client: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey)
  }

  async listProjects(): Promise<Project[]> {
    const { data, error } = await this.client.from('projects').select('*').order('created_at')
    if (error) throw error
    return (data as ProjectRow[]).map(projectFromRow)
  }

  async listItems(): Promise<Item[]> {
    const { data, error } = await this.client.from('items').select('*').order('created_at')
    if (error) throw error
    return (data as ItemRow[]).map(itemFromRow)
  }

  async createItem(input: NewItem): Promise<Item> {
    const now = new Date().toISOString()
    const row = { ...itemToRow(input), last_touched_at: now }
    const { data, error } = await this.client.from('items').insert(row).select().single()
    if (error) throw error
    return itemFromRow(data as ItemRow)
  }

  async updateItem(id: string, patch: ItemPatch): Promise<Item> {
    const { data, error } = await this.client
      .from('items')
      .update(itemToRow(patch))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return itemFromRow(data as ItemRow)
  }

  async createProject(input: NewProject): Promise<Project> {
    const { data, error } = await this.client
      .from('projects')
      .insert(projectToRow(input))
      .select()
      .single()
    if (error) throw error
    return projectFromRow(data as ProjectRow)
  }

  async updateProject(id: string, patch: ProjectPatch): Promise<Project> {
    const { data, error } = await this.client
      .from('projects')
      .update(projectToRow(patch))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return projectFromRow(data as ProjectRow)
  }

  async touchItem(id: string, note: string): Promise<Item> {
    return this.updateItem(id, {
      lastTouchedAt: new Date().toISOString(),
      lastTouchNote: note,
    })
  }
}
