import type { ImportedResult, StyleSpec, WorkbenchBrief } from "./workbenchTypes";
import { getOutputSize } from "./workbenchPresets";

export function createSampleResult(brief: WorkbenchBrief, style: StyleSpec): ImportedResult {
  const output = getOutputSize(brief);
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const ctx = requireContext(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < brief.rows; row += 1) {
    for (let column = 0; column < brief.columns; column += 1) {
      const x = column * brief.cellWidth;
      const y = row * brief.cellHeight;
      if (brief.assetKind === "hex_map_tiles") {
        drawHexTile(ctx, x, y, brief.cellWidth, brief.cellHeight, row, column);
      } else {
        drawPixelActor(ctx, x, y, brief.cellWidth, brief.cellHeight, row, column, style.id);
      }
    }
  }

  return {
    id: crypto.randomUUID(),
    name: `${brief.assetName}-sample.png`,
    dataUrl: canvas.toDataURL("image/png"),
    width: output.width,
    height: output.height,
    importedAt: new Date().toISOString(),
    source: "sample",
  };
}

function drawPixelActor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  row: number,
  column: number,
  styleId: string,
) {
  const unit = Math.max(2, Math.floor(Math.min(width, height) / 32));
  const centerX = x + Math.floor(width / 2);
  const footY = y + height - unit * 5;
  const sway = (column - 1) * unit * 2;
  const face = styleId === "ink_tactical" ? "#2c2721" : "#f2c79b";
  const hair = styleId === "pixel_clean" ? "#314c7c" : "#3b332b";
  const cloth = styleId === "strategy_sandbox" ? "#5b7c55" : "#3f8fb7";
  const trim = "#e7c66a";
  const shadow = "rgba(0, 0, 0, 0.22)";

  ctx.fillStyle = shadow;
  ctx.fillRect(centerX - unit * 7, footY + unit * 1, unit * 14, unit * 2);

  ctx.fillStyle = hair;
  ctx.fillRect(centerX - unit * 5, footY - unit * 25, unit * 10, unit * 8);
  ctx.fillStyle = face;
  ctx.fillRect(centerX - unit * 4, footY - unit * 22, unit * 8, unit * 7);
  ctx.fillStyle = "#1d2730";
  ctx.fillRect(centerX - unit * 3, footY - unit * 19, unit * 2, unit);
  ctx.fillRect(centerX + unit, footY - unit * 19, unit * 2, unit);

  ctx.fillStyle = cloth;
  ctx.fillRect(centerX - unit * 5, footY - unit * 14, unit * 10, unit * 10);
  ctx.fillStyle = trim;
  ctx.fillRect(centerX - unit, footY - unit * 14, unit * 2, unit * 10);
  ctx.fillRect(centerX - unit * 5, footY - unit * 8, unit * 10, unit * 2);

  ctx.fillStyle = cloth;
  ctx.fillRect(centerX - unit * 8 - sway, footY - unit * 13, unit * 4, unit * 8);
  ctx.fillRect(centerX + unit * 4 + sway, footY - unit * 13, unit * 4, unit * 8);

  ctx.fillStyle = "#f5ead8";
  ctx.fillRect(centerX - unit * 4 + sway, footY - unit * 4, unit * 3, unit * 5);
  ctx.fillRect(centerX + unit - sway, footY - unit * 4, unit * 3, unit * 5);

  if (row === 1) {
    ctx.fillStyle = hair;
    ctx.fillRect(centerX - unit * 5, footY - unit * 23, unit * 10, unit * 10);
  }
  if (row >= 2) {
    ctx.fillStyle = "#d9e5ef";
    ctx.fillRect(centerX + (row === 2 ? -unit * 7 : unit * 5), footY - unit * 17, unit * 3, unit * 8);
  }
}

function drawHexTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  row: number,
  column: number,
) {
  const padX = Math.floor(width * 0.08);
  const padY = Math.floor(height * 0.08);
  const left = x + padX;
  const right = x + width - padX;
  const top = y + padY;
  const bottom = y + height - padY;
  const midX = x + Math.floor(width / 2);
  const midY = y + Math.floor(height / 2);
  const terrain = (row * 5 + column) % 5;
  const fills = ["#a9b77a", "#5f8763", "#8e8a77", "#70a8b6", "#b99655"];
  const accents = ["#d9d49a", "#335b3c", "#d8d2be", "#d5f0ee", "#6e5730"];

  ctx.beginPath();
  ctx.moveTo(midX, top);
  ctx.lineTo(right, y + Math.floor(height * 0.28));
  ctx.lineTo(right, y + Math.floor(height * 0.72));
  ctx.lineTo(midX, bottom);
  ctx.lineTo(left, y + Math.floor(height * 0.72));
  ctx.lineTo(left, y + Math.floor(height * 0.28));
  ctx.closePath();
  ctx.fillStyle = fills[terrain];
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = accents[terrain];
  if (terrain === 1) {
    for (let i = 0; i < 7; i += 1) {
      ctx.fillRect(left + 12 + i * 11, midY - 22 + (i % 3) * 12, 9, 13);
    }
  } else if (terrain === 2) {
    ctx.fillRect(midX - 18, midY - 22, 36, 44);
    ctx.fillStyle = "#d8d2be";
    ctx.fillRect(midX - 8, midY - 28, 16, 16);
  } else if (terrain === 3) {
    ctx.fillRect(left, midY - 8, width, 16);
    ctx.fillStyle = "#eef9f6";
    ctx.fillRect(left + 18, midY - 2, width - 36, 3);
  } else if (terrain === 4) {
    for (let i = 0; i < 6; i += 1) {
      ctx.fillRect(left + i * 15, top + 14, 3, bottom - top - 28);
    }
  } else {
    ctx.fillRect(midX - 22, midY - 4, 44, 8);
    ctx.fillRect(midX - 4, midY - 22, 8, 44);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(31, 39, 31, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function requireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available.");
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
