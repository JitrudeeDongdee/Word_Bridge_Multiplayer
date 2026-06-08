# Word Bridge — Development Plan

---

## Phase 1 — Project Setup

### Tasks
- [ ] Scaffold project with `npm create vite@latest` (React + TypeScript template)
- [ ] Install all dependencies
- [ ] Configure TailwindCSS (`tailwind.config.js`, `postcss.config.js`)
- [ ] Configure ESLint + Prettier
- [ ] Set up path aliases in `tsconfig.json` and `vite.config.ts`
- [ ] Create `src/` directory structure
- [ ] Create placeholder pages and basic router

### Acceptance Criteria
- `npm run dev` starts the dev server with no errors
- `npm run lint` returns zero warnings
- TailwindCSS utility classes render correctly in the browser
- TypeScript strict mode is enabled and no type errors exist

---

## Phase 2 — Room System

### Tasks
- [ ] Define all TypeScript types (`Room`, `Player`, `GameNode`, `GameEdge`, `GameState`)
- [ ] Implement Firebase config module
- [ ] Implement `roomService` (create room, join room, get room)
- [ ] Implement Home page (Create Room / Join Room forms)
- [ ] Implement Lobby page (player list, Start Game button for host)
- [ ] Wire routing: Home → Lobby on room creation/join

### Acceptance Criteria
- A room can be created and a 6-character code is displayed
- A second browser tab can join the room using that code
- Both tabs show the same player list, updating in real time
- The host's Start Game button is visible only to the host

---

## Phase 3 — Realtime Synchronisation

### Tasks
- [ ] Implement Firebase listeners for room state (`onValue`)
- [ ] Implement Zustand store (`useGameStore`) mirroring Firebase state locally
- [ ] Implement node CRUD Firebase writes (add, update position, delete)
- [ ] Implement edge CRUD Firebase writes (add, delete)
- [ ] Test that two clients see identical node/edge state within 200 ms

### Acceptance Criteria
- Adding a node in one tab appears on all other tabs within 200 ms
- Dragging a node syncs the new position across tabs
- Deleting a node removes it and its edges on all tabs
- Connecting nodes syncs the new edge across tabs

---

## Phase 4 — React Flow Graph

### Tasks
- [ ] Implement `GameCanvas` component wrapping `<ReactFlow>`
- [ ] Implement custom `WordNode` component (styled node with word label and delete button)
- [ ] Implement `AddWordPanel` component (input + Add button)
- [ ] Wire `onNodeDragStop` → Firebase position update
- [ ] Wire `onConnect` → Firebase edge add
- [ ] Wire `onNodesDelete` → Firebase node delete (owner-only guard)
- [ ] Render start nodes (Word A, Word B) as a distinct visual style

### Acceptance Criteria
- All nodes render as labelled draggable cards
- Start nodes cannot be deleted
- Players can only delete their own nodes
- Drawing an edge connection syncs to all clients
- Canvas supports zoom and pan

---

## Phase 5 — Win Detection

### Tasks
- [ ] Implement `checkWin(startNodeId, targetNodeId, edges)` using BFS
- [ ] Write Vitest unit tests for `checkWin` covering: direct edge, multi-hop path, no path, cycle detection
- [ ] Call `checkWin` inside the Firebase `onValue` listener after every state update
- [ ] On win: write `status: "won"` and `winnerId` to Firebase
- [ ] Subscribe to `status` change and redirect all clients to Victory screen

### Acceptance Criteria
- `checkWin` passes all unit tests
- Win is detected within one render cycle of the final connecting edge being added
- All clients navigate to the Victory screen simultaneously
- Victory screen shows the winning word chain (path) if derivable

---

## Phase 6 — Polish

### Tasks
- [ ] Add loading states (spinner while connecting to Firebase)
- [ ] Add error messages (invalid room code, word already exists, max nodes reached)
- [ ] Animate new nodes appearing on the canvas
- [ ] Highlight the winning path on the Victory screen
- [ ] Mobile-responsive layout check
- [ ] Add favicon and page title

### Acceptance Criteria
- All error states show user-friendly messages
- UI is usable on a 375 px wide mobile viewport
- No console errors or warnings in production build

---

## Phase 7 — Deployment

### Tasks
- [ ] Set up Firebase project and obtain config values
- [ ] Create `.env.example` with all required environment variable keys
- [ ] Configure `vite.config.ts` with correct `base` path for GitHub Pages
- [ ] Add `deploy` script to `package.json` using `gh-pages`
- [ ] Write `DEPLOYMENT.md` with step-by-step Firebase setup and GitHub Pages instructions
- [ ] Verify production build (`npm run build`) has no errors
- [ ] Deploy to GitHub Pages and confirm the live URL works

### Acceptance Criteria
- `npm run build` succeeds and produces a `dist/` folder
- `npm run deploy` pushes to `gh-pages` branch
- The live GitHub Pages URL is fully functional
- Firebase Database Rules restrict writes to valid room paths
