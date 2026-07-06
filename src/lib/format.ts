const DAY = 86_400_000

export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function daysAgoLabel(isoTimestamp: string, now: Date = new Date()): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(isoTimestamp).getTime()) / DAY))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export const effortLabels = { S: 'Small', M: 'Medium', L: 'Large' } as const

export const statusLabels = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  parked: 'Parked',
} as const
