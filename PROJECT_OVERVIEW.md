# Word Bridge — Project Overview

## Project Vision

Word Bridge is a real-time collaborative multiplayer browser game where players work together to semantically connect two random English words by building an intermediate chain of words that bridges the conceptual gap between them. The game rewards creativity, vocabulary, and lateral thinking.

## Core Gameplay

Two starting words are displayed at opposite ends of a canvas — **Word A** and **Word B**. Players in the same room collaboratively add intermediate word nodes and draw edges (connections) between them, constructing a graph. The room wins when a connected path of edges exists from Word A to Word B.

**Example:**
```
FIRE → HEAT → WARM → WINTER → COLD → SNOW
```

Every word is a draggable node on a shared canvas. Players can:
- Add new word nodes to the canvas
- Drag existing nodes to rearrange the layout
- Connect nodes with edges by drawing from one to another
- Remove nodes they personally added

All changes sync instantly to every player in the room via Firebase Realtime Database.

## Target Audience

- Word game enthusiasts (fans of Wordle, Codenames, etc.)
- Groups of friends looking for a quick collaborative online game
- Students wanting to explore word associations
- Casual gamers aged 13+

## MVP Scope

The Minimum Viable Product covers:

| Feature | Status |
|---|---|
| Create a room with a generated code | MVP |
| Join a room by entering a code | MVP |
| Lobby with player list and host controls | MVP |
| Random starting word pair on game start | MVP |
| Add/drag/connect/delete word nodes | MVP |
| Real-time graph sync across all players | MVP |
| BFS-based win detection | MVP |
| Victory screen with winner announcement | MVP |
| Responsive desktop-first UI | MVP |

## Future Roadmap

### v1.1 — Quality of Life
- Word validation via dictionary API (reject non-words)
- Player cursors visible on canvas
- Undo/redo per player

### v1.2 — Competitive Mode
- Timed rounds (e.g., 3 minutes)
- Individual scoring based on nodes contributed to the winning path
- Leaderboard

### v1.3 — Social Features
- Persistent player profiles
- Room history / replay viewer
- Custom word pair input by host

### v2.0 — Expanded Game Modes
- Versus mode: two teams race to bridge the same pair
- Daily Challenge: same word pair for all global players
- Spectator mode
