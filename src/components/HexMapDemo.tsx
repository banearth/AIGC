import { Flag, Map, Route, Tags, Wheat, Trees, Coins, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { hexTiles, marchRoutes, type FactionKind, type HexTile } from "../lib/hexMapDemoData";

const HEX_WIDTH = 126;
const HEX_HEIGHT = 108;
const HEX_X_STEP = 98;
const HEX_Y_STEP = 92;
const HEX_ODD_OFFSET = 46;

const factionLabels: Record<FactionKind, string> = {
  han: "汉",
  shu: "蜀",
  wu: "吴",
  wei: "魏",
  neutral: "野",
};

const factionColors: Record<FactionKind, string> = {
  han: "#c49a4d",
  shu: "#4f9d66",
  wu: "#4b9eb3",
  wei: "#b44c3f",
  neutral: "#8b877a",
};

const terrainImageMap: Record<HexTile["terrain"], string> = {
  plain: "plain",
  forest: "forest",
  mountain: "mountain",
  river: "river",
  farmland: "farmland",
  road: "road",
  lake: "lake",
  pass: "pass",
  fog: "fog",
  dock: "dock",
};

const markerImageMap: Record<NonNullable<HexTile["marker"]>, string> = {
  city: "city",
  fort: "fort",
  gate: "gate",
  dock: "dock",
  farm: "farm",
  mine: "mine",
  camp: "camp",
};

export default function HexMapDemo() {
  const [showLabels, setShowLabels] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showTerritory, setShowTerritory] = useState(true);
  const [activeTile, setActiveTile] = useState<HexTile | null>(hexTiles.find((tile) => tile.selected) ?? null);

  const boardSize = useMemo(() => {
    const maxQ = Math.max(...hexTiles.map((tile) => tile.q));
    const maxR = Math.max(...hexTiles.map((tile) => tile.r));
    return {
      width: maxQ * HEX_X_STEP + HEX_WIDTH + 28,
      height: maxR * HEX_Y_STEP + HEX_HEIGHT + HEX_ODD_OFFSET + 28,
    };
  }, []);

  return (
    <section className="panel hex-demo-panel">
      <div className="panel-header">
        <div>
          <p className="section-tag">HEX MAP DEMO</p>
          <h2>清爽国风沙盘分层渲染</h2>
        </div>
        <div className="hex-demo-actions">
          <button className={showLabels ? "tool-button active" : "tool-button"} type="button" onClick={() => setShowLabels((value) => !value)}>
            <Tags size={17} />
            名牌
          </button>
          <button className={showRoutes ? "tool-button active" : "tool-button"} type="button" onClick={() => setShowRoutes((value) => !value)}>
            <Route size={17} />
            行军
          </button>
          <button className={showTerritory ? "tool-button active" : "tool-button"} type="button" onClick={() => setShowTerritory((value) => !value)}>
            <Map size={17} />
            领地
          </button>
        </div>
      </div>

      <div className="hex-demo-layout">
        <div className="hex-map-scroll">
          <div className="hex-map-board" style={{ width: boardSize.width, height: boardSize.height }}>
            <div className="hex-map-hud">
              <div className="map-title-block">
                <b>司州 · 洛阳南境</b>
                <span>春 · 第 15 回合</span>
              </div>
              <div className="resource-strip">
                <span>
                  <Wheat size={14} /> 85.1k
                </span>
                <span>
                  <Trees size={14} /> 72.4k
                </span>
                <span>
                  <Coins size={14} /> 9860
                </span>
                <span>
                  <Shield size={14} /> 14/25
                </span>
              </div>
            </div>
            <svg className="hex-route-layer" width={boardSize.width} height={boardSize.height} aria-hidden="true">
              <defs>
                {Object.entries(factionColors).map(([faction, color]) => (
                  <marker key={faction} id={`arrow-${faction}`} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                    <path d="M0,0 L8,4.5 L0,9 Z" fill={color} />
                  </marker>
                ))}
              </defs>
              {showRoutes &&
                marchRoutes.map((route) => {
                  const from = hexCenter(route.from[0], route.from[1]);
                  const to = hexCenter(route.to[0], route.to[1]);
                  return (
                    <line
                      key={route.id}
                      className={`march-route route-${route.faction}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      markerEnd={`url(#arrow-${route.faction})`}
                    />
                  );
                })}
            </svg>

            {hexTiles.map((tile) => {
              const point = hexToPixel(tile.q, tile.r);
              const isActive = activeTile?.q === tile.q && activeTile?.r === tile.r;
              return (
                <button
                  key={`${tile.q}-${tile.r}`}
                  className={[
                    "hex-cell",
                    `terrain-${tile.terrain}`,
                    showTerritory ? `faction-${tile.faction}` : "",
                    tile.selected ? "is-selected" : "",
                    isActive ? "is-active" : "",
                    tile.warning ? "has-warning" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  style={{ left: point.x, top: point.y }}
                  onClick={() => setActiveTile(tile)}
                >
                  <img
                    className="hex-terrain-img"
                    src={`/assets/game/hex/terrain/${terrainImageMap[tile.terrain]}.png`}
                    alt=""
                    draggable={false}
                  />
                  {tile.marker && (
                    <img
                      className={`map-marker marker-${tile.marker}`}
                      src={`/assets/game/hex/markers/${markerImageMap[tile.marker]}.png`}
                      alt=""
                      draggable={false}
                    />
                  )}
                  {tile.army && <span className={`army-token army-${tile.army}`} />}
                  {showLabels && tile.name && (
                    <span className={`map-nameplate label-${tile.faction}`}>
                      <b>{tile.name}</b>
                      <small>{tile.alliance}</small>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="hex-info-panel">
          <div className="mini-map-card">
            <p className="section-tag">SELECTED HEX</p>
            <h3>{activeTile?.name ?? "未命名地块"}</h3>
            <dl>
              <div>
                <dt>坐标</dt>
                <dd>
                  {activeTile ? `${activeTile.q}, ${activeTile.r}` : "--"}
                </dd>
              </div>
              <div>
                <dt>势力</dt>
                <dd>{activeTile ? factionLabels[activeTile.faction] : "--"}</dd>
              </div>
              <div>
                <dt>地形</dt>
                <dd>{activeTile?.terrain ?? "--"}</dd>
              </div>
              <div>
                <dt>设施</dt>
                <dd>{activeTile?.marker ?? "none"}</dd>
              </div>
            </dl>
          </div>

          <div className="layer-stack-card">
            <p className="section-tag">LAYERS</p>
            <div className="layer-item">
              <Flag size={16} />
              <span>terrain hex cells</span>
            </div>
            <div className="layer-item">
              <Flag size={16} />
              <span>city/resource markers</span>
            </div>
            <div className="layer-item">
              <Flag size={16} />
              <span>territory borders</span>
            </div>
            <div className="layer-item">
              <Flag size={16} />
              <span>marching routes</span>
            </div>
            <div className="layer-item">
              <Flag size={16} />
              <span>player nameplates</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: q * HEX_X_STEP + 14,
    y: r * HEX_Y_STEP + (q % 2 === 1 ? HEX_ODD_OFFSET : 0) + 14,
  };
}

function hexCenter(q: number, r: number): { x: number; y: number } {
  const point = hexToPixel(q, r);
  return {
    x: point.x + HEX_WIDTH / 2,
    y: point.y + HEX_HEIGHT / 2,
  };
}
