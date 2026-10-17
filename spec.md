# Word Bridge Multiplayer — spec

Living source of truth for current state and decisions. Game rules: `GAME_RULES.md`.

## Word similarity (auto-bridge)

When a word is added, it is scored against every node on the canvas; pairs scoring
`>= AUTO_BRIDGE_THRESHOLD` (0.15) get an edge automatically. Players cannot draw
edges by hand (`nodesConnectable={false}`).

Score = `max(datamuse, embedding)` — `src/utils/semanticSimilarity.ts`

| Source | How | Notes |
|---|---|---|
| Embedding | `Xenova/all-MiniLM-L6-v2` (q8, ~23MB) via `@huggingface/transformers` in the browser — `src/utils/embeddingSimilarity.ts` | Cosine is mapped so `EMBEDDING_RELATED_COSINE` (0.35) == 0.15. Model files come from huggingface.co, ONNX wasm from cdn.jsdelivr.net; both cached by the browser after first load. Preloaded on GamePage mount. |
| Datamuse | `ml` + `rel_trg`, top 200 each, both directions | Binary in practice: a pair is in the top-200 list (high score) or scores 0. |

If the model fails to load, Datamuse alone is used (a warning is logged).

### Crowd-taught pairs (link voting)
- "🔗 Vote link" on the canvas → pick two words → "Vote to link".
- Vote stored at `pairVotes/{a|b}/voters/{voterKey}`; voterKey = public IP
  (fallback: player ID), so one network = one vote. `src/services/pairVotesService.ts`
- At `PAIR_VOTE_THRESHOLD` (3) distinct voters the pair is written to `learnedPairs/{a|b}`:
  linked immediately in the voter's room, and scored 1.0 (always bridged) in every game
  after (`useLearnedPairs` → `scorePair` in `useGameActions`).
- Not allowed: the two goal words, pairs already connected, voting outside `playing`.
- Integrity is best-effort only: the database has no auth and open rules, so anyone with
  the client can write votes directly. Players on the same network count as one voter.
- Rules for `pairVotes` / `learnedPairs` (from `firebase.rules.json`) were published in the
  Firebase Console on 2026-10-17. Without them reads/writes get "Permission denied" and the
  UI shows "Could not save your vote".

### Decisions
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

## Scoring (competitive, v2 — `src/utils/scoring.ts`)
Points are awarded only when the round is won (`useWinDetection`, host's client).
- **Bridge** = every intermediate word on *any* shortest path from A to B (BFS distances
  from both ends: `dA[v] + dB[v] === length`). Longer detours don't count.
- **Pot** by bridge length (intermediate words): 1 → 10, 2 → 8, 3 → 6, 4 → 4, 5+ → 2.
  Split equally between the bridge words' owners (ties share one pot); rounded to 1 decimal.
- **Finisher +2**: `createdBy` of the newest edge on the bridge (the add-word or vote that
  completed it). Edges without `createdAt` (pre-v2) give no finisher bonus.
- **Creative +1** per bridge word with an auto-bridged link scoring in [0.15, 0.30) — valid
  but not obvious. Vote links never count; learned pairs score 1.0 so never count.
  The score is taken from `edge.score` (node scores are saved only after the edges, so the
  finishing word may not have them yet), falling back to `node.scores`.
- **Cap**: 5 words per player per round (`MAX_WORDS_PER_PLAYER`); deleting one frees a slot.
- Breakdown saved as `room.roundBreakdown` and shown on the victory screen. Firebase drops
  empty arrays, so its arrays may be missing when read back.
- Points accumulate per room across rounds (`room.scores`, rounded to 1 decimal).

Ideas not done: semantic "progress" scoring; moving win detection off the host's client
(if the host's tab is closed, a win isn't recorded).

## Known issues
- 📖 Dict mode definitions still come only from `api.dictionaryapi.dev`; while it is down
  they show "Definition not found." (word validation has a fallback, see below).

## Word validation
`checkRealWord` (`src/utils/validation.ts`) asks `api.dictionaryapi.dev` first (3s
timeout). Only a JSON response is trusted (200 = valid, 404 = not found); a timeout,
HTML error page or 5xx falls through to Datamuse (`/words?sp=<word>&md=dp`, 5s):
valid = exact spelling + at least one definition + not tagged `prop` (proper noun).
"Network error" is shown only when both are unreachable.
- **2026-10-17 hotfix** — dictionaryapi.dev timed out on every request, so no word could
  be added and the game was unplayable.
- `npm run lint` has 10 pre-existing problems on `main`.

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
