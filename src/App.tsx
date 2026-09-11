import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { WhatNow } from './screens/WhatNow'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TourProvider } from './components/Tour'
import { AnalyticsBoot } from './analytics/AnalyticsBoot'
import { PutOff } from './screens/PutOff'
import { Projects } from './screens/Projects'
import { AddItem } from './screens/AddItem'
import { Import } from './screens/Import'
import { Product } from './screens/Product'
import { About } from './screens/About'

const tabs = [
  { to: '/', label: 'Now' },
  { to: '/put-off', label: 'Put off' },
  { to: '/projects', label: 'Projects' },
  { to: '/product', label: 'Product' },
]

/** The paired-discs wordmark: a lit accent disc in front, a faded disc
 *  receding up and to the right. Same geometry as public/favicon.svg. */
function Logo() {
  return (
    <span className="relative h-4 w-6 flex-none" aria-hidden>
      <span className="absolute right-1 top-0 size-[10px] rounded-pill bg-line-strong" />
      <span className="absolute bottom-0 left-0 size-[14px] rounded-pill bg-accent shadow-[0_0_12px_var(--color-accent-glow)]" />
    </span>
  )
}

/** A tab's 5px dot: a ring at rest, lit accent when active. */
function TabDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={`size-[5px] flex-none rounded-pill ${
        active ? 'bg-accent shadow-[0_0_8px_var(--color-accent)]' : 'border border-text-3'
      }`}
    />
  )
}

// Screen crashes stay inside the routed area: the boundary is keyed by
// route, so switching tabs mounts a fresh subtree instead of a stuck
// fallback, and the header and nav above it keep working.
function RouteBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
}

function ScrollToTop() {
  const { pathname } = useLocation()
  // Braced body on purpose: an effect's return value becomes its cleanup,
  // and React calls any non-undefined cleanup as a function. Browser
  // extensions patch window.scrollTo to return values, which white-screened
  // production on the first navigation. Never return a call's result here.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
      <TourProvider>
      <div className="min-h-dvh bg-ground pb-28 font-sans text-[15px] text-text antialiased lg:pb-10">
        <ScrollToTop />
        <AnalyticsBoot />
        <header className="mx-auto flex max-w-lg items-center gap-2 px-5 pt-[18px] lg:max-w-[1060px] lg:gap-6 lg:border-b lg:border-line lg:px-8 lg:pb-3">
          <Link to="/" className="flex min-h-tap items-center gap-2.5 lg:mr-auto">
            <Logo />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-text lg:text-base">
              Foreground
            </span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-tap items-center gap-2 font-mono text-label uppercase ${
                    isActive ? 'text-accent' : 'text-text-3 hover:text-text'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <TabDot active={isActive} />
                    {tab.label}
                  </>
                )}
              </NavLink>
            ))}
            <Link
              to="/add"
              className="inline-flex min-h-11 items-center rounded-pill bg-accent px-5 text-[14px] font-semibold text-accent-ink hover:bg-accent-hover active:translate-y-px"
            >
              Add item
            </Link>
          </nav>
          <Link
            to="/about"
            className="ml-auto inline-flex min-h-tap items-center font-mono text-label uppercase text-text-3 hover:text-text lg:ml-0"
          >
            About
          </Link>
        </header>
        <RouteBoundary>
          <Routes>
            <Route path="/" element={<WhatNow />} />
            <Route path="/put-off" element={<PutOff />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/product" element={<Product />} />
            <Route path="/add" element={<AddItem />} />
            <Route path="/import" element={<Import />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </RouteBoundary>

        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 border-t border-line bg-panel lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
            {[...tabs, { to: '/add', label: 'Add' }].map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className="flex min-h-12 flex-col items-center justify-center gap-2"
              >
                {({ isActive }) => (
                  <>
                    <TabDot active={isActive} />
                    <span
                      className={`font-mono text-[10px] font-medium uppercase tracking-[0.14em] ${
                        isActive ? 'text-accent' : 'text-text-3'
                      }`}
                    >
                      {tab.label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
      </TourProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
