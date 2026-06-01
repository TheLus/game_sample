import {
  DEFAULT_MAP,
  DEPLOY_ZONES,
  INITIAL_ENEMIES,
  STARTING_GOLD,
  MAP_WIDTH,
  MAP_HEIGHT,
  Team,
  resolveClassKey,
} from "./config.js";

export const STAGE_STORAGE_KEY = "tacticalCustomStage";

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
    enemies,
  };
}

export function stageToJson(stage) {
  return JSON.stringify(stage, null, 2);
}

export function downloadStageJson(stage) {
  const blob = new Blob([stageToJson(stage)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName = String(stage.name ?? "stage").replace(
    /[^\w\u3040-\u30ff\u4e00-\u9faf-]+/gu,
    "_"
  );
  anchor.href = url;
  anchor.download = `${safeName || "stage"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function saveStage(stage) {
  localStorage.setItem(STAGE_STORAGE_KEY, JSON.stringify(stage));
}

export function loadStage() {
  try {
    const json = localStorage.getItem(STAGE_STORAGE_KEY);
    if (!json) return null;
    return normalizeStage(JSON.parse(json));
  } catch {
    return null;
  }
}

export function loadActiveStage() {
  return loadStage() ?? buildDefaultStage();
}

export function enemyDefsToSpawn(enemies) {
  return enemies.map((e) => ({
    classKey: e.classKey,
    team: Team.ENEMY,
    x: e.x,
    y: e.y,
  }));
}
