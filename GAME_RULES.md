# Word Bridge — Game Rules

## Room Flow

### 1. Create Room
- A player visits the home page and clicks **Create Room**.
- They enter a display name.
- The system generates a unique 6-character alphanumeric **Room Code**.
- The creator becomes the **Host**.
- They are redirected to the Lobby.

### 2. Join Room
- A player visits the home page and clicks **Join Room**.
- They enter their display name and a Room Code.
- If the room exists and the game has not started yet, they are added to the player list.
- They are redirected to the Lobby.

### 3. Lobby
- All players can see who has joined.
- The **Host** has exclusive access to the **Start Game** button.
- The game cannot start with fewer than 1 player (solo play is allowed for testing).
- Once the host clicks Start Game, all players are moved to the Game Room.

### 4. Game Start
- The system selects two random English words: **Word A** (start) and **Word B** (target).
- Both words appear as fixed, undeletable nodes on the canvas.
- Players can immediately begin adding intermediate nodes.

---

## Gameplay

### Adding a Word Node
- A player types a word into the input field and clicks **Add Word** (or presses Enter).
- A new draggable node appears on the canvas at a random position.
- The node is labeled with the word and tagged with the player's ID.
- The node is synced to Firebase and appears on all players' canvases instantly.

### Dragging Nodes
- Any player may drag any node to reposition it on the canvas.
- Position changes (x, y coordinates) sync to Firebase in real time.

### Connecting Nodes
- Players draw edges between nodes using React Flow's default connect gesture (drag from a node handle to another node).
- Edges are undirected for win-detection purposes but rendered as arrows for clarity.
- An edge between the same two nodes (duplicate edge) is not allowed.

### Removing Nodes
- A player may only delete nodes they personally created (identified by `createdBy` matching their player ID).
- The two start nodes (Word A and Word B) cannot be deleted by anyone.
- Deleting a node automatically removes all edges connected to it.

---

## Win Condition

The room wins when a **connected graph path** exists from **Word A's node** to **Word B's node**.

Win detection runs automatically after every node addition or edge addition.

### Algorithm: Breadth-First Search (BFS)

```
function checkWin(startNodeId, targetNodeId, edges):
    visited = Set()
    queue = [startNodeId]

    while queue is not empty:
        current = queue.dequeue()
        if current == targetNodeId:
            return true
        if current in visited:
            continue
        visited.add(current)
        neighbors = all nodes connected to current via any edge
        queue.enqueue(neighbors not in visited)

    return false
```

An edge connects two nodes in **both directions** (undirected graph).

### Depth-First Search (DFS) — Alternative

```
function checkWinDFS(startNodeId, targetNodeId, edges, visited = Set()):
    if startNodeId == targetNodeId:
        return true
    visited.add(startNodeId)
    neighbors = all nodes connected to startNodeId via any edge
    for neighbor in neighbors not in visited:
        if checkWinDFS(neighbor, targetNodeId, edges, visited):
            return true
    return false
```

---

## Validation Rules

| Rule | Detail |
|---|---|
| English letters only | Words must match `/^[a-zA-Z]+$/` |
| Minimum word length | At least **2** characters |
| Maximum word length | No more than **30** characters |
| No duplicates | The same word cannot appear twice on the canvas (case-insensitive) |
| Maximum nodes | A room may contain no more than **50** word nodes (including the 2 start nodes) |
| No self-loops | A node cannot be connected to itself |

---

## Game States

| State | Description |
|---|---|
| `waiting` | Room created, players joining in the Lobby |
| `playing` | Game in progress |
| `won` | A winning path was detected; Victory screen is shown |

---

## Player Roles

| Role | Permissions |
|---|---|
| Host | Start game, all gameplay actions |
| Player | All gameplay actions |
