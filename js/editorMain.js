import {
  Terrain,
  UnitClass,
  TERRAIN_BRUSH_KEYS,
  ENEMY_EDITOR_KEYS,
  SHOP_UNIT_KEYS,
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

document.getElementById("shopUnitsEditor").innerHTML = SHOP_UNIT_KEYS.map(
  (key) => {
    const u = UnitClass[key];
    return `<label class="shop-unit-check">
      <input type="checkbox" data-class-key="${key}" checked>
      <span>${u.symbol} ${u.name}（${u.cost}G）</span>
    </label>`;
  }
).join("");

const ui = {
  messageEl: document.getElementById("message"),
  stageNameInput: document.getElementById("stageName"),
  startingGoldInput: document.getElementById("startingGoldInput"),
  shopUnitsEditor: document.getElementById("shopUnitsEditor"),
  saveBtn: document.getElementById("saveBtn"),
  loadBtn: document.getElementById("loadBtn"),
  loadFileInput: document.getElementById("loadFileInput"),
  resetBtn: document.getElementById("resetBtn"),
  deleteEnemyBtn: document.getElementById("deleteEnemyBtn"),
  editorStageSelect: document.getElementById("editorStageSelect"),
  addStageBtn: document.getElementById("addStageBtn"),
  modeTerrain: document.getElementById("modeTerrain"),
  modeDeploy: document.getElementById("modeDeploy"),
  modeEnemy: document.getElementById("modeEnemy"),
  terrainPalette: document.getElementById("terrainPalette"),
  enemyPalette: document.getElementById("enemyPalette"),
};

new StageEditor(canvas, ui);
