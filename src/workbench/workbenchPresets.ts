import type { AssetKind, AssetPreset, StyleSpec, WorkbenchBrief } from "./workbenchTypes";

export const ASSET_PRESETS: Record<AssetKind, AssetPreset> = {
  pixel_character: {
    kind: "pixel_character",
    label: "像素角色序列帧",
    shortLabel: "角色",
    defaultBrief: {
      assetKind: "pixel_character",
      assetName: "原创武将小人",
      productionGoal: "用于 2D 策略游戏大地图与战斗前表现的可读角色小人",
      cellWidth: 64,
      cellHeight: 64,
      columns: 3,
      rows: 4,
      viewMode: "四方向俯视 RPG，小头身但轮廓清晰",
      deliverable: "单张透明 PNG sprite sheet，3 列 x 4 行",
      referencePolicy: "可上传参考图；只提取服装、配色、发型和气质，不照搬原图构图",
      notes: "每行一个方向：正面、背面、左、右；每列为步行动作的 3 帧循环。所有帧使用同一脚底基线和角色根节点。",
    },
    acceptance: [
      "画布尺寸必须等于格子尺寸乘以行列数",
      "透明背景，无 UI、文字、水印、场景背景",
      "角色比例、发色、服装、武器在所有帧中一致",
      "每行所有帧的脚底基线和下半身锚点必须稳定，不允许角色在格内左右滑动",
      "每格保留透明边距，不要贴边",
    ],
  },
  battle_sequence: {
    kind: "battle_sequence",
    label: "战斗动作序列",
    shortLabel: "战斗",
    defaultBrief: {
      assetKind: "battle_sequence",
      assetName: "轻剑普攻循环",
      productionGoal: "用于回合制战斗中播放的一套普攻动作循环",
      cellWidth: 96,
      cellHeight: 96,
      columns: 6,
      rows: 2,
      viewMode: "3/4 侧向战斗视角，角色朝右",
      deliverable: "单张透明 PNG sprite sheet，第一行为起手到命中，第二行为收招到待机",
      referencePolicy: "参考角色设定图保持身份特征，动作可以重新设计",
      notes: "帧 1-2 起手，帧 3-4 挥击，帧 5 命中，帧 6 回收；第二行可放变体或连击循环。",
    },
    acceptance: [
      "动作重心连续，不能每帧像不同角色",
      "攻击方向、武器长度和受击点清晰",
      "透明背景，不包含特效底图；特效应作为独立发光像素块",
      "所有帧在 96x96 格内居中且脚底基线稳定",
    ],
  },
  hex_map_tiles: {
    kind: "hex_map_tiles",
    label: "六边形地图地块",
    shortLabel: "地块",
    defaultBrief: {
      assetKind: "hex_map_tiles",
      assetName: "国风沙盘地块套装",
      productionGoal: "用于类似三国策略手游的大地图六边形地形和建筑资源",
      cellWidth: 128,
      cellHeight: 112,
      columns: 5,
      rows: 3,
      viewMode: "斜俯视沙盘，六边形边界清楚，真实材质但手游可读",
      deliverable: "透明 PNG atlas，每格一个六边形地块或建筑标记",
      referencePolicy: "可参考真实山体、河流、农田和古建筑照片，但输出必须统一为游戏资产",
      notes: "建议包含平原、森林、山地、河流、农田、道路、城池、关隘、营地、码头、矿点等。",
    },
    acceptance: [
      "同一镜头角度、同一光照方向、同一边界尺寸",
      "地块边缘可拼接，不出现明显摄影背景",
      "材质真实但不能脏，资源点和城池在缩放后可读",
      "透明背景，六边形外部 alpha 为 0",
    ],
  },
};

export const STYLE_SPECS: StyleSpec[] = [
  {
    id: "pixel_clean",
    name: "清晰像素小人",
    tone: "高可读、低噪声、游戏内直接可用",
    palette: "24-32 色以内，主色不超过 5 组，暗部用硬边像素块表达",
    must: [
      "nearest-neighbor pixel edges",
      "clean silhouette",
      "consistent scale in every frame",
      "transparent background",
    ],
    avoid: ["painterly brush", "blur", "text", "watermark", "busy background", "soft shadow"],
    promptStyle:
      "Use compact pixel clusters, controlled dithering, hard edges, and readable color separation. Prioritize game readability over illustration detail.",
  },
  {
    id: "strategy_sandbox",
    name: "写实国风沙盘",
    tone: "轻写实、干净、策略手游大地图",
    palette: "低饱和青绿、土黄、石灰、墨黑点缀；避免塑料高光",
    must: [
      "top-down oblique strategy map asset",
      "real material cues",
      "clean tile boundary",
      "consistent lighting",
    ],
    avoid: ["toy-like plastic shading", "muddy texture", "overly dark vignette", "random labels", "UI mockup"],
    promptStyle:
      "Use real-world material references translated into clean mobile strategy game assets. Keep texture controlled, edges legible, and color contrast suitable for dense maps.",
  },
  {
    id: "ink_tactical",
    name: "水墨战棋界面",
    tone: "纸本、水墨、战棋棋盘",
    palette: "宣纸米白、墨灰、朱砂、青绿；低饱和，少量高亮",
    must: ["paper grain", "ink contour", "clear gameplay layer", "reserved UI contrast"],
    avoid: ["photoreal UI", "sci-fi glow", "heavy noise", "unreadable calligraphy"],
    promptStyle:
      "Blend ink-wash shapes with crisp game UI readability. Use paper texture as a restrained base, not as noise covering functional elements.",
  },
];

export const WORKFLOW_STEPS = [
  { id: "brief", label: "需求" },
  { id: "style", label: "风格" },
  { id: "prompt", label: "提示词" },
  { id: "import", label: "导入" },
  { id: "quality", label: "质检" },
  { id: "export", label: "导出" },
  { id: "library", label: "资产库" },
] as const;

export function createDefaultBrief(kind: AssetKind): WorkbenchBrief {
  return { ...ASSET_PRESETS[kind].defaultBrief };
}

export function getOutputSize(brief: WorkbenchBrief): { width: number; height: number; cells: number } {
  return {
    width: brief.cellWidth * brief.columns,
    height: brief.cellHeight * brief.rows,
    cells: brief.columns * brief.rows,
  };
}

export function buildWorkbenchPrompt(brief: WorkbenchBrief, style: StyleSpec): string {
  const output = getOutputSize(brief);
  const preset = ASSET_PRESETS[brief.assetKind];

  return [
    "请生成一张可直接落地到游戏工程的 2D 美术资产图。",
    "",
    "任务：",
    `- 资产名称：${brief.assetName}`,
    `- 资产类型：${preset.label}`,
    `- 用途：${brief.productionGoal}`,
    `- 视角：${brief.viewMode}`,
    `- 交付格式：${brief.deliverable}`,
    `- 画布尺寸：严格为 ${output.width} x ${output.height}px`,
    `- 网格：${brief.columns} 列 x ${brief.rows} 行，每格 ${brief.cellWidth} x ${brief.cellHeight}px`,
    `- 参考策略：${brief.referencePolicy}`,
    "",
    "风格规范：",
    `- 风格：${style.name}`,
    `- 气质：${style.tone}`,
    `- 色彩：${style.palette}`,
    `- 表现方法：${style.promptStyle}`,
    "",
    "硬性要求：",
    ...style.must.map((item) => `- ${item}`),
    ...preset.acceptance.map((item) => `- ${item}`),
    ...(brief.assetKind !== "hex_map_tiles"
      ? [
          "",
          "动画锚点规范：",
          `- 每个 ${brief.cellWidth} x ${brief.cellHeight}px cell 使用同一局部坐标系，左上角为 (0,0)。`,
          `- 角色脚底/站立接地点统一落在 y=${Math.max(1, brief.cellHeight - 12)} 附近，误差不超过 1-2px。`,
          `- 角色下半身根节点/重心统一保持在 x=${Math.round(brief.cellWidth / 2)} 附近，不要每帧重新居中或左右漂移。`,
          "- 攻击、武器和特效可以变化，但身体根节点、脚底基线和站立接地点必须稳定。",
          "- 每一帧都像同一个角色在同一个位置播放动作，而不是一组位置不同的独立插画。",
        ]
      : []),
    "",
    "禁止项：",
    ...style.avoid.map((item) => `- no ${item}`),
    "- no extra canvas border",
    "- no cropped cells",
    "- no inconsistent camera angle",
    "",
    "补充说明：",
    brief.notes || "- 无",
    "",
    "输出只要图片，不要解释文字。若无法精确满足尺寸，请尽量生成同等比例的透明 PNG，并保持所有单元格严格对齐。",
  ].join("\n");
}

export function buildExportMetadata(
  brief: WorkbenchBrief,
  style: StyleSpec,
  prompt: string,
  result: { name: string; width: number; height: number } | null,
  checks: Array<{ id: string; label: string; status: string; detail: string }>,
) {
  return {
    brief,
    style,
    prompt,
    expectedOutput: getOutputSize(brief),
    result,
    checks,
    exportedAt: new Date().toISOString(),
  };
}
