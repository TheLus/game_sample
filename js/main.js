import { Game } from "./game.js";
import { UnitClass, SHOP_UNIT_KEYS } from "./config.js";

const canvas = document.getElementById("gameCanvas");
const unitShop = document.getElementById("unitShop");

unitShop.innerHTML = SHOP_UNIT_KEYS.map(
  (key) =>
    `<button type="button" class="shop-btn" data-class-key="${key}">
      <span class="shop-name">${UnitClass[key].symbol} ${UnitClass[key].name}</span>
      <span class="shop-cost">${UnitClass[key].cost}G</span>
    </button>`
).join("");

const ui = {
  messageEl: document.getElementById("message"),
  goldText: document.getElementById("goldText"),
  unitInfo: document.getElementById("unitInfo"),
  unitShop,
  unitShopBar: document.getElementById("unitShopBar"),
  startBattleBtn: document.getElementById("startBattleBtn"),
  restartBtn: document.getElementById("restartBtn"),

  renderGold(gold) {
    this.goldText.textContent = `資金: ${gold}G`;
  },

  renderShop(selectedKey, gold, enabled) {
    for (const btn of this.unitShop.querySelectorAll(".shop-btn")) {
      const key = btn.dataset.classKey;
      const cost = UnitClass[key].cost;
      btn.classList.toggle("selected", key === selectedKey);
      btn.disabled = !enabled || gold < cost;
    }
  },

  renderUnitInfo(unit, selected) {
    const el = this.unitInfo;
    const display = selected ?? unit;
    if (!display) {
      el.innerHTML = '<p class="placeholder">マスを選択してください</p>';
      return;
    }
    const hpPct = Math.round((display.hp / display.maxHp) * 100);
    const dest = display.destination
      ? `(${display.destination.x}, ${display.destination.y})`
      : "なし";
    const costLine = display.isPlayer
      ? `<dt>配置コスト</dt><dd>${display.deployCost}G</dd>`
      : "";
    el.innerHTML = `
      <p class="name">${display.name}（${display.team === "player" ? "味方" : "敵"}）</p>
      <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div></div>
      <dl>
        <dt>HP</dt><dd>${display.hp} / ${display.maxHp}</dd>
        <dt>攻撃</dt><dd>${display.atk}</dd>
        <dt>防御</dt><dd>${display.def}</dd>
        <dt>射程</dt><dd>${display.attackRange}</dd>
        ${costLine}
        <dt>移動先</dt><dd>${display.isPlayer ? dest : "—"}</dd>
      </dl>
    `;
  },
};

new Game(canvas, ui);
