# Word Bridge — Tech Stack

## Architecture Overview

Word Bridge is a client-only single-page application (SPA). There is no dedicated backend server. Firebase acts as the sole real-time data layer, and all game logic runs in the browser. This keeps infrastructure costs at zero and deployment trivially simple.

```
Browser (React SPA)
    │
    ├── React Flow          (interactive canvas / graph editor)
    ├── Zustand             (local UI state)
    └── Firebase SDK
            │
            └── Firebase Realtime Database  (shared game state)
```

---

## Frontend

### React 18
The UI component model. Chosen for its large ecosystem, excellent TypeScript support, and compatibility with React Flow.

### TypeScript (strict mode)
All source files use TypeScript with `"strict": true`. This catches entire categories of runtime bugs at compile time, makes refactoring safe, and serves as living documentation through types.

### Vite
Build tool and dev server. Orders of magnitude faster than Create React App (ESM-native HMR). Produces optimised static bundles suitable for GitHub Pages deployment.

### React Flow (`@xyflow/react`)
The core visual component. Provides a production-grade interactive node-and-edge canvas out of the box: draggable nodes, connectable handles, zoom/pan, and a rich event API. Building this from scratch with SVG/Canvas would consume the entire MVP timeline.

### TailwindCSS
Utility-first CSS framework. Enables rapid styling without context-switching to separate CSS files. The purge/tree-shake step means unused styles are stripped from the production bundle.

---

## Real-time Layer

### Firebase Realtime Database
A hosted JSON database with WebSocket-based push updates. Chosen because:
- Zero backend code required (rules-based security)
- SDK handles reconnection, offline caching, and ordering
- Free Spark tier is sufficient for MVP traffic
- All connected clients see writes reflected in under 100 ms

Alternative considered: **Supabase Realtime** — rejected because Postgres row-level subscriptions add complexity for the simple JSON structures used here.

---

## Hosting

### GitHub Pages
Free static hosting that integrates directly with the repository. A single `npm run build` followed by deploying the `dist/` folder (via `gh-pages` or GitHub Actions) is all that is needed. Custom domains are also supported.

---

## State Management

### Zustand
Lightweight flux-style state library. Chosen over Redux because:
- No boilerplate (no actions/reducers/selectors setup)
- Native TypeScript inference
- Works well alongside Firebase listeners (store is updated directly from `onValue` callbacks)
- Bundle size is ~1 KB gzipped

---

## Utilities

### UUID (`uuid` package)
Generates RFC-compliant v4 UUIDs for room IDs, node IDs, and player IDs. Deterministic, collision-resistant, and zero-dependency.

---

## Testing

### Vitest
Test runner that shares Vite's config and transform pipeline. Near-instant startup compared to Jest. Used for unit testing utility functions (win detection, validation) and Zustand store logic.

---

## Linting & Formatting

### ESLint
Static analysis for code quality and potential bugs. Configured with:
- `@typescript-eslint` — TypeScript-aware rules
- `eslint-plugin-react-hooks` — enforces hooks rules

### Prettier
Opinionated code formatter. Removes all debates about style. Integrated as an ESLint plugin so a single `eslint --fix` run both lints and formats.

---

## Dependency Summary

| Package | Version | Purpose |
|---|---|---|
| react | ^18 | UI framework |
| react-dom | ^18 | DOM renderer |
| typescript | ^5 | Type safety |
| vite | ^5 | Build tool |
| @xyflow/react | ^12 | Graph canvas |
| tailwindcss | ^3 | Styling |
| firebase | ^10 | Realtime DB + hosting |
| zustand | ^4 | State management |
| uuid | ^9 | ID generation |
| react-router-dom | ^6 | Client-side routing |
| vitest | ^1 | Unit tests |
| eslint | ^8 | Linting |
| prettier | ^3 | Formatting |
| gh-pages | ^6 | GitHub Pages deploy |
