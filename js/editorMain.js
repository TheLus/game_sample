import {
  Terrain,
  UnitClass,
  TERRAIN_BRUSH_KEYS,
  ENEMY_EDITOR_KEYS,
} from "./config.js";
import { StageEditor } from "./editor.js";

const canvas = document.getElementById("editorCanvas");

document.getElementById("terrainPalette").innerHTML = TERRAIN_BRUSH_KEYS.map(
  (key) => {
    const t = Terrain[key];
    return `<button type="button" class="palette-btn terrain-btn" data-terrain-id="${t.id}" title="${t.name}">
      <span class="swatch" style="background:${t.color}"></span>
      <span>${t.name}</span>
    </button>`;
  }
).join("");

document.getElementById("enemyPalette").innerHTML = ENEMY_EDITOR_KEYS.map(
  (key) => {
    const u = UnitClass[key];
    return `<button type="button" class="palette-btn enemy-btn" data-class-key="${key}">
      <span class="symbol">${u.symbol}</span>
      <span>${u.name}</span>
    </button>`;
  }
).join("");

const ui = {
  messageEl: document.getElementById("message"),
  stageNameInput: document.getElementById("stageName"),
  saveBtn: document.getElementById("saveBtn"),
  loadBtn: document.getElementById("loadBtn"),
  loadFileInput: document.getElementById("loadFileInput"),
  resetBtn: document.getElementById("resetBtn"),
  deleteEnemyBtn: document.getElementById("deleteEnemyBtn"),
  modeTerrain: document.getElementById("modeTerrain"),
  modeDeploy: document.getElementById("modeDeploy"),
  modeEnemy: document.getElementById("modeEnemy"),
  terrainPalette: document.getElementById("terrainPalette"),
  enemyPalette: document.getElementById("enemyPalette"),
};

new StageEditor(canvas, ui);
