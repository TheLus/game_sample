import {
  DEFAULT_MAP,
  INITIAL_UNITS,
  Team,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_SIZE,
} from "./config.js";
import { createUnits } from "./units.js";
import { getReachableTiles, getAttackTiles, getTerrain } from "./pathfinding.js";
import { executeCombat, previewCombat } from "./combat.js";
import { runEnemyTurn } from "./ai.js";
import { Renderer } from "./renderer.js";

export const Phase = {
  SELECT: "select",
  MOVE: "move",
  ACTION: "action",
  ATTACK: "attack",
  ENEMY: "enemy",
  GAME_OVER: "game_over",
};

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.map = DEFAULT_MAP.map((row) => [...row]);
    this.units = [];
    this.phase = Phase.SELECT;
    this.selectedUnit = null;
    this.moveTiles = null;
    this.attackTiles = null;
    this.cursor = { x: 0, y: 0 };
    this.pendingMove = null;
    this.isPlaying = true;
    this.playerPhase = true;

    this.bindEvents();
    this.start();
  }

  start() {
    this.units = createUnits(INITIAL_UNITS);
    this.phase = Phase.SELECT;
    this.selectedUnit = null;
    this.moveTiles = null;
    this.attackTiles = null;
    this.isPlaying = true;
    this.playerPhase = true;
    this.ui.restartBtn.hidden = true;
    this.ui.endTurnBtn.disabled = false;
    this.setMessage("味方ユニットを選んでください");
    this.updateUI();
    this.render();
  }

  bindEvents() {
    this.canvas.addEventListener("click", (e) => this.onClick(e));
    document.addEventListener("keydown", (e) => this.onKeyDown(e));
    this.ui.endTurnBtn.addEventListener("click", () => this.endPlayerTurn());
    this.ui.restartBtn.addEventListener("click", () => this.start());
  }

  delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  setMessage(msg) {
    this.ui.messageEl.textContent = msg;
  }

  render() {
    this.renderer.draw({
      map: this.map,
      units: this.units,
      cursor: this.cursor,
      moveTiles: this.moveTiles,
      attackTiles: this.attackTiles,
      selectedUnit: this.selectedUnit,
    });
  }

  updateUI() {
    const phaseEl = this.ui.phaseText;
    if (this.phase === Phase.GAME_OVER) {
      phaseEl.textContent = "終了";
      phaseEl.className = "phase-text";
    } else if (this.playerPhase) {
      phaseEl.textContent = "味方ターン";
      phaseEl.className = "phase-text player";
    } else {
      phaseEl.textContent = "敵ターン";
      phaseEl.className = "phase-text enemy";
    }

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
    if (!this.isPlaying || !this.playerPhase) return;
    const tile = this.canvasToTile(e);
    if (!tile) return;
    this.cursor = tile;
    this.handlePlayerInput(tile);
    this.updateUI();
    this.render();
  }

  onKeyDown(e) {
    if (!this.isPlaying) return;

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

    if (e.key === "Enter" && this.playerPhase) {
      this.handlePlayerInput({ ...this.cursor });
      this.updateUI();
      this.render();
      return;
    }

    if (e.key === "Escape") {
      this.cancelSelection();
      this.updateUI();
      this.render();
    }
  }

  cancelSelection() {
    if (this.phase === Phase.MOVE || this.phase === Phase.ACTION || this.phase === Phase.ATTACK) {
      if (this.pendingMove && this.selectedUnit) {
        this.selectedUnit.x = this.pendingMove.fromX;
        this.selectedUnit.y = this.pendingMove.fromY;
      }
      this.pendingMove = null;
      this.phase = Phase.SELECT;
      this.moveTiles = null;
      this.attackTiles = null;
      this.setMessage("選択をキャンセルしました");
    }
  }

  handlePlayerInput(tile) {
    const { x, y } = tile;
    const clickedUnit = this.getUnitAt(x, y);

    if (this.phase === Phase.SELECT) {
      if (clickedUnit?.isPlayer && clickedUnit.canAct) {
        this.selectUnit(clickedUnit);
      } else if (clickedUnit) {
        this.setMessage("行動済みのユニットです");
      }
      return;
    }

    if (this.phase === Phase.MOVE) {
      const key = `${x},${y}`;
      if (this.moveTiles?.has(key)) {
        this.pendingMove = {
          fromX: this.selectedUnit.x,
          fromY: this.selectedUnit.y,
        };
        this.selectedUnit.x = x;
        this.selectedUnit.y = y;
        this.selectedUnit.hasMoved = true;
        this.moveTiles = null;
        this.showActionMenu();
      } else if (clickedUnit?.id === this.selectedUnit.id) {
        this.showActionMenu();
      } else {
        this.setMessage("移動できないマスです");
      }
      return;
    }

    if (this.phase === Phase.ATTACK) {
      const target = this.attackTiles?.find((t) => t.x === x && t.y === y);
      if (target) {
        const enemy = this.getUnitAt(x, y);
        if (enemy && !enemy.isPlayer) {
          this.performAttack(enemy);
        }
      } else if (!clickedUnit) {
        this.setMessage("攻撃対象を選んでください");
      }
      return;
    }

    if (this.phase === Phase.ACTION) {
      if (clickedUnit && !clickedUnit.isPlayer) {
        const inRange = getAttackTiles(this.selectedUnit, this.selectedUnit.x, this.selectedUnit.y)
          .some((t) => t.x === x && t.y === y);
        if (inRange) {
          this.performAttack(clickedUnit);
          return;
        }
      }
      if (!clickedUnit || clickedUnit.id === this.selectedUnit.id) {
        this.wait();
      }
    }
  }

  selectUnit(unit) {
    this.selectedUnit = unit;
    this.pendingMove = null;

    if (unit.hasMoved) {
      this.moveTiles = null;
      this.showActionMenu();
      return;
    }

    this.moveTiles = getReachableTiles(
      this.map,
      unit,
      this.units,
      unit.x,
      unit.y
    );
    this.phase = Phase.MOVE;
    this.attackTiles = null;
    this.setMessage(`${unit.name}：移動先を選んでください`);
  }

  showActionMenu() {
    this.phase = Phase.ACTION;
    const unit = this.selectedUnit;
    const enemies = this.units.filter((u) => u.isAlive && !u.isPlayer);
    const attackRange = getAttackTiles(unit, unit.x, unit.y);
    const targets = attackRange.filter((t) =>
      enemies.some((e) => e.x === t.x && e.y === t.y)
    );

    if (targets.length > 0) {
      this.attackTiles = targets;
      this.setMessage("攻撃する敵を選ぶか、空きマスで待機");
    } else {
      this.setMessage("攻撃できる敵がいません。空きマスで待機");
    }
  }

  performAttack(defender) {
    const attacker = this.selectedUnit;
    const preview = previewCombat(
      attacker,
      defender,
      this.map,
      attacker.x,
      attacker.y,
      defender.x,
      defender.y
    );
    this.setMessage(
      `予想: 命中${Math.round(preview.hit)}% / ${preview.damage}ダメージ` +
        (preview.counter ? ` ← 反撃${preview.counter.damage}` : "")
    );

    executeCombat(
      attacker,
      defender,
      this.map,
      attacker.x,
      attacker.y,
      defender.x,
      defender.y,
      (msg) => this.setMessage(msg)
    );

    attacker.hasActed = true;
    this.finishUnitAction();
    this.checkVictory();
  }

  wait() {
    this.selectedUnit.hasActed = true;
    this.setMessage(`${this.selectedUnit.name}は待機しました`);
    this.finishUnitAction();
  }

  finishUnitAction() {
    this.phase = Phase.SELECT;
    this.selectedUnit = null;
    this.moveTiles = null;
    this.attackTiles = null;
    this.pendingMove = null;
  }

  endPlayerTurn() {
    if (!this.playerPhase || this.phase === Phase.GAME_OVER) return;

    this.units
      .filter((u) => u.isPlayer)
      .forEach((u) => {
        if (!u.hasMoved && !u.hasActed) {
          u.hasMoved = true;
          u.hasActed = true;
        }
      });

    this.finishUnitAction();
    this.startEnemyTurn();
  }

  async startEnemyTurn() {
    this.playerPhase = false;
    this.phase = Phase.ENEMY;
    this.ui.endTurnBtn.disabled = true;
    this.setMessage("敵ターン…");
    this.updateUI();
    this.render();

    await this.delay(500);
    await runEnemyTurn(this);

    if (!this.isPlaying) return;

    this.units.filter((u) => u.isPlayer).forEach((u) => u.resetTurn());
    this.playerPhase = true;
    this.phase = Phase.SELECT;
    this.ui.endTurnBtn.disabled = false;
    this.setMessage("味方ターン開始");
    this.updateUI();
    this.render();

    this.checkDefeat();
  }

  checkVictory() {
    const enemiesLeft = this.units.some((u) => u.isAlive && !u.isPlayer);
    if (!enemiesLeft) {
      this.gameOver(true);
      return true;
    }
    return false;
  }

  checkDefeat() {
    const playersLeft = this.units.some((u) => u.isAlive && u.isPlayer);
    if (!playersLeft) {
      this.gameOver(false);
    }
  }

  gameOver(victory) {
    this.isPlaying = false;
    this.phase = Phase.GAME_OVER;
    this.ui.endTurnBtn.disabled = true;
    this.ui.restartBtn.hidden = false;
    this.setMessage(victory ? "勝利！ 全ての敵を撃破しました" : "敗北… 味方が全滅しました");
    this.updateUI();
    this.render();
  }
}
