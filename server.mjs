import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const host = process.env.AIGC_API_HOST || "127.0.0.1";
const port = Number(process.env.AIGC_API_PORT || 8787);
const generatedDir = path.join(rootDir, "outputs", "generated");

createServer(async (req, res) => {
  try {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, mode: "codex-cli", serviceTier: "fast" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/generate-codex-image") {
      const body = await readJson(req);
      const response = await generateCodexImage(body);
      sendJson(res, 200, response);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/generated-images") {
      const response = await listGeneratedImages();
      sendJson(res, 200, response);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/generated/")) {
      await serveGeneratedFile(url.pathname, res);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    sendJson(res, 500, { error: message });
  }
}).listen(port, host, () => {
  console.log(`AIGC API server listening on http://${host}:${port}`);
  console.log("Codex CLI invocations force service_tier=fast.");
});

async function generateCodexImage(body) {
  const prompt = String(body?.prompt || "").trim();
  const assetName = safeName(String(body?.assetName || "asset"));
  const width = clampInt(body?.width, 16, 4096, 512);
  const height = clampInt(body?.height, 16, 4096, 512);
  const referenceImageDataUrl = typeof body?.referenceImageDataUrl === "string" ? body.referenceImageDataUrl : "";

  if (!prompt) throw new Error("Prompt is required.");
  if (prompt.length > 24000) throw new Error("Prompt is too long.");

  await mkdir(generatedDir, { recursive: true });

  const id = randomUUID();
  const fileName = `${assetName}-${id.slice(0, 8)}.png`;
  const outputPath = path.join(generatedDir, fileName);
  const reportPath = path.join(generatedDir, `${assetName}-${id.slice(0, 8)}.txt`);
  const referencePath = referenceImageDataUrl ? await saveReferenceImage(referenceImageDataUrl, id) : null;
  const startedAt = Date.now();

  const codexPrompt = buildCodexPrompt({ prompt, outputPath, width, height, hasReferenceImage: Boolean(referencePath) });
  const { stdout, stderr } = await runCodexExec(codexPrompt, reportPath, referencePath);

  if (!existsSync(outputPath)) {
    const report = existsSync(reportPath) ? await readFile(reportPath, "utf8") : "";
    throw new Error(
      [
        "Codex CLI finished but did not create the expected PNG.",
        `Expected: ${outputPath}`,
        report ? `Last message: ${report.slice(0, 1200)}` : "",
        stderr ? `stderr: ${stderr.slice(-1200)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const buffer = await readFile(outputPath);
  const dimensions = readPngDimensions(buffer);
  const fileStat = await stat(outputPath);
  const report = existsSync(reportPath) ? await readFile(reportPath, "utf8") : "";

  return {
    id,
    fileName,
    fileUrl: `/generated/${encodeURIComponent(fileName)}`,
    dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
    path: outputPath,
    width: dimensions.width,
    height: dimensions.height,
    bytes: fileStat.size,
    elapsedMs: Date.now() - startedAt,
    report,
    stdoutTail: stdout.slice(-4000),
    stderrTail: stderr.slice(-4000),
  };
}

async function listGeneratedImages() {
  await mkdir(generatedDir, { recursive: true });
  const entries = await readdir(generatedDir, { withFileTypes: true });
  const images = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith(".png")) continue;
    if (entry.name.startsWith(".")) continue;
    if (/\.(source|chroma)\.png$/i.test(entry.name)) continue;

    const filePath = path.join(generatedDir, entry.name);
    const fileStat = await stat(filePath);
    const buffer = await readFile(filePath);
    let dimensions;
    try {
      dimensions = readPngDimensions(buffer);
    } catch {
      continue;
    }

    const reportName = entry.name.replace(/\.png$/i, ".txt");
    const reportPath = path.join(generatedDir, reportName);
    const report = existsSync(reportPath) ? await readFile(reportPath, "utf8") : "";

    images.push({
      fileName: entry.name,
      fileUrl: `/generated/${encodeURIComponent(entry.name)}`,
      path: filePath,
      width: dimensions.width,
      height: dimensions.height,
      bytes: fileStat.size,
      createdAt: fileStat.mtime.toISOString(),
      report,
    });
  }

  images.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return { images };
}

async function saveReferenceImage(dataUrl, id) {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-z0-9+/=]+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error("Reference image must be a PNG/JPEG/WebP data URL.");

  const mimeType = match[1].toLowerCase();
  const extension = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : mimeType.replace("image/", "");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 7 * 1024 * 1024) throw new Error("Reference image is too large.");

  const referenceDir = path.join(generatedDir, "_references");
  await mkdir(referenceDir, { recursive: true });
  const filePath = path.join(referenceDir, `${id}.${extension}`);
  await writeFile(filePath, buffer);
  return filePath;
}

function buildCodexPrompt({ prompt, outputPath, width, height, hasReferenceImage }) {
  return [
    "请调用你当前可见的真实 image_gen 图片生成工具生成项目资产。",
    "",
    "硬性执行要求：",
    "- 必须使用真实 image_gen / imagegen 工具生成源图。",
    "- 不要用代码、SVG、canvas、Pillow、PowerShell 绘图或占位图伪造资产主体。",
    "- 允许只做必要后处理：抠透明、裁切、缩放、补透明边距、保存 PNG。",
    "- 输出最终必须是 PNG，RGBA，透明背景。",
    `- 最终文件必须保存到：${outputPath}`,
    `- 最终目标尺寸：${width} x ${height}px。`,
    "- 如果 image_gen 原图不是目标尺寸，请把真实生成结果等比缩放/居中/透明补边到目标尺寸。",
    "- 如果内置图片工具无法原生透明，请使用纯色抠像背景生成，再用本机 imagegen skill 的 remove_chroma_key.py 后处理。",
    "- 完成后报告最终文件路径、尺寸、alpha 检查结果。",
    hasReferenceImage
      ? "- 已随本次请求附带一张参考图。返工时必须参考它的角色身份、配色、轮廓和已有问题，但不要照搬错误的帧布局。"
      : "",
    "",
    "资产生产 Prompt：",
    prompt,
  ]
    .filter(Boolean)
    .join("\n");
}

function runCodexExec(prompt, reportPath, referencePath = null) {
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--ephemeral",
    "--json",
    "--sandbox",
    "workspace-write",
    "-c",
    'service_tier="fast"',
    "-C",
    rootDir,
    "-o",
    reportPath,
  ];

  if (referencePath) {
    args.push("--image", referencePath);
  }

  args.push("-");

  return new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd: rootDir,
      shell: process.platform === "win32",
      windowsHide: true,
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Codex CLI image generation timed out after 8 minutes."));
    }, 8 * 60 * 1000);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.stdin.end(prompt);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`Codex CLI exited with code ${code}.\n${stderr || stdout}`));
    });
  });
}

async function serveGeneratedFile(urlPath, res) {
  const fileName = decodeURIComponent(urlPath.replace("/generated/", ""));
  const safeFileName = path.basename(fileName);
  const filePath = path.join(generatedDir, safeFileName);

  if (!filePath.startsWith(generatedDir) || !existsSync(filePath)) {
    sendJson(res, 404, { error: "Generated file not found" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(res);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += String(chunk);
      if (data.length > 8 * 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readPngDimensions(buffer) {
  const isPng =
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[12] === 0x49 &&
    buffer[13] === 0x48 &&
    buffer[14] === 0x44 &&
    buffer[15] === 0x52;

  if (!isPng) throw new Error("Generated file is not a valid PNG.");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function clampInt(value, min, max, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function safeName(value) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "asset"
  );
}
