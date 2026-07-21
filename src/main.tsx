import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { Toaster } from './components/Toaster'
import { pushToast } from './lib/toast'
import { installGlobalErrorReporting } from './lib/reportError'

// Catch errors that escape React (event handlers, async callbacks, effect
// teardown, extension-injected code) and post them to the log drain.
installGlobalErrorReporting()

// Any mutation that errors surfaces a toast with a Retry, so a failed save is
// never silent. Retry re-runs the same mutation with its original variables;
// if it fails again the cache raises a fresh toast.
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (_error, variables, _onMutateResult, mutation) => {
      pushToast({
        message: "Couldn't save that change. It hasn't been stored.",
        retry: () => {
          void mutation.execute(variables).catch(() => {})
        },
      })
    },
  }),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)
