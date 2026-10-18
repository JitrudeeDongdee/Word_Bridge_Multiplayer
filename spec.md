# Word Bridge Multiplayer — spec

Living source of truth for current state and decisions. Game rules: `GAME_RULES.md`.

## Word similarity (auto-bridge)

When a word is added, it is scored against every node on the canvas; pairs scoring
`>= AUTO_BRIDGE_THRESHOLD` (0.15) get an edge automatically. Players cannot draw
edges by hand (`nodesConnectable={false}`).

Score = `max(datamuse, embedding)` — `src/utils/semanticSimilarity.ts`

| Source | How | Notes |
|---|---|---|
| Embedding | `Xenova/all-MiniLM-L6-v2` (q8, ~23MB) via `@huggingface/transformers` in the browser — `src/utils/embeddingSimilarity.ts` | Cosine is mapped so `EMBEDDING_RELATED_COSINE` (0.45) == 0.15. Model files come from huggingface.co, ONNX wasm from cdn.jsdelivr.net; both cached by the browser after first load. Preloaded on GamePage mount. |
| Datamuse | `ml` + `rel_trg`, top 200 each, both directions | Binary in practice: a pair is in the top-200 list (high score) or scores 0. |

If the model fails to load, Datamuse alone is used (a warning is logged).

### Crowd-taught pairs (link voting)
- "🔗 Vote link" on the canvas → pick two words → "Vote to link".
- Vote stored at `pairVotes/{a|b}/voters/{voterKey}`; voterKey = public IP
  (fallback: player ID), so one network = one vote. `src/services/pairVotesService.ts`
- At `PAIR_VOTE_THRESHOLD` (3) distinct voters the pair is written to `learnedPairs/{a|b}`:
  linked immediately in the voter's room, and scored 1.0 (always bridged) in every game
  after (`useLearnedPairs` → `scorePair` in `useGameActions`).
- Not allowed: the two goal words, pairs already connected. Voting is open while playing
  and after the round ends (`won`, board viewed via "See the board"); a link added after
  the round doesn't change its score.
- Integrity is best-effort only: the database has no auth and open rules, so anyone with
  the client can write votes directly. Players on the same network count as one voter.
- Rules for `pairVotes` / `learnedPairs` (from `firebase.rules.json`) were published in the
  Firebase Console on 2026-10-17. Without them reads/writes get "Permission denied" and the
  UI shows "Could not save your vote".

### Decisions
- **2026-10-17 (later)** — embedding-only cutoff raised 0.35 → 0.45. On 1,500 random
  start-word pairs 11% reached 0.35 (dog–king 0.392, puppet–dog 0.418), so generic words
  like "rock"/"fire" finished ~20% of start pairs in one word. At 0.45: 1.5% of random pairs;
  on 80 sampled start pairs rock 15 → 1, fire 18 → 4, dark 11 → 0 one-word wins.
  Cost: embedding-only true pairs like coffee–morning (0.357) and war–dead (0.384) no longer
  auto-link — Datamuse or player votes must cover them. CSLS hubness correction and the
  bge-small / gte-small models were tried and separated related/unrelated no better.
- **2026-10-17** — ConceptNet removed: `api.conceptnet.io` returns 502. Embedding added
  because Datamuse alone gave 0 to obviously related pairs (sun–summer, war–dead,
  coffee–morning), so tuning the threshold had no effect.
- Calibration (2026-10-17, in-browser): 25 related pairs cosine 0.357–0.803,
  20 unrelated pairs 0.123–0.342. The margin at 0.35 is thin — re-calibrate with more
  pairs if false connections show up.

### Next steps
**Layer 3 — LLM judge: on hold** (decided 2026-10-17: let players use layers 1–2 first and
see whether related pairs are still missed often enough to justify the API cost).

Decisions already made for when it resumes:
- **Backend:** Cloudflare Worker holds the Claude API key (never in the client) and caches
  each pair's verdict in Workers KV, so a pair is asked at most once. Firebase Cloud
  Functions ruled out: the project is on the Spark plan and Functions need Blaze (billing).
- **When to ask:** only borderline pairs — final score roughly 0.08–0.15 (just under
  `AUTO_BRIDGE_THRESHOLD`). Clear yes/no pairs never call the API.

Still open:
- **Model:** Claude Opus 5.5 (~$2–5 per 1,000 new pairs) vs Claude Haiku 5.5
  (~$0.05–0.15 per 1,000 new pairs). Rough estimates, not measured.
- Abuse protection for a public Worker endpoint (per-IP rate limit, daily call cap) so the
  API bill can't be run up.
- Who owns the Cloudflare account and the Anthropic API key (set as a Worker secret by
  the owner, not committed).

## Rooms: public list, names, passwords
- **Main lobby** (`/rooms`, `RoomsPage` + `RoomList`; home page has "Go to main lobby"):
  live list from `roomIndex/{roomId}` — a public
  summary (name, host, player count, status, hasPassword, lastActiveAt) kept in sync by
  `syncRoomIndex` after every change to a room's players / status / name (create, join,
  leave, kick, start, restart, back to lobby, win; delete removes it). Waiting rooms first,
  then by recent activity; empty or >2h idle rooms hidden. A search box filters by room
  name, host name or room code (`filterRooms`, case-insensitive). `cleanOldRooms` also removes
  index entries of deleted or missing rooms. Rooms in progress can be joined as a spectator
  (including between rounds).
- **Room lobby → main lobby**: "Main lobby" (top-left of the room lobby) leaves the room —
  host passes to the next player, or the room closes after a confirm if you're alone — and
  opens `/rooms`. Visitors who aren't in the room just navigate.
- **Room name**: set by the host at creation (≤30 chars), default "<host>'s room" (follows
  the current host when no name was set).
- **Password** (optional, set at creation) is separate from the 6-char room code (which is
  only for finding the room). Stored as `passwordHash` = SHA-256(`passwordSalt`:password);
  `joinRoom` returns `password_required` / `wrong_password`. Asked on every join path (code,
  list, invite link, direct game link). Soft lock: rooms are readable and writable by
  anyone, so it only stops joining through the game UI.
- Lobby confirmations (Delete Room, leaving as the last player) use the in-page
  `ConfirmDialog`, not `window.confirm()` — in-app browsers / embedded previews never show
  native dialogs, so the button looked dead (2026-10-18). Delete Room → main lobby (`/rooms`).
- **Room settings** (host only; room lobby behind a gear at the card's top-right corner,
  collapsed by default (2026-10-18) + in-game drawer, `RoomSettings` →
  `updateRoomSettings`): rename (empty = default name), set a new password **without the old
  one** (the old one can't be shown — only its hash is stored), or remove the lock. Players
  already in the room stay; the password only applies to new joiners. A host who lost their
  identity (other device / cleared browser) can't recover — needs accounts.
- Requires the `roomIndex` rule (published 2026-10-17).
- **Accounts: UI preview only.** `AccountButtons` (home + main lobby) links to `/login` and
  `/signup` (`AuthPage`): Continue with Google, Continue with Facebook, and phone number →
  6-digit code. Every action ends in a "coming soon" notice — no provider is contacted, no
  SMS is sent, nothing is stored (verified: zero external requests). To make it real:
  Firebase Auth (Google / Facebook / Phone providers, Blaze plan needed for phone SMS),
  then tie `playerId` to the auth uid.

## Icons
UI uses `lucide-react` icons (no emoji or symbol glyphs in components); decorative icons are
`aria-hidden`, icon-only buttons have an `aria-label`.
- Player counts include players who closed the tab without leaving (no disconnect cleanup).

## Game screen layout
- Canvas takes the full width. Players, scores and the edge score table live in a drawer
  (`GameSidebar`), opened from the header ("👥 Players & Scores" / ☰ on mobile).
- Bottom dock (`GamePage`), centered, max-width 36rem: add-word input (or the spectator
  "Watching / Join now" card) + 💬 chat button. Shown only while `status === 'playing'`.
  It follows the on-screen keyboard via `useKeyboardInset` (visualViewport).
- Chat (`ChatDock`): icon with an unread badge (messages from others since the panel was
  last closed; history from before the page opened counts as read). Opens as a popover on
  desktop, a bottom sheet on mobile.
- Vote-link confirm panel sits top-center; MiniMap top-right (desktop only); zoom controls
  hidden on mobile (pinch zoom). `minZoom` 0.2 so both goal words fit on a phone.
- On-screen keyboard: the word dock / chat sheet sit above it via `visualViewport`
  (`useKeyboardInset`); `index.html` asks Chrome for `interactive-widget=resizes-content`.
  Some in-app browsers (Messenger on Android, reported 2026-10-18) draw the keyboard over the
  page without resizing anything, so nothing can be measured: when a text field is focused on
  a touch screen and neither viewport shrank after 500 ms, the dock and chat sheet move just
  under the header until the field loses focus.
- Arrow keys pan the board (Shift = 3× step, 80 px base). Ignored while a field with text
  is focused or another handler used the key (suggestion list), so typing is unaffected.

## Scoring (competitive, v2 — `src/utils/scoring.ts`)
Points are awarded only when the round is won (`useWinDetection`, host's client).
- **Bridge** = every intermediate word on *any* shortest path from A to B (BFS distances
  from both ends: `dA[v] + dB[v] === length`). Longer detours don't count.
- **Pot** by bridge length (intermediate words): 1 → 10, 2 → 8, 3 → 6, 4 → 4, 5+ → 2.
  Split equally between the bridge words' owners (ties share one pot); rounded to 1 decimal.
- **Finisher +2**: `createdBy` of the newest edge on the bridge (the add-word or vote that
  completed it). Edges without `createdAt` (pre-v2) give no finisher bonus.
- **Creative +1** per bridge word with an auto link that Datamuse confirms
  (`edge.datamuse` ≥ 0.15) but whose final `edge.score` is < 0.30 — valid but not obvious.
  Embedding-only links never count (their weak range is mostly noise); vote links, learned
  pairs (1.0) and older edges without `datamuse` don't count either.
- No per-player word cap (a 5-word cap was tried and removed 2026-10-17 at the owner's request;
  only the 50-node room limit applies).
- Breakdown saved as `room.roundBreakdown` and shown on the victory screen. Firebase drops
  empty arrays, so its arrays may be missing when read back.
  The victory box lays every line out on one grid (icon | item · who | points, right-aligned)
  so bridge / finisher / creative rows line up (2026-10-17).
- Points accumulate per room across rounds (`room.scores`, rounded to 1 decimal).

Ideas not done: semantic "progress" scoring; moving win detection off the host's client
(if the host's tab is closed, a win isn't recorded).

## Known issues
- Fixed 2026-10-17: every page reload logged the player out of their room. The store's
  `get currentPlayer()` getter made zustand-persist hydration throw (silently), so the
  first write after load saved `playerId: null`. Test: `src/test/sessionStore.test.ts`.
- 📖 Dict mode definitions still come only from `api.dictionaryapi.dev`; while it is down
  they show "Definition not found." (word validation has a fallback, see below).

## Word validation & definitions (`src/services/dictionary.ts`)
`checkRealWord` and `lookupDefinition` (📖 Dict panel) share one lookup per word:
- Both sources are asked **in parallel**: `api.dictionaryapi.dev` (3s timeout; only JSON
  trusted — 200 found, 404 not found) and Datamuse (`/words?sp=<word>&md=dp`, 5s: exact
  spelling + a definition + not tagged `prop`). First source to find the word wins;
  not found only when no source found it and at least one answered.
- Results are cached per word (network failures aren't cached, so they can be retried).
- A source failing twice in a row is skipped for 5 minutes.

### Dict pictures (`src/services/wikiImage.ts`, `DictImage`)
- "🖼 Images" toggle inside the 📖 Dict panel, **on by default** (owner's choice,
  2026-10-17); a viewer who switches it off keeps that in their browser
  (`localStorage` `wb-dict-images`).
- When on, each card shows the thumbnail from the Wikipedia page summary API (no key,
  CORS) with an "‹Title› · Wikipedia" link as attribution. Disambiguation pages (e.g. "run")
  and pages without an image show nothing; lookups are cached per word, 4s timeout.
- **Pronunciation**: a speaker button next to each card's word (`SpeakButton`,
  `utils/speech.ts`) reads it aloud with the browser's `speechSynthesis` (en-US voice, rate
  0.9, cancels any speech in progress). Hidden when the browser has no speech synthesis.
  Synthetic voice — differs by device; iPhone silent mode can mute it.
- Images are not screened (no safe-search flag in the API). The image matches the
  word's main article, not necessarily the sense used in the game ("bank" → a bank).

## Adding a word (`handleAddWord`)
1. Instant: format / duplicate / room-size checks, then the node is written with
   `pending: true` (`placeNode`, id generated locally — no wait for the server ack).
   The input clears immediately; the node is shown faded and pulsing (no extra text, so
   it doesn't resize) and can't be deleted.
2. Background: dictionary check → if invalid the node (and any edges) is removed and the
   error floats above the input; if valid → autocomplete pool, scoring + edges (pending
   nodes of others are skipped), relayout, then `pending` is cleared.
- **2026-10-17 hotfix** — dictionaryapi.dev timed out on every request, so no word could
  be added and the game was unplayable.
- `npm run lint` has 9 pre-existing problems on `main`.

## Start word pairs
`pickWordPair` (`src/utils/wordPairs.ts`) picks only from the curated list: 405 pairs in 13
categories (90 hand-picked + 315 hand-written, kept if embedding cosine is 0.15–0.45 and no
word appears more than 3 times; calibrated 2026-10-17 — the original 90 have median 0.36).
Per room it avoids, in order of strictness: used pairs, any word from the last 10 rounds,
categories from the last 3 rounds; then falls back to any unused pair, then any pair.
- **2026-10-17** — stopped picking start words from `globalCustomWords`. That pool is every
  word players ever typed (31 words at the time, mostly bird/sky themed), so it always won
  over the curated list and the same words kept coming back. It also contained an ethnic
  slur ("gook"), which was deleted from the database. The pool still feeds autocomplete and
  has no profanity filter (decided not to add one for now).
