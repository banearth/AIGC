export type CodexImageRequest = {
  prompt: string;
  assetName: string;
  width: number;
  height: number;
  referenceImageDataUrl?: string;
};

export type CodexImageResponse = {
  id: string;
  fileName: string;
  fileUrl: string;
  dataUrl: string;
  path: string;
  width: number;
  height: number;
  bytes: number;
  elapsedMs: number;
  report: string;
  stdoutTail: string;
  stderrTail: string;
};

export type GeneratedImageEntry = {
  fileName: string;
  fileUrl: string;
  path: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  report: string;
};

export async function generateCodexImage(request: CodexImageRequest): Promise<CodexImageResponse> {
  let response: Response;

  try {
    response = await fetch("/api/generate-codex-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch (error) {
    throw new Error(
      `本地生成服务未连接。请启动 API 服务：npm run api，或直接运行 npm run dev:full。${formatErrorSuffix(error)}`,
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `生成服务返回 ${response.status}`);
  }

  return payload as CodexImageResponse;
}

export async function listGeneratedImages(): Promise<GeneratedImageEntry[]> {
  let response: Response;

  try {
    response = await fetch("/api/generated-images");
  } catch (error) {
    throw new Error(
      `本地生成服务未连接。请启动 API 服务：npm run api，或直接运行 npm run dev:full。${formatErrorSuffix(error)}`,
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `历史列表返回 ${response.status}`);
  }

  return Array.isArray(payload?.images) ? (payload.images as GeneratedImageEntry[]) : [];
}

function formatErrorSuffix(error: unknown): string {
  if (!(error instanceof Error) || !error.message) return "";
  return ` 原始错误：${error.message}`;
}
