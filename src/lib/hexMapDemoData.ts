export type TerrainKind =
  | "plain"
  | "forest"
  | "mountain"
  | "river"
  | "farmland"
  | "road"
  | "lake"
  | "dock"
  | "pass"
  | "fog";

export type FactionKind = "han" | "shu" | "wu" | "wei" | "neutral";

export type HexTile = {
  q: number;
  r: number;
  terrain: TerrainKind;
  faction: FactionKind;
  marker?: "city" | "fort" | "gate" | "dock" | "farm" | "mine" | "camp";
  name?: string;
  alliance?: string;
  army?: "infantry" | "cavalry" | "archer" | "siege";
  selected?: boolean;
  warning?: boolean;
};

export type MarchRoute = {
  id: string;
  from: [number, number];
  to: [number, number];
  faction: FactionKind;
};

const terrainRows: TerrainKind[][] = [
  ["mountain", "mountain", "mountain", "forest", "plain", "road", "plain", "forest", "mountain", "mountain", "mountain", "fog"],
  ["mountain", "mountain", "forest", "plain", "road", "city" as TerrainKind, "road", "plain", "forest", "mountain", "pass", "fog"],
  ["forest", "forest", "plain", "farmland", "road", "river", "river", "road", "plain", "forest", "plain", "fog"],
  ["plain", "farmland", "farmland", "plain", "forest", "river", "lake", "river", "road", "plain", "camp" as TerrainKind, "forest"],
  ["plain", "road", "plain", "forest", "mountain", "river", "dock" as TerrainKind, "plain", "farmland", "farmland", "plain", "mountain"],
  ["farmland", "plain", "forest", "mountain", "pass", "plain", "road", "farmland", "city" as TerrainKind, "road", "forest", "mountain"],
  ["plain", "camp" as TerrainKind, "plain", "forest", "mountain", "plain", "farmland", "road", "plain", "forest", "mountain", "fog"],
  ["fog", "plain", "farmland", "plain", "forest", "mountain", "pass", "plain", "forest", "mountain", "mountain", "fog"],
];

export const hexTiles: HexTile[] = terrainRows.flatMap((row, r) =>
  row.map((terrain, q) => ({
    q,
    r,
    terrain: normalizeTerrain(terrain),
    faction: factionFor(q, r),
    ...markerFor(q, r),
  })),
);

export const marchRoutes: MarchRoute[] = [
  { id: "route-a", from: [1, 6], to: [5, 3], faction: "shu" },
  { id: "route-b", from: [8, 5], to: [6, 2], faction: "wei" },
  { id: "route-c", from: [10, 3], to: [8, 1], faction: "wu" },
];

function normalizeTerrain(terrain: TerrainKind): TerrainKind {
  if (terrain === ("city" as TerrainKind) || terrain === ("camp" as TerrainKind)) return "plain";
  if (terrain === ("dock" as TerrainKind)) return "dock";
  return terrain;
}

function factionFor(q: number, r: number): FactionKind {
  if (q >= 0 && q <= 3 && r >= 4) return "shu";
  if (q >= 7 && q <= 10 && r >= 2 && r <= 6) return "wei";
  if (q >= 4 && q <= 7 && r <= 3) return "wu";
  if (q >= 2 && q <= 5 && r >= 1 && r <= 4) return "han";
  return "neutral";
}

function markerFor(q: number, r: number): Partial<HexTile> {
  const key = `${q},${r}`;
  const markers: Record<string, Partial<HexTile>> = {
    "5,1": { marker: "city", name: "许都", alliance: "汉庭", army: "infantry" },
    "8,5": { marker: "city", name: "建业", alliance: "江东", army: "archer" },
    "1,6": { marker: "city", name: "成都", alliance: "西蜀", army: "cavalry" },
    "9,1": { marker: "gate", name: "虎牢关", alliance: "中立", selected: true },
    "4,6": { marker: "gate", name: "剑阁", alliance: "西蜀" },
    "6,4": { marker: "dock", name: "江陵港", alliance: "汉庭" },
    "10,3": { marker: "camp", name: "赤壁营", alliance: "江东", army: "siege", warning: true },
    "2,2": { marker: "farm", name: "屯田", alliance: "西蜀" },
    "9,3": { marker: "farm", name: "粮仓", alliance: "江东" },
    "3,5": { marker: "mine", name: "铁矿", alliance: "中立" },
    "7,0": { marker: "fort", name: "北寨", alliance: "江东" },
  };
  return markers[key] ?? {};
}
