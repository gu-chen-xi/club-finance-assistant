// 把 tesseract.js 运行时需要的文件复制到 public/ocr，供本地离线识别使用。
// public/ocr 已加入 .gitignore，dev/build 前由 npm predev/prebuild 自动执行。
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "public", "ocr");

const files = [
  ["node_modules/tesseract.js/dist/tesseract.min.js", "tesseract.min.js"],
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "core/tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm", "core/tesseract-core-simd-lstm.wasm"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "lang/eng.traineddata.gz"],
];

for (const [src, dst] of files) {
  const srcPath = join(root, src);
  const dstPath = join(out, dst);
  if (!existsSync(srcPath)) {
    console.error(`[ocr] 缺少文件：${src}，请先 npm install`);
    process.exit(1);
  }
  mkdirSync(dirname(dstPath), { recursive: true });
  copyFileSync(srcPath, dstPath);
}

console.log(`[ocr] 已复制 ${files.length} 个文件到 public/ocr`);
