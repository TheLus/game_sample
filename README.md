# Tactical Simulation

A 2D tactical RPG built with HTML, Canvas, and JavaScript.

## Pages

- **Game**: `index.html` — play the tactical simulation
- **Stage editor**: `editor.html` — design maps, deploy zones, and enemies

Use the navigation links at the top of each page to switch between them.

**Stages** are stored in the browser as a library (`localStorage` key `tacticalStagesLibrary`). The game page lets you pick which stage to play; the editor lets you pick which stage to edit and add new stages with **ステージ追加**. **Save** exports **all stages in one JSON file** (`stages.json`); **Load** replaces the entire library from that format.

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

- Runs automatically; turn interval is adjustable with a slider (**0.1–3 seconds** per turn, default 0.5s)
- **Pause** / **Resume** during combat; when combat ends (wipe or stale), the loop stops and **End Battle** returns to instruction (enemies reset; allies, gold, and orders restored to pre-combat state)
- Applies after allies are wiped out or **3 turns with no change**
- **Clear all enemies** during combat to win the game

## Features

- Instruction-phase deployment with gold, deploy zones, drag reposition, and drag-to-sell
- Two-phase loop: instruction → combat
- Grid map with terrain (plain, forest, mountain, fort, river — water is impassable)
- Ally destination orders with pathfinding (1 tile per turn during combat)
- Automatic combat (100% hit rate; no counterattacks; deterministic for trial-and-error play)
- **Weapon triangle** (melee only): Sword → Axe → Lance → Sword — advantage deals **2×** damage, disadvantage **0.5×**; Bow is outside the triangle
- Unit types: **Sword**, **Axe**, **Lance** (same stats as the former Fighter), **Archer** (ranged)
- Enemy AI (holds position; moves toward and attacks when a unit enters 5 tiles)

### Unused unit stats (hidden in UI)

Defined in `config.js` but **not used** in combat or movement yet:

| Stat | Field | Notes |
|------|-------|--------|
| Skill (技) | `skill` | Was for hit rate; combat is 100% hit |
| Speed (速) | `speed` | Was paired with skill for hit rate |
| Move (移動) | `move` | Combat moves **1 tile/turn** regardless; `moveCost` on terrain is also unused |

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
| `js/movement.js` | Combat movement for allies and enemies (no overlap, cycle swaps) |
| `js/ai.js` | Unused in combat; enemy movement is in `movement.js` |
| `js/renderer.js` | Canvas rendering |
| `js/game.js` | Game state, phases, and input |
| `js/main.js` | Game entry point |
| `js/stage.js` | Stage data save/load |
| `editor.html` | Stage editor page |
| `js/editor.js` | Stage editor logic |
| `js/editorMain.js` | Editor entry point |

## Possible Extensions

- Save combat speed preference across sessions
- Map editor and multiple stages
- Class changes and level-ups
- Animations and sound effects
- Save / load
