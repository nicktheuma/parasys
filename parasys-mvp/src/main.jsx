import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress benign performance warnings from libraries
const originalWarn = console.warn
console.warn = function(...args) {
  const msg = args[0]
  // Suppress GPOS font warnings from Troika text renderer
  if (msg?.includes?.('GPOS table LookupType')) return
  // Suppress wheel event listener warning from OrbitControls
  if (msg?.includes?.('wheel') && msg?.includes?.('passive')) return
  originalWarn.apply(console, args)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
