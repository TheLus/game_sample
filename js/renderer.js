import { TILE_SIZE, Terrain, Team } from "./config.js";

const TERRAIN_BY_ID = Object.values(Terrain).filter((t) => t.id !== undefined);

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  draw(state) {
    const { map, units, cursor, moveTiles, attackTiles, selectedUnit } = state;
    const ctx = this.ctx;
    const w = map[0].length * TILE_SIZE;
    const h = map.length * TILE_SIZE;

    ctx.clearRect(0, 0, w, h);

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const terrain = TERRAIN_BY_ID[map[y][x]] ?? Terrain.PLAIN;
        ctx.fillStyle = terrain.color;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        if (terrain.id === 1) {
          ctx.fillStyle = "rgba(0,40,0,0.3)";
          ctx.beginPath();
          ctx.arc(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            6,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }

    if (moveTiles) {
      ctx.fillStyle = "rgba(74, 158, 255, 0.35)";
      for (const key of moveTiles) {
        const [x, y] = key.split(",").map(Number);
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    if (attackTiles) {
      ctx.fillStyle = "rgba(233, 69, 96, 0.4)";
      for (const { x, y } of attackTiles) {
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
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
      ctx.fillStyle = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#fbbf24" : "#ef4444";
      ctx.fillRect(px + 4, py + TILE_SIZE - 6, barW * hpRatio, 4);

      if (unit.hasMoved && unit.hasActed) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      }
    }

    if (selectedUnit) {
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
