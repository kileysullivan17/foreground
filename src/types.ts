export type Area = 'work' | 'home'
export type Effort = 'S' | 'M' | 'L'
export type Status = 'open' | 'in_progress' | 'done' | 'parked'

export interface Project {
  id: string
  name: string
  area: Area
  goal: string
  targetDate: string | null // ISO date (yyyy-mm-dd)
  createdAt: string // ISO timestamp
}

// Field shape deliberately mirrors Asana tasks for a later integration:
// title→name, notes→notes, hardDeadline→due_on, projectId→projects[0],
// section→memberships[].section, assignee→assignee, status done→completed.
export interface Item {
  id: string
  title: string
  notes: string
  area: Area
  projectId: string | null
  section: string | null
  assignee: string | null
  effort: Effort
  hardDeadline: string | null // ISO date (yyyy-mm-dd)
  importance: number // 1..5
  dependsOn: string[] // ids of items that must finish before this one
  status: Status
  createdAt: string // ISO timestamp
  lastTouchedAt: string // ISO timestamp
  lastTouchNote: string | null
}

export type NewItem = Omit<Item, 'id' | 'createdAt' | 'lastTouchedAt' | 'lastTouchNote'>
export type NewProject = Omit<Project, 'id' | 'createdAt'>
export type ItemPatch = Partial<Omit<Item, 'id' | 'createdAt'>>
export type ProjectPatch = Partial<Omit<Project, 'id' | 'createdAt'>>
