# Tactical Simulation

A 2D tactical RPG built with HTML, Canvas, and JavaScript.

## Getting Started

1. Run a local server (ES modules do not work over `file://`)

```bash
npx --yes serve .
# or
python3 -m http.server 8080
```

2. Open the app in your browser:
   - `http://localhost:3000` when using `serve`
   - `http://localhost:8080` when using Python’s HTTP server

## Controls

### Instruction phase

Placement and movement orders happen in the same phase:

- **Unit bar (below map)**: Select a unit type, then **click a yellow-bordered deploy tile** to place it (costs gold)
- **Drag a placed ally**: Move it to another deploy tile
- **Drag a placed ally off the map**: Sell it (full deploy cost refunded)
- **Click an ally**: Select it, then **click a tile** to set its combat movement destination
- **Start Battle**: Begin the combat phase (requires at least one ally)
- **Arrow keys**: Move cursor
- **Esc**: Deselect

### Combat phase

- Runs automatically at **one turn per second** (movement and combat)
- Returns to **instruction** when combat ends (enemies reset; allies, gold, and orders restored to pre-combat state)
- Applies after allies are wiped out or **3 turns with no change**
- **Clear all enemies** during combat to win the game

## Features

- Instruction-phase deployment with gold, deploy zones, drag reposition, and drag-to-sell
- Two-phase loop: instruction → combat
- Grid map with terrain (plain, forest, mountain, fort, river — water is impassable)
- Ally destination orders with pathfinding (1 tile per turn during combat)
- Automatic combat (counterattacks, hit rate, weapon triangle)
- Enemy AI (holds position; moves toward and attacks when a unit enters 5 tiles)

## Project Structure

| File | Description |
|------|-------------|
| `index.html` | Page layout |
| `css/style.css` | UI styles |
| `js/config.js` | Map and unit definitions |
| `js/deployment.js` | Deploy zone helpers |
| `js/units.js` | Unit class |
| `js/pathfinding.js` | Pathfinding and attack range |
| `js/combat.js` | Combat logic |
| `js/ai.js` | Enemy AI |
| `js/renderer.js` | Canvas rendering |
| `js/game.js` | Game state, phases, and input |
| `js/main.js` | Entry point |

## Possible Extensions

- Pause / speed controls during combat
- Map editor and multiple stages
- Class changes and level-ups
- Animations and sound effects
- Save / load
