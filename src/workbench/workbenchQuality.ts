import { loadImage } from "../lib/imageTools";
import type { ImportedResult, QualityCheck, WorkbenchBrief } from "./workbenchTypes";
import { getOutputSize } from "./workbenchPresets";
import { analyzeSpriteAnchors } from "./spriteSheetAnchors";

export async function evaluateImageQuality(result: ImportedResult | null, brief: WorkbenchBrief): Promise<QualityCheck[]> {
  if (!result) {
    return [
      {
        id: "result_loaded",
        label: "结果导入",
        status: "pending",
        detail: "尚未导入图片。",
      },
    ];
  }

  const expected = getOutputSize(brief);
  const image = await loadImage(result.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = requireContext(canvas);
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const alphaStats = scanAlpha(imageData.data, canvas.width, canvas.height);
  const cellStats = scanCells(imageData.data, canvas.width, canvas.height, brief.columns, brief.rows);
  const anchorAnalysis =
    brief.assetKind !== "hex_map_tiles"
      ? analyzeSpriteAnchors(imageData.data, canvas.width, canvas.height, brief.columns, brief.rows)
      : null;

  const exactSize = canvas.width === expected.width && canvas.height === expected.height;
  const gridAligned = canvas.width % brief.columns === 0 && canvas.height % brief.rows === 0;
  const transparentCorners = getCornerAlpha(imageData.data, canvas.width, canvas.height).filter((alpha) => alpha < 12).length;
  const touchesOuterEdge = alphaStats.bounds
    ? alphaStats.bounds.minX <= 1 ||
      alphaStats.bounds.minY <= 1 ||
      alphaStats.bounds.maxX >= canvas.width - 2 ||
      alphaStats.bounds.maxY >= canvas.height - 2
    : false;
  const emptyCells = cellStats.filter((cell) => cell.opaquePixels < 16).length;

  const checks: QualityCheck[] = [
    {
      id: "result_loaded",
      label: "结果导入",
      status: "pass",
      detail: `${result.name}，${canvas.width} x ${canvas.height}px。`,
    },
    {
      id: "canvas_size",
      label: "画布尺寸",
      status: exactSize ? "pass" : gridAligned ? "warn" : "fail",
      detail: exactSize
        ? `符合 ${expected.width} x ${expected.height}px。`
        : `当前 ${canvas.width} x ${canvas.height}px，期望 ${expected.width} x ${expected.height}px。`,
    },
    {
      id: "grid_layout",
      label: "网格切分",
      status: gridAligned ? "pass" : "fail",
      detail: gridAligned
        ? `可切为 ${brief.columns} x ${brief.rows}，单元约 ${Math.floor(canvas.width / brief.columns)} x ${Math.floor(
            canvas.height / brief.rows,
          )}px。`
        : "图片尺寸无法按目标行列整除。",
    },
    {
      id: "transparent_background",
      label: "透明背景",
      status: transparentCorners === 4 ? "pass" : transparentCorners >= 2 ? "warn" : "fail",
      detail:
        transparentCorners === 4
          ? "四角透明，适合作为 sprite/atlas 导入。"
          : `四角透明数 ${transparentCorners}/4，可能带有背景或棋盘格底。`,
    },
    {
      id: "outer_margin",
      label: "安全边距",
      status: !alphaStats.bounds ? "fail" : touchesOuterEdge ? "warn" : "pass",
      detail: !alphaStats.bounds
        ? "没有检测到有效不透明内容。"
        : touchesOuterEdge
          ? "有效内容贴近画布边缘，切图时可能被裁。"
          : "有效内容未贴边。",
    },
    {
      id: "cell_content",
      label: "单元完整度",
      status: emptyCells === 0 ? "pass" : emptyCells <= Math.max(1, Math.floor(cellStats.length * 0.2)) ? "warn" : "fail",
      detail: emptyCells === 0 ? "每个目标单元都检测到内容。" : `${emptyCells}/${cellStats.length} 个单元接近空白。`,
    },
  ];

  if (anchorAnalysis) {
    checks.push(buildAnchorCheck(anchorAnalysis, brief));
    if (brief.assetKind === "pixel_character") {
      checks.push(buildDirectionScaleCheck(anchorAnalysis));
    }
  }

  return checks;
}

export function summarizeChecks(checks: QualityCheck[]): { pass: number; warn: number; fail: number; pending: number } {
  return checks.reduce(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { pass: 0, warn: 0, fail: 0, pending: 0 },
  );
}

function scanAlpha(data: Uint8ClampedArray, width: number, height: number) {
  let opaquePixels = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 16) continue;
      opaquePixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return {
    opaquePixels,
    bounds: opaquePixels > 0 ? { minX, minY, maxX, maxY } : null,
  };
}

function scanCells(data: Uint8ClampedArray, width: number, height: number, columns: number, rows: number) {
  const cellWidth = Math.floor(width / columns);
  const cellHeight = Math.floor(height / rows);
  const cells: Array<{ column: number; row: number; opaquePixels: number }> = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let opaquePixels = 0;
      const startX = column * cellWidth;
      const startY = row * cellHeight;
      const endX = column === columns - 1 ? width : startX + cellWidth;
      const endY = row === rows - 1 ? height : startY + cellHeight;

      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          if (data[(y * width + x) * 4 + 3] >= 16) opaquePixels += 1;
        }
      }

      cells.push({ column, row, opaquePixels });
    }
  }

  return cells;
}

function getCornerAlpha(data: Uint8ClampedArray, width: number, height: number): number[] {
  return [
    data[3],
    data[(width - 1) * 4 + 3],
    data[((height - 1) * width) * 4 + 3],
    data[((height - 1) * width + width - 1) * 4 + 3],
  ];
}

function buildAnchorCheck(
  analysis: ReturnType<typeof analyzeSpriteAnchors>,
  brief: WorkbenchBrief,
): QualityCheck {
  const xPass = brief.assetKind === "battle_sequence" ? 4 : 2;
  const xWarn = brief.assetKind === "battle_sequence" ? 8 : 5;
  const yPass = 1;
  const yWarn = 3;
  const status =
    analysis.maxBottomDelta <= yPass && analysis.maxAnchorDelta <= xPass
      ? "pass"
      : analysis.maxBottomDelta <= yWarn && analysis.maxAnchorDelta <= xWarn
        ? "warn"
        : "fail";
  const rowDetails = analysis.rows
    .map(
      (row) =>
        `第${row.row + 1}行 bottom ${row.bottomMin}-${row.bottomMax}，anchorX ${row.anchorMin.toFixed(1)}-${row.anchorMax.toFixed(
          1,
        )}`,
    )
    .join("；");

  return {
    id: "anchor_stability",
    label: "脚底锚点稳定",
    status,
    detail:
      status === "pass"
        ? `脚底基线和下半身锚点稳定。${rowDetails}`
        : `检测到帧间锚点漂移：最大 bottom 差 ${analysis.maxBottomDelta}px，最大 anchorX 差 ${analysis.maxAnchorDelta.toFixed(
            1,
          )}px。${rowDetails}`,
  };
}

function buildDirectionScaleCheck(analysis: ReturnType<typeof analyzeSpriteAnchors>): QualityCheck {
  const rowStats = analysis.rows.map((row) => {
    const metrics = analysis.metrics.filter((metric) => metric.row === row.row && metric.bounds);
    const heights = metrics.map((metric) => metric.bounds!.maxY - metric.bounds!.minY + 1);
    const medianHeight = median(heights);
    return {
      row: row.row,
      medianHeight,
      baseline: row.targetBottomY,
    };
  });
  const heightValues = rowStats.map((row) => row.medianHeight);
  const baselineValues = rowStats.map((row) => row.baseline);
  const heightDelta = Math.max(...heightValues) - Math.min(...heightValues);
  const baselineDelta = Math.max(...baselineValues) - Math.min(...baselineValues);
  const status = heightDelta <= 4 && baselineDelta <= 2 ? "pass" : heightDelta <= 8 && baselineDelta <= 6 ? "warn" : "fail";
  const labels = ["正面", "背面", "左侧", "右侧"];
  const detail = rowStats
    .map((row) => `${labels[row.row] ?? `第${row.row + 1}行`} h=${row.medianHeight.toFixed(0)} bottom=${row.baseline}`)
    .join("；");

  return {
    id: "direction_scale",
    label: "四方向身高一致",
    status,
    detail:
      status === "pass"
        ? `四方向身高和脚底基线一致。${detail}`
        : `四方向存在尺度差：身高差 ${heightDelta.toFixed(0)}px，脚底基线差 ${baselineDelta}px。${detail}`,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function requireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context is not available.");
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
