import { useEffect } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { WhatNow } from './screens/WhatNow'
import { PutOff } from './screens/PutOff'
import { Projects } from './screens/Projects'
import { AddItem } from './screens/AddItem'
import { Product } from './screens/Product'

const tabs = [
  { to: '/', label: 'Now', symbol: '◎' },
  { to: '/put-off', label: 'Put off', symbol: '🕰' },
  { to: '/projects', label: 'Projects', symbol: '▤' },
  { to: '/product', label: 'Product', symbol: '▦' },
  { to: '/add', label: 'Add', symbol: '＋' },
]

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-dvh bg-zinc-50 pb-24 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <ScrollToTop />
        <header className="mx-auto flex max-w-lg items-center gap-1.5 px-4 pt-3">
          <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
            <circle cx="31" cy="18" r="9" className="fill-zinc-300 dark:fill-zinc-700" />
            <circle cx="21" cy="27" r="12" className="fill-indigo-500" />
          </svg>
          <span className="text-sm font-semibold tracking-tight">Foreground</span>
        </header>
        <Routes>
          <Route path="/" element={<WhatNow />} />
          <Route path="/put-off" element={<PutOff />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/product" element={<Product />} />
          <Route path="/add" element={<AddItem />} />
        </Routes>

        <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] text-xs font-medium ${
                    isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500'
                  }`
                }
              >
                <span aria-hidden className="text-lg leading-none">
                  {tab.symbol}
                </span>
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </BrowserRouter>
  )
}
