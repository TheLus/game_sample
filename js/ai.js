import { Team } from "./config.js";
import { getReachableTiles, getAttackTiles } from "./pathfinding.js";
import { previewCombat, executeCombat } from "./combat.js";

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function findBestMoveAndTarget(map, unit, units) {
  const players = units.filter((u) => u.isAlive && u.team === Team.PLAYER);
  if (players.length === 0) return null;

  const reachable = getReachableTiles(map, unit, units, unit.x, unit.y);
  let best = null;
  let bestScore = -Infinity;

  for (const [key, _cost] of reachable) {
    const [x, y] = key.split(",").map(Number);
    const attackTiles = getAttackTiles(unit, x, y);
    for (const target of players) {
      const inRange = attackTiles.some((t) => t.x === target.x && t.y === target.y);
      if (!inRange) continue;

      const preview = previewCombat(unit, target, map, x, y, target.x, target.y);
      const score =
        preview.damage * (preview.hit / 100) -
        (preview.counter?.damage ?? 0) * ((preview.counter?.hit ?? 0) / 100) +
        (preview.wpnMod > 0 ? 5 : 0);

      if (score > bestScore) {
        bestScore = score;
        best = { moveTo: { x, y }, target };
      }
    }
  }

  if (best) return best;

  const nearest = players.reduce((a, b) =>
    manhattan(unit, a) <= manhattan(unit, b) ? a : b
  );

  let closestDist = Infinity;
  let closestTile = null;

  for (const [key] of reachable) {
    const [x, y] = key.split(",").map(Number);
    const d = manhattan({ x, y }, nearest);
    if (d < closestDist) {
      closestDist = d;
      closestTile = { x, y };
    }
  }

  if (closestTile && (closestTile.x !== unit.x || closestTile.y !== unit.y)) {
    return { moveTo: closestTile, target: null };
  }

  return null;
}

export async function runEnemyTurn(game) {
  const enemies = game.units.filter(
    (u) => u.isAlive && u.team === Team.ENEMY && u.canAct
  );

  for (const unit of enemies) {
    if (!game.isPlaying) break;

    const plan = findBestMoveAndTarget(game.map, unit, game.units);
    if (!plan) {
      unit.hasMoved = true;
      unit.hasActed = true;
      continue;
    }

    unit.x = plan.moveTo.x;
    unit.y = plan.moveTo.y;
    unit.hasMoved = true;
    game.render();
    await game.delay(400);

    if (plan.target && plan.target.isAlive) {
      executeCombat(
        unit,
        plan.target,
        game.map,
        unit.x,
        unit.y,
        plan.target.x,
        plan.target.y,
        (msg) => game.setMessage(msg)
      );
      unit.hasActed = true;
      game.render();
      await game.delay(600);

      if (game.checkVictory()) return;
    } else {
      unit.hasActed = true;
    }
  }
}
