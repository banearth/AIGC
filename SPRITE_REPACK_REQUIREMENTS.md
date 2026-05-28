# Sprite 主体提取与图集重排需求

## 背景

当前 AIGC 直接生成严格矩形 sprite sheet 时，容易出现角色贴边、串格、红框/网格残留、姿态被压缩等问题。新的目标是让 AIGC 主要负责画好角色主体，由后处理流程负责把主体提取出来，并重新生成工程可用的标准 atlas。

## 当前状态

- [x] 已完成：预览器删除“动作行”下拉选择。
- [x] 已完成：四个方向可同时显示，便于整体检查。
- [x] 已完成：播放、下一帧、FPS、缩放控制共用同一帧索引。
- [x] 已完成：已有“对齐脚底”后处理能力，见 `src/workbench/spriteSheetAnchors.ts`。
- [x] 已完成：资源目录已加入 `.gitignore`，不要提交 `assets/`、`outputs/`、`public/assets/`、`dist/`、`tmp/`、日志和 `node_modules/`。

## 目标

- [ ] 新增“主体提取并重排图集”能力。
- [ ] 允许 AIGC 生成较宽松的 4 行 x 3 列布局，不要求每一帧完美落在严格矩形 cell 内。
- [ ] 后处理从每个粗 cell 中提取角色主体，清理小噪点，重新绘制到标准 `cellWidth x cellHeight` cell。
- [ ] 输出新的透明背景 atlas，尺寸仍为 `brief.columns * brief.cellWidth` by `brief.rows * brief.cellHeight`。
- [ ] 输出分析信息，用于 UI 提示和后续质检。

## 建议实现边界

新增纯函数模块：

```ts
// src/workbench/spriteSheetRepack.ts
export async function repackSpriteSheetSubjects(
  dataUrl: string,
  brief: WorkbenchBrief,
): Promise<SpriteSheetRepackResult>;
```

建议类型：

```ts
export type SpriteSheetRepackFrame = {
  row: number;
  column: number;
  sourceBox: { x: number; y: number; width: number; height: number };
  targetBox: { x: number; y: number; width: number; height: number };
  anchorX: number;
  baselineY: number;
  opaquePixels: number;
  warnings: string[];
};

export type SpriteSheetRepackResult = {
  dataUrl: string;
  width: number;
  height: number;
  frames: SpriteSheetRepackFrame[];
  warnings: string[];
};
```

## 处理流程

- [ ] 按 `brief.rows x brief.columns` 对原图做粗切分。
- [ ] 在每个粗 cell 内找主体像素 bbox。
- [ ] 支持透明背景图。
- [ ] 支持接近纯色背景图，必要时用角落颜色估计背景。
- [ ] 清理孤立小噪点，但不要误删武器、头发、披风等细长主体。
- [ ] 对空帧、主体过小、主体贴边给出 warning。
- [ ] 将主体绘制回标准 cell，保持像素风，不做抗锯齿缩放。
- [ ] 统一脚底 baseline，角色根节点尽量居中。
- [ ] 每个 cell 保留安全 padding，避免再次串格。
- [ ] 重新拼成标准 atlas。

## UI 集成

- [ ] 在验收工具栏新增按钮：`提取主体并重排`。
- [ ] 按钮位置建议放在“对齐脚底”之前，因为重排比脚底对齐更上游。
- [ ] 点击后用当前 `importedResult.dataUrl` 和 `brief` 运行新函数。
- [ ] 成功后替换 `importedResult`，文件名后缀建议为 `repacked`。
- [ ] 成功后重新执行 `evaluateImageQuality`。
- [ ] 状态栏显示重排结果，例如：`已提取并重排：11/12 帧正常，1 warning`。
- [ ] 失败时保留原图，不覆盖当前结果。

## 关键约束

- [ ] 不要直接在 UI 组件里写图像算法，算法放到 `src/workbench/`。
- [ ] 不要改动现有导入、生成、历史导入、导出流程的行为。
- [ ] 不要上传或提交任何资源图、生成图、临时图或日志。
- [ ] 不要执行 Lua 热更/热重载相关命令。
- [ ] 不要引入重型依赖；优先使用 Canvas/ImageData 实现。
- [ ] 保持 TypeScript 构建通过。

## 验收标准

- [ ] `npm run build` 通过。
- [ ] 对 4 行 x 3 列角色 sheet，重排后四方向三帧都能显示。
- [ ] 重排后的 atlas 没有明显串格像素。
- [ ] 主体没有被裁掉武器、头发、披风等外轮廓。
- [ ] 每帧脚底线大体一致。
- [ ] 每帧主体水平位置合理，动画播放时不大幅跳动。
- [ ] 空帧或异常帧会给 warning，而不是静默生成坏图。

## 后续可选增强

- [ ] 增加可视化 debug overlay，显示每帧 bbox、baseline、anchor。
- [ ] 增加手动调整 padding、噪点阈值、背景容差的控制项。
- [ ] 支持从非严格 4x3 大图中按连通域自动排序主体。
- [ ] 支持导出 repack 分析 JSON。
