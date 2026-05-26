/** マップ・地形・ユニット種別の定義 */

export const TILE_SIZE = 32;
export const MAP_WIDTH = 16;
export const MAP_HEIGHT = 12;

export const Team = {
  PLAYER: "player",
  ENEMY: "enemy",
};

export const Terrain = {
  PLAIN: { id: 0, name: "平地", moveCost: 1, defBonus: 0, color: "#5a8f5a" },
  FOREST: { id: 1, name: "森", moveCost: 2, defBonus: 1, color: "#3d6b3d" },
  MOUNTAIN: { id: 2, name: "山", moveCost: 3, defBonus: 2, color: "#6b5a4a" },
  FORT: { id: 3, name: "砦", moveCost: 1, defBonus: 3, color: "#7a6a5a" },
  WALL: { id: 4, name: "壁", moveCost: 99, defBonus: 0, color: "#444" },
};

export const Weapon = {
  SWORD: "sword",
  LANCE: "lance",
  AXE: "axe",
  BOW: "bow",
};

/** 三すくみ: 剣→斧→槍→剣 */
export const WEAPON_ADVANTAGE = {
  [Weapon.SWORD]: Weapon.AXE,
  [Weapon.AXE]: Weapon.LANCE,
  [Weapon.LANCE]: Weapon.SWORD,
};

export const UnitClass = {
  LORD: {
    name: "君主",
    symbol: "君",
    weapon: Weapon.SWORD,
    move: 5,
    hp: 22,
    atk: 7,
    def: 4,
    skill: 8,
    speed: 9,
  },
  SOLDIER: {
    name: "兵士",
    symbol: "兵",
    weapon: Weapon.LANCE,
    move: 4,
    hp: 20,
    atk: 6,
    def: 5,
    skill: 5,
    speed: 5,
  },
  FIGHTER: {
    name: "戦士",
    symbol: "戦",
    weapon: Weapon.AXE,
    move: 4,
    hp: 24,
    atk: 8,
    def: 3,
    skill: 4,
    speed: 6,
  },
  ARCHER: {
    name: "弓兵",
    symbol: "弓",
    weapon: Weapon.BOW,
    move: 4,
    hp: 18,
    atk: 6,
    def: 2,
    skill: 7,
    speed: 7,
    range: 2,
  },
};

/** 地形IDの2次元マップ（0=平地, 1=森, ...） */
export const DEFAULT_MAP = [
  [0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 0, 3, 3, 0, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 2, 2, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

export const INITIAL_UNITS = [
  { classKey: "LORD", team: Team.PLAYER, x: 2, y: 5 },
  { classKey: "SOLDIER", team: Team.PLAYER, x: 3, y: 6 },
  { classKey: "ARCHER", team: Team.PLAYER, x: 2, y: 7 },
  { classKey: "FIGHTER", team: Team.ENEMY, x: 12, y: 3 },
  { classKey: "SOLDIER", team: Team.ENEMY, x: 13, y: 4 },
  { classKey: "ARCHER", team: Team.ENEMY, x: 14, y: 5 },
  { classKey: "FIGHTER", team: Team.ENEMY, x: 12, y: 6 },
];
