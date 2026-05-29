import { TILE_SIZE, Terrain, Team, ENEMY_AGGRO_RANGE, TERRAIN_BY_ID } from "./config.js";
import { getTilesInManhattanRange } from "./pathfinding.js";

function tileCenter(x, y) {
  return {
    x: x * TILE_SIZE + TILE_SIZE / 2,
    y: y * TILE_SIZE + TILE_SIZE / 2,
  };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  drawMovementPath(ctx, { unit, path, preview }) {
    const fill = preview
      ? "rgba(74, 158, 255, 0.15)"
      : "rgba(74, 158, 255, 0.3)";
    const stroke = preview ? "rgba(74, 158, 255, 0.5)" : "#4a9eff";
    const lineColor = preview ? "rgba(74, 158, 255, 0.55)" : "#6eb5ff";

    for (const tile of path) {
      const px = tile.x * TILE_SIZE;
      const py = tile.y * TILE_SIZE;
      ctx.fillStyle = fill;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = preview ? 1 : 2;
      ctx.setLineDash(preview ? [3, 3] : []);
      ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      ctx.setLineDash([]);
    }

    const dest = path[path.length - 1];
    const destPx = dest.x * TILE_SIZE;
    const destPy = dest.y * TILE_SIZE;
    if (!preview) {
      ctx.fillStyle = "rgba(74, 158, 255, 0.25)";
      ctx.fillRect(destPx, destPy, TILE_SIZE, TILE_SIZE);
    }
    ctx.fillStyle = preview ? "rgba(74, 158, 255, 0.7)" : "#4a9eff";
    ctx.beginPath();
    ctx.arc(
      destPx + TILE_SIZE / 2,
      destPy + TILE_SIZE / 2,
      preview ? 4 : 5,
      0,
      Math.PI * 2
    );
    ctx.fill();

    const points = [tileCenter(unit.x, unit.y), ...path.map((t) => tileCenter(t.x, t.y))];

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = preview ? 2 : 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash(preview ? [6, 4] : []);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 1; i < path.length; i++) {
      const c = tileCenter(path[i].x, path[i].y);
      ctx.fillStyle = preview ? "rgba(110, 181, 255, 0.8)" : "#a8d4ff";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEnemyAggroRanges(ctx, map, units) {
    const mapW = map[0].length;
    const mapH = map.length;
    const enemies = units.filter((u) => u.isAlive && u.team === Team.ENEMY);
    const AGGRO_FILL_ALPHA = 0.2;
    const MAX_OVERLAP_LAYERS = 2;

    const overlapCounts = new Map();
    const edgeTiles = new Set();

    for (const unit of enemies) {
      const tiles = getTilesInManhattanRange(
        unit.x,
        unit.y,
        ENEMY_AGGRO_RANGE,
        mapW,
        mapH
      );

      for (const { x, y, dist } of tiles) {
        const key = `${x},${y}`;
        overlapCounts.set(key, (overlapCounts.get(key) ?? 0) + 1);
        if (dist === ENEMY_AGGRO_RANGE) edgeTiles.add(key);
      }
    }

    for (const [key, count] of overlapCounts) {
      const [x, y] = key.split(",").map(Number);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      const layers = Math.min(count, MAX_OVERLAP_LAYERS);
      const alpha = AGGRO_FILL_ALPHA * layers;
      ctx.fillStyle = `rgba(255, 107, 74, ${alpha})`;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }

    ctx.strokeStyle = "rgba(255, 107, 74, 0.55)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const key of edgeTiles) {
      const [x, y] = key.split(",").map(Number);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
    ctx.setLineDash([]);
  }

  draw(state) {
    const { map, units, cursor, selectedUnit, movementPaths = [] } = state;
    const ctx = this.ctx;
    const w = map[0].length * TILE_SIZE;
    const h = map.length * TILE_SIZE;

    ctx.clearRect(0, 0, w, h);

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const terrain = TERRAIN_BY_ID[map[y][x]] ?? Terrain.PLAIN;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        ctx.fillStyle = terrain.color;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

        if (terrain.id === 1) {
          ctx.fillStyle = "rgba(0,40,0,0.3)";
          ctx.beginPath();
          ctx.arc(
            px + TILE_SIZE / 2,
            py + TILE_SIZE / 2,
            6,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        if (terrain.waterStyle === "river") {
          ctx.strokeStyle = "rgba(255,255,255,0.45)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + 4, py + TILE_SIZE / 2);
          ctx.lineTo(px + TILE_SIZE - 4, py + TILE_SIZE / 2);
          ctx.stroke();
        }
      }
    }

    this.drawEnemyAggroRanges(ctx, map, units);

    const drawnPreview = new Set();
    for (const entry of movementPaths) {
      if (entry.preview) {
        if (drawnPreview.has(entry.unit.id)) continue;
        drawnPreview.add(entry.unit.id);
      }
      this.drawMovementPath(ctx, entry);
    }

    for (const unit of units.filter((u) => u.isAlive)) {
      const px = unit.x * TILE_SIZE;
      const py = unit.y * TILE_SIZE;
      const color = unit.team === Team.PLAYER ? "#4a9eff" : "#ff6b4a";

      ctx.fillStyle = color;
      ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(unit.symbol, px + TILE_SIZE / 2, py + TILE_SIZE / 2);

      const barW = TILE_SIZE - 8;
      const hpRatio = unit.hp / unit.maxHp;
      ctx.fillStyle = "#333";
      ctx.fillRect(px + 4, py + TILE_SIZE - 6, barW, 4);
      ctx.fillStyle =
        hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#fbbf24" : "#ef4444";
      ctx.fillRect(px + 4, py + TILE_SIZE - 6, barW * hpRatio, 4);
    }

    if (selectedUnit?.isAlive) {
      const px = selectedUnit.x * TILE_SIZE;
      const py = selectedUnit.y * TILE_SIZE;
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }

    if (cursor) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        cursor.x * TILE_SIZE + 2,
        cursor.y * TILE_SIZE + 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4
      );
    }
  }
}
