import { WEAPON_ADVANTAGE } from "./config.js";
import { getTerrain } from "./pathfinding.js";

function weaponModifier(attackerWeapon, defenderWeapon) {
  if (WEAPON_ADVANTAGE[attackerWeapon] === defenderWeapon) return 1;
  if (WEAPON_ADVANTAGE[defenderWeapon] === attackerWeapon) return -1;
  return 0;
}

function hitRate(attacker, defender, wpnMod) {
  const base = 90 + (attacker.skill - defender.speed) * 2;
  const bonus = wpnMod > 0 ? 15 : wpnMod < 0 ? -15 : 0;
  return Math.min(100, Math.max(0, base + bonus));
}

function calcDamage(attacker, defender, map, terrainDef) {
  const wpnMod = weaponModifier(attacker.weapon, defender.weapon);
  const atkBonus = wpnMod > 0 ? 2 : wpnMod < 0 ? -2 : 0;
  const raw = attacker.atk + atkBonus - (defender.def + terrainDef);
  return { damage: Math.max(0, raw), wpnMod };
}

function rollHit(rate) {
  return Math.random() * 100 < rate;
}

export function previewCombat(attacker, defender, map, ax, ay, dx, dy) {
  const terrain = getTerrain(map, dx, dy);
  const terrainDef = defender.terrainDefBonus(terrain);
  const wpnMod = weaponModifier(attacker.weapon, defender.weapon);
  const hit = hitRate(attacker, defender, wpnMod);
  const { damage } = calcDamage(attacker, defender, map, terrainDef);

  let counter = null;
  const dist =
    Math.abs(ax - dx) + Math.abs(ay - dy);
  if (dist <= defender.attackRange && defender.hp - damage > 0) {
    const counterTerrain = getTerrain(map, ax, ay);
    const counterDef = attacker.terrainDefBonus(counterTerrain);
    const cw = weaponModifier(defender.weapon, attacker.weapon);
    const counterHit = hitRate(defender, attacker, cw);
    const counterDmg = calcDamage(defender, attacker, map, counterDef);
    counter = { hit: counterHit, damage: counterDmg.damage, wpnMod: cw };
  }

  return { hit, damage, wpnMod, counter, terrainName: terrain?.name ?? "" };
}

export function executeCombat(attacker, defender, map, ax, ay, dx, dy, onMessage) {
  const terrain = getTerrain(map, dx, dy);
  const terrainDef = defender.terrainDefBonus(terrain);
  const { damage, wpnMod } = calcDamage(attacker, defender, map, terrainDef);
  const hit = hitRate(attacker, defender, wpnMod);

  const wpnText =
    wpnMod > 0 ? "（武器有利）" : wpnMod < 0 ? "（武器不利）" : "";

  if (rollHit(hit)) {
    defender.hp = Math.max(0, defender.hp - damage);
    onMessage(`${attacker.name}の攻撃！ ${damage}ダメージ${wpnText}`);
  } else {
    onMessage(`${attacker.name}の攻撃は外れた！`);
    return { attacker, defender, killed: false };
  }

  if (defender.hp <= 0) {
    onMessage(`${defender.name}を撃破！`);
    return { attacker, defender, killed: true };
  }

  const dist = Math.abs(ax - dx) + Math.abs(ay - dy);
  if (dist <= defender.attackRange) {
    const counterTerrain = getTerrain(map, ax, ay);
    const counterDef = attacker.terrainDefBonus(counterTerrain);
    const cw = weaponModifier(defender.weapon, attacker.weapon);
    const counterHit = hitRate(defender, attacker, cw);
    const { damage: counterDmg } = calcDamage(defender, attacker, map, counterDef);

    if (rollHit(counterHit)) {
      attacker.hp = Math.max(0, attacker.hp - counterDmg);
      onMessage(`${defender.name}の反撃！ ${counterDmg}ダメージ`);
      if (attacker.hp <= 0) {
        onMessage(`${attacker.name}が倒れた…`);
        return { attacker, defender, killed: true };
      }
    } else {
      onMessage(`${defender.name}の反撃は外れた`);
    }
  }

  return { attacker, defender, killed: defender.hp <= 0 };
}
