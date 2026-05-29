import {
  DEFAULT_MAP,
  INITIAL_UNITS,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_SIZE,
} from "./config.js";
import { createUnits } from "./units.js";
import {
  getNextStepToward,
  getPathToward,
  getAttackTiles,
  getTerrain,
  isWalkable,
} from "./pathfinding.js";
import { isImpassableTerrain } from "./config.js";
import { executeCombat, previewCombat } from "./combat.js";
import { stepEnemyUnit } from "./ai.js";
import { Renderer } from "./renderer.js";

const TICK_MS = 1000;
const STALE_TURN_LIMIT = 3;

export const GamePhase = {
  INSTRUCTION: "instruction",
  COMBAT: "combat",
  GAME_OVER: "game_over",
};

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.map = DEFAULT_MAP.map((row) => [...row]);
    this.units = [];
    this.selectedUnit = null;
    this.cursor = { x: 0, y: 0 };
    this.phase = GamePhase.INSTRUCTION;
    this.combatTurn = 0;
    this.staleTurns = 0;
    this.previousTurnState = null;
    this.tickTimer = null;

    this.bindEvents();
    this.start();
  }

  start() {
    this.stopTickLoop();
    this.units = createUnits(INITIAL_UNITS);
    this.selectedUnit = null;
    this.phase = GamePhase.INSTRUCTION;
    this.combatTurn = 0;
    this.staleTurns = 0;
    this.previousTurnState = null;
    this.ui.restartBtn.hidden = true;
    this.setMessage("指示フェーズ — 味方の移動先を指定し「戦闘開始」を押してください");
    this.updateUI();
    this.render();
  }

  isInstructionPhase() {
    return this.phase === GamePhase.INSTRUCTION;
  }

  isCombatPhase() {
    return this.phase === GamePhase.COMBAT;
  }

  stopTickLoop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  bindEvents() {
    this.canvas.addEventListener("click", (e) => this.onClick(e));
    document.addEventListener("keydown", (e) => this.onKeyDown(e));
    this.ui.restartBtn.addEventListener("click", () => this.start());
    this.ui.startBattleBtn.addEventListener("click", () => this.startCombatPhase());
  }

  setMessage(msg) {
    this.ui.messageEl.textContent = msg;
  }

  captureState() {
    return JSON.stringify(
      this.units.map((u) => ({
        id: u.id,
        hp: u.hp,
        x: u.x,
        y: u.y,
      }))
    );
  }

  getMovementPaths() {
    if (!this.isInstructionPhase()) return [];

    const paths = [];

    for (const unit of this.units.filter(
      (u) => u.isAlive && u.isPlayer && u.destination
    )) {
      const path = getPathToward(
        this.map,
        this.units,
        unit,
        unit.destination.x,
        unit.destination.y
      );
      if (path && path.length > 0) {
        paths.push({ unit, path });
      }
    }

    if (this.selectedUnit?.isAlive) {
      const { x, y } = this.cursor;
      const u = this.selectedUnit;
      const sameAsOrder =
        u.destination?.x === x && u.destination?.y === y;
      const canPreview =
        !sameAsOrder &&
        isWalkable(this.map, this.units, u, x, y) &&
        (x !== u.x || y !== u.y);
      if (canPreview) {
        const preview = getPathToward(this.map, this.units, u, x, y);
        if (preview && preview.length > 0) {
          paths.push({ unit: u, path: preview, preview: true });
        }
      }
    }

    return paths;
  }

  render() {
    this.renderer.draw({
      map: this.map,
      units: this.units,
      cursor: this.cursor,
      selectedUnit: this.selectedUnit,
      movementPaths: this.getMovementPaths(),
    });
  }

  updateUI() {
    const phaseEl = this.ui.phaseText;

    if (this.phase === GamePhase.GAME_OVER) {
      phaseEl.textContent = "クリア";
      phaseEl.className = "phase-text";
    } else if (this.isInstructionPhase()) {
      phaseEl.textContent = "指示フェーズ";
      phaseEl.className = "phase-text player";
    } else {
      phaseEl.textContent = `戦闘フェーズ（${this.combatTurn}ターン）`;
      phaseEl.className = "phase-text enemy";
    }

    this.ui.startBattleBtn.disabled = !this.isInstructionPhase();
    this.ui.startBattleBtn.hidden = this.phase === GamePhase.GAME_OVER;

    const unit = this.getUnitAt(this.cursor.x, this.cursor.y);
    this.ui.renderUnitInfo(unit, this.selectedUnit);
  }

  getUnitAt(x, y) {
    return this.units.find((u) => u.isAlive && u.x === x && u.y === y) ?? null;
  }

  canvasToTile(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / TILE_SIZE);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / TILE_SIZE);
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
    return { x, y };
  }

  onClick(e) {
    if (!this.isInstructionPhase()) return;
    const tile = this.canvasToTile(e);
    if (!tile) return;
    this.cursor = tile;
    this.handlePlayerInput(tile);
    this.updateUI();
    this.render();
  }

  onKeyDown(e) {
    if (this.phase === GamePhase.GAME_OVER) return;

    const moves = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };

    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      this.cursor.x = Math.max(0, Math.min(MAP_WIDTH - 1, this.cursor.x + dx));
      this.cursor.y = Math.max(0, Math.min(MAP_HEIGHT - 1, this.cursor.y + dy));
      this.updateUI();
      this.render();
      return;
    }

    if (e.key === "Enter" && this.isInstructionPhase()) {
      this.handlePlayerInput({ ...this.cursor });
      this.updateUI();
      this.render();
      return;
    }

    if (e.key === "Escape" && this.isInstructionPhase()) {
      if (this.selectedUnit) {
        this.selectedUnit = null;
        this.setMessage("選択を解除しました");
      }
      this.updateUI();
      this.render();
    }
  }

  handlePlayerInput(tile) {
    const { x, y } = tile;
    const clickedUnit = this.getUnitAt(x, y);

    if (clickedUnit?.isPlayer) {
      this.selectedUnit = clickedUnit;
      this.setMessage(`${clickedUnit.name}を選択。移動先を指定してください`);
      return;
    }

    if (!this.selectedUnit) {
      this.setMessage("先に味方ユニットを選んでください");
      return;
    }

    if (clickedUnit && !clickedUnit.isPlayer) {
      this.setMessage("移動先には指定できません");
      return;
    }

    if (!isWalkable(this.map, this.units, this.selectedUnit, x, y)) {
      const terrain = getTerrain(this.map, x, y);
      if (isImpassableTerrain(terrain)) {
        this.setMessage(`${terrain.name}のため移動先に指定できません`);
      } else {
        this.setMessage("他のユニットがいるマスには指定できません");
      }
      return;
    }

    if (this.selectedUnit.x === x && this.selectedUnit.y === y) {
      this.selectedUnit.clearDestination();
      this.setMessage(`${this.selectedUnit.name}の移動指示を解除しました`);
      return;
    }

    const path = getPathToward(this.map, this.units, this.selectedUnit, x, y);
    if (!path || path.length === 0) {
      this.setMessage("そこへは到達できません");
      return;
    }

    this.selectedUnit.destination = { x, y };
    this.setMessage(
      `${this.selectedUnit.name} → (${x}, ${y}) へ向かうよう指示しました`
    );
  }

  startCombatPhase() {
    if (!this.isInstructionPhase()) return;

    this.phase = GamePhase.COMBAT;
    this.combatTurn = 0;
    this.staleTurns = 0;
    this.previousTurnState = this.captureState();
    this.selectedUnit = null;

    this.setMessage("戦闘フェーズ開始！（1秒に1ターン）");
    this.updateUI();
    this.render();

    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
  }

  returnToInstruction(reason) {
    this.stopTickLoop();

    const playersWiped = !this.units.some((u) => u.isAlive && u.isPlayer);
    if (playersWiped) {
      this.units = createUnits(INITIAL_UNITS);
    } else {
      for (const u of this.units.filter((u) => u.isPlayer)) {
        u.clearDestination();
      }
    }

    this.phase = GamePhase.INSTRUCTION;
    this.combatTurn = 0;
    this.staleTurns = 0;
    this.previousTurnState = null;
    this.selectedUnit = null;

    this.setMessage(`${reason} — 指示フェーズに戻りました`);
    this.updateUI();
    this.render();
  }

  tick() {
    if (!this.isCombatPhase()) return;

    this.combatTurn++;

    this.movePlayerUnits();
    this.moveEnemyUnits();
    this.resolveCombat();

    if (this.phase === GamePhase.GAME_OVER) return;

    if (!this.units.some((u) => u.isAlive && u.isPlayer)) {
      this.returnToInstruction("味方が全滅しました");
      return;
    }

    const stateAfter = this.captureState();
    if (stateAfter === this.previousTurnState) {
      this.staleTurns++;
    } else {
      this.staleTurns = 0;
    }
    this.previousTurnState = stateAfter;

    if (this.staleTurns >= STALE_TURN_LIMIT) {
      this.returnToInstruction("3ターン連続で変化がありませんでした");
      return;
    }

    this.setMessage(`戦闘フェーズ — ターン ${this.combatTurn}`);
    this.updateUI();
    this.render();
  }

  movePlayerUnits() {
    for (const unit of this.units.filter((u) => u.isAlive && u.isPlayer)) {
      if (!unit.destination) continue;

      const { x: destX, y: destY } = unit.destination;
      if (unit.x === destX && unit.y === destY) {
        unit.clearDestination();
        continue;
      }

      const step = getNextStepToward(this.map, this.units, unit, destX, destY);
      if (!step) continue;

      unit.x = step.x;
      unit.y = step.y;

      if (unit.x === destX && unit.y === destY) {
        unit.clearDestination();
      }
    }
  }

  moveEnemyUnits() {
    for (const unit of this.units.filter((u) => u.isAlive && !u.isPlayer)) {
      stepEnemyUnit(this.map, unit, this.units);
    }
  }

  findAttackTarget(attacker) {
    const foes = this.units.filter(
      (u) => u.isAlive && u.team !== attacker.team
    );
    const attackTiles = getAttackTiles(attacker, attacker.x, attacker.y);
    const inRange = foes.filter((f) =>
      attackTiles.some((t) => t.x === f.x && t.y === f.y)
    );
    if (inRange.length === 0) return null;

    return inRange.reduce((best, foe) => {
      const preview = previewCombat(
        attacker,
        foe,
        this.map,
        attacker.x,
        attacker.y,
        foe.x,
        foe.y
      );
      const bestPreview = previewCombat(
        attacker,
        best,
        this.map,
        attacker.x,
        attacker.y,
        best.x,
        best.y
      );
      const score = preview.damage * (preview.hit / 100);
      const bestScore = bestPreview.damage * (bestPreview.hit / 100);
      return score > bestScore ? foe : best;
    });
  }

  resolveCombat() {
    const attackers = this.units.filter((u) => u.isAlive);
    for (const unit of attackers) {
      if (!unit.isAlive) continue;

      const target = this.findAttackTarget(unit);
      if (!target || !target.isAlive) continue;

      executeCombat(
        unit,
        target,
        this.map,
        unit.x,
        unit.y,
        target.x,
        target.y,
        () => {}
      );

      if (this.checkVictory()) return;
    }
  }

  checkVictory() {
    const enemiesLeft = this.units.some((u) => u.isAlive && !u.isPlayer);
    if (!enemiesLeft) {
      this.gameClear();
      return true;
    }
    return false;
  }

  gameClear() {
    this.stopTickLoop();
    this.phase = GamePhase.GAME_OVER;
    this.ui.restartBtn.hidden = false;
    this.ui.startBattleBtn.hidden = true;
    this.setMessage("ゲームクリア！ 全ての敵を撃破しました");
    this.updateUI();
    this.render();
  }
}
