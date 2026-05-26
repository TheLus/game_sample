import { UnitClass, Team } from "./config.js";

let nextId = 1;

export class Unit {
  constructor({ classKey, team, x, y }) {
    const template = UnitClass[classKey];
    this.id = nextId++;
    this.classKey = classKey;
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
    this.x = x;
    this.y = y;
    this.hasMoved = false;
    this.hasActed = false;
  }

  get isPlayer() {
    return this.team === Team.PLAYER;
  }

  get canAct() {
    return !this.hasMoved || !this.hasActed;
  }

  get isAlive() {
    return this.hp > 0;
  }

  resetTurn() {
    this.hasMoved = false;
    this.hasActed = false;
  }

  terrainDefBonus(terrain) {
    return terrain.defBonus;
  }
}

export function createUnits(definitions) {
  return definitions.map((d) => new Unit(d));
}
