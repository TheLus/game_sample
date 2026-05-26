import { Terrain } from "./config.js";

const TERRAIN_BY_ID = Object.values(Terrain).filter((t) => t.id !== undefined);

export function getTerrain(map, x, y) {
  if (x < 0 || y < 0 || x >= map[0].length || y >= map.length) return null;
  return TERRAIN_BY_ID[map[y][x]] ?? Terrain.PLAIN;
}

export function getReachableTiles(map, unit, units, startX, startY) {
  const occupied = new Set(
    units.filter((u) => u.isAlive && u.id !== unit.id).map((u) => `${u.x},${u.y}`)
  );
  const dist = new Map();
  const queue = [{ x: startX, y: startY, cost: 0 }];
  dist.set(`${startX},${startY}`, 0);

  while (queue.length > 0) {
    const { x, y, cost } = queue.shift();
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];

    for (const [nx, ny] of neighbors) {
      const terrain = getTerrain(map, nx, ny);
      if (!terrain || terrain.moveCost >= 99) continue;

      const key = `${nx},${ny}`;
      const newCost = cost + terrain.moveCost;
      if (newCost > unit.moveRange) continue;
      if (occupied.has(key) && !(nx === unit.x && ny === unit.y)) continue;
      if (dist.has(key) && dist.get(key) <= newCost) continue;

      dist.set(key, newCost);
      queue.push({ x: nx, y: ny, cost: newCost });
    }
  }

  return dist;
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
