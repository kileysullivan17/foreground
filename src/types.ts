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

// The Product module: this app's own roadmap as a managed backlog.
// 'later' is the v3 shelf; the four board columns are the other statuses.
export type StoryStatus = 'backlog' | 'groomed' | 'in_progress' | 'done' | 'later'

export interface AcceptanceCriterion {
  text: string
  done: boolean
}

export interface Story {
  id: string
  title: string // "As a [user], I want [capability] so that [outcome]"
  description: string
  acceptanceCriteria: AcceptanceCriterion[]
  businessValue: number // 1..5 — value to the user or the portfolio
  timeCriticality: number // 1..5 — cost of doing this later instead of now
  enablement: number // 1..5 — how much other work this unblocks or de-risks
  jobSize: number // story points: 1, 2, 3, 5, 8
  status: StoryStatus
  /** Captured raw, not yet groomed into story form. Grooming clears it. */
  raw: boolean
  createdAt: string // ISO timestamp
}

export type NewStory = Omit<Story, 'id' | 'createdAt'>
export type StoryPatch = Partial<Omit<Story, 'id' | 'createdAt'>>

export type NewItem = Omit<Item, 'id' | 'createdAt' | 'lastTouchedAt' | 'lastTouchNote'>
export type NewProject = Omit<Project, 'id' | 'createdAt'>
export type ItemPatch = Partial<Omit<Item, 'id' | 'createdAt'>>
export type ProjectPatch = Partial<Omit<Project, 'id' | 'createdAt'>>
