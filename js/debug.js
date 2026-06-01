/** ブラウザの開発者ツール → Console で移動・戦闘の流れを確認 */
export const DEBUG_GAME = true;

export function debugLog(category, message, data) {
  if (!DEBUG_GAME) return;
  if (data !== undefined) {
    console.log(`[game:${category}]`, message, data);
  } else {
    console.log(`[game:${category}]`, message);
  }
}

export function unitSnapshot(unit) {
  return {
    id: unit.id,
    name: unit.name,
    team: unit.team,
    classKey: unit.classKey,
    pos: { x: unit.x, y: unit.y },
    hp: unit.hp,
    maxHp: unit.maxHp,
    atk: unit.atk,
    def: unit.def,
    skill: unit.skill,
    speed: unit.speed,
    weapon: unit.weapon,
    attackRange: unit.attackRange,
    destination: unit.destination
      ? { x: unit.destination.x, y: unit.destination.y }
      : null,
  };
}

export function unitLabel(unit) {
  const team = unit.team === "player" ? "味方" : "敵";
  return `${unit.name}#${unit.id}(${team}) @(${unit.x},${unit.y}) HP${unit.hp}/${unit.maxHp}`;
}
