export type AssetKind = "pixel_character" | "battle_sequence" | "hex_map_tiles";

export type WorkflowStepId = "brief" | "style" | "prompt" | "import" | "quality" | "export" | "library";

export type CheckStatus = "pending" | "pass" | "warn" | "fail";

export type WorkbenchBrief = {
  assetKind: AssetKind;
  assetName: string;
  productionGoal: string;
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
  viewMode: string;
  deliverable: string;
  referencePolicy: string;
  notes: string;
};

export type AssetPreset = {
  kind: AssetKind;
  label: string;
  shortLabel: string;
  defaultBrief: WorkbenchBrief;
  acceptance: string[];
};

export type StyleSpec = {
  id: string;
  name: string;
  tone: string;
  palette: string;
  must: string[];
  avoid: string[];
  promptStyle: string;
};

export type ImportedResult = {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  importedAt: string;
  source: "upload" | "sample" | "codex" | "history";
};

export type QualityCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

export type AssetLibraryEntry = {
  id: string;
  name: string;
  kind: AssetKind;
  styleName: string;
  width: number;
  height: number;
  prompt: string;
  checks: QualityCheck[];
  createdAt: string;
};
