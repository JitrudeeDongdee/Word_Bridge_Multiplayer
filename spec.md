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

### Decisions
- **2026-10-17** — ConceptNet removed: `api.conceptnet.io` returns 502. Embedding added
  because Datamuse alone gave 0 to obviously related pairs (sun–summer, war–dead,
  coffee–morning), so tuning the threshold had no effect.
- Calibration (2026-10-17, in-browser): 25 related pairs cosine 0.357–0.803,
  20 unrelated pairs 0.123–0.342. The margin at 0.35 is thin — re-calibrate with more
  pairs if false connections show up.

### Next steps (proposed, not started)
1. Crowd-confirmed pairs: a "request link" action, votes stored in Firebase, pairs with
   enough distinct voters override the model score.
2. LLM judge for borderline pairs behind a small backend (Cloud Function / Worker),
   cached per pair.

## Known issues
- `api.dictionaryapi.dev` (word validation) was timing out on 2026-10-17, which blocks
  adding any word ("Network error. Unable to verify word.").
- `npm run lint` has 10 pre-existing problems on `main`.
