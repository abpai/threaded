import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// Threaded Live is served by the local server (pnpm live); it loads only on /live.
const LiveView = lazy(() => import('./components/live/LiveView'))
const isLive = window.location.pathname === '/live' || window.location.pathname.startsWith('/live/')

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Could not find root element to mount to')
}

const root = ReactDOM.createRoot(rootElement)
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {isLive ? (
        <Suspense fallback={null}>
          <LiveView />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </React.StrictMode>
)
