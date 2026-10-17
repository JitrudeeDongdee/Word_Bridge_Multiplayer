import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// When a new deploy replaces hashed JS chunks, any lazy-load of the old chunk
// URLs will fail. Catch it globally and reload to pick up the new assets.
window.addEventListener('unhandledrejection', (e) => {
  const msg = String((e.reason as Error)?.message ?? '');
  // Only chunk-load failures. A bare "Failed to fetch" is any failed network request
  // (Datamuse, dictionary, IP lookup…) and used to reload the page mid-game.
  if (
    msg.includes('dynamically imported module') ||
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
