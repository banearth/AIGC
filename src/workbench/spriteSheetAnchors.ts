import { loadImage } from "../lib/imageTools";
import type { WorkbenchBrief } from "./workbenchTypes";

export type SpriteAnchorMetric = {
  row: number;
  column: number;
  opaquePixels: number;
  bottomY: number;
  anchorX: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
};

export type SpriteAnchorRowSummary = {
  row: number;
  targetBottomY: number;
  targetAnchorX: number;
  bottomMin: number;
  bottomMax: number;
  anchorMin: number;
  anchorMax: number;
  bottomDelta: number;
  anchorDelta: number;
};

export type SpriteAnchorAnalysis = {
  metrics: SpriteAnchorMetric[];
  rows: SpriteAnchorRowSummary[];
  maxBottomDelta: number;
  maxAnchorDelta: number;
};

const ALPHA_THRESHOLD = 16;

export async function alignSpriteSheetAnchors(
  src: string,
  brief: WorkbenchBrief,
): Promise<{ dataUrl: string; width: number; height: number; analysis: SpriteAnchorAnalysis }> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const sourceCtx = requireContext(canvas);
  sourceCtx.drawImage(image, 0, 0);
  const imageData = sourceCtx.getImageData(0, 0, canvas.width, canvas.height);
  const analysis = analyzeSpriteAnchors(imageData.data, canvas.width, canvas.height, brief.columns, brief.rows);
  const cellWidth = Math.floor(canvas.width / brief.columns);
  const cellHeight = Math.floor(canvas.height / brief.rows);
  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  const outputCtx = requireContext(output);
  const summaryByRow = new Map(analysis.rows.map((row) => [row.row, row]));
  const globalTarget =
    brief.assetKind === "pixel_character"
      ? {
          // Four-direction character sheets should share one root baseline.
          // Use the lowest detected stable baseline to avoid clipping tall directions upward.
          bottomY: Math.max(...analysis.rows.map((row) => row.targetBottomY)),
          anchorX: median(analysis.metrics.filter((metric) => metric.bounds).map((metric) => metric.anchorX)),
        }
      : null;

  for (const metric of analysis.metrics) {
    const sourceX = metric.column * cellWidth;
    const sourceY = metric.row * cellHeight;
    const summary = summaryByRow.get(metric.row);
    if (!metric.bounds || !summary) continue;

    const targetBottomY = globalTarget?.bottomY ?? summary.targetBottomY;
    const targetAnchorX = globalTarget?.anchorX ?? summary.targetAnchorX;
    const dx = Math.round(targetAnchorX - metric.anchorX);
    const dy = Math.round(targetBottomY - metric.bottomY);
    outputCtx.save();
    outputCtx.beginPath();
    outputCtx.rect(sourceX, sourceY, cellWidth, cellHeight);
    outputCtx.clip();
    outputCtx.drawImage(canvas, sourceX, sourceY, cellWidth, cellHeight, sourceX + dx, sourceY + dy, cellWidth, cellHeight);
    outputCtx.restore();
  }

  return {
    dataUrl: output.toDataURL("image/png"),
    width: output.width,
    height: output.height,
    analysis,
  };
}

export function analyzeSpriteAnchors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  columns: number,
  rows: number,
): SpriteAnchorAnalysis {
  const cellWidth = Math.floor(width / columns);
  const cellHeight = Math.floor(height / rows);
  const metrics: SpriteAnchorMetric[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      metrics.push(measureCellAnchor(data, width, cellWidth, cellHeight, row, column));
    }
  }

  const summaries: SpriteAnchorRowSummary[] = [];
  for (let row = 0; row < rows; row += 1) {
    const rowMetrics = metrics.filter((metric) => metric.row === row && metric.bounds);
    if (rowMetrics.length === 0) continue;
    const bottomValues = rowMetrics.map((metric) => metric.bottomY);
    const anchorValues = rowMetrics.map((metric) => metric.anchorX);
    const bottomMin = Math.min(...bottomValues);
    const bottomMax = Math.max(...bottomValues);
    const anchorMin = Math.min(...anchorValues);
    const anchorMax = Math.max(...anchorValues);
    summaries.push({
      row,
      targetBottomY: Math.round(median(bottomValues)),
      targetAnchorX: median(anchorValues),
      bottomMin,
      bottomMax,
      anchorMin,
      anchorMax,
      bottomDelta: bottomMax - bottomMin,
      anchorDelta: anchorMax - anchorMin,
    });
  }

  return {
    metrics,
    rows: summaries,
    maxBottomDelta: summaries.length ? Math.max(...summaries.map((row) => row.bottomDelta)) : 0,
    maxAnchorDelta: summaries.length ? Math.max(...summaries.map((row) => row.anchorDelta)) : 0,
  };
}

function measureCellAnchor(
  data: Uint8ClampedArray,
  imageWidth: number,
  cellWidth: number,
  cellHeight: number,
  row: number,
  column: number,
): SpriteAnchorMetric {
  const offsetX = column * cellWidth;
  const offsetY = row * cellHeight;
  let opaquePixels = 0;
  let minX = cellWidth;
  let minY = cellHeight;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < cellHeight; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      const alpha = data[((offsetY + y) * imageWidth + offsetX + x) * 4 + 3];
      if (alpha < ALPHA_THRESHOLD) continue;
      opaquePixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (opaquePixels === 0) {
    return {
      row,
      column,
      opaquePixels,
      bottomY: -1,
      anchorX: cellWidth / 2,
      bounds: null,
    };
  }

  const lowerBandStart = Math.max(minY, maxY - Math.max(8, Math.round(cellHeight * 0.44)));
  let weightedX = 0;
  let weight = 0;
  for (let y = lowerBandStart; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const alpha = data[((offsetY + y) * imageWidth + offsetX + x) * 4 + 3];
      if (alpha < ALPHA_THRESHOLD) continue;
      weightedX += x;
      weight += 1;
    }
  }

  return {
    row,
    column,
    opaquePixels,
    bottomY: maxY,
    anchorX: weight > 0 ? weightedX / weight : (minX + maxX) / 2,
    bounds: { minX, minY, maxX, maxY },
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function requireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context is not available.");
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
