import { z } from 'zod'

export const areaSchema = z.enum(['work', 'home'])
export const effortSchema = z.enum(['S', 'M', 'L'])
export const statusSchema = z.enum(['open', 'in_progress', 'done', 'parked'])

// Fast capture: only title and area are required. Everything else defaults.
export const itemFormSchema = z.object({
  title: z.string().trim().min(1, 'Give it a name'),
  area: areaSchema,
  notes: z.string().default(''),
  projectId: z.string().nullable().default(null),
  effort: effortSchema.default('M'),
  hardDeadline: z.string().nullable().default(null),
  importance: z.coerce.number().int().min(1).max(5).default(3),
  dependsOn: z.array(z.string()).default([]),
})

export type ItemFormValues = z.input<typeof itemFormSchema>
export type ItemFormOutput = z.output<typeof itemFormSchema>

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Give it a name'),
  area: areaSchema,
  goal: z.string().default(''),
  targetDate: z.string().nullable().default(null),
})

export type ProjectFormValues = z.input<typeof projectFormSchema>
export type ProjectFormOutput = z.output<typeof projectFormSchema>

export const touchNoteSchema = z.object({
  note: z.string().trim().min(1, 'One line: where does this stand?'),
})
export type TouchNoteValues = z.infer<typeof touchNoteSchema>
