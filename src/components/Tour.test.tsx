// @vitest-environment happy-dom

// The guided tour engine: starts on demand, steps forward and back, and closes
// on Skip or Finish. Target measurement degrades gracefully when a selector
// matches nothing (the case in this isolated harness), so the step card still
// renders its copy.

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TourProvider, useTour } from './Tour'

function Harness() {
  const { startTour } = useTour()
  return (
    <button type="button" onClick={startTour}>
      launch
    </button>
  )
}

function renderTour() {
  return render(
    <MemoryRouter>
      <TourProvider>
        <Harness />
      </TourProvider>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('guided tour', () => {
  it('is inert until started', () => {
    renderTour()
    expect(screen.queryByRole('dialog', { name: 'Guided tour' })).toBeNull()
  })

  it('steps forward and back, then finishes closed', () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'launch' }))

    // Step 1 of 5.
    expect(screen.getByText('One thing, front and center')).toBeTruthy()
    expect(screen.getByText('1 / 5')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    // Step 2 defines the acronym in full.
    expect(screen.getByText(/Weighted Shortest Job First \(WSJF\)/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('One thing, front and center')).toBeTruthy()

    // Walk to the last step and finish.
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('5 / 5')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'See the product board' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(screen.queryByRole('dialog', { name: 'Guided tour' })).toBeNull()
  })

  it('closes on Skip', () => {
    renderTour()
    fireEvent.click(screen.getByRole('button', { name: 'launch' }))
    expect(screen.getByRole('dialog', { name: 'Guided tour' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('dialog', { name: 'Guided tour' })).toBeNull()
  })
})
