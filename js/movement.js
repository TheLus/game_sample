import { Team, ENEMY_AGGRO_RANGE } from "./config.js";
import { getNextStepToward, hasAttackableFoe } from "./pathfinding.js";
import { debugLog, unitLabel } from "./debug.js";

function samePos(a, b) {
  return a.x === b.x && a.y === b.y;
}

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
 * @returns {{ from: {x,y}, to: {x,y} } | null}
 */
export function getPlayerMoveIntent(map, units, unit) {
  if (!unit.destination) return null;
  if (hasAttackableFoe(unit, units)) return null;

  const { x: destX, y: destY } = unit.destination;
  if (unit.x === destX && unit.y === destY) return null;

  const step = getNextStepToward(map, units, unit, destX, destY);
  if (!step) return null;

  return { from: { x: unit.x, y: unit.y }, to: { x: step.x, y: step.y } };
}

/**
 * @returns {{ from: {x,y}, to: {x,y} } | null}
 */
export function getEnemyMoveIntent(map, unit, units) {
  const targets = getPlayersInAggroRange(unit, units);
  if (targets.length === 0) return null;
  if (hasAttackableFoe(unit, units)) return null;

  const nearest = targets.reduce((a, b) =>
    manhattan(unit, a) <= manhattan(unit, b) ? a : b
  );

  const step = getNextStepToward(map, units, unit, nearest.x, nearest.y);
  if (!step) return null;

  return { from: { x: unit.x, y: unit.y }, to: { x: step.x, y: step.y } };
}

function findUnitAt(pos, units, x, y, excludeId) {
  for (const u of units) {
    if (!u.isAlive || u.id === excludeId) continue;
    const p = pos.get(u.id);
    if (p && p.x === x && p.y === y) return u;
  }
  return null;
}

function unitListIndex(units, unitId) {
  const i = units.findIndex((u) => u.id === unitId);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/** aId の方が bId より先に同じマスへ入れる */
function winsMovePriority(units, aId, bId) {
  const a = units.find((u) => u.id === aId);
  const b = units.find((u) => u.id === bId);
  if (!a || !b) return aId < bId;
  if (a.isPlayer !== b.isPlayer) return a.isPlayer;
  return unitListIndex(units, aId) < unitListIndex(units, bId);
}

function electDestinationWinner(claimantIds, units) {
  return claimantIds.reduce((best, id) =>
    winsMovePriority(units, id, best) ? id : best
  );
}

function destKey(to) {
  return `${to.x},${to.y}`;
}

/**
 * 味方・敵を問わず、移動先にユニットがいる場合は待機。
 * 依存チェーンがループなら一括移動で解決。
 * @param {import("./units.js").Unit[]} units
 * @param {Map<number, { from: {x,y}, to: {x,y} }>} intents
 */
function traceChain(startId, intents, pos, units, pending) {
  const path = [];
  let current = startId;
  const indexById = new Map();

  while (true) {
    if (indexById.has(current)) {
      const start = indexById.get(current);
      return { kind: "cycle", ids: path.slice(start).map((p) => p.id) };
    }
    indexById.set(current, path.length);

    const intent = intents.get(current);
    if (!intent || samePos(intent.from, intent.to)) {
      return { kind: "blocked" };
    }

    path.push({ id: current });

    const { to } = intent;
    const occupant = findUnitAt(pos, units, to.x, to.y, current);

    if (!occupant) {
      return { kind: "chain_end_free", terminalId: current };
    }

    if (!pending.has(occupant.id)) {
      if (!findUnitAt(pos, units, to.x, to.y, current)) {
        return { kind: "chain_end_free", terminalId: current };
      }
      return { kind: "blocked" };
    }

    const occIntent = intents.get(occupant.id);
    if (!occIntent || samePos(occIntent.from, occIntent.to)) {
      return { kind: "blocked" };
    }

    current = occupant.id;
  }
}

export function resolveConcurrentMoves(units, intents) {
  const alive = units.filter((u) => u.isAlive);
  const pos = new Map(alive.map((u) => [u.id, { x: u.x, y: u.y }]));

  const pending = new Set();
  for (const [id, intent] of intents) {
    if (!samePos(intent.from, intent.to)) pending.add(id);
  }

  debugLog("move", `同時移動解決 — 対象 ${pending.size} 体`, {
    intents: [...intents.entries()].map(([id, i]) => ({
      id,
      from: i.from,
      to: i.to,
    })),
  });

  function canApplyInBatch(id, batch) {
    const intent = intents.get(id);
    if (!intent) return false;

    for (const otherId of pending) {
      if (otherId === id || batch.has(otherId)) continue;
      const other = intents.get(otherId);
      if (other && samePos(other.to, intent.to)) {
        if (!winsMovePriority(units, id, otherId)) return false;
      }
    }

    const occupant = findUnitAt(pos, alive, intent.to.x, intent.to.y, id);
    if (!occupant) return true;

    // 同一バッチ内の入れ替え（ループ）のみ重なり許可
    return batch.has(occupant.id);
  }

  let round = 0;
  while (pending.size > 0) {
    round++;
    const batch = new Set();
    const cyclesLogged = new Set();

    for (const id of pending) {
      const trace = traceChain(id, intents, pos, alive, pending);
      if (trace.kind === "cycle") {
        for (const cid of trace.ids) batch.add(cid);
        const cycleKey = [...trace.ids].sort((a, b) => a - b).join(",");
        if (!cyclesLogged.has(cycleKey)) {
          cyclesLogged.add(cycleKey);
          debugLog(
            "move",
            `ループ検出（一括移動）: ${trace.ids
              .map((cid) => {
                const u = alive.find((x) => x.id === cid);
                return u ? unitLabel(u) : cid;
              })
              .join(" → ")}`
          );
        }
      }
    }

    const freeCandidates = [];
    for (const id of pending) {
      if (batch.has(id)) continue;
      const trace = traceChain(id, intents, pos, alive, pending);
      if (trace.kind === "chain_end_free" && trace.terminalId === id) {
        freeCandidates.push(id);
      }
    }

    const byDest = new Map();
    for (const id of freeCandidates) {
      const to = intents.get(id).to;
      const key = destKey(to);
      if (!byDest.has(key)) byDest.set(key, []);
      byDest.get(key).push(id);
    }

    for (const [key, claimantIds] of byDest) {
      const winnerId = electDestinationWinner(claimantIds, units);
      batch.add(winnerId);
      if (claimantIds.length > 1) {
        const winner = units.find((u) => u.id === winnerId);
        const losers = claimantIds
          .filter((id) => id !== winnerId)
          .map((id) => units.find((u) => u.id === id))
          .filter(Boolean);
        debugLog(
          "move",
          `移動先 (${key}) の競合 — 優先: ${winner ? unitLabel(winner) : winnerId}`,
          {
            reason: winner?.isPlayer
              ? "味方優先"
              : "同一陣営・units配列のindex順",
            waiting: losers.map((u) => unitLabel(u)),
          }
        );
      }
    }

    for (const id of [...batch]) {
      if (!canApplyInBatch(id, batch)) batch.delete(id);
    }

    if (batch.size === 0) {
      debugLog(
        "move",
        `移動待ちで停止（ラウンド ${round}）`,
        [...pending].map((id) => {
          const u = alive.find((x) => x.id === id);
          return u ? unitLabel(u) : id;
        })
      );
      break;
    }

    for (const id of batch) {
      const intent = intents.get(id);
      const unit = alive.find((u) => u.id === id);
      const before = pos.get(id);
      pos.set(id, { x: intent.to.x, y: intent.to.y });
      pending.delete(id);
      if (unit) {
        debugLog(
          "move",
          `${unitLabel(unit)} — (${before.x},${before.y}) → (${intent.to.x},${intent.to.y}) [ラウンド ${round}]`
        );
      }
    }

    const seen = new Map();
    for (const u of alive) {
      const p = pos.get(u.id);
      const key = `${p.x},${p.y}`;
      if (seen.has(key)) {
        debugLog(
          "move",
          `警告: 重なり検出 @(${p.x},${p.y}) — ${unitLabel(u)} と ${unitLabel(seen.get(key))}`
        );
      } else {
        seen.set(key, u);
      }
    }
  }

  for (const u of alive) {
    const p = pos.get(u.id);
    if (p) {
      u.x = p.x;
      u.y = p.y;
    }
  }
}

export function resolveCombatMovement(map, units) {
  debugLog("move", "--- 移動フェーズ ---");
  const intents = new Map();

  for (const unit of units.filter((u) => u.isAlive && u.isPlayer)) {
    if (
      unit.destination &&
      unit.x === unit.destination.x &&
      unit.y === unit.destination.y
    ) {
      unit.clearDestination();
      debugLog("move", `${unitLabel(unit)} — 移動先に到達済み`);
      continue;
    }

    const intent = getPlayerMoveIntent(map, units, unit);
    if (intent) {
      intents.set(unit.id, intent);
    } else if (!unit.destination) {
      debugLog("move", `${unitLabel(unit)} — 移動先なし`);
    } else if (hasAttackableFoe(unit, units)) {
      debugLog("move", `${unitLabel(unit)} — 攻撃可能な敵がいるため移動しない`);
    } else {
      debugLog("move", `${unitLabel(unit)} — 経路なしまたは移動なし`);
    }
  }

  for (const unit of units.filter((u) => u.isAlive && !u.isPlayer)) {
    const intent = getEnemyMoveIntent(map, unit, units);
    if (intent) {
      intents.set(unit.id, intent);
    } else {
      const targets = getPlayersInAggroRange(unit, units);
      if (targets.length === 0) {
        debugLog("move", `${unitLabel(unit)} — 索敵範囲内に味方なし`);
      } else if (hasAttackableFoe(unit, units)) {
        debugLog("move", `${unitLabel(unit)} — 攻撃可能な敵がいるため移動しない`);
      } else {
        debugLog("move", `${unitLabel(unit)} — 経路なし`);
      }
    }
  }

  resolveConcurrentMoves(units, intents);

  for (const unit of units.filter((u) => u.isAlive && u.isPlayer && u.destination)) {
    if (
      unit.x === unit.destination.x &&
      unit.y === unit.destination.y
    ) {
      unit.clearDestination();
    }
  }
}
