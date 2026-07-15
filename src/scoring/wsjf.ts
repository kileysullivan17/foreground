import type { Story } from '../types'

// WSJF for backlog stories: cost of delay over job size. Cost of delay is
// the sum of three 1..5 inputs (business value, time criticality, enablement),
// so scores land in 0.375 (3/8) .. 15 (15/1). Higher = do sooner.

export interface StoryWsjf {
  costOfDelay: number
  jobSize: number
  score: number
}

export function storyWsjf(story: Story): StoryWsjf {
  const costOfDelay = story.businessValue + story.timeCriticality + story.enablement
  return {
    costOfDelay,
    jobSize: story.jobSize,
    score: Math.round((costOfDelay / story.jobSize) * 10) / 10,
  }
}

/** Column order: highest WSJF first; raw captures sink until groomed. */
export function compareStories(a: Story, b: Story): number {
  if (a.raw !== b.raw) return a.raw ? 1 : -1
  return (
    storyWsjf(b).score - storyWsjf(a).score || a.createdAt.localeCompare(b.createdAt)
  )
}
