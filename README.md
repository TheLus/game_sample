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

- **Click**: Select unit → Move → Attack / Wait
- **Arrow keys**: Move cursor
- **Enter**: Confirm at cursor position
- **Esc**: Cancel
- **End Turn**: Finish the player phase and start the enemy turn

## Features

- Grid map with terrain (plain, forest, mountain, fort)
- Movement range (BFS with terrain costs)
- Combat with counterattacks, hit rate, and weapon triangle
- Player / enemy turn phases
- Simple enemy AI (attack when possible, otherwise advance)

## Project Structure

| File | Description |
|------|-------------|
| `index.html` | Page layout |
| `css/style.css` | UI styles |
| `js/config.js` | Map and unit definitions |
| `js/units.js` | Unit class |
| `js/pathfinding.js` | Movement and attack range |
| `js/combat.js` | Combat logic |
| `js/ai.js` | Enemy AI |
| `js/renderer.js` | Canvas rendering |
| `js/game.js` | Game state and input |
| `js/main.js` | Entry point |

## Possible Extensions

- Map editor and multiple stages
- Class changes and level-ups
- Animations and sound effects
- Support effects and magic
- Save / load
