import raw from './seed-data.json'
import type { Area, Effort, Item, Project, Status } from '../types'

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

export function buildSeed(): { projects: Project[]; items: Item[] } {
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

  return { projects, items }
}
