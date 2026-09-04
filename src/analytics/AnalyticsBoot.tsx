import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useItems } from '../hooks/useData'
import { capturePageview } from './posthog'
import { trackSessionStarted } from './events'

// Renders nothing. Sits inside the router so it can see route changes, and
// fires the two events that are not tied to a user action: one page view per
// route change and one session_started per page load once the backlog has
// loaded. Both are no-ops in every suppressed state.
export function AnalyticsBoot() {
  const { pathname } = useLocation()
  const items = useItems().data

  useEffect(() => {
    capturePageview()
  }, [pathname])

  useEffect(() => {
    if (items) trackSessionStarted(items)
  }, [items])

  return null
}
