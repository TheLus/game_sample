/** マップ・地形・ユニット種別の定義 */

export const TILE_SIZE = 32;
export const MAP_WIDTH = 16;
export const MAP_HEIGHT = 12;

/** 敵が反応する範囲（マンハッタン距離） */
export const ENEMY_AGGRO_RANGE = 5;

/** 配置フェーズの初期資金 */
export const STARTING_GOLD = 400;

export const Team = {
  PLAYER: "player",
  ENEMY: "enemy",
};

export const Terrain = {
  PLAIN: { id: 0, name: "平地", moveCost: 1, defBonus: 0, color: "#5a8f5a" },
  FOREST: { id: 1, name: "森", moveCost: 2, defBonus: 1, color: "#3d6b3d" },
  MOUNTAIN: { id: 2, name: "山", moveCost: 3, defBonus: 2, color: "#6b5a4a" },
  FORT: { id: 3, name: "砦", moveCost: 1, defBonus: 3, color: "#7a6a5a" },
  WALL: {
    id: 4,
    name: "壁",
    impassable: true,
    moveCost: 99,
    defBonus: 0,
    color: "#6b6b6b",
  },
  RIVER: {
    id: 5,
    name: "川",
    impassable: true,
    moveCost: 99,
    defBonus: 0,
    color: "#4a9ec4",
    waterStyle: "river",
  },
};

export const TERRAIN_BY_ID = Object.fromEntries(
  Object.values(Terrain)
    .filter((t) => t.id !== undefined)
    .map((t) => [t.id, t])
);

export function isImpassableTerrain(terrain) {
  return Boolean(terrain?.impassable);
}

export const Weapon = {
  SWORD: "sword",
  LANCE: "lance",
  AXE: "axe",
  BOW: "bow",
};

/** 三すくみ: 剣→斧→槍→剣（弓は対象外） */
export const WEAPON_ADVANTAGE = {
  [Weapon.SWORD]: Weapon.AXE,
  [Weapon.AXE]: Weapon.LANCE,
  [Weapon.LANCE]: Weapon.SWORD,
};

/** 旧 classKey → 現行（保存データ互換） */
export const CLASS_KEY_ALIASES = {
  SOLDIER: "LANCE",
  FIGHTER: "AXE",
  LORD: "SWORD",
};

export function resolveClassKey(classKey) {
  if (!classKey) return "SWORD";
  return CLASS_KEY_ALIASES[classKey] ?? classKey;
}

/** skill / speed / move は未使用（UI非表示・戦闘・移動ロジックに未反映） */
const MELEE_STATS = {
  move: 4,
  hp: 24,
  atk: 8,
  def: 3,
  skill: 4,
  speed: 6,
  cost: 90,
};

export const UnitClass = {
  SWORD: {
    name: "剣兵",
    symbol: "剣",
    weapon: Weapon.SWORD,
    ...MELEE_STATS,
  },
  AXE: {
    name: "斧兵",
    symbol: "斧",
    weapon: Weapon.AXE,
    ...MELEE_STATS,
  },
  LANCE: {
    name: "槍兵",
    symbol: "槍",
    weapon: Weapon.LANCE,
    ...MELEE_STATS,
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
    cost: 100,
  },
};

/** ショップで購入できるユニット（表示順: 剣→斧→槍→弓） */
export const SHOP_UNIT_KEYS = ["SWORD", "AXE", "LANCE", "ARCHER"];

/** ステージ定義用: 有効なショップユニット一覧（1種類以上） */
export function normalizeShopUnitKeys(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...SHOP_UNIT_KEYS];
  }
  const picked = new Set();
  const result = [];
  for (const key of raw) {
    const resolved = resolveClassKey(key);
    if (SHOP_UNIT_KEYS.includes(resolved) && !picked.has(resolved)) {
      picked.add(resolved);
      result.push(resolved);
    }
  }
  return result.length > 0 ? result : [...SHOP_UNIT_KEYS];
}

/** ステージエディタで配置できる敵（表示順） */
export const ENEMY_EDITOR_KEYS = ["SWORD", "AXE", "LANCE", "ARCHER"];

/** ステージエディタの地形ブラシ（表示順） */
export const TERRAIN_BRUSH_KEYS = [
  "PLAIN",
  "FOREST",
  "MOUNTAIN",
  "FORT",
  "WALL",
  "RIVER",
];

/** 地形IDの2次元マップ（5=川 は通行不可） */
export const DEFAULT_MAP = [
  [0, 0, 0, 1, 1, 0, 0, 5, 5, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 0, 3, 5, 5, 1, 1, 0, 0, 5, 5, 0],
  [0, 0, 0, 0, 0, 0, 3, 5, 5, 0, 0, 0, 5, 5, 5, 0],
  [0, 0, 0, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 5, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 5, 5, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 5, 5, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 5, 5, 0, 0, 0, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 5, 5, 0, 0, 0, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

/** 1=味方配置可能エリア */
export const DEPLOY_ZONES = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

export const INITIAL_ENEMIES = [
  { classKey: "AXE", team: Team.ENEMY, x: 12, y: 3 },
  { classKey: "LANCE", team: Team.ENEMY, x: 13, y: 4 },
  { classKey: "ARCHER", team: Team.ENEMY, x: 14, y: 5 },
  { classKey: "SWORD", team: Team.ENEMY, x: 12, y: 6 },
];
