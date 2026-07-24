// @vitest-environment happy-dom

// The live-demo intro banner: shows once for a first-time visitor, spells out
// the WSJF acronym on first use, and stays gone after dismissal (persisted per
// browser so a returning/daily user never sees it twice).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WhatNow } from './WhatNow'

function renderWhatNow() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WhatNow />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('What now demo intro', () => {
  it('shows on first visit and spells out Weighted Shortest Job First (WSJF)', () => {
    renderWhatNow()
    expect(screen.getByText(/Weighted Shortest Job First \(WSJF\)/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /How it works/ }).getAttribute('href')).toBe('/about')
  })

  it('stays gone after dismissal and persists the choice', () => {
    const { unmount } = renderWhatNow()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss demo intro' }))
    expect(screen.queryByText(/Weighted Shortest Job First/)).toBeNull()
    expect(localStorage.getItem('fg-demo-intro-v1')).toBe('1')

    // A later mount (a return visit) keeps it dismissed.
    unmount()
    renderWhatNow()
    expect(screen.queryByText(/Weighted Shortest Job First/)).toBeNull()
  })
})
