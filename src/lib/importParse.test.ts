import { describe, expect, it } from 'vitest'
import {
  isHeaderLine,
  MAX_IMPORT_ITEMS,
  parseImportText,
  stripPrefix,
} from './importDraft'

const titles = (raw: string) => parseImportText(raw).map((l) => l.title)

describe('parseImportText', () => {
  it('splits newline-separated lines into one item each', () => {
    expect(titles('Buy milk\nCall the plumber\nRenew passport')).toEqual([
      'Buy milk',
      'Call the plumber',
      'Renew passport',
    ])
  })

  it('strips hyphen, asterisk, and unicode bullet prefixes', () => {
    expect(titles('- Email the accountant\n* Draft the post\n• Water the plants\n‣ Sort mail')).toEqual([
      'Email the accountant',
      'Draft the post',
      'Water the plants',
      'Sort mail',
    ])
  })

  it('strips numbered and parenthesised list prefixes', () => {
    expect(titles('1. Fix the tap\n2) Book dentist\n(3) Pay rent\n10. Last one')).toEqual([
      'Fix the tap',
      'Book dentist',
      'Pay rent',
      'Last one',
    ])
  })

  it('drops blank and whitespace-only lines', () => {
    expect(titles('First\n\n   \nSecond\n\t\nThird')).toEqual(['First', 'Second', 'Third'])
  })

  it('ignores obvious header lines: markdown, rules, and bare labels', () => {
    const raw = [
      '# Work',
      'Ship the release',
      '## Home',
      '- Groceries:',
      'Buy oat milk',
      '-----',
      'Home:',
      'Fix the fence',
    ].join('\n')
    expect(titles(raw)).toEqual(['Ship the release', 'Buy oat milk', 'Fix the fence'])
  })

  it('keeps a trailing note as part of the title (colon mid-line is not a header)', () => {
    expect(titles('Call Sam: about the invoice\n- Buy paint - the matte one')).toEqual([
      'Call Sam: about the invoice',
      'Buy paint - the matte one',
    ])
  })

  it('drops a line that is only a bullet glyph', () => {
    expect(titles('•\nReal task\n-')).toEqual(['Real task'])
  })

  it('never throws and returns [] for empty or blank input', () => {
    expect(parseImportText('')).toEqual([])
    expect(parseImportText('\n\n   \n')).toEqual([])
  })

  it('caps the number of parsed items', () => {
    const raw = Array.from({ length: MAX_IMPORT_ITEMS + 50 }, (_, i) => `Task ${i}`).join('\n')
    expect(parseImportText(raw)).toHaveLength(MAX_IMPORT_ITEMS)
  })
})

describe('stripPrefix / isHeaderLine helpers', () => {
  it('strips a prefix without touching inner punctuation', () => {
    expect(stripPrefix('1. As a user, I want X')).toBe('As a user, I want X')
    expect(stripPrefix('- 2 for 1 deal')).toBe('2 for 1 deal')
  })

  it('recognises headers but not tasks that merely contain a colon', () => {
    expect(isHeaderLine('# Heading')).toBe(true)
    expect(isHeaderLine('Errands:')).toBe(true)
    expect(isHeaderLine('====')).toBe(true)
    expect(isHeaderLine('Email Sam: re the quote')).toBe(false)
    expect(isHeaderLine('Just a normal task')).toBe(false)
  })
})
