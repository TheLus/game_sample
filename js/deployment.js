import { isImpassableTerrain } from "./config.js";
import { getTerrain } from "./pathfinding.js";

export function isDeployZone(deployZones, x, y) {
  if (y < 0 || x < 0 || y >= deployZones.length || x >= deployZones[0].length) {
    return false;
  }
  return deployZones[y][x] === 1;
}

export function canDeployAt(map, deployZones, units, x, y, excludeUnitId = null) {
  if (!isDeployZone(deployZones, x, y)) return false;
  if (isImpassableTerrain(getTerrain(map, x, y))) return false;
  if (
    units.some(
      (u) =>
        u.isAlive &&
        u.id !== excludeUnitId &&
        u.x === x &&
        u.y === y
    )
  ) {
    return false;
  }
  return true;
}
