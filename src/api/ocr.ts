import { invoke } from "@tauri-apps/api/core";

// 本地 OCR：tesseract.js + 本地 eng 数据（public/ocr，由 scripts/copy-ocr-assets.mjs 复制）。
// 只识别发票「价税合计（小写）」区域的数字。

// 只框「￥金额」本身（不含左侧"（小写）"），落在 826x551 电子发票的固定版式上。
// 实测该区域 6 倍放大 + 灰度即可稳定识别 3.64 / 23.17。
export const INVOICE_ROI = { x: 0.735, y: 0.692, width: 0.12, height: 0.04 };

declare global {
  interface Window {
    Tesseract?: any;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTesseract(): Promise<void> {
  if (window.Tesseract) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/ocr/tesseract.min.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("OCR 引擎加载失败（缺少 /ocr/tesseract.min.js）"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

let workerPromise: Promise<any> | null = null;

async function getWorker(onProgress?: (progress: number) => void): Promise<any> {
  if (!workerPromise) {
    workerPromise = (async () => {
      await loadTesseract();
      const worker = await window.Tesseract.createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core/tesseract-core-simd-lstm.wasm.js",
        langPath: "/ocr/lang",
        gzip: true,
        cacheMethod: "none",
        workerBlobURL: false,
        logger: (m: any) => {
          if (m?.status === "recognizing text" && typeof m.progress === "number") {
            onProgress?.(m.progress);
          }
        },
      });
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789.,",
        tessedit_pageseg_mode: "7",
      });
      return worker;
    })();
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

/** 把本地图片文件读成 dataURL */
export async function readImageDataUrl(path: string): Promise<string> {
  const b64 = await invoke<string>("read_file_base64", { path });
  const ext = path.split(".").pop()?.toLowerCase() || "jpg";
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${b64}`;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

export interface CropResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
}

/**
 * 按相对坐标裁剪，放大 + 灰度（不做二值化，实测二值化会丢小数点）。
 */
export function cropForOcr(img: HTMLImageElement, scale = 6): CropResult {
  const sx = Math.round(img.naturalWidth * INVOICE_ROI.x);
  const sy = Math.round(img.naturalHeight * INVOICE_ROI.y);
  const sw = Math.round(img.naturalWidth * INVOICE_ROI.width);
  const sh = Math.round(img.naturalHeight * INVOICE_ROI.height);

  const canvas = document.createElement("canvas");
  canvas.width = sw * scale;
  canvas.height = sh * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = gray;
  }
  ctx.putImageData(data, 0, 0);

  return { canvas, dataUrl: canvas.toDataURL("image/png") };
}

/** 从 OCR 文本中提取金额（优先带两位小数，取最后一个） */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[^\d.,]/g, " ");
  const decimals = t.match(/\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}/g);
  const candidates = decimals || t.match(/\d+/g);
  if (!candidates || candidates.length === 0) return null;
  for (let i = candidates.length - 1; i >= 0; i--) {
    const n = Number(candidates[i].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0 && n < 1_000_000) {
      return Math.round(n * 100) / 100;
    }
  }
  return null;
}

export interface OcrResult {
  ok: boolean;
  amount: number | null;
  text: string;
  confidence: number;
  dataUrl: string;
}

export async function recognizeInvoiceDataUrl(
  url: string,
  onProgress?: (p: number) => void,
): Promise<OcrResult> {
  const img = await loadImage(url);
  const { canvas, dataUrl } = cropForOcr(img);

  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(canvas);
  const text = String(data?.text || "").replace(/\s+/g, "");
  const confidence = Number(data?.confidence || 0);
  const amount = parseAmount(text);
  // 置信度在这类小图上恒为 0，改用「文本是否恰好是 x.xx」做成功判定
  const ok = amount !== null && /^\d+\.\d{2}$/.test(text);

  return {
    ok,
    amount,
    text,
    confidence,
    dataUrl,
  };
}
