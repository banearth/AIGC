import type { CharacterSheetPreset, CharacterSpec, CharacterView } from "../types";

export type PresetLayout = {
  columns: number;
  rows: number;
  label: string;
  promptLine: string;
};

const PRESET_LAYOUTS: Record<CharacterSheetPreset, PresetLayout> = {
  single: {
    columns: 1,
    rows: 1,
    label: "Single sprite",
    promptLine: "Create one front-facing idle character sprite in a single cell.",
  },
  four_direction: {
    columns: 4,
    rows: 1,
    label: "4 directions",
    promptLine: "Create four cells in one row: front, back, left, right.",
  },
  walk_cycle_12: {
    columns: 3,
    rows: 4,
    label: "4-dir walk cycle",
    promptLine:
      "Create a 3 columns by 4 rows sprite sheet. Rows are front, back, left, right. Columns are walk frame 1, idle/contact frame, walk frame 2.",
  },
};

const VIEW_TEXT: Record<CharacterView, string> = {
  top_down: "top-down RPG character view with a readable head and compact body",
  side_view: "side-view platformer character view with a clear silhouette",
  isometric: "three-quarter isometric game character view with consistent camera angle",
};

export function getPresetLayout(preset: CharacterSheetPreset): PresetLayout {
  return PRESET_LAYOUTS[preset];
}

export function buildPixelCharacterPrompt(spec: CharacterSpec, hasReference: boolean): string {
  const layout = getPresetLayout(spec.preset);
  const referenceLine = hasReference
    ? "Use the uploaded image as the character identity reference. Preserve the main outfit, colors, hairstyle, accessories, and overall personality, but redraw it as original pixel art."
    : "Design an original character from the written description.";

  return [
    "Generate a clean 2D pixel art game character sprite sheet.",
    referenceLine,
    "",
    `Character name: ${spec.name || "unnamed hero"}`,
    `Sprite cell size: ${spec.tileSize}x${spec.tileSize} pixels.`,
    `Camera: ${VIEW_TEXT[spec.view]}.`,
    `Layout: ${layout.promptLine}`,
    `Canvas: exactly ${layout.columns} columns by ${layout.rows} rows, every cell aligned to the same ${spec.tileSize}x${spec.tileSize} grid.`,
    "",
    "Hard requirements:",
    "- transparent background",
    "- crisp pixel art, no blur, no painterly shading",
    "- nearest-neighbor pixel edges",
    "- centered character in every cell",
    "- consistent scale, outfit, colors, and proportions across all cells",
    "- no text, labels, watermarks, UI, shadows, gradients, or background scene",
    "- leave a small transparent margin inside each cell",
    "- export as a single PNG sprite sheet",
    "",
    `Palette: ${spec.palette}`,
    `Style notes: ${spec.styleNotes}`,
  ].join("\n");
}
