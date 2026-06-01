import {
  DEFAULT_MAP,
  DEPLOY_ZONES,
  INITIAL_ENEMIES,
  STARTING_GOLD,
  MAP_WIDTH,
  MAP_HEIGHT,
  Team,
  resolveClassKey,
  normalizeShopUnitKeys,
  SHOP_UNIT_KEYS,
} from "./config.js";

export const STAGES_LIBRARY_KEY = "tacticalStagesLibrary";
export const STAGES_EXPORT_VERSION = 1;

export function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

export function createEmptyMap(fill = 0) {
  return Array.from({ length: MAP_HEIGHT }, () =>
    Array(MAP_WIDTH).fill(fill)
  );
}

export function createEmptyDeployZones() {
  return createEmptyMap(0);
}

export function buildDefaultStage() {
  return {
    name: "デフォルト",
    map: cloneGrid(DEFAULT_MAP),
    deployZones: cloneGrid(DEPLOY_ZONES),
    startingGold: STARTING_GOLD,
    shopUnitKeys: [...SHOP_UNIT_KEYS],
    enemies: INITIAL_ENEMIES.map((e) => ({
      classKey: e.classKey,
      x: e.x,
      y: e.y,
      destination: null,
    })),
  };
}

export function normalizeStage(raw) {
  const fallback = buildDefaultStage();
  if (!raw || !Array.isArray(raw.map)) return fallback;

  const map = cloneGrid(raw.map);
  const deployZones =
    raw.deployZones && Array.isArray(raw.deployZones)
      ? cloneGrid(raw.deployZones)
      : createEmptyDeployZones();

  const enemies = Array.isArray(raw.enemies)
    ? raw.enemies.map((e) => ({
        classKey: resolveClassKey(e.classKey),
        x: Number(e.x) || 0,
        y: Number(e.y) || 0,
        destination: e.destination
          ? { x: Number(e.destination.x), y: Number(e.destination.y) }
          : null,
      }))
    : [];

  return {
    name: raw.name ?? "カスタムステージ",
    map,
    deployZones,
    startingGold: Number(raw.startingGold) || STARTING_GOLD,
    shopUnitKeys: normalizeShopUnitKeys(raw.shopUnitKeys),
    enemies,
  };
}

function generateStageId() {
  return `stage-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function stageToRecord(id, stage) {
  const normalized = normalizeStage(stage);
  return { id, ...normalized };
}

function createDefaultLibrary() {
  const id = generateStageId();
  const stage = buildDefaultStage();
  return {
    version: STAGES_EXPORT_VERSION,
    gameStageId: id,
    editorStageId: id,
    stages: [stageToRecord(id, stage)],
  };
}

function normalizeLibrary(raw) {
  if (!raw || !Array.isArray(raw.stages) || raw.stages.length === 0) {
    return createDefaultLibrary();
  }

  const stages = raw.stages.map((s) =>
    stageToRecord(s.id ?? generateStageId(), s)
  );
  const ids = new Set(stages.map((s) => s.id));
  let gameStageId = raw.gameStageId;
  let editorStageId = raw.editorStageId;
  if (!ids.has(gameStageId)) gameStageId = stages[0].id;
  if (!ids.has(editorStageId)) editorStageId = stages[0].id;

  return {
    version: STAGES_EXPORT_VERSION,
    gameStageId,
    editorStageId,
    stages,
  };
}

export function loadStagesLibrary() {
  try {
    const json = localStorage.getItem(STAGES_LIBRARY_KEY);
    if (!json) return createDefaultLibrary();
    return normalizeLibrary(JSON.parse(json));
  } catch {
    return createDefaultLibrary();
  }
}

export function getStagesLibraryForExport() {
  return loadStagesLibrary();
}

export function importStagesLibrary(raw) {
  const lib = normalizeLibrary(raw);
  saveStagesLibrary(lib);
  return lib;
}

export function saveStagesLibrary(lib) {
  localStorage.setItem(STAGES_LIBRARY_KEY, JSON.stringify(lib));
}

export function listStages() {
  return loadStagesLibrary().stages.map((s) => ({
    id: s.id,
    name: s.name,
  }));
}

export function getGameStageId() {
  return loadStagesLibrary().gameStageId;
}

export function getEditorStageId() {
  return loadStagesLibrary().editorStageId;
}

export function setGameStageId(id) {
  const lib = loadStagesLibrary();
  if (!lib.stages.some((s) => s.id === id)) return false;
  lib.gameStageId = id;
  saveStagesLibrary(lib);
  return true;
}

export function setEditorStageId(id) {
  const lib = loadStagesLibrary();
  if (!lib.stages.some((s) => s.id === id)) return false;
  lib.editorStageId = id;
  saveStagesLibrary(lib);
  return true;
}

function findStageRecord(lib, id) {
  return lib.stages.find((s) => s.id === id) ?? null;
}

export function loadStageById(id) {
  const lib = loadStagesLibrary();
  const record = findStageRecord(lib, id);
  return record ? normalizeStage(record) : null;
}

export function loadActiveStage() {
  const lib = loadStagesLibrary();
  const record = findStageRecord(lib, lib.gameStageId);
  return normalizeStage(record ?? lib.stages[0]);
}

export function loadEditorStage() {
  const lib = loadStagesLibrary();
  const record = findStageRecord(lib, lib.editorStageId);
  return normalizeStage(record ?? lib.stages[0]);
}

export function updateStageInLibrary(id, stage) {
  const lib = loadStagesLibrary();
  const index = lib.stages.findIndex((s) => s.id === id);
  if (index === -1) return false;
  lib.stages[index] = stageToRecord(id, stage);
  saveStagesLibrary(lib);
  return true;
}

export function addStage(initialStage = null) {
  const lib = loadStagesLibrary();
  const id = generateStageId();
  const base = initialStage ?? buildDefaultStage();
  base.name = base.name || `ステージ ${lib.stages.length + 1}`;
  lib.stages.push(stageToRecord(id, base));
  lib.editorStageId = id;
  saveStagesLibrary(lib);
  return id;
}

export function loadStage() {
  return loadEditorStage();
}

export function libraryToJson(lib) {
  return JSON.stringify(lib, null, 2);
}

export function downloadStagesLibrary(fileName = "stages.json") {
  const lib = loadStagesLibrary();
  const blob = new Blob([libraryToJson(lib)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function fillStageSelect(selectEl, selectedId) {
  if (!selectEl) return;
  const stages = listStages();
  selectEl.innerHTML = stages
    .map(
      (s) =>
        `<option value="${s.id}"${s.id === selectedId ? " selected" : ""}>${escapeHtml(s.name)}</option>`
    )
    .join("");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export function enemyDefsToSpawn(enemies) {
  return enemies.map((e) => ({
    classKey: e.classKey,
    team: Team.ENEMY,
    x: e.x,
    y: e.y,
  }));
}
