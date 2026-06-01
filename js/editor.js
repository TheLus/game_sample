import {
  Terrain,
  UnitClass,
  Team,
  TILE_SIZE,
  MAP_WIDTH,
  MAP_HEIGHT,
  TERRAIN_BRUSH_KEYS,
  ENEMY_EDITOR_KEYS,
  isImpassableTerrain,
} from "./config.js";
import { getPathToward, getTerrain } from "./pathfinding.js";
import { isDeployZone, canDeployAt } from "./deployment.js";
import { createUnit } from "./units.js";
import { Renderer } from "./renderer.js";
import {
  loadStage,
  saveStage,
  downloadStageJson,
  buildDefaultStage,
  cloneGrid,
  normalizeStage,
} from "./stage.js";

const EditorMode = {
  TERRAIN: "terrain",
  DEPLOY: "deploy",
  ENEMY: "enemy",
};

const DRAG_THRESHOLD_PX = 6;

export class StageEditor {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.stage = normalizeStage(loadStage() ?? buildDefaultStage());
    this.mode = EditorMode.TERRAIN;
    this.terrainBrushId = Terrain.PLAIN.id;
    this.enemyClassKey = "SWORD";
    this.selectedEnemyIndex = null;
    this.cursor = { x: 0, y: 0 };
    this.isPainting = false;
    this.dragEnemyIndex = null;
    this.dragPointer = null;
    this.dragStartPointer = null;
    this.dragMoved = false;
    this.pointerModifiers = { shift: false, alt: false };

    this.bindEvents();
    this.updateUI();
    this.render();
    this.setMessage("地形ブラシでマスを塗ってください");
  }

  bindEvents() {
    this.ui.saveBtn.addEventListener("click", () => this.save());
    this.ui.loadBtn.addEventListener("click", () => this.ui.loadFileInput.click());
    this.ui.loadFileInput.addEventListener("change", () => this.loadFromFileInput());
    this.ui.resetBtn.addEventListener("click", () => this.loadDefault());
    this.ui.modeTerrain.addEventListener("click", () => this.setMode(EditorMode.TERRAIN));
    this.ui.modeDeploy.addEventListener("click", () => this.setMode(EditorMode.DEPLOY));
    this.ui.modeEnemy.addEventListener("click", () => this.setMode(EditorMode.ENEMY));

    this.ui.terrainPalette.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-terrain-id]");
      if (!btn) return;
      this.terrainBrushId = Number(btn.dataset.terrainId);
      this.setMode(EditorMode.TERRAIN);
      this.updateUI();
      this.render();
    });

    this.ui.enemyPalette.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-class-key]");
      if (!btn) return;
      this.enemyClassKey = btn.dataset.classKey;
      this.setMode(EditorMode.ENEMY);
      this.selectedEnemyIndex = null;
      this.updateUI();
      this.render();
    });

    this.ui.deleteEnemyBtn.addEventListener("click", () =>
      this.deleteSelectedEnemy()
    );

    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.canvas.addEventListener("pointerleave", (e) => {
      if (this.isPainting) this.onPointerUp(e);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (this.isTypingInInput()) return;
        e.preventDefault();
        this.deleteSelectedEnemy();
      }
      if (e.key === "Escape") {
        this.selectedEnemyIndex = null;
        this.dragEnemyIndex = null;
        this.setMessage("選択を解除しました");
        this.updateUI();
        this.render();
      }
    });
  }

  setMode(mode) {
    this.mode = mode;
    if (mode !== EditorMode.ENEMY) this.selectedEnemyIndex = null;
    this.updateUI();
  }

  setMessage(msg) {
    this.ui.messageEl.textContent = msg;
  }

  getEnemyAt(x, y) {
    return this.stage.enemies.findIndex((e) => e.x === x && e.y === y);
  }

  getDisplayUnits() {
    return this.stage.enemies.map((e, index) => {
      const t = UnitClass[e.classKey];
      return {
        id: index,
        classKey: e.classKey,
        name: t.name,
        symbol: t.symbol,
        team: Team.ENEMY,
        x: e.x,
        y: e.y,
        hp: t.hp,
        maxHp: t.hp,
        isPlayer: false,
        isAlive: true,
        destination: e.destination,
      };
    });
  }

  getEnemyMovementPaths() {
    if (this.selectedEnemyIndex === null) return [];
    const e = this.stage.enemies[this.selectedEnemyIndex];
    if (!e?.destination) return [];

    const fakeUnit = createUnit({
      classKey: e.classKey,
      team: Team.ENEMY,
      x: e.x,
      y: e.y,
    });
    const units = this.getDisplayUnits().map((u, i) =>
      i === this.selectedEnemyIndex
        ? fakeUnit
        : createUnit({
            classKey: u.classKey,
            team: Team.ENEMY,
            x: u.x,
            y: u.y,
          })
    );

    const path = getPathToward(
      this.stage.map,
      units,
      fakeUnit,
      e.destination.x,
      e.destination.y
    );
    if (!path?.length) return [];
    return [{ unit: fakeUnit, path }];
  }

  getPreviewPath() {
    if (
      this.mode !== EditorMode.ENEMY ||
      this.selectedEnemyIndex === null ||
      this.dragEnemyIndex !== null
    ) {
      return [];
    }

    const e = this.stage.enemies[this.selectedEnemyIndex];
    const { x, y } = this.cursor;
    if (x === e.x && y === e.y) return [];

    const fakeUnit = createUnit({
      classKey: e.classKey,
      team: Team.ENEMY,
      x: e.x,
      y: e.y,
    });
    const units = this.getDisplayUnits().map((u, i) =>
      createUnit({
        classKey: u.classKey,
        team: Team.ENEMY,
        x: u.x,
        y: u.y,
      })
    );

    const path = getPathToward(this.stage.map, units, fakeUnit, x, y);
    if (!path?.length) return [];
    return [{ unit: fakeUnit, path, preview: true }];
  }

  render() {
    const paths = [...this.getEnemyMovementPaths(), ...this.getPreviewPath()];
    const selected =
      this.selectedEnemyIndex !== null
        ? this.getDisplayUnits()[this.selectedEnemyIndex]
        : null;

    this.renderer.draw({
      map: this.stage.map,
      deployZones: this.stage.deployZones,
      showDeployZones: true,
      units: this.getDisplayUnits(),
      cursor: this.cursor,
      selectedUnit: selected,
      movementPaths: paths,
    });
  }

  updateUI() {
    this.ui.modeTerrain.classList.toggle("active", this.mode === EditorMode.TERRAIN);
    this.ui.modeDeploy.classList.toggle("active", this.mode === EditorMode.DEPLOY);
    this.ui.modeEnemy.classList.toggle("active", this.mode === EditorMode.ENEMY);

    for (const btn of this.ui.terrainPalette.querySelectorAll("[data-terrain-id]")) {
      btn.classList.toggle("selected", Number(btn.dataset.terrainId) === this.terrainBrushId);
    }
    for (const btn of this.ui.enemyPalette.querySelectorAll("[data-class-key]")) {
      btn.classList.toggle("selected", btn.dataset.classKey === this.enemyClassKey);
    }

    this.ui.stageNameInput.value = this.stage.name;
    this.ui.terrainPalette.hidden = this.mode !== EditorMode.TERRAIN;
    this.ui.enemyPalette.hidden = this.mode !== EditorMode.ENEMY;

    const canDelete =
      this.mode === EditorMode.ENEMY && this.selectedEnemyIndex !== null;
    this.ui.deleteEnemyBtn.disabled = !canDelete;
    this.ui.deleteEnemyBtn.hidden = this.mode !== EditorMode.ENEMY;
  }

  clientToTile(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = Math.floor(((clientX - rect.left) * scaleX) / TILE_SIZE);
    const y = Math.floor(((clientY - rect.top) * scaleY) / TILE_SIZE);
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
    return { x, y };
  }

  isOnCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  applyTerrain(x, y) {
    this.stage.map[y][x] = this.terrainBrushId;
  }

  toggleDeploy(x, y) {
    this.stage.deployZones[y][x] = this.stage.deployZones[y][x] ? 0 : 1;
  }

  canPlaceEnemyAt(x, y, excludeIndex = null) {
    const terrain = getTerrain(this.stage.map, x, y);
    if (isImpassableTerrain(terrain)) return false;
    const idx = this.getEnemyAt(x, y);
    if (idx !== -1 && idx !== excludeIndex) return false;
    return true;
  }

  placeEnemy(x, y) {
    if (!this.canPlaceEnemyAt(x, y)) {
      this.setMessage("ここには敵を配置できません");
      return;
    }
    this.stage.enemies.push({
      classKey: this.enemyClassKey,
      x,
      y,
      destination: null,
    });
    this.selectedEnemyIndex = this.stage.enemies.length - 1;
    this.setMessage(`${UnitClass[this.enemyClassKey].name}を配置しました`);
  }

  isTypingInInput() {
    const el = document.activeElement;
    return el?.tagName === "INPUT" || el?.tagName === "TEXTAREA";
  }

  removeEnemy(index) {
    if (index < 0 || index >= this.stage.enemies.length) return;
    const name = UnitClass[this.stage.enemies[index].classKey].name;
    this.stage.enemies.splice(index, 1);

    if (this.selectedEnemyIndex === index) {
      this.selectedEnemyIndex = null;
    } else if (this.selectedEnemyIndex > index) {
      this.selectedEnemyIndex--;
    }

    if (this.dragEnemyIndex === index) {
      this.dragEnemyIndex = null;
    } else if (this.dragEnemyIndex !== null && this.dragEnemyIndex > index) {
      this.dragEnemyIndex--;
    }

    this.setMessage(`${name}を削除しました`);
  }

  deleteSelectedEnemy() {
    if (this.mode !== EditorMode.ENEMY) {
      this.setMessage("敵ユニットモードで削除してください");
      return;
    }
    if (this.selectedEnemyIndex === null) {
      this.setMessage("削除する敵を選択してください");
      return;
    }
    this.removeEnemy(this.selectedEnemyIndex);
    this.updateUI();
    this.render();
  }

  deleteEnemyAt(x, y) {
    const idx = this.getEnemyAt(x, y);
    if (idx === -1) return false;
    this.removeEnemy(idx);
    return true;
  }

  onPointerDown(e) {
    this.pointerModifiers = { shift: e.shiftKey, alt: e.altKey };

    if (e.button === 2 && this.mode === EditorMode.ENEMY) {
      const tile = this.clientToTile(e.clientX, e.clientY);
      if (tile && this.deleteEnemyAt(tile.x, tile.y)) {
        this.updateUI();
        this.render();
      }
      return;
    }

    this.canvas.setPointerCapture(e.pointerId);
    const tile = this.clientToTile(e.clientX, e.clientY);
    if (!tile) return;
    this.cursor = tile;

    if (this.mode === EditorMode.ENEMY) {
      const idx = this.getEnemyAt(tile.x, tile.y);
      if (idx !== -1) {
        this.dragEnemyIndex = idx;
        this.dragPointer = { x: e.clientX, y: e.clientY };
        this.dragStartPointer = { x: e.clientX, y: e.clientY };
        this.dragMoved = false;
        this.selectedEnemyIndex = idx;
      }
      return;
    }

    this.isPainting = true;
    this.paintAt(tile);
  }

  onPointerMove(e) {
    const tile = this.clientToTile(e.clientX, e.clientY);
    if (tile) this.cursor = tile;

    if (this.dragEnemyIndex !== null) {
      this.dragPointer = { x: e.clientX, y: e.clientY };
      const dx = e.clientX - this.dragStartPointer.x;
      const dy = e.clientY - this.dragStartPointer.y;
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) this.dragMoved = true;
      this.render();
      return;
    }

    if (this.isPainting && tile) {
      this.paintAt(tile);
    } else {
      this.render();
    }
  }

  onPointerUp(e) {
    this.pointerModifiers = { shift: e.shiftKey, alt: e.altKey };

    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }

    if (this.dragEnemyIndex !== null) {
      this.handleEnemyDragEnd(e.clientX, e.clientY);
      this.dragEnemyIndex = null;
      this.dragPointer = null;
      this.isPainting = false;
      this.updateUI();
      this.render();
      return;
    }

    if (this.isPainting) {
      this.isPainting = false;
      this.updateUI();
      this.render();
      return;
    }

    const tile = this.clientToTile(e.clientX, e.clientY);
    if (!tile) return;
    this.handleClick(tile);
    this.updateUI();
    this.render();
  }

  paintAt(tile) {
    if (this.mode === EditorMode.TERRAIN) {
      this.applyTerrain(tile.x, tile.y);
    } else if (this.mode === EditorMode.DEPLOY) {
      this.toggleDeploy(tile.x, tile.y);
    }
    this.render();
  }

  handleEnemyDragEnd(clientX, clientY) {
    const idx = this.dragEnemyIndex;
    const enemy = this.stage.enemies[idx];
    if (!enemy) return;

    if (!this.isOnCanvas(clientX, clientY)) {
      this.removeEnemy(idx);
      this.selectedEnemyIndex = null;
      this.setMessage("マップ外へドラッグ — 敵を削除しました");
      return;
    }

    if (!this.dragMoved) {
      this.selectedEnemyIndex = idx;
      this.setMessage(`${UnitClass[enemy.classKey].name}を選択 — 移動先をクリック`);
      return;
    }

    const tile = this.clientToTile(clientX, clientY);
    if (!tile) return;

    if (this.canPlaceEnemyAt(tile.x, tile.y, idx)) {
      enemy.x = tile.x;
      enemy.y = tile.y;
      enemy.destination = null;
      this.setMessage(`${UnitClass[enemy.classKey].name}の位置を変更しました`);
      return;
    }

    this.setMessage("そのマスには移動できません");
  }

  handleClick(tile) {
    const { x, y } = tile;

    if (this.mode === EditorMode.TERRAIN) {
      this.applyTerrain(x, y);
      this.setMessage("地形を配置しました");
      return;
    }

    if (this.mode === EditorMode.DEPLOY) {
      this.toggleDeploy(x, y);
      this.setMessage(
        isDeployZone(this.stage.deployZones, x, y)
          ? "配置エリアを追加しました"
          : "配置エリアを解除しました"
      );
      return;
    }

    if (this.mode === EditorMode.ENEMY) {
      const idx = this.getEnemyAt(x, y);
      if (idx !== -1) {
        if (this.pointerModifiers.shift || this.pointerModifiers.alt) {
          this.removeEnemy(idx);
          return;
        }
        this.selectedEnemyIndex = idx;
        this.setMessage(
          `${UnitClass[this.stage.enemies[idx].classKey].name}を選択 — 移動先をクリック / 右クリック・Shift+クリックで削除`
        );
        return;
      }

      if (this.selectedEnemyIndex !== null) {
        const enemy = this.stage.enemies[this.selectedEnemyIndex];
        if (enemy.x === x && enemy.y === y) {
          enemy.destination = null;
          this.setMessage("移動指示を解除しました");
          return;
        }

        const fakeUnits = this.getDisplayUnits().map((u) =>
          createUnit({
            classKey: u.classKey,
            team: Team.ENEMY,
            x: u.x,
            y: u.y,
          })
        );
        const mover = fakeUnits[this.selectedEnemyIndex];
        const path = getPathToward(this.stage.map, fakeUnits, mover, x, y);
        if (!path?.length) {
          this.setMessage("そこへは移動できません");
          return;
        }
        enemy.destination = { x, y };
        this.setMessage(`移動先を (${x}, ${y}) に設定しました`);
        return;
      }

      this.placeEnemy(x, y);
    }
  }

  syncStageNameFromUI() {
    this.stage.name = this.ui.stageNameInput.value.trim() || "カスタムステージ";
  }

  save() {
    this.syncStageNameFromUI();
    saveStage(this.stage);
    downloadStageJson(this.stage);
    this.setMessage("JSONを出力しました — ゲームにも反映済みです");
  }

  loadFromFileInput() {
    const file = this.ui.loadFileInput.files?.[0];
    this.ui.loadFileInput.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        this.stage = normalizeStage(parsed);
        saveStage(this.stage);
        this.selectedEnemyIndex = null;
        this.updateUI();
        this.render();
        this.setMessage(`「${this.stage.name}」を読み込みました`);
      } catch {
        this.setMessage("JSONの読み込みに失敗しました");
      }
    };
    reader.onerror = () => this.setMessage("ファイルの読み込みに失敗しました");
    reader.readAsText(file);
  }

  loadDefault() {
    if (!confirm("デフォルトのマップに戻しますか？未保存の変更は失われます。")) return;
    this.stage = buildDefaultStage();
    this.selectedEnemyIndex = null;
    this.updateUI();
    this.render();
    this.setMessage("デフォルトステージを読み込みました");
  }
}
