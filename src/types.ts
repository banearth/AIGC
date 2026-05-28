export type GridSettings = {
  tileWidth: number;
  tileHeight: number;
  margin: number;
  spacing: number;
};

export type Sprite = {
  id: string;
  name: string;
  width: number;
  height: number;
  tileW: number;
  tileH: number;
  dataUrl: string;
};

export type LayoutItem = {
  id: string;
  spriteId: string;
  x: number;
  y: number;
};

export type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CharacterSheetPreset = "single" | "four_direction" | "walk_cycle_12";

export type CharacterView = "top_down" | "side_view" | "isometric";

export type CharacterSpec = {
  name: string;
  tileSize: number;
  preset: CharacterSheetPreset;
  view: CharacterView;
  palette: string;
  styleNotes: string;
};
