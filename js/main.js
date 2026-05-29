import { Game } from "./game.js";

const canvas = document.getElementById("gameCanvas");
const ui = {
  messageEl: document.getElementById("message"),
  phaseText: document.getElementById("phaseText"),
  unitInfo: document.getElementById("unitInfo"),
  startBattleBtn: document.getElementById("startBattleBtn"),
  restartBtn: document.getElementById("restartBtn"),
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
    el.innerHTML = `
      <p class="name">${display.name}（${display.team === "player" ? "味方" : "敵"}）</p>
      <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%"></div></div>
      <dl>
        <dt>HP</dt><dd>${display.hp} / ${display.maxHp}</dd>
        <dt>攻撃</dt><dd>${display.atk}</dd>
        <dt>防御</dt><dd>${display.def}</dd>
        <dt>射程</dt><dd>${display.attackRange}</dd>
        <dt>移動先</dt><dd>${display.isPlayer ? dest : "—"}</dd>
      </dl>
    `;
  },
};

new Game(canvas, ui);
