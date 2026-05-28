import { Pause, Play, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ImportedResult, WorkbenchBrief } from "../workbench/workbenchTypes";

type SpriteAnimationPreviewProps = {
  result: ImportedResult;
  brief: WorkbenchBrief;
};

export default function SpriteAnimationPreview({ result, brief }: SpriteAnimationPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const [fps, setFps] = useState(8);
  const [scale, setScale] = useState(4);
  const rowLabels = useMemo(() => getRowLabels(brief), [brief]);
  const rowIndexes = useMemo(() => Array.from({ length: brief.rows }, (_, index) => index), [brief.rows]);
  const canAnimate = brief.assetKind !== "hex_map_tiles" && brief.columns > 1;
  const safeFrame = Math.min(frame, Math.max(0, brief.columns - 1));
  const baselineY = Math.max(1, brief.cellHeight - 12);
  const rootX = Math.round(brief.cellWidth / 2);

  useEffect(() => {
    setFrame(0);
  }, [result.id, brief.columns, brief.rows]);

  useEffect(() => {
    if (!canAnimate || !isPlaying) return;
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % brief.columns);
    }, 1000 / fps);

    return () => window.clearInterval(timer);
  }, [brief.columns, canAnimate, fps, isPlaying]);

  if (!canAnimate) {
    return (
      <div className="animation-preview static">
        <div className="animation-stage">
          <div
            className="animation-frame-wrap"
            style={{
              width: brief.cellWidth * Math.min(scale, 3),
              height: brief.cellHeight * Math.min(scale, 3),
            }}
          >
            <div
              className="animation-frame"
              style={{
                backgroundImage: `url(${result.dataUrl})`,
                backgroundSize: `${result.width * Math.min(scale, 3)}px ${result.height * Math.min(scale, 3)}px`,
                backgroundPosition: "0 0",
              }}
            />
          </div>
        </div>
        <span className="animation-note">当前资产类型按 atlas 预览，不播放帧动画。</span>
      </div>
    );
  }

  return (
    <div className="animation-preview">
      <div className="animation-stage-grid">
        {rowIndexes.map((rowIndex) => (
          <section className="animation-row-card" key={rowIndex} aria-label={rowLabels[rowIndex] ?? `Row ${rowIndex + 1}`}>
            <div className="animation-row-label">{rowLabels[rowIndex] ?? `Row ${rowIndex + 1}`}</div>
            <div className="animation-stage">
              <div
                className="animation-frame-wrap"
                style={{
                  width: brief.cellWidth * scale,
                  height: brief.cellHeight * scale,
                }}
              >
                <div
                  className="animation-frame"
                  style={{
                    backgroundImage: `url(${result.dataUrl})`,
                    backgroundSize: `${result.width * scale}px ${result.height * scale}px`,
                    backgroundPosition: `${-safeFrame * brief.cellWidth * scale}px ${-rowIndex * brief.cellHeight * scale}px`,
                  }}
                />
                <span className="anchor-guide baseline" style={{ top: baselineY * scale }} />
                <span className="anchor-guide rootline" style={{ left: rootX * scale }} />
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="animation-controls">
        <button className="tool-button" type="button" onClick={() => setIsPlaying((value) => !value)}>
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          {isPlaying ? "暂停" : "播放"}
        </button>
        <button className="tool-button" type="button" onClick={() => setFrame((current) => (current + 1) % brief.columns)}>
          <SkipForward size={17} />
          下一帧
        </button>
        <label>
          <span>FPS</span>
          <input min={1} max={24} type="range" value={fps} onChange={(event) => setFps(Number(event.target.value))} />
          <b>{fps}</b>
        </label>
        <label>
          <span>缩放</span>
          <input min={2} max={8} type="range" value={scale} onChange={(event) => setScale(Number(event.target.value))} />
          <b>{scale}x</b>
        </label>
      </div>

      <div className="frame-strip">
        {Array.from({ length: brief.columns }, (_, index) => (
          <button
            key={index}
            className={index === safeFrame ? "frame-dot active" : "frame-dot"}
            type="button"
            onClick={() => setFrame(index)}
            aria-label={`Frame ${index + 1}`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function getRowLabels(brief: WorkbenchBrief): string[] {
  if (brief.assetKind === "pixel_character" && brief.rows === 4) return ["正面", "背面", "左侧", "右侧"];
  if (brief.assetKind === "battle_sequence") return Array.from({ length: brief.rows }, (_, index) => `动作 ${index + 1}`);
  return Array.from({ length: brief.rows }, (_, index) => `Row ${index + 1}`);
}
