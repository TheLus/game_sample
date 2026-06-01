import { WEAPON_ADVANTAGE } from "./config.js";
import { getTerrain } from "./pathfinding.js";
import { debugLog, unitLabel, unitSnapshot } from "./debug.js";

/** 試行錯誤型のゲーム設計のため、戦闘の命中は常に確定 */
export const COMBAT_HIT_RATE = 100;

function weaponModifier(attackerWeapon, defenderWeapon) {
  if (WEAPON_ADVANTAGE[attackerWeapon] === defenderWeapon) return 1;
  if (WEAPON_ADVANTAGE[defenderWeapon] === attackerWeapon) return -1;
  return 0;
}

function damageMultiplier(wpnMod) {
  if (wpnMod > 0) return 2;
  if (wpnMod < 0) return 0.5;
  return 1;
}

function calcDamage(attacker, defender, _map, terrainDef) {
  const wpnMod = weaponModifier(attacker.weapon, defender.weapon);
  const base = attacker.atk - (defender.def + terrainDef);
  const damage = Math.max(0, Math.floor(base * damageMultiplier(wpnMod)));
  return { damage, wpnMod };
}

export function previewCombat(attacker, defender, map, ax, ay, dx, dy) {
  const terrain = getTerrain(map, dx, dy);
  const terrainDef = defender.terrainDefBonus(terrain);
  const wpnMod = weaponModifier(attacker.weapon, defender.weapon);
  const { damage } = calcDamage(attacker, defender, map, terrainDef);

  return {
    hit: COMBAT_HIT_RATE,
    damage,
    wpnMod,
    terrainName: terrain?.name ?? "",
  };
}

export function executeCombat(attacker, defender, map, ax, ay, dx, dy, onMessage) {
  const terrain = getTerrain(map, dx, dy);
  const terrainDef = defender.terrainDefBonus(terrain);
  const { damage, wpnMod } = calcDamage(attacker, defender, map, terrainDef);
  const defenderHpBefore = defender.hp;

  const wpnText =
    wpnMod > 0 ? "（武器有利・2倍）" : wpnMod < 0 ? "（武器不利・半減）" : "";

  debugLog("combat", "攻撃", {
    attacker: unitSnapshot(attacker),
    defender: unitSnapshot(defender),
    terrain: terrain?.name ?? "?",
    terrainDef,
    weaponMod: wpnMod,
    hit: COMBAT_HIT_RATE,
    damage,
    defenderHpBefore,
  });

  defender.hp -= damage;
  onMessage(`${attacker.name}の攻撃！ ${damage}ダメージ${wpnText}`);
  debugLog(
    "combat",
    `命中 → ${unitLabel(defender)} HP ${defenderHpBefore} → ${defender.hp}`
  );
}
