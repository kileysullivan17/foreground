// @vitest-environment happy-dom

// Guards the import accept-gate: a paste is never written until it has been
// through the mandatory review step and an explicit Save. Also checks that the
// AI path degrades to a labeled local parse offline (the dev/stub branch) and
// that Save creates every included item and routes to What Now.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Import } from './Import'
import { db } from '../data'
import type { Item, NewItem } from '../types'

function renderImport() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/import']}>
        <Routes>
          <Route path="/import" element={<Import />} />
          <Route path="/" element={<div>What now marker</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const PASTE = ['# Errands', '- Buy milk', '1. Call the plumber', '', 'Renew passport'].join('\n')

let created: NewItem[]

beforeEach(() => {
  localStorage.clear()
  created = []
  vi.spyOn(db, 'createItem').mockImplementation(async (input: NewItem) => {
    created.push(input)
    return { ...input, id: `itm-${created.length}`, createdAt: '', lastTouchedAt: '', lastTouchNote: null } as Item
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Import accept-gate', () => {
  it('parses locally into a review table without saving anything', async () => {
    renderImport()
    fireEvent.change(screen.getByLabelText('Paste your list'), { target: { value: PASTE } })
    fireEvent.click(screen.getByRole('button', { name: 'Parse locally' }))

    // Header line dropped, three tasks split out into editable rows.
    expect(await screen.findByRole('heading', { name: 'Review' })).toBeTruthy()
    expect((screen.getByLabelText('Title for row 1') as HTMLInputElement).value).toBe('Buy milk')
    expect((screen.getByLabelText('Title for row 2') as HTMLInputElement).value).toBe(
      'Call the plumber',
    )
    expect((screen.getByLabelText('Title for row 3') as HTMLInputElement).value).toBe(
      'Renew passport',
    )
    // The gate: reaching review must not have written a single item.
    expect(db.createItem).not.toHaveBeenCalled()
  })

  it('saves only included, reviewed rows and routes to What Now', async () => {
    renderImport()
    fireEvent.change(screen.getByLabelText('Paste your list'), { target: { value: PASTE } })
    fireEvent.click(screen.getByRole('button', { name: 'Parse locally' }))
    await screen.findByRole('heading', { name: 'Review' })

    // Edit a title, retarget an area in bulk, and exclude one row.
    fireEvent.change(screen.getByLabelText('Title for row 1'), { target: { value: 'Buy oat milk' } })
    fireEvent.click(screen.getByRole('button', { name: 'All work' }))
    fireEvent.click(screen.getByLabelText('Include "Renew passport"'))

    fireEvent.click(screen.getByRole('button', { name: 'Save 2 items' }))

    expect(await screen.findByText('What now marker')).toBeTruthy()
    expect(created).toHaveLength(2)
    expect(created.map((i) => i.title)).toEqual(['Buy oat milk', 'Call the plumber'])
    expect(created.every((i) => i.area === 'work')).toBe(true)
    expect(created.every((i) => i.status === 'open')).toBe(true)
  })

  it('AI path degrades to a labeled local parse when the model is unavailable', async () => {
    renderImport()
    fireEvent.change(screen.getByLabelText('Paste your list'), { target: { value: PASTE } })
    fireEvent.click(screen.getByRole('button', { name: /Structure with AI/ }))

    // Offline (dev/stub) it lands in review, honestly labeled, still unsaved.
    expect(await screen.findByRole('heading', { name: 'Review' })).toBeTruthy()
    expect(screen.getByText(/model is not wired/i)).toBeTruthy()
    await waitFor(() => expect(db.createItem).not.toHaveBeenCalled())
  })
})
