import { Terrain, TERRAIN_BY_ID, isImpassableTerrain } from "./config.js";

export function getTerrain(map, x, y) {
  if (x < 0 || y < 0 || x >= map[0].length || y >= map.length) return null;
  return TERRAIN_BY_ID[map[y][x]] ?? Terrain.PLAIN;
}

/** 地形のみで通行可能か（経路探索はユニットを無視する） */
export function isTerrainWalkable(map, x, y) {
  const terrain = getTerrain(map, x, y);
  return Boolean(terrain && !isImpassableTerrain(terrain));
}

/** @deprecated 互換用。ユニットは考慮しない（isTerrainWalkable と同じ） */
export function isWalkable(map, _units, _unit, x, y) {
  return isTerrainWalkable(map, x, y);
}

function findPathParents(map, unit, destX, destY) {
  const startKey = `${unit.x},${unit.y}`;
  const destKey = `${destX},${destY}`;

  if (startKey === destKey) {
    return { parent: new Map([[startKey, null]]), found: true, startKey, destKey };
  }

  const destTerrain = getTerrain(map, destX, destY);
  if (isImpassableTerrain(destTerrain)) {
    return { parent: new Map([[startKey, null]]), found: false, startKey, destKey };
  }

  const queue = [{ x: unit.x, y: unit.y }];
  const parent = new Map([[startKey, null]]);
  let found = false;

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    const key = `${x},${y}`;
    if (key === destKey) {
      found = true;
      break;
    }

    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      const nkey = `${nx},${ny}`;
      if (parent.has(nkey)) continue;

      if (!isTerrainWalkable(map, nx, ny)) continue;

      parent.set(nkey, key);
      queue.push({ x: nx, y: ny });
    }
  }

  return { parent, found, startKey, destKey };
}

/**
 * 現在地から目的地までの経路（開始マス除く、目的地を含む）
 * @returns {{ x: number, y: number }[] | null}
 */
export function getPathToward(map, _units, unit, destX, destY) {
  const { parent, found, startKey, destKey } = findPathParents(
    map,
    unit,
    destX,
    destY
  );

  if (!found) return null;
  if (startKey === destKey) return [];

  const path = [];
  let current = destKey;
  while (current !== startKey) {
    const [x, y] = current.split(",").map(Number);
    path.unshift({ x, y });
    current = parent.get(current);
    if (current === undefined) return null;
  }

  return path;
}

/** 目的地へ向けて進む最初の1マス（BFS） */
export function getNextStepToward(map, units, unit, destX, destY) {
  const path = getPathToward(map, units, unit, destX, destY);
  return path && path.length > 0 ? path[0] : null;
}

export function getAdjacentTiles(map, units, unit) {
  const tiles = [{ x: unit.x, y: unit.y }];
  for (const [nx, ny] of [
    [unit.x + 1, unit.y],
    [unit.x - 1, unit.y],
    [unit.x, unit.y + 1],
    [unit.x, unit.y - 1],
  ]) {
    if (isWalkable(map, units, unit, nx, ny)) {
      tiles.push({ x: nx, y: ny });
    }
  }
  return tiles;
}

/** マンハッタン距離で range 以内のマス（中心マスは含めない） */
export function getTilesInManhattanRange(cx, cy, range, mapWidth, mapHeight) {
  const tiles = [];
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist === 0 || dist > range) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) continue;
      tiles.push({ x, y, dist });
    }
  }
  return tiles;
}

export function getAttackTiles(unit, fromX, fromY) {
  const tiles = [];
  const range = unit.attackRange;

  if (range === 1) {
    const adj = [
      [fromX + 1, fromY],
      [fromX - 1, fromY],
      [fromX, fromY + 1],
      [fromX, fromY - 1],
    ];
    for (const [x, y] of adj) tiles.push({ x, y });
  } else {
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        if (dx === 0 && dy === 0) continue;
        const manhattan = Math.abs(dx) + Math.abs(dy);
        if (manhattan <= range && manhattan >= 1) {
          tiles.push({ x: fromX + dx, y: fromY + dy });
        }
      }
    }
  }

  return tiles;
}

/** 現在地から攻撃できる敵がいるか */
export function hasAttackableFoe(unit, units) {
  const attackTiles = getAttackTiles(unit, unit.x, unit.y);
  return units.some(
    (u) =>
      u.isAlive &&
      u.team !== unit.team &&
      attackTiles.some((t) => t.x === u.x && t.y === u.y)
  );
}
