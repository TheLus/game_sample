import { Team, ENEMY_AGGRO_RANGE } from "./config.js";
import { getNextStepToward, hasAttackableFoe } from "./pathfinding.js";
import { debugLog, unitLabel } from "./debug.js";

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
  if (targets.length === 0) {
    debugLog("move", `${unitLabel(unit)} — 索敵範囲内に味方なし（移動なし）`);
    return false;
  }

  if (hasAttackableFoe(unit, units)) {
    debugLog("move", `${unitLabel(unit)} — 攻撃可能な敵がいるため移動しない`);
    return false;
  }

  const nearest = targets.reduce((a, b) =>
    manhattan(unit, a) <= manhattan(unit, b) ? a : b
  );

  const step = getNextStepToward(map, units, unit, nearest.x, nearest.y);
  if (!step) {
    debugLog("move", `${unitLabel(unit)} — 経路なし（目標: ${unitLabel(nearest)}）`);
    return false;
  }

  const from = { x: unit.x, y: unit.y };
  unit.x = step.x;
  unit.y = step.y;
  debugLog(
    "move",
    `${unitLabel(unit)} — (${from.x},${from.y}) → (${unit.x},${unit.y}) 目標: ${unitLabel(nearest)}`
  );
  return true;
}
