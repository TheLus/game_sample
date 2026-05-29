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

- **Click ally**: Select unit
- **Click tile**: Set destination (path shown on the map)
- **Click selected ally’s tile**: Clear destination order
- **Start Battle**: Begin the combat phase
- **Arrow keys**: Move cursor
- **Esc**: Deselect unit

### Combat phase

- Runs automatically at **one turn per second** (movement and combat)
- Returns to the instruction phase if allies are wiped out, or if there is **no change for 3 turns in a row**
- **Clear all enemies** during combat to win the game

## Features

- Two-phase loop: instruction → combat → instruction
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
