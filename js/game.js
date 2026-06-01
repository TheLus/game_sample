import {
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_SIZE,
  UnitClass,
  Team,
} from "./config.js";
import {
  loadActiveStage,
  cloneGrid,
  enemyDefsToSpawn,
} from "./stage.js";
import { normalizeShopUnitKeys } from "./config.js";
import { createUnit, createUnits, resetUnitIds } from "./units.js";
import {
  getPathToward,
  getAttackTiles,
  getTerrain,
  hasAttackableFoe,
  isTerrainWalkable,
} from "./pathfinding.js";
import { isImpassableTerrain } from "./config.js";
import { executeCombat, previewCombat } from "./combat.js";
import { resolveCombatMovement } from "./movement.js";
import { canDeployAt } from "./deployment.js";
import { Renderer } from "./renderer.js";
import { debugLog, unitLabel, unitSnapshot } from "./debug.js";

const TURN_SPEED_MIN = 0.1;
const TURN_SPEED_MAX = 3;
const TURN_SPEED_DEFAULT = 0.5;
const STALE_TURN_LIMIT = 3;

function formatTurnSpeed(seconds) {
  const s = Math.round(seconds * 10) / 10;
  return `${s}秒`;
}
const DRAG_THRESHOLD_PX = 6;

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
    this.stageData = loadActiveStage();
    this.applyStageConfig(this.stageData);
    this.map = cloneGrid(this.stageData.map);
    this.deployZones = cloneGrid(this.stageData.deployZones);
    this.stageEnemyDefs = this.stageData.enemies;
    this.units = [];
    this.selectedUnit = null;
    this.cursor = { x: 0, y: 0 };
    this.phase = GamePhase.INSTRUCTION;
    this.combatTurn = 0;
    this.staleTurns = 0;
    this.previousTurnState = null;
    this.preCombatSnapshot = null;
    this.tickTimer = null;
    this.tickIntervalSec = TURN_SPEED_DEFAULT;
    this.combatPaused = false;
    this.combatAwaitingEnd = false;
    this.pendingCombatEndReason = null;
    this.dragUnit = null;
    this.dragPointer = null;
    this.dragMoved = false;

    this.bindEvents();
    this.start();
  }

  start() {
    this.stopTickLoop();
    resetUnitIds();
    this.stageData = loadActiveStage();
    this.applyStageConfig(this.stageData);
    this.map = cloneGrid(this.stageData.map);
    this.deployZones = cloneGrid(this.stageData.deployZones);
    this.stageEnemyDefs = this.stageData.enemies;
    this.units = createUnits(enemyDefsToSpawn(this.stageEnemyDefs));
    this.selectedUnit = null;
    this.phase = GamePhase.INSTRUCTION;
    this.combatTurn = 0;
    this.staleTurns = 0;
    this.previousTurnState = null;
    this.preCombatSnapshot = null;
    this.combatPaused = false;
    this.combatAwaitingEnd = false;
    this.pendingCombatEndReason = null;
    this.clearDrag();
    this.ui.restartBtn.hidden = true;
    this.setMessage(
      `「${this.stageData.name}」— 指示フェーズ（下のユニットを選んで配置 / ドラッグで移動・マップ外で売却）`
    );
    this.updateUI();
    this.render();
  }

  restartForStage() {
    if (this.isCombatPhase()) {
      this.stopTickLoop();
    }
    this.start();
  }

  applyStageConfig(stageData) {
    this.shopUnitKeys = normalizeShopUnitKeys(stageData.shopUnitKeys);
    this.gold = stageData.startingGold;
    if (!this.shopUnitKeys.includes(this.shopClassKey)) {
      this.shopClassKey = this.shopUnitKeys[0];
    }
  }

  isInstructionPhase() {
    return this.phase === GamePhase.INSTRUCTION;
  }

  isCombatPhase() {
    return this.phase === GamePhase.COMBAT;
  }

  isCombatTickRunning() {
    return (
      this.isCombatPhase() && !this.combatPaused && !this.combatAwaitingEnd
    );
  }

  getPlayerUnits() {
    return this.units.filter((u) => u.isAlive && u.isPlayer);
  }

  clearDrag() {
    this.dragUnit = null;
    this.dragPointer = null;
    this.dragMoved = false;
    this.canvas.classList.remove("dragging");
  }

  stopTickLoop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  getTickMs() {
    return Math.round(this.tickIntervalSec * 1000);
  }

  startTickLoop() {
    this.stopTickLoop();
    this.tickTimer = setInterval(() => this.tick(), this.getTickMs());
  }

  setTurnSpeed(seconds) {
    const clamped = Math.min(
      TURN_SPEED_MAX,
      Math.max(TURN_SPEED_MIN, Number(seconds) || TURN_SPEED_DEFAULT)
    );
    this.tickIntervalSec = Math.round(clamped * 10) / 10;
    this.syncTurnSpeedUI();
    if (this.isCombatTickRunning()) this.startTickLoop();
  }

  syncTurnSpeedUI() {
    if (!this.ui.turnSpeedSlider) return;
    this.ui.turnSpeedSlider.value = String(this.tickIntervalSec);
    if (this.ui.turnSpeedLabel) {
      this.ui.turnSpeedLabel.textContent = formatTurnSpeed(this.tickIntervalSec);
    }
  }

  bindEvents() {
    this.syncTurnSpeedUI();
    this.ui.restartBtn.addEventListener("click", () => this.start());
    this.ui.startBattleBtn.addEventListener("click", () =>
      this.onBattleControlClick()
    );
    if (this.ui.turnSpeedSlider) {
      this.ui.turnSpeedSlider.addEventListener("input", () => {
        this.setTurnSpeed(Number(this.ui.turnSpeedSlider.value));
      });
    }
    this.ui.clearDestBtn?.addEventListener("click", () =>
      this.clearSelectedDestination()
    );
    this.ui.sellUnitBtn?.addEventListener("click", () => this.sellSelectedUnit());

    this.ui.unitShop.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-class-key]");
      if (!btn || !this.isInstructionPhase()) return;
      this.shopClassKey = btn.dataset.classKey;
      this.selectedUnit = null;
      this.clearDrag();
      const cls = UnitClass[this.shopClassKey];
      this.setMessage(`${cls.name}（${cls.cost}G）— 黄枠内をクリックして配置`);
      this.updateUI();
      this.render();
    });

    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.canvas.addEventListener("pointercancel", () => this.clearDrag());

    document.addEventListener("keydown", (e) => this.onKeyDown(e));
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

  snapshotPreCombat() {
    this.preCombatSnapshot = {
      gold: this.gold,
      players: this.getPlayerUnits().map((u) => ({
        classKey: u.classKey,
        x: u.x,
        y: u.y,
        hp: u.hp,
        deployCost: u.deployCost,
        destination: u.destination ? { x: u.destination.x, y: u.destination.y } : null,
      })),
    };
  }

  /** 敵を初期配置に戻し、味方・資金を戦闘開始前の状態に復元 */
  restoreAfterCombat() {
    this.units = createUnits(enemyDefsToSpawn(this.stageEnemyDefs));

    const snapshot = this.preCombatSnapshot;
    if (!snapshot) return;

    this.gold = snapshot.gold;

    for (const p of snapshot.players) {
      const unit = createUnit({
        classKey: p.classKey,
        team: Team.PLAYER,
        x: p.x,
        y: p.y,
      });
      unit.hp = p.hp;
      unit.deployCost = p.deployCost;
      unit.destination = p.destination ? { ...p.destination } : null;
      this.units.push(unit);
    }
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

    if (this.selectedUnit?.isAlive && !this.dragUnit) {
      const { x, y } = this.cursor;
      const u = this.selectedUnit;
      const sameAsOrder =
        u.destination?.x === x && u.destination?.y === y;
      const occupant = this.getUnitAt(x, y);
      const canPreview =
        !sameAsOrder &&
        isTerrainWalkable(this.map, x, y) &&
        (x !== u.x || y !== u.y) &&
        (!occupant || occupant.id === u.id);
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
      deployZones: this.deployZones,
      showDeployZones: this.isInstructionPhase(),
      units: this.units,
      cursor: this.cursor,
      selectedUnit: this.selectedUnit,
      dragUnit: this.dragUnit,
      dragTile: this.getDragTile(),
      movementPaths: this.getMovementPaths(),
    });
  }

  getDragTile() {
    if (!this.dragPointer) return null;
    return this.clientToTile(this.dragPointer.x, this.dragPointer.y);
  }

  updateUI() {
    this.ui.renderGold(this.gold);
    this.ui.renderShop(
      this.shopUnitKeys,
      this.shopClassKey,
      this.gold,
      this.isInstructionPhase()
    );
    this.ui.unitShopBar.hidden =
      !this.isInstructionPhase() || this.phase === GamePhase.GAME_OVER;
    this.updateBattleControlButton();

    const unit = this.getUnitAt(this.cursor.x, this.cursor.y);
    const shopClassKey =
      this.isInstructionPhase() && !this.selectedUnit
        ? this.shopClassKey
        : null;
    this.ui.renderUnitInfo(unit, this.selectedUnit, shopClassKey);
    this.updateUnitActionButtons();
  }

  updateUnitActionButtons() {
    const actions = this.ui.unitActions;
    if (!actions) return;

    const unit = this.selectedUnit;
    const show =
      this.isInstructionPhase() && unit?.isAlive && unit.isPlayer;

    actions.hidden = !show;
    if (!show) return;

    this.ui.clearDestBtn.disabled = !unit.destination;
    this.ui.sellUnitBtn.disabled = false;
  }

  clearSelectedDestination() {
    if (!this.isInstructionPhase()) return;
    const unit = this.selectedUnit;
    if (!unit?.isPlayer || !unit.isAlive) return;
    if (!unit.destination) return;

    unit.clearDestination();
    this.setMessage(`${unit.name}の移動指示を解除しました`);
    this.updateUI();
    this.render();
  }

  sellSelectedUnit() {
    if (!this.isInstructionPhase()) return;
    const unit = this.selectedUnit;
    if (!unit?.isPlayer || !unit.isAlive) return;

    this.sellUnit(unit);
    this.updateUI();
    this.render();
  }

  getUnitAt(x, y) {
    return this.units.find((u) => u.isAlive && u.x === x && u.y === y) ?? null;
  }

  getCanvasRect() {
    return this.canvas.getBoundingClientRect();
  }

  isOnCanvas(clientX, clientY) {
    const rect = this.getCanvasRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  clientToTile(clientX, clientY) {
    const rect = this.getCanvasRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = Math.floor(((clientX - rect.left) * scaleX) / TILE_SIZE);
    const y = Math.floor(((clientY - rect.top) * scaleY) / TILE_SIZE);
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
    return { x, y };
  }

  onPointerDown(e) {
    if (!this.isInstructionPhase()) return;
    this.canvas.setPointerCapture(e.pointerId);
    const tile = this.clientToTile(e.clientX, e.clientY);
    if (!tile) return;

    this.cursor = tile;
    const unit = this.getUnitAt(tile.x, tile.y);

    if (unit?.isPlayer) {
      this.dragUnit = unit;
      this.dragPointer = { x: e.clientX, y: e.clientY };
      this.dragStartPointer = { x: e.clientX, y: e.clientY };
      this.dragMoved = false;
      this.canvas.classList.add("dragging");
      return;
    }

    this.pendingTile = tile;
  }

  onPointerMove(e) {
    if (!this.isInstructionPhase()) return;

    const tile = this.clientToTile(e.clientX, e.clientY);
    if (tile) this.cursor = tile;

    if (this.dragUnit) {
      this.dragPointer = { x: e.clientX, y: e.clientY };
      const dx = e.clientX - this.dragStartPointer.x;
      const dy = e.clientY - this.dragStartPointer.y;
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
        this.dragMoved = true;
      }
      this.render();
      this.updateUI();
    }
  }

  onPointerUp(e) {
    if (!this.isInstructionPhase()) return;

    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }

    if (this.dragUnit) {
      this.handleDragEnd(e.clientX, e.clientY);
      this.clearDrag();
      this.updateUI();
      this.render();
      return;
    }

    if (this.pendingTile) {
      this.handleMapClick(this.pendingTile);
      this.pendingTile = null;
      this.updateUI();
      this.render();
    }
  }

  handleDragEnd(clientX, clientY) {
    const unit = this.dragUnit;
    if (!unit) return;

    if (!this.isOnCanvas(clientX, clientY)) {
      this.sellUnit(unit);
      return;
    }

    if (!this.dragMoved) {
      this.selectedUnit = unit;
      this.setMessage(`${unit.name}を選択 — 移動先をクリック（ドラッグで配置変更）`);
      return;
    }

    const tile = this.clientToTile(clientX, clientY);
    if (!tile) return;

    if (
      canDeployAt(
        this.map,
        this.deployZones,
        this.units,
        tile.x,
        tile.y,
        unit.id
      )
    ) {
      unit.x = tile.x;
      unit.y = tile.y;
      unit.clearDestination();
      this.selectedUnit = unit;
      this.setMessage(`${unit.name}の配置位置を変更しました`);
      return;
    }

    if (!this.deployZones[tile.y]?.[tile.x]) {
      this.setMessage("配置可能エリア内にドロップしてください");
    } else {
      this.setMessage("そのマスには配置できません");
    }
  }

  handleMapClick(tile) {
    const { x, y } = tile;
    const clickedUnit = this.getUnitAt(x, y);

    if (clickedUnit?.isPlayer) {
      this.selectedUnit = clickedUnit;
      this.setMessage(`${clickedUnit.name}を選択 — 移動先をクリック`);
      return;
    }

    if (this.selectedUnit) {
      this.trySetDestination(x, y);
      return;
    }

    if (this.tryPlaceUnit(x, y)) return;

    this.setMessage("下のユニットを選ぶか、配置済みユニットを選択してください");
  }

  tryPlaceUnit(x, y) {
    if (this.selectedUnit) return false;
    if (!this.shopUnitKeys.includes(this.shopClassKey)) return false;
    if (this.getUnitAt(x, y)) return false;

    const cost = UnitClass[this.shopClassKey].cost;
    if (this.gold < cost) {
      this.setMessage(`資金が足りません（${cost}G 必要）`);
      return true;
    }

    if (!canDeployAt(this.map, this.deployZones, this.units, x, y)) {
      if (!this.deployZones[y]?.[x]) {
        this.setMessage("配置可能エリア（黄枠）内をクリックしてください");
      } else if (isImpassableTerrain(getTerrain(this.map, x, y))) {
        this.setMessage("この地形には配置できません");
      } else {
        this.setMessage("すでにユニットがいます");
      }
      return true;
    }

    const unit = createUnit({
      classKey: this.shopClassKey,
      team: Team.PLAYER,
      x,
      y,
    });
    this.units.push(unit);
    this.gold -= cost;
    this.setMessage(
      `${unit.name}を配置（-${cost}G / 残り${this.gold}G）— クリックで移動指示 / ドラッグで移動・売却`
    );
    return true;
  }

  trySetDestination(x, y) {
    if (!this.selectedUnit) return;

    if (!isTerrainWalkable(this.map, x, y)) {
      const terrain = getTerrain(this.map, x, y);
      this.setMessage(`${terrain?.name ?? "地形"}のため移動先に指定できません`);
      return;
    }

    const occupant = this.getUnitAt(x, y);
    if (occupant && occupant.id !== this.selectedUnit.id) {
      this.setMessage("他のユニットがいるマスには指定できません");
      return;
    }

    if (this.selectedUnit.x === x && this.selectedUnit.y === y) {
      this.selectedUnit.clearDestination();
      this.setMessage(`${this.selectedUnit.name}の移動指示を解除しました`);
      return;
    }

    const path = getPathToward(
      this.map,
      this.units,
      this.selectedUnit,
      x,
      y
    );
    if (!path || path.length === 0) {
      this.setMessage("そこへは到達できません");
      return;
    }

    this.selectedUnit.destination = { x, y };
    this.setMessage(
      `${this.selectedUnit.name} → (${x}, ${y}) へ向かうよう指示しました`
    );
  }

  sellUnit(unit) {
    if (!unit.isPlayer) return;
    const refund = unit.deployCost;
    this.gold += refund;
    this.units = this.units.filter((u) => u.id !== unit.id);
    if (this.selectedUnit?.id === unit.id) this.selectedUnit = null;
    this.setMessage(`${unit.name}を売却（+${refund}G / 残り${this.gold}G）`);
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

    if (e.key === "Escape" && this.isInstructionPhase()) {
      this.selectedUnit = null;
      this.clearDrag();
      this.setMessage("選択を解除しました");
      this.updateUI();
      this.render();
    }
  }

  updateBattleControlButton() {
    const btn = this.ui.startBattleBtn;
    if (!btn) return;

    if (this.phase === GamePhase.GAME_OVER) {
      btn.hidden = true;
      return;
    }

    btn.hidden = false;

    if (this.isInstructionPhase()) {
      btn.textContent = "戦闘開始";
      btn.disabled = this.getPlayerUnits().length === 0;
      return;
    }

    if (this.combatAwaitingEnd) {
      btn.textContent = "戦闘終了";
      btn.disabled = false;
      return;
    }

    if (this.combatPaused) {
      btn.textContent = "再開";
      btn.disabled = false;
      return;
    }

    btn.textContent = "一時停止";
    btn.disabled = false;
  }

  onBattleControlClick() {
    if (this.isInstructionPhase()) {
      this.startCombatPhase();
      return;
    }
    if (!this.isCombatPhase()) return;

    if (this.combatAwaitingEnd) {
      this.endCombatAndReturnToInstruction();
      return;
    }

    if (this.combatPaused) {
      this.resumeCombat();
    } else {
      this.pauseCombat();
    }
  }

  startCombatPhase() {
    if (!this.isInstructionPhase()) return;

    if (this.getPlayerUnits().length === 0) {
      this.setMessage("少なくとも1体の味方を配置してください");
      return;
    }

    this.snapshotPreCombat();
    this.phase = GamePhase.COMBAT;
    this.combatTurn = 0;
    this.staleTurns = 0;
    this.previousTurnState = this.captureState();
    this.combatPaused = false;
    this.combatAwaitingEnd = false;
    this.pendingCombatEndReason = null;
    this.selectedUnit = null;
    this.clearDrag();

    this.setMessage(
      `戦闘フェーズ開始！（${formatTurnSpeed(this.tickIntervalSec)}に1ターン）`
    );
    this.updateUI();
    this.render();

    this.startTickLoop();
  }

  pauseCombat() {
    if (!this.isCombatPhase() || this.combatAwaitingEnd || this.combatPaused) {
      return;
    }
    this.combatPaused = true;
    this.stopTickLoop();
    this.setMessage("戦闘を一時停止しました");
    this.updateUI();
    this.render();
  }

  resumeCombat() {
    if (!this.isCombatPhase() || this.combatAwaitingEnd || !this.combatPaused) {
      return;
    }
    this.combatPaused = false;
    this.startTickLoop();
    this.setMessage(
      `戦闘を再開しました（${formatTurnSpeed(this.tickIntervalSec)}に1ターン）`
    );
    this.updateUI();
    this.render();
  }

  finishCombatPhase(reason) {
    if (!this.isCombatPhase() || this.combatAwaitingEnd) return;

    this.stopTickLoop();
    this.combatPaused = false;
    this.combatAwaitingEnd = true;
    this.pendingCombatEndReason = reason;
    this.setMessage(`${reason} — 「戦闘終了」で指示フェーズに戻れます`);
    this.updateUI();
    this.render();
  }

  endCombatAndReturnToInstruction(reason) {
    const endReason =
      reason ?? this.pendingCombatEndReason ?? "戦闘が終了しました";

    this.stopTickLoop();
    this.restoreAfterCombat();
    this.phase = GamePhase.INSTRUCTION;
    this.combatTurn = 0;
    this.staleTurns = 0;
    this.previousTurnState = null;
    this.combatPaused = false;
    this.combatAwaitingEnd = false;
    this.pendingCombatEndReason = null;
    this.selectedUnit = null;
    this.clearDrag();
    this.setMessage(`${endReason} — 指示フェーズに戻りました`);
    this.updateUI();
    this.render();
  }

  tick() {
    if (!this.isCombatPhase()) return;

    this.combatTurn++;
    debugLog("turn", `======== 戦闘ターン ${this.combatTurn} 開始 ========`);
    for (const u of this.units.filter((x) => x.isAlive)) {
      debugLog("turn", unitLabel(u), unitSnapshot(u));
    }

    resolveCombatMovement(this.map, this.units);
    this.resolveCombat();

    if (this.phase === GamePhase.GAME_OVER) return;

    if (!this.units.some((u) => u.isAlive && u.isPlayer)) {
      this.finishCombatPhase("味方が全滅しました");
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
      this.finishCombatPhase("3ターン連続で変化がありませんでした");
      return;
    }

    this.setMessage(`戦闘フェーズ — ターン ${this.combatTurn}`);
    this.updateUI();
    this.render();
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

    const chosen = inRange.reduce((best, foe) => {
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
      const score = preview.damage;
      const bestScore = bestPreview.damage;
      return score > bestScore ? foe : best;
    });

    if (inRange.length > 1) {
      debugLog("combat", `${unitLabel(attacker)} のターゲット選択`, {
        candidates: inRange.map((f) => {
          const p = previewCombat(
            attacker,
            f,
            this.map,
            attacker.x,
            attacker.y,
            f.x,
            f.y
          );
          return {
            unit: unitLabel(f),
            expectedDamage: p.damage,
            score: p.damage,
          };
        }),
        chosen: unitLabel(chosen),
      });
    }

    return chosen;
  }

  resolveCombat() {
    debugLog("combat", "--- 戦闘解決フェーズ ---");
    const orders = [];
    for (const unit of this.units) {
      if (!unit.isAlive) continue;
      const target = this.findAttackTarget(unit);
      if (target?.isAlive) {
        orders.push({ attacker: unit, target });
      } else {
        debugLog("combat", `${unitLabel(unit)} — 攻撃対象なし`);
      }
    }

    debugLog(
      "combat",
      `攻撃順（${orders.length}件）`,
      orders.map(({ attacker, target }, i) => ({
        order: i + 1,
        attacker: unitLabel(attacker),
        target: unitLabel(target),
        attackerHp: attacker.hp,
        targetHp: target.hp,
      }))
    );

    for (const { attacker, target } of orders) {
      if (target.hp <= 0) {
        debugLog(
          "combat",
          `スキップ: ${unitLabel(attacker)} → ${unitLabel(target)}（対象は既に HP≤0）`
        );
        continue;
      }

      debugLog(
        "combat",
        `実行: ${unitLabel(attacker)} → ${unitLabel(target)}`
      );
      executeCombat(
        attacker,
        target,
        this.map,
        attacker.x,
        attacker.y,
        target.x,
        target.y,
        () => {}
      );
    }

    const fallen = this.units.filter((u) => u.hp <= 0);
    for (const unit of fallen) {
      unit.hp = 0;
    }
    if (fallen.length > 0) {
      debugLog(
        "combat",
        "死亡判定（全攻撃後）",
        fallen.map((u) => unitLabel(u))
      );
    }

    const survivors = this.units.filter((u) => u.isAlive);
    debugLog(
      "combat",
      "ターン終了時の生存者",
      survivors.map((u) => unitLabel(u))
    );

    if (this.checkVictory()) return;
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
    this.combatPaused = false;
    this.combatAwaitingEnd = false;
    this.pendingCombatEndReason = null;
    this.phase = GamePhase.GAME_OVER;
    this.ui.restartBtn.hidden = false;
    this.ui.startBattleBtn.hidden = true;
    this.ui.unitShopBar.hidden = true;
    this.setMessage("ゲームクリア！ 全ての敵を撃破しました");
    this.updateUI();
    this.render();
  }
}
