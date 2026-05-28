import type { GridSettings, LayoutItem, SelectionRect, Sprite } from "../types";

export type LoadedImage = {
  url: string;
  width: number;
  height: number;
};

export type AutoDetectOptions = {
  alphaThreshold: number;
  minOpaquePixels: number;
  padding: number;
  maxSprites: number;
  snapToGrid: boolean;
};

export async function readImageFile(file: File): Promise<LoadedImage> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = await loadImage(url);
  return { url, width: image.naturalWidth, height: image.naturalHeight };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load."));
    image.src = src;
  });
}

export function normalizeRect(rect: SelectionRect): SelectionRect {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x;
  const y = rect.height < 0 ? rect.y + rect.height : rect.y;
  return {
    x,
    y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  };
}

export function snapRectToGrid(
  rect: SelectionRect,
  grid: GridSettings,
  bounds: { width: number; height: number },
): SelectionRect {
  const normalized = normalizeRect(rect);
  const stepX = Math.max(1, grid.tileWidth + grid.spacing);
  const stepY = Math.max(1, grid.tileHeight + grid.spacing);
  const minX = grid.margin;
  const minY = grid.margin;
  const startX = minX + Math.floor((normalized.x - minX) / stepX) * stepX;
  const startY = minY + Math.floor((normalized.y - minY) / stepY) * stepY;
  const endX = minX + Math.ceil((normalized.x + normalized.width - minX) / stepX) * stepX;
  const endY = minY + Math.ceil((normalized.y + normalized.height - minY) / stepY) * stepY;

  const x = clamp(startX, 0, bounds.width);
  const y = clamp(startY, 0, bounds.height);
  return {
    x,
    y,
    width: clamp(endX, x, bounds.width) - x,
    height: clamp(endY, y, bounds.height) - y,
  };
}

export async function removeEdgeBackground(
  src: string,
  tolerance: number,
): Promise<{ dataUrl: string; removedPixels: number }> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = requireContext(canvas);
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const samples = [
    getPixel(data, width, 0, 0),
    getPixel(data, width, width - 1, 0),
    getPixel(data, width, 0, height - 1),
    getPixel(data, width, width - 1, height - 1),
  ];
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];

  for (let x = 0; x < width; x += 1) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    stack.push(y * width, y * width + width - 1);
  }

  let removedPixels = 0;
  while (stack.length > 0) {
    const index = stack.pop()!;
    if (visited[index]) continue;
    visited[index] = 1;
    const px = index % width;
    const py = Math.floor(index / width);
    const offset = index * 4;
    const current = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
    if (!matchesAnySample(current, samples, tolerance)) continue;

    if (data[offset + 3] !== 0) removedPixels += 1;
    data[offset + 3] = 0;
    if (px > 0) stack.push(index - 1);
    if (px < width - 1) stack.push(index + 1);
    if (py > 0) stack.push(index - width);
    if (py < height - 1) stack.push(index + width);
  }

  ctx.putImageData(imageData, 0, 0);
  return { dataUrl: canvas.toDataURL("image/png"), removedPixels };
}

export async function cropSprite(
  src: string,
  selection: SelectionRect,
  grid: GridSettings,
  index: number,
): Promise<Sprite> {
  const image = await loadImage(src);
  const rect = normalizeRect(selection);
  const tileW = Math.max(1, Math.ceil(rect.width / grid.tileWidth));
  const tileH = Math.max(1, Math.ceil(rect.height / grid.tileHeight));
  const width = tileW * grid.tileWidth;
  const height = tileH * grid.tileHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = requireContext(canvas);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);

  return {
    id: crypto.randomUUID(),
    name: `sprite-${String(index).padStart(3, "0")}`,
    width,
    height,
    tileW,
    tileH,
    dataUrl: canvas.toDataURL("image/png"),
  };
}

export async function detectSpriteRegions(
  src: string,
  grid: GridSettings,
  options: AutoDetectOptions,
): Promise<SelectionRect[]> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = requireContext(canvas);
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const visited = new Uint8Array(width * height);
  const regions: Array<SelectionRect & { opaquePixels: number }> = [];

  for (let index = 0; index < width * height; index += 1) {
    if (visited[index] || !isOpaque(data, index, options.alphaThreshold)) continue;
    const region = floodOpaqueRegion(data, visited, width, height, index, options.alphaThreshold);
    if (region.opaquePixels < options.minOpaquePixels) continue;

    const padded = expandRect(
      {
        x: region.minX,
        y: region.minY,
        width: region.maxX - region.minX + 1,
        height: region.maxY - region.minY + 1,
      },
      options.padding,
      { width, height },
    );
    const rect = options.snapToGrid ? snapRectToGrid(padded, grid, { width, height }) : padded;
    if (rect.width <= 0 || rect.height <= 0) continue;
    regions.push({ ...rect, opaquePixels: region.opaquePixels });
  }

  const uniqueRegions = new Map<string, SelectionRect & { opaquePixels: number }>();
  for (const region of regions) {
    const key = `${region.x}:${region.y}:${region.width}:${region.height}`;
    const existing = uniqueRegions.get(key);
    if (!existing || existing.opaquePixels < region.opaquePixels) {
      uniqueRegions.set(key, region);
    }
  }

  return Array.from(uniqueRegions.values())
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, options.maxSprites)
    .map(({ opaquePixels: _opaquePixels, ...rect }) => rect);
}

export async function makeSpriteSheet(
  sprites: Sprite[],
  layout: LayoutItem[],
  grid: GridSettings,
  columns: number,
  rows: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const width = columns * grid.tileWidth;
  const height = rows * grid.tileHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = requireContext(canvas);
  ctx.clearRect(0, 0, width, height);

  const spriteMap = new Map(sprites.map((sprite) => [sprite.id, sprite]));
  for (const item of layout) {
    const sprite = spriteMap.get(item.spriteId);
    if (!sprite) continue;
    const image = await loadImage(sprite.dataUrl);
    ctx.drawImage(image, item.x * grid.tileWidth, item.y * grid.tileHeight, sprite.width, sprite.height);
  }

  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

export function findFirstFreeSlot(
  sprites: Sprite[],
  layout: LayoutItem[],
  spriteId: string,
  columns: number,
  rows: number,
): { x: number; y: number } | null {
  const sprite = sprites.find((item) => item.id === spriteId);
  if (!sprite) return null;
  const occupied = buildOccupancy(sprites, layout, columns, rows);

  for (let y = 0; y <= rows - sprite.tileH; y += 1) {
    for (let x = 0; x <= columns - sprite.tileW; x += 1) {
      if (canPlace(occupied, x, y, sprite.tileW, sprite.tileH, columns, rows)) {
        return { x, y };
      }
    }
  }
  return null;
}

export function createTSX(
  name: string,
  imageSource: string,
  imageWidth: number,
  imageHeight: number,
  grid: GridSettings,
  columns: number,
  rows: number,
  sprites: Sprite[],
  layout: LayoutItem[],
): string {
  const spriteMap = new Map(sprites.map((sprite) => [sprite.id, sprite]));
  const tileProperties = layout
    .map((item) => {
      const sprite = spriteMap.get(item.spriteId);
      if (!sprite) return "";
      const tileId = item.y * columns + item.x;
      return [
        ` <tile id="${tileId}">`,
        "  <properties>",
        `   <property name="assetName" value="${escapeXml(sprite.name)}"/>`,
        `   <property name="assetId" value="${escapeXml(sprite.id)}"/>`,
        `   <property name="tileSpan" value="${sprite.tileW}x${sprite.tileH}"/>`,
        `   <property name="pixelSize" value="${sprite.width}x${sprite.height}"/>`,
        "  </properties>",
        " </tile>",
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<tileset version="1.10" tiledversion="1.11.0" name="${escapeXml(name)}" tilewidth="${grid.tileWidth}" tileheight="${grid.tileHeight}" spacing="0" margin="0" tilecount="${columns * rows}" columns="${columns}">`,
    ` <image source="${escapeXml(imageSource)}" width="${imageWidth}" height="${imageHeight}"/>`,
    tileProperties,
    "</tileset>",
    "",
  ].join("\n");
}

export function downloadText(filename: string, contents: string, mimeType = "text/plain") {
  const blob = new Blob([contents], { type: mimeType });
  downloadUrl(filename, URL.createObjectURL(blob), true);
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  downloadUrl(filename, dataUrl, false);
}

function downloadUrl(filename: string, url: string, revoke: boolean) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (revoke) {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function buildOccupancy(
  sprites: Sprite[],
  layout: LayoutItem[],
  columns: number,
  rows: number,
): Uint8Array {
  const spriteMap = new Map(sprites.map((sprite) => [sprite.id, sprite]));
  const occupied = new Uint8Array(columns * rows);
  for (const item of layout) {
    const sprite = spriteMap.get(item.spriteId);
    if (!sprite) continue;
    for (let y = item.y; y < item.y + sprite.tileH && y < rows; y += 1) {
      for (let x = item.x; x < item.x + sprite.tileW && x < columns; x += 1) {
        occupied[y * columns + x] = 1;
      }
    }
  }
  return occupied;
}

function canPlace(
  occupied: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
  columns: number,
  rows: number,
): boolean {
  if (x < 0 || y < 0 || x + width > columns || y + height > rows) return false;
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      if (occupied[py * columns + px]) return false;
    }
  }
  return true;
}

function floodOpaqueRegion(
  data: Uint8ClampedArray,
  visited: Uint8Array,
  width: number,
  height: number,
  startIndex: number,
  alphaThreshold: number,
): { minX: number; minY: number; maxX: number; maxY: number; opaquePixels: number } {
  const stack = [startIndex];
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let opaquePixels = 0;

  while (stack.length > 0) {
    const index = stack.pop()!;
    if (visited[index]) continue;
    visited[index] = 1;
    if (!isOpaque(data, index, alphaThreshold)) continue;

    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    opaquePixels += 1;

    if (x > 0) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (y > 0) stack.push(index - width);
    if (y < height - 1) stack.push(index + width);
  }

  return { minX, minY, maxX, maxY, opaquePixels };
}

function expandRect(
  rect: SelectionRect,
  padding: number,
  bounds: { width: number; height: number },
): SelectionRect {
  const x = clamp(rect.x - padding, 0, bounds.width);
  const y = clamp(rect.y - padding, 0, bounds.height);
  const right = clamp(rect.x + rect.width + padding, x, bounds.width);
  const bottom = clamp(rect.y + rect.height + padding, y, bounds.height);
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}

function isOpaque(data: Uint8ClampedArray, index: number, alphaThreshold: number): boolean {
  return data[index * 4 + 3] >= alphaThreshold;
}

function getPixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const offset = (y * width + x) * 4;
  return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
}

function matchesAnySample(pixel: number[], samples: number[][], tolerance: number): boolean {
  if (pixel[3] === 0) return true;
  return samples.some((sample) => colorDistance(pixel, sample) <= tolerance);
}

function colorDistance(a: number[], b: number[]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
      (a[1] - b[1]) ** 2 +
      (a[2] - b[2]) ** 2 +
      ((a[3] - b[3]) * 0.5) ** 2,
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function requireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context is not available.");
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
