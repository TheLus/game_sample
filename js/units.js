import { UnitClass, Team, resolveClassKey } from "./config.js";

let nextId = 1;

export function resetUnitIds() {
  nextId = 1;
}

export class Unit {
  constructor({ classKey, team, x, y }) {
    const key = resolveClassKey(classKey);
    const template = UnitClass[key];
    if (!template) {
      throw new Error(`Unknown unit class: ${classKey}`);
    }
    this.id = nextId++;
    this.classKey = key;
    this.name = template.name;
    this.symbol = template.symbol;
    this.team = team;
    this.weapon = template.weapon;
    this.moveRange = template.move;
    this.maxHp = template.hp;
    this.hp = template.hp;
    this.atk = template.atk;
    this.def = template.def;
    this.skill = template.skill;
    this.speed = template.speed;
    this.attackRange = template.range ?? 1;
    this.deployCost = template.cost ?? 0;
    this.x = x;
    this.y = y;
    /** @type {{ x: number, y: number } | null} 味方のみ使用 */
    this.destination = null;
  }

  get isPlayer() {
    return this.team === Team.PLAYER;
  }

  get isAlive() {
    return this.hp > 0;
  }

  clearDestination() {
    this.destination = null;
  }

  terrainDefBonus(terrain) {
    return terrain.defBonus;
  }
}

export function createUnit(definition) {
  return new Unit(definition);
}

export function createUnits(definitions) {
  return definitions.map((d) => createUnit(d));
}
