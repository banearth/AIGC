import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  FileJson,
  ImageDown,
  ImagePlus,
  RefreshCcw,
  Library,
  PackageCheck,
  Palette,
  Play,
  ShieldCheck,
  Upload,
  WandSparkles,
  XCircle,
} from "lucide-react";
import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { downloadDataUrl, downloadText, readImageFile } from "../lib/imageTools";
import { createSampleResult } from "../workbench/sampleAssets";
import SpriteAnimationPreview from "./SpriteAnimationPreview";
import { alignSpriteSheetAnchors } from "../workbench/spriteSheetAnchors";
import {
  ASSET_PRESETS,
  STYLE_SPECS,
  WORKFLOW_STEPS,
  buildExportMetadata,
  buildWorkbenchPrompt,
  createDefaultBrief,
  getOutputSize,
} from "../workbench/workbenchPresets";
import { generateCodexImage, listGeneratedImages, type GeneratedImageEntry } from "../workbench/codexImageApi";
import { evaluateImageQuality, summarizeChecks } from "../workbench/workbenchQuality";
import type {
  AssetKind,
  AssetLibraryEntry,
  CheckStatus,
  ImportedResult,
  QualityCheck,
  WorkbenchBrief,
  WorkflowStepId,
} from "../workbench/workbenchTypes";

const DEFAULT_KIND: AssetKind = "pixel_character";

export default function GameArtWorkbench() {
  const [brief, setBrief] = useState<WorkbenchBrief>(() => createDefaultBrief(DEFAULT_KIND));
  const [styleId, setStyleId] = useState(STYLE_SPECS[0].id);
  const [activeStep, setActiveStep] = useState<WorkflowStepId>("brief");
  const [importedResult, setImportedResult] = useState<ImportedResult | null>(null);
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [libraryEntries, setLibraryEntries] = useState<AssetLibraryEntry[]>([]);
  const [generatedHistory, setGeneratedHistory] = useState<GeneratedImageEntry[]>([]);
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoSampleRanRef = useRef(false);

  const selectedStyle = useMemo(() => STYLE_SPECS.find((style) => style.id === styleId) ?? STYLE_SPECS[0], [styleId]);
  const preset = ASSET_PRESETS[brief.assetKind];
  const output = useMemo(() => getOutputSize(brief), [brief]);
  const prompt = useMemo(() => buildWorkbenchPrompt(brief, selectedStyle), [brief, selectedStyle]);
  const checkSummary = useMemo(() => summarizeChecks(checks), [checks]);
  const currentVerdict = useMemo(() => getVerdict(checkSummary), [checkSummary]);

  const updateBrief = <Key extends keyof WorkbenchBrief>(key: Key, value: WorkbenchBrief[Key]) => {
    setBrief((current) => ({ ...current, [key]: value }));
  };

  const handleAssetKindChange = (kind: AssetKind) => {
    setBrief(createDefaultBrief(kind));
    setImportedResult(null);
    setChecks([]);
    setStatus(`${ASSET_PRESETS[kind].label} preset loaded`);
  };

  const navigateTo = (step: WorkflowStepId) => {
    setActiveStep(step);
    document.getElementById(`step-${step}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const runQuality = async (result: ImportedResult | null = importedResult) => {
    setIsBusy(true);
    try {
      const nextChecks = await evaluateImageQuality(result, brief);
      setChecks(nextChecks);
      setStatus(formatQualityStatus(nextChecks));
      return nextChecks;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Quality check failed";
      setStatus(message);
      return [];
    } finally {
      setIsBusy(false);
    }
  };

  const refreshGeneratedHistory = async () => {
    try {
      const images = await listGeneratedImages();
      setGeneratedHistory(images);
      return images;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "历史列表加载失败");
      return [];
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsBusy(true);
    try {
      const image = await readImageFile(file);
      const result: ImportedResult = {
        id: crypto.randomUUID(),
        name: file.name,
        dataUrl: image.url,
        width: image.width,
        height: image.height,
        importedAt: new Date().toISOString(),
        source: "upload",
      };
      setImportedResult(result);
      const nextChecks = await evaluateImageQuality(result, brief);
      setChecks(nextChecks);
      setActiveStep("quality");
      setStatus(formatQualityStatus(nextChecks));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsBusy(false);
      event.target.value = "";
    }
  };

  const handleLoadSample = async () => {
    setIsBusy(true);
    try {
      const result = createSampleResult(brief, selectedStyle);
      setImportedResult(result);
      const nextChecks = await evaluateImageQuality(result, brief);
      setChecks(nextChecks);
      addLibraryEntry(result, nextChecks);
      setActiveStep("quality");
      setStatus(`示例流程完成：${formatQualityStatus(nextChecks)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sample run failed");
    } finally {
      setIsBusy(false);
    }
  };

  const handleGenerateWithCodex = async () => {
    setIsBusy(true);
    setStatus("Codex CLI fast 模式生成中，通常需要 1-3 分钟");
    try {
      const generated = await generateCodexImage({
        prompt,
        assetName: brief.assetName,
        width: output.width,
        height: output.height,
      });
      const result: ImportedResult = {
        id: generated.id,
        name: generated.fileName,
        dataUrl: generated.dataUrl,
        width: generated.width,
        height: generated.height,
        importedAt: new Date().toISOString(),
        source: "codex",
      };
      setImportedResult(result);
      const nextChecks = await evaluateImageQuality(result, brief);
      setChecks(nextChecks);
      addLibraryEntry(result, nextChecks);
      void refreshGeneratedHistory();
      setActiveStep("quality");
      setStatus(`Codex CLI 已生成：${generated.fileName}，${formatQualityStatus(nextChecks)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Codex CLI generation failed");
    } finally {
      setIsBusy(false);
    }
  };

  const handleAlignAnchors = async () => {
    if (!importedResult || brief.assetKind === "hex_map_tiles") return;
    setIsBusy(true);
    try {
      const aligned = await alignSpriteSheetAnchors(importedResult.dataUrl, brief);
      const result: ImportedResult = {
        ...importedResult,
        id: crypto.randomUUID(),
        name: withNameSuffix(importedResult.name, "aligned"),
        dataUrl: aligned.dataUrl,
        width: aligned.width,
        height: aligned.height,
        importedAt: new Date().toISOString(),
      };
      setImportedResult(result);
      const nextChecks = await evaluateImageQuality(result, brief);
      setChecks(nextChecks);
      setActiveStep("quality");
      setStatus(
        `已对齐脚底锚点：bottom 最大差 ${aligned.analysis.maxBottomDelta}px，anchorX 最大差 ${aligned.analysis.maxAnchorDelta.toFixed(
          1,
        )}px`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Anchor alignment failed");
    } finally {
      setIsBusy(false);
    }
  };

  const handleReworkWithCodex = async () => {
    if (!importedResult) return;
    setIsBusy(true);
    setStatus("Codex CLI fast 模式返工中，会参考当前图片和质检问题重新生成");
    try {
      const referenceImageDataUrl = await imageSourceToDataUrl(importedResult.dataUrl);
      const generated = await generateCodexImage({
        prompt: buildReworkPrompt(prompt, importedResult, checks),
        assetName: `${brief.assetName}-返工`,
        width: output.width,
        height: output.height,
        referenceImageDataUrl,
      });
      const result: ImportedResult = {
        id: generated.id,
        name: generated.fileName,
        dataUrl: generated.dataUrl,
        width: generated.width,
        height: generated.height,
        importedAt: new Date().toISOString(),
        source: "codex",
      };
      setImportedResult(result);
      const nextChecks = await evaluateImageQuality(result, brief);
      setChecks(nextChecks);
      addLibraryEntry(result, nextChecks);
      void refreshGeneratedHistory();
      setActiveStep("quality");
      setStatus(`Codex CLI 返工完成：${generated.fileName}，${formatQualityStatus(nextChecks)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Codex CLI rework failed");
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    if (autoSampleRanRef.current) return;
    if (!new URLSearchParams(window.location.search).has("sample")) return;
    autoSampleRanRef.current = true;
    void handleLoadSample();
  }, []);

  useEffect(() => {
    void refreshGeneratedHistory();
  }, []);

  const handleImportHistory = async (entry: GeneratedImageEntry) => {
    setIsBusy(true);
    try {
      const result: ImportedResult = {
        id: crypto.randomUUID(),
        name: entry.fileName,
        dataUrl: entry.fileUrl,
        width: entry.width,
        height: entry.height,
        importedAt: new Date().toISOString(),
        source: "history",
      };
      setImportedResult(result);
      const nextChecks = await evaluateImageQuality(result, brief);
      setChecks(nextChecks);
      setActiveStep("quality");
      setStatus(`已导入历史生成：${entry.fileName}，${formatQualityStatus(nextChecks)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "历史图片导入失败");
    } finally {
      setIsBusy(false);
    }
  };

  const addLibraryEntry = (result: ImportedResult | null = importedResult, entryChecks: QualityCheck[] = checks) => {
    if (!result) return;
    const entry: AssetLibraryEntry = {
      id: crypto.randomUUID(),
      name: result.name,
      kind: brief.assetKind,
      styleName: selectedStyle.name,
      width: result.width,
      height: result.height,
      prompt,
      checks: entryChecks,
      createdAt: new Date().toISOString(),
    };
    setLibraryEntries((current) => [entry, ...current].slice(0, 12));
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setStatus("Prompt copied");
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setStatus("Clipboard permission denied");
    }
  };

  const handleExportPrompt = () => {
    downloadText(`${safeName(brief.assetName)}-prompt.txt`, prompt);
    setStatus("Prompt exported");
  };

  const handleExportReport = () => {
    const metadata = buildExportMetadata(
      brief,
      selectedStyle,
      prompt,
      importedResult ? { name: importedResult.name, width: importedResult.width, height: importedResult.height } : null,
      checks,
    );
    downloadText(`${safeName(brief.assetName)}-aigc-report.json`, JSON.stringify(metadata, null, 2), "application/json");
    setStatus("Report exported");
  };

  const handleExportImage = () => {
    if (!importedResult) return;
    downloadDataUrl(`${safeName(brief.assetName)}.png`, importedResult.dataUrl);
    setStatus("PNG exported");
  };

  return (
    <main className="app-shell">
      <input ref={fileInputRef} className="sr-only" type="file" accept="image/*" onChange={handleUpload} />

      <header className="app-header">
        <div>
          <p className="kicker">Pixel AIGC Pipeline</p>
          <h1>Game Art AIGC Workbench</h1>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={handleGenerateWithCodex} disabled={isBusy}>
            <WandSparkles size={17} />
            Codex 生成
          </button>
          <button className="primary-button" type="button" onClick={handleLoadSample} disabled={isBusy}>
            <Play size={17} />
            走一遍示例
          </button>
          <button className="tool-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
            <Upload size={17} />
            导入结果图
          </button>
          <button className="tool-button" type="button" onClick={handleExportReport} disabled={isBusy}>
            <Download size={17} />
            导出报告
          </button>
        </div>
      </header>

      <div className="workbench-shell">
        <aside className="workflow-rail" aria-label="workflow">
          {WORKFLOW_STEPS.map((step, index) => (
            <button
              key={step.id}
              className={activeStep === step.id ? "workflow-step active" : "workflow-step"}
              type="button"
              onClick={() => navigateTo(step.id)}
            >
              <span>{index + 1}</span>
              {step.label}
            </button>
          ))}
        </aside>

        <div className="workbench-main">
          <section id="step-brief" className="panel flow-panel">
            <PanelTitle tag="ASSET BRIEF" title="出图需求" icon={<Clipboard size={18} />} />

            <div className="asset-kind-grid">
              {Object.values(ASSET_PRESETS).map((item) => (
                <button
                  key={item.kind}
                  className={brief.assetKind === item.kind ? "asset-kind-card active" : "asset-kind-card"}
                  type="button"
                  onClick={() => handleAssetKindChange(item.kind)}
                >
                  <b>{item.shortLabel}</b>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="form-grid two">
              <label>
                <span>资产名</span>
                <input value={brief.assetName} onChange={(event) => updateBrief("assetName", event.target.value)} />
              </label>
              <label>
                <span>用途</span>
                <input value={brief.productionGoal} onChange={(event) => updateBrief("productionGoal", event.target.value)} />
              </label>
              <label>
                <span>视角</span>
                <input value={brief.viewMode} onChange={(event) => updateBrief("viewMode", event.target.value)} />
              </label>
              <label>
                <span>交付</span>
                <input value={brief.deliverable} onChange={(event) => updateBrief("deliverable", event.target.value)} />
              </label>
            </div>

            <div className="form-grid four">
              <NumberField label="Cell W" value={brief.cellWidth} onChange={(value) => updateBrief("cellWidth", value)} />
              <NumberField label="Cell H" value={brief.cellHeight} onChange={(value) => updateBrief("cellHeight", value)} />
              <NumberField label="Columns" value={brief.columns} onChange={(value) => updateBrief("columns", value)} />
              <NumberField label="Rows" value={brief.rows} onChange={(value) => updateBrief("rows", value)} />
            </div>

            <div className="form-grid one">
              <label>
                <span>参考策略</span>
                <input value={brief.referencePolicy} onChange={(event) => updateBrief("referencePolicy", event.target.value)} />
              </label>
              <label>
                <span>帧/地块说明</span>
                <textarea value={brief.notes} onChange={(event) => updateBrief("notes", event.target.value)} />
              </label>
            </div>
          </section>

          <section id="step-style" className="panel flow-panel">
            <PanelTitle tag="STYLE SPEC" title="风格规范" icon={<Palette size={18} />} />
            <div className="style-grid">
              {STYLE_SPECS.map((style) => (
                <button
                  key={style.id}
                  className={style.id === selectedStyle.id ? "style-card active" : "style-card"}
                  type="button"
                  onClick={() => setStyleId(style.id)}
                >
                  <b>{style.name}</b>
                  <span>{style.tone}</span>
                </button>
              ))}
            </div>

            <div className="spec-split">
              <SpecList title="必须满足" items={[...selectedStyle.must, ...preset.acceptance]} />
              <SpecList title="禁止项" items={selectedStyle.avoid} />
            </div>
          </section>

          <section id="step-prompt" className="panel flow-panel">
            <PanelTitle tag="PROMPT BUILDER" title="提示词" icon={<WandSparkles size={18} />} />
            <div className="prompt-actions">
              <button className="primary-button" type="button" onClick={handleGenerateWithCodex} disabled={isBusy}>
                <WandSparkles size={17} />
                Codex CLI 生成
              </button>
              <button className="primary-button" type="button" onClick={handleCopyPrompt}>
                {copied ? <CheckCircle2 size={17} /> : <Copy size={17} />}
                {copied ? "已复制" : "复制"}
              </button>
              <button className="tool-button" type="button" onClick={handleExportPrompt}>
                <Download size={17} />
                TXT
              </button>
            </div>
            <textarea className="prompt-textarea" readOnly value={prompt} />
          </section>

          <section id="step-import" className="panel flow-panel">
            <PanelTitle tag="IMPORT RESULT" title="导入生成结果" icon={<ImagePlus size={18} />} />
            <div className="import-grid">
              <button className="upload-zone codex" type="button" onClick={handleGenerateWithCodex} disabled={isBusy}>
                <WandSparkles size={30} />
                <span>用本机 Codex CLI 生成并导入</span>
              </button>
              <button className="upload-zone" type="button" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
                <Upload size={30} />
                <span>导入 ChatGPT / 其他模型生成的 PNG</span>
              </button>
              <button className="upload-zone sample" type="button" onClick={handleLoadSample} disabled={isBusy}>
                <Play size={30} />
                <span>加载示例结果并检查</span>
              </button>
            </div>

            {importedResult ? (
              <div className="result-preview-stack">
                <div className="result-preview">
                  <div className="preview-canvas">
                    <img src={importedResult.dataUrl} alt="" />
                  </div>
                  <dl>
                    <div>
                      <dt>文件</dt>
                      <dd>{importedResult.name}</dd>
                    </div>
                    <div>
                      <dt>尺寸</dt>
                      <dd>
                        {importedResult.width} x {importedResult.height}px
                      </dd>
                    </div>
                    <div>
                      <dt>来源</dt>
                      <dd>{formatResultSource(importedResult.source)}</dd>
                    </div>
                  </dl>
                </div>

                <SpriteAnimationPreview result={importedResult} brief={brief} />
              </div>
            ) : null}
          </section>

          <section id="step-quality" className="panel flow-panel">
            <PanelTitle tag="QUALITY GATE" title="验收" icon={<ShieldCheck size={18} />} />
            <div className="quality-toolbar">
              <button className="primary-button" type="button" onClick={() => runQuality()} disabled={isBusy || !importedResult}>
                <ShieldCheck size={17} />
                重新检查
              </button>
              <button
                className="tool-button"
                type="button"
                onClick={handleAlignAnchors}
                disabled={isBusy || !importedResult || brief.assetKind === "hex_map_tiles"}
              >
                <WandSparkles size={17} />
                对齐脚底
              </button>
              <button className="tool-button" type="button" onClick={handleReworkWithCodex} disabled={isBusy || !importedResult}>
                <RefreshCcw size={17} />
                AI 返工
              </button>
              <span className={`verdict ${currentVerdict.status}`}>{currentVerdict.label}</span>
            </div>

            <div className="check-list">
              {checks.length === 0 ? (
                <div className="empty-state">尚未执行检查</div>
              ) : (
                checks.map((check) => (
                  <article key={check.id} className={`check-card ${check.status}`}>
                    {getCheckIcon(check.status)}
                    <div>
                      <b>{check.label}</b>
                      <span>{check.detail}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section id="step-export" className="panel flow-panel">
            <PanelTitle tag="ASSEMBLE / EXPORT" title="导出交付物" icon={<PackageCheck size={18} />} />
            <div className="export-grid">
              <button className="export-card" type="button" onClick={handleExportImage} disabled={!importedResult}>
                <ImageDown size={22} />
                <b>PNG</b>
                <span>生成结果图</span>
              </button>
              <button className="export-card" type="button" onClick={handleExportPrompt}>
                <Clipboard size={22} />
                <b>Prompt</b>
                <span>生产提示词</span>
              </button>
              <button className="export-card" type="button" onClick={handleExportReport}>
                <FileJson size={22} />
                <b>JSON</b>
                <span>需求、风格、质检</span>
              </button>
              <button className="export-card" type="button" onClick={() => addLibraryEntry()} disabled={!importedResult}>
                <Library size={22} />
                <b>Library</b>
                <span>加入资产库</span>
              </button>
            </div>
          </section>

          <section id="step-library" className="panel flow-panel">
            <PanelTitle tag="ASSET LIBRARY" title="资产库" icon={<Library size={18} />} />
            <div className="library-toolbar">
              <span>工程目录历史：outputs/generated</span>
              <button className="tool-button" type="button" onClick={() => void refreshGeneratedHistory()} disabled={isBusy}>
                <RefreshCcw size={16} />
                刷新
              </button>
            </div>
            <div className="history-grid">
              {generatedHistory.length === 0 ? (
                <div className="empty-state">暂无历史生成 PNG</div>
              ) : (
                generatedHistory.map((entry) => (
                  <article key={entry.fileName} className="history-card">
                    <button className="history-thumb" type="button" onClick={() => void handleImportHistory(entry)} disabled={isBusy}>
                      <img src={entry.fileUrl} alt="" loading="lazy" />
                    </button>
                    <div className="history-meta">
                      <b title={entry.fileName}>{entry.fileName}</b>
                      <span>
                        {entry.width} x {entry.height}px / {formatBytes(entry.bytes)}
                      </span>
                      <span>{formatDateTime(entry.createdAt)}</span>
                    </div>
                    <button className="tool-button" type="button" onClick={() => void handleImportHistory(entry)} disabled={isBusy}>
                      导入
                    </button>
                  </article>
                ))
              )}
            </div>

            <div className="library-toolbar secondary">
              <span>本次会话记录</span>
            </div>
            <div className="library-list">
              {libraryEntries.length === 0 ? (
                <div className="empty-state">暂无资产记录</div>
              ) : (
                libraryEntries.map((entry) => {
                  const summary = summarizeChecks(entry.checks);
                  return (
                    <article key={entry.id} className="library-card">
                      <div>
                        <b>{entry.name}</b>
                        <span>
                          {ASSET_PRESETS[entry.kind].label} / {entry.styleName}
                        </span>
                      </div>
                      <span>
                        {entry.width} x {entry.height}px
                      </span>
                      <span className={summary.fail > 0 ? "fail-text" : summary.warn > 0 ? "warn-text" : "pass-text"}>
                        {summary.pass} pass / {summary.warn} warn / {summary.fail} fail
                      </span>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <aside className="inspector-panel">
          <div className="panel inspector-card">
            <p className="section-tag">RUN STATUS</p>
            <h2>{preset.label}</h2>
            <dl>
              <div>
                <dt>目标尺寸</dt>
                <dd>
                  {output.width} x {output.height}px
                </dd>
              </div>
              <div>
                <dt>单元格</dt>
                <dd>
                  {output.cells} cells / {brief.cellWidth} x {brief.cellHeight}
                </dd>
              </div>
              <div>
                <dt>当前结果</dt>
                <dd>{importedResult ? `${importedResult.width} x ${importedResult.height}px` : "未导入"}</dd>
              </div>
              <div>
                <dt>验收</dt>
                <dd>
                  {checkSummary.pass} pass / {checkSummary.warn} warn / {checkSummary.fail} fail
                </dd>
              </div>
            </dl>
            <div className={`status-pill ${currentVerdict.status}`}>{currentVerdict.label}</div>
          </div>

          <div className="panel inspector-card">
            <p className="section-tag">ACCEPTANCE</p>
            <ul className="acceptance-list">
              {preset.acceptance.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <footer className="statusbar">
        <span className={isBusy ? "busy-dot active" : "busy-dot"} />
        <span>{status}</span>
      </footer>
    </main>
  );
}

function PanelTitle({ tag, title, icon }: { tag: string; title: string; icon: ReactNode }) {
  return (
    <div className="panel-title">
      <div>
        <p className="section-tag">{tag}</p>
        <h2>{title}</h2>
      </div>
      <span className="panel-icon">{icon}</span>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input min={1} type="number" value={value} onChange={(event) => onChange(Math.max(1, Math.round(Number(event.target.value) || 1)))} />
    </label>
  );
}

function SpecList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="spec-list">
      <b>{title}</b>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function getCheckIcon(status: CheckStatus) {
  if (status === "pass") return <CheckCircle2 size={20} />;
  if (status === "warn") return <AlertTriangle size={20} />;
  if (status === "fail") return <XCircle size={20} />;
  return <ShieldCheck size={20} />;
}

function getVerdict(summary: ReturnType<typeof summarizeChecks>): { status: CheckStatus; label: string } {
  if (summary.fail > 0) return { status: "fail", label: "需要返工" };
  if (summary.warn > 0) return { status: "warn", label: "可用但需复查" };
  if (summary.pass > 0) return { status: "pass", label: "通过" };
  return { status: "pending", label: "待检查" };
}

function formatQualityStatus(checks: QualityCheck[]): string {
  const summary = summarizeChecks(checks);
  return `${summary.pass} pass / ${summary.warn} warn / ${summary.fail} fail`;
}

function formatResultSource(source: ImportedResult["source"]): string {
  if (source === "sample") return "内置示例";
  if (source === "codex") return "Codex CLI";
  if (source === "history") return "历史生成";
  return "上传";
}

function buildReworkPrompt(basePrompt: string, result: ImportedResult, checks: QualityCheck[]): string {
  const problemChecks = checks.filter((check) => check.status === "fail" || check.status === "warn");
  const problemText =
    problemChecks.length > 0
      ? problemChecks.map((check) => `- [${check.status}] ${check.label}: ${check.detail}`).join("\n")
      : "- 当前没有失败项，但需要基于参考图重新生成一版更稳定、更规整的结果。";

  return [
    "请对随附参考图进行一次游戏资产返工，而不是普通重画。",
    "",
    "返工原则：",
    "- 保留参考图中已经成立的角色身份、主配色、武器类型、像素风格和整体轮廓。",
    "- 只针对质检指出的问题修正，不要引入新角色、新背景、新文字或 UI。",
    "- 重新生成完整 sprite sheet，不要只输出单帧。",
    "- 每个 cell 的角色根节点、脚底基线、身高比例和方向结构必须一致。",
    "- 如果参考图某些方向身高或脚底线错误，以规格为准，不要复刻错误。",
    "",
    "当前结果：",
    `- 文件：${result.name}`,
    `- 尺寸：${result.width} x ${result.height}px`,
    "",
    "质检问题：",
    problemText,
    "",
    "原始生产规格：",
    basePrompt,
  ].join("\n");
}

async function imageSourceToDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error(`无法读取当前图片用于返工：${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("图片转 data URL 失败"));
    reader.readAsDataURL(blob);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function safeName(value: string): string {
  return (
    value
      .trim()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "asset"
  );
}

function withNameSuffix(name: string, suffix: string): string {
  if (!/\.[a-z0-9]+$/i.test(name)) return `${name}-${suffix}`;
  return name.replace(/(\.[a-z0-9]+)$/i, `-${suffix}$1`);
}
