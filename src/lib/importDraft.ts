// Shared by the client (local parse + AI request) and api/groom.ts (the
// import branch), so bulk import behaves identically wherever the LLM is
// unavailable. Nothing here touches the browser or node runtime, so the api
// build can pull the same file in.

import { z } from 'zod'

// Cost/UI caps. The paste is bounded so a giant paste cannot run up the paid
// endpoint, and the parsed set is bounded so the review table stays sane.
export const MAX_IMPORT_CHARS = 10_000
export const MAX_IMPORT_ITEMS = 200

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// One structured item the AI path proposes. The deadline is either a real ISO
// date the text stated or null: the schema cannot enforce "was in the text",
// but it can refuse anything that is not a plain yyyy-mm-dd, and the system
// prompt carries the never-invent rule.
export const importItemSchema = z.object({
  title: z.string().min(1),
  area: z.enum(['work', 'home']),
  effort: z.enum(['S', 'M', 'L']),
  importance: z.number().int().min(1).max(5),
  deadline: z.union([z.string().regex(ISO_DATE), z.null()]),
})

// The model's raw output: just the items. The server validates this before
// trusting it and adds the source tag itself.
export const importResponseContentSchema = z.object({
  items: z.array(importItemSchema),
})

// The wire response the client reads. 'llm' means the model structured it;
// 'stub' means the model is not wired (GROOM_LLM off / no key) so the client
// should parse locally; 'stub-fallback' means a live call was attempted and
// failed. The client labels all three distinctly, same principle as grooming.
export const importResponseSchema = importResponseContentSchema.extend({
  source: z.enum(['llm', 'stub', 'stub-fallback']),
})

export type ImportItem = z.infer<typeof importItemSchema>
export type ImportResponse = z.infer<typeof importResponseSchema>

// ---- Local parser (no API, offline, GROOM_LLM-agnostic) ----

// Leading bullet glyphs: hyphen, asterisk, and the common unicode bullets.
const BULLET = /^[-*•‣◦·–]+[ \t]+/
// "1. ", "2) ", "(3) " — a leading list number, optionally parenthesised.
const NUMBERED = /^\(?\d+[.)][ \t]+/
const MD_HEADING = /^#{1,6}[ \t]+/
// A horizontal rule made of dashes/equals/underscores/asterisks.
const RULE = /^[-=_*]{3,}$/
// A line that is nothing but bullet/rule glyphs — a stray "•" or "-" with no
// task after it. Bullet stripping needs a following space so it never mangles
// "-5 degrees"; this catches the bare-glyph leftovers stripping cannot.
const GLYPHS_ONLY = /^[-*•‣◦·–—=_]+$/

/** Strip a leading bullet, list number, or markdown heading marker. */
export function stripPrefix(line: string): string {
  return line.trim().replace(MD_HEADING, '').replace(BULLET, '').replace(NUMBERED, '').trim()
}

/**
 * An "obvious header": a markdown heading, a rule, or a bare label that ends
 * in a colon with no task after it ("Work:", "- Groceries:"). A line that
 * keeps text past the colon ("Call Sam: about the invoice") is a task with a
 * trailing note, not a header, and survives.
 */
export function isHeaderLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (MD_HEADING.test(t)) return true
  if (RULE.test(t)) return true
  return /:$/.test(stripPrefix(t))
}

export interface ParsedLine {
  title: string
}

/**
 * Split a messy paste into one candidate item per line. Strips bullet and
 * number prefixes, trims, drops blanks and obvious headers, and keeps a
 * trailing note as part of the title (the AI path is what cleans those).
 * Never throws: the worst case is an empty list.
 */
export function parseImportText(raw: string): ParsedLine[] {
  const out: ParsedLine[] = []
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (isHeaderLine(line)) continue
    const title = stripPrefix(line)
    if (!title || GLYPHS_ONLY.test(title)) continue
    out.push({ title })
    if (out.length >= MAX_IMPORT_ITEMS) break
  }
  return out
}
