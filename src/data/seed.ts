import raw from './seed-data.json'
import type {
  AcceptanceCriterion,
  Area,
  Effort,
  Item,
  Project,
  Status,
  Story,
  StoryStatus,
} from '../types'

const DAY = 86_400_000

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString()
}

function dateInDays(n: number): string {
  return new Date(Date.now() + n * DAY).toISOString().slice(0, 10)
}

interface SeedProject {
  key: string
  name: string
  area: string
  goal: string
  targetInDays: number | null
}

interface SeedItem {
  key: string
  title: string
  notes: string
  area: string
  projectKey: string | null
  section?: string
  assignee?: string
  effort: string
  importance: number
  deadlineInDays?: number
  dependsOnKeys?: string[]
  status?: string
  createdDaysAgo: number
  touchedDaysAgo: number
  lastTouchNote?: string
}

interface SeedStory {
  key: string
  title: string
  description: string
  acceptanceCriteria: AcceptanceCriterion[]
  businessValue: number
  timeCriticality: number
  enablement: number
  jobSize: number
  status: string
  raw: boolean
  createdDaysAgo: number
}

export function buildStorySeed(): Story[] {
  return (raw.stories as SeedStory[]).map((s) => ({
    id: s.key,
    title: s.title,
    description: s.description,
    acceptanceCriteria: s.acceptanceCriteria,
    businessValue: s.businessValue,
    timeCriticality: s.timeCriticality,
    enablement: s.enablement,
    jobSize: s.jobSize,
    status: s.status as StoryStatus,
    raw: s.raw,
    createdAt: daysAgo(s.createdDaysAgo),
  }))
}

export function buildSeed(): { projects: Project[]; items: Item[]; stories: Story[] } {
  const projects = (raw.projects as SeedProject[]).map((p) => ({
    id: p.key,
    name: p.name,
    area: p.area as Area,
    goal: p.goal,
    targetDate: p.targetInDays == null ? null : dateInDays(p.targetInDays),
    createdAt: daysAgo(50),
  }))

  const items = (raw.items as SeedItem[]).map((i) => ({
    id: i.key,
    title: i.title,
    notes: i.notes,
    area: i.area as Area,
    projectId: i.projectKey,
    section: i.section ?? null,
    assignee: i.assignee ?? null,
    effort: i.effort as Effort,
    hardDeadline: i.deadlineInDays == null ? null : dateInDays(i.deadlineInDays),
    importance: i.importance,
    dependsOn: i.dependsOnKeys ?? [],
    status: (i.status ?? 'open') as Status,
    createdAt: daysAgo(i.createdDaysAgo),
    lastTouchedAt: daysAgo(i.touchedDaysAgo),
    lastTouchNote: i.lastTouchNote ?? null,
  }))

  return { projects, items, stories: buildStorySeed() }
}
