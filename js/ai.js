import { Team, ENEMY_AGGRO_RANGE } from "./config.js";
import { getAttackTiles, getNextStepToward } from "./pathfinding.js";

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getPlayersInAggroRange(unit, units) {
  return units.filter(
    (u) =>
      u.isAlive &&
      u.team === Team.PLAYER &&
      manhattan(unit, u) <= ENEMY_AGGRO_RANGE
  );
}

/**
 * 敵ユニットを1マス動かす。
 * 周囲 ENEMY_AGGRO_RANGE 以内に味方がいない場合はその場に留まる。
 * いる場合は最寄りの味方へ1マス近づく（射程内なら移動しない）。
 */
export function stepEnemyUnit(map, unit, units) {
  const targets = getPlayersInAggroRange(unit, units);
  if (targets.length === 0) return false;

  const attackTiles = getAttackTiles(unit, unit.x, unit.y);
  const canAttackNow = targets.some((t) =>
    attackTiles.some((tile) => tile.x === t.x && tile.y === t.y)
  );
  if (canAttackNow) return false;

  const nearest = targets.reduce((a, b) =>
    manhattan(unit, a) <= manhattan(unit, b) ? a : b
  );

  const step = getNextStepToward(map, units, unit, nearest.x, nearest.y);
  if (!step) return false;

  unit.x = step.x;
  unit.y = step.y;
  return true;
}
