import { useEffect } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { WhatNow } from './screens/WhatNow'
import { ThemeToggle } from './components/ThemeToggle'
import { PutOff } from './screens/PutOff'
import { Projects } from './screens/Projects'
import { AddItem } from './screens/AddItem'
import { Product } from './screens/Product'
import { About } from './screens/About'

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const NowIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" {...stroke} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
)
const PutOffIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" {...stroke} aria-hidden>
    <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l3 2" />
  </svg>
)
const ProjectsIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" {...stroke} aria-hidden>
    <path d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
  </svg>
)
const ProductIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" {...stroke} aria-hidden>
    <path d="M5 4v12" />
    <path d="M12 4v7" />
    <path d="M19 4v16" />
  </svg>
)
const AddIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" {...stroke} aria-hidden>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
)

const tabs = [
  { to: '/', label: 'Now', icon: <NowIcon /> },
  { to: '/put-off', label: 'Put off', icon: <PutOffIcon /> },
  { to: '/projects', label: 'Projects', icon: <ProjectsIcon /> },
  { to: '/product', label: 'Product', icon: <ProductIcon /> },
]

/** The paired-discs logo: a clay disc in front, a sand outline receding. */
function Logo() {
  return (
    <span className="relative h-4 w-6 flex-none" aria-hidden>
      <span className="absolute left-2.5 top-px size-[11px] rounded-pill border-2 border-sand-500 dark:border-sand-600" />
      <span className="absolute left-0 top-px size-3.5 rounded-pill bg-clay dark:bg-clay-400" />
    </span>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-dvh bg-ground pb-24 font-body text-[15px] text-ink lg:pb-10 dark:bg-ground-dark dark:text-ink-inverse">
        <ScrollToTop />
        <header className="mx-auto flex max-w-lg items-center gap-2 px-5 pt-5 lg:max-w-[1060px] lg:gap-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 lg:mr-auto">
            <Logo />
            <span className="font-display text-[15px] lg:text-lg">Foreground</span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `pb-0.5 text-[14px] ${
                    isActive
                      ? 'border-b-2 border-clay font-semibold text-clay-700 dark:border-clay-400 dark:text-clay-300'
                      : 'text-sand-800 hover:text-clay-700 dark:text-sand-300 dark:hover:text-clay-300'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
            <Link
              to="/add"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-pill bg-clay-500 px-[18px] font-display text-[14px] text-ink hover:bg-clay-400 dark:bg-clay-400 dark:hover:bg-clay-300"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" {...stroke} aria-hidden>
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Add item
            </Link>
          </nav>
          <Link
            to="/about"
            className="ml-auto text-meta font-semibold text-sand-700 hover:text-clay-700 lg:ml-0 dark:text-sand-400 dark:hover:text-clay-300"
          >
            About
          </Link>
          <ThemeToggle />
        </header>
        <Routes>
          <Route path="/" element={<WhatNow />} />
          <Route path="/put-off" element={<PutOff />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/product" element={<Product />} />
          <Route path="/add" element={<AddItem />} />
          <Route path="/about" element={<About />} />
        </Routes>

        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 border-t border-ink/10 bg-surface-raised/95 backdrop-blur lg:hidden dark:border-ink-inverse/12 dark:bg-surface-dark/95"
        >
          <div className="mx-auto flex max-w-lg items-start px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="min-h-12 flex-1">
                {({ isActive }) => (
                  <span
                    className={`flex flex-col items-center justify-center gap-[3px] text-[11px] font-semibold ${
                      isActive
                        ? 'text-clay-700 dark:text-clay-400'
                        : 'text-sand-700 dark:text-sand-400'
                    }`}
                  >
                    <span
                      className={`grid h-[26px] place-items-center ${
                        isActive
                          ? 'w-[46px] rounded-pill bg-clay-200 text-clay-800 dark:bg-surface-dark-raised dark:text-clay-300'
                          : ''
                      }`}
                    >
                      {tab.icon}
                    </span>
                    {tab.label}
                  </span>
                )}
              </NavLink>
            ))}
            <NavLink to="/add" className="min-h-12 flex-1">
              <span className="flex flex-col items-center justify-center gap-[3px] text-[11px] font-semibold text-sand-700 dark:text-sand-400">
                <span className="-mt-3.5 grid size-[42px] place-items-center rounded-pill bg-clay-500 text-ink shadow-md dark:bg-clay-400">
                  <AddIcon />
                </span>
                Add
              </span>
            </NavLink>
          </div>
        </nav>
      </div>
    </BrowserRouter>
  )
}
