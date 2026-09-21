import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { getStoredTheme, applyThemeToDOM } from './pages/Settings.jsx'

// Resolved by Settings so the default lives in exactly one place.
applyThemeToDOM(getStoredTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
