// @vitest-environment happy-dom

// Regression guards for the production white-screen (2026-07-19): the app
// crashed with "TypeError: n is not a function" on the first navigation in
// browsers where an extension patches window.scrollTo to return a value,
// because ScrollToTop's effect returned that value and React called it as
// a cleanup. These tests mount the real App over the real seeded data
// shape (LocalProvider seeds localStorage), so any effect returning a
// non-function cleanup, or a screen that cannot render the seed, fails
// here instead of in production.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  )
}

describe('App navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/')
    // The hostile environment from the incident: scrollTo returns a value.
    vi.stubGlobal('scrollTo', () => true)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('survives a patched window.scrollTo across navigation to Product', async () => {
    renderApp()
    // What Now renders the seeded ranking first.
    expect(await screen.findByText('What now')).toBeTruthy()

    // The crash fired on the first route change, in the passive-effect
    // flush. Navigate the way a user does.
    fireEvent.click(screen.getAllByRole('link', { name: 'Product' })[0]!)

    // Product mounts over the real seed: board heading plus a seeded story.
    expect(await screen.findByRole('heading', { name: 'Product' })).toBeTruthy()
    expect(await screen.findByText(/Weekly review screen/)).toBeTruthy()
  })

  it('mounts every tab over the seeded data shape', async () => {
    renderApp()
    await screen.findByText('What now')
    for (const [name, heading] of [
      ['Put off', /put off/i],
      ['Projects', 'Projects'],
      ['Product', 'Product'],
      ['Now', 'What now'],
    ] as const) {
      fireEvent.click(screen.getAllByRole('link', { name })[0]!)
      expect(await screen.findByRole('heading', { name: heading })).toBeTruthy()
    }
  })
})

describe('ErrorBoundary', () => {
  afterEach(cleanup)

  it('degrades a render crash to the fallback card instead of unmounting', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Bomb(): never {
      throw new Error('boom')
    }
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert').textContent).toContain('This screen hit an error')
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    consoleError.mockRestore()
  })
})
