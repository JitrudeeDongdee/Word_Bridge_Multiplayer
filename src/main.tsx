import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// When a new deploy replaces hashed JS chunks, any lazy-load of the old chunk
// URLs will fail. Catch it globally and reload to pick up the new assets.
window.addEventListener('unhandledrejection', (e) => {
  const msg = String((e.reason as Error)?.message ?? '');
  if (
    msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch') ||
    msg.includes('Importing a module script failed')
  ) {
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
