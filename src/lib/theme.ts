// Class-driven dark mode. The saved choice wins; with nothing saved the
// system preference applies. index.html runs the same logic pre-paint.

export type Theme = 'light' | 'dark'

const THEME_KEY = 'planner-theme-v1'

type Listener = () => void
const listeners = new Set<Listener>()

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* private mode: the in-page toggle still works, it just won't persist */
  }
  listeners.forEach((l) => l())
}

export function toggleTheme(): void {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark')
}

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
