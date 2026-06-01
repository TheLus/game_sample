import { Game } from "./game.js";
import { UnitClass, SHOP_UNIT_KEYS, Weapon } from "./config.js";
import { fillStageSelect, getGameStageId, setGameStageId } from "./stage.js";

const WEAPON_LABELS = {
  [Weapon.SWORD]: "剣",
  [Weapon.AXE]: "斧",
  [Weapon.LANCE]: "槍",
  [Weapon.BOW]: "弓",
};

const canvas = document.getElementById("gameCanvas");
const ui = {
  messageEl: document.getElementById("message"),
  goldText: document.getElementById("goldText"),
  unitInfo: document.getElementById("unitInfo"),
  unitShop,
  unitShopBar: document.getElementById("unitShopBar"),
  startBattleBtn: document.getElementById("startBattleBtn"),
  turnSpeedSlider: document.getElementById("turnSpeedSlider"),
  turnSpeedLabel: document.getElementById("turnSpeedLabel"),
  restartBtn: document.getElementById("restartBtn"),
  gameStageSelect: document.getElementById("gameStageSelect"),
  unitActions: document.getElementById("unitActions"),
  clearDestBtn: document.getElementById("clearDestBtn"),
  sellUnitBtn: document.getElementById("sellUnitBtn"),

  renderGold(gold) {
    this.goldText.textContent = `資金: ${gold}G`;
  },

  renderShop(shopUnitKeys, selectedKey, gold, enabled) {
    const keys = shopUnitKeys?.length ? shopUnitKeys : SHOP_UNIT_KEYS;
    this.unitShop.innerHTML = keys
      .map(
        (key) =>
          `<button type="button" class="shop-btn" data-class-key="${key}">
      <span class="shop-name">${UnitClass[key].symbol} ${UnitClass[key].name}</span>
      <span class="shop-cost">${UnitClass[key].cost}G</span>
    </button>`
      )
      .join("");

    for (const btn of this.unitShop.querySelectorAll(".shop-btn")) {
      const key = btn.dataset.classKey;
      const cost = UnitClass[key].cost;
      btn.classList.toggle("selected", key === selectedKey);
      btn.disabled = !enabled || gold < cost;
    }
  },

  renderClassPreview(classKey) {
    const t = UnitClass[classKey];
    if (!t) {
      return '<p class="placeholder">ユニットを選択してください</p>';
    }
    const range = t.range ?? 1;
    return `
      <p class="name">${t.symbol} ${t.name}（配置前）</p>
      <div class="hp-bar"><div class="hp-fill" style="width:100%"></div></div>
      <dl>
        <dt>HP</dt><dd>${t.hp}</dd>
        <dt>攻撃</dt><dd>${t.atk}</dd>
        <dt>防御</dt><dd>${t.def}</dd>
        <dt>射程</dt><dd>${range}</dd>
        <dt>武器</dt><dd>${WEAPON_LABELS[t.weapon] ?? t.weapon}</dd>
        <dt>配置コスト</dt><dd>${t.cost}G</dd>
      </dl>
    `;
  },

  renderUnitInfo(unit, selected, shopClassKey) {
    const el = this.unitInfo;

    if (selected?.isAlive) {
      const hpPct = Math.round((selected.hp / selected.maxHp) * 100);
      const dest = selected.destination
        ? `(${selected.destination.x}, ${selected.destination.y})`
        : "なし";
      const costLine = selected.isPlayer
        ? `<dt>配置コスト</dt><dd>${selected.deployCost}G</dd>`
        : "";
      const weaponLine = selected.weapon
        ? `<dt>武器</dt><dd>${WEAPON_LABELS[selected.weapon] ?? selected.weapon}</dd>`
        : "";
      el.innerHTML = `
        <p class="name">${selected.name}（${selected.team === "player" ? "味方" : "敵"}）</p>
        <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div></div>
        <dl>
          <dt>HP</dt><dd>${selected.hp} / ${selected.maxHp}</dd>
          <dt>攻撃</dt><dd>${selected.atk}</dd>
          <dt>防御</dt><dd>${selected.def}</dd>
          <dt>射程</dt><dd>${selected.attackRange}</dd>
          ${weaponLine}
          ${costLine}
          <dt>移動先</dt><dd>${selected.isPlayer ? dest : "—"}</dd>
        </dl>
      `;
      return;
    }

    if (shopClassKey) {
      el.innerHTML = this.renderClassPreview(shopClassKey);
      return;
    }

    if (unit?.isAlive) {
      const hpPct = Math.round((unit.hp / unit.maxHp) * 100);
      el.innerHTML = `
        <p class="name">${unit.name}（${unit.team === "player" ? "味方" : "敵"}）</p>
        <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div></div>
        <dl>
          <dt>HP</dt><dd>${unit.hp} / ${unit.maxHp}</dd>
          <dt>攻撃</dt><dd>${unit.atk}</dd>
          <dt>防御</dt><dd>${unit.def}</dd>
          <dt>射程</dt><dd>${unit.attackRange}</dd>
        </dl>
      `;
      return;
    }

    el.innerHTML = '<p class="placeholder">下のユニットを選ぶか、マスを選択してください</p>';
  },
};

fillStageSelect(ui.gameStageSelect, getGameStageId());

const game = new Game(canvas, ui);

ui.gameStageSelect?.addEventListener("change", () => {
  const id = ui.gameStageSelect.value;
  if (!setGameStageId(id)) return;
  game.restartForStage();
  fillStageSelect(ui.gameStageSelect, id);
});
