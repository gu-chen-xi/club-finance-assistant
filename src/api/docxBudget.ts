import { invoke } from "@tauri-apps/api/core";

// 从活动策划书 docx 的「经费预算」表格解析采购清单。
// 只做结构解析，识别结果必须经用户确认后才写入采购清单。

export interface BudgetRow {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number | null;
}

export interface BudgetParseResult {
  rows: BudgetRow[];
  warnings: string[];
}

/** 全角数字/符号转半角 */
function toHalfWidth(s: string): string {
  return s.replace(/[０-９．，]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

function cleanText(s: string): string {
  return toHalfWidth(s).replace(/\s+/g, " ").trim();
}

/** 提取元素内所有 w:t 的文字（只取本层，避免嵌套表格串行） */
function textOf(el: Element): string {
  const parts: string[] = [];
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (child.localName === "tbl") continue; // 嵌套表格单独处理
      if (child.localName === "t") parts.push(child.textContent || "");
      else walk(child);
    }
  };
  walk(el);
  return cleanText(parts.join(""));
}

function parseNumber(s: string): number | null {
  const t = toHalfWidth(s).replace(/[,，\s]/g, "");
  const m = t.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

const NAME_KEYS = ["物品名称", "品名", "名称", "物品"];
const PRICE_KEYS = ["单价"];
const QTY_KEYS = ["数量"];
const TOTAL_KEYS = ["总价", "小计", "金额", "合计"];

function findCol(cells: string[], keys: string[]): number {
  return cells.findIndex((c) => keys.some((k) => c.includes(k)));
}

function isSummaryRow(cells: string[]): boolean {
  const first = cells[0] || "";
  return /^(共计|合计|总计|小计)/.test(first) || cells.filter(Boolean).length <= 1;
}

interface TableParse {
  rows: BudgetRow[];
  warnings: string[];
  header: boolean;
}

function parseTable(tbl: Element): TableParse {
  const warnings: string[] = [];
  const trs = Array.from(tbl.children).filter((e) => e.localName === "tr");
  const rows: BudgetRow[] = [];

  // 找表头行
  let headerIdx = -1;
  let cols = { name: -1, price: -1, qty: -1, total: -1 };
  for (let i = 0; i < trs.length; i++) {
    const cells = Array.from(trs[i].children)
      .filter((e) => e.localName === "tc")
      .map(textOf);
    const name = findCol(cells, NAME_KEYS);
    const qty = findCol(cells, QTY_KEYS);
    const price = findCol(cells, PRICE_KEYS);
    if (name >= 0 && qty >= 0) {
      headerIdx = i;
      cols = { name, price, qty, total: findCol(cells, TOTAL_KEYS) };
      break;
    }
  }
  if (headerIdx < 0) return { rows, warnings, header: false };

  for (let i = headerIdx + 1; i < trs.length; i++) {
    const cells = Array.from(trs[i].children)
      .filter((e) => e.localName === "tc")
      .map(textOf);
    if (cells.length === 0) continue;
    if (isSummaryRow(cells)) continue;

    const name = (cells[cols.name] || "").trim();
    if (!name) continue;

    const qtyRaw = cols.qty >= 0 ? cells[cols.qty] || "" : "";
    const priceRaw = cols.price >= 0 ? cells[cols.price] || "" : "";
    const totalRaw = cols.total >= 0 ? cells[cols.total] || "" : "";

    let quantity = parseNumber(qtyRaw);
    if (quantity === null || quantity <= 0) {
      quantity = 1;
      warnings.push(`「${name}」数量未识别，按 1 处理`);
    }
    let unitPrice = parseNumber(priceRaw);
    const total = parseNumber(totalRaw);
    if ((unitPrice === null || unitPrice === 0) && total && quantity > 0) {
      unitPrice = Math.round((total / quantity) * 100) / 100;
      warnings.push(`「${name}」单价为空，按 总价÷数量 推算为 ${unitPrice}`);
    }
    if (unitPrice === null) {
      warnings.push(`「${name}」单价未识别，请手动填写`);
      unitPrice = 0;
    }

    rows.push({ name, quantity, unitPrice, total });
  }

  return { rows, warnings, header: true };
}

/** 在 XML 文档顺序中找到「经费预算」段落之后的第一张表 */
function findBudgetTable(doc: Document): Element | null {
  const all = Array.from(doc.getElementsByTagName("*"));
  let anchor = -1;
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === "p" && textOf(all[i]).includes("经费预算")) {
      anchor = i;
      break;
    }
  }
  for (let i = Math.max(anchor, 0) + 1; i < all.length; i++) {
    if (all[i].localName === "tbl") return all[i];
  }
  return null;
}

export function parseBudgetXml(xml: string): BudgetParseResult {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("docx 内容解析失败");
  }

  let table = findBudgetTable(doc);
  let res: TableParse | null = table ? parseTable(table) : null;

  // 找不到「经费预算」或该表格没有标准表头时，退回「第一张含物品名称/数量表头的表」
  if (!res || !res.header || res.rows.length === 0) {
    const tables = Array.from(doc.getElementsByTagName("*")).filter((e) => e.localName === "tbl");
    for (const t of tables) {
      if (table && t === table) continue;
      const r = parseTable(t);
      if (r.header && r.rows.length > 0) {
        table = t;
        res = r;
        break;
      }
    }
  }

  if (!res || !res.header) throw new Error("未找到经费预算表格（需含 物品名称 / 数量 表头）");
  if (res.rows.length === 0) throw new Error("经费预算表格中没有可识别的行");

  return { rows: res.rows, warnings: res.warnings };
}

// ===== docx 解包（零依赖：ZIP 目录解析 + 浏览器原生 inflate） =====

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 从 ZIP 中央目录里取指定文件的压缩数据 */
function readZipEntry(bytes: Uint8Array, target: string): { method: number; data: Uint8Array } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("不是有效的 docx（找不到 ZIP 目录）");

  const decoder = new TextDecoder();
  let p = view.getUint32(eocd + 16, true);
  while (p + 46 <= bytes.length && view.getUint32(p, true) === 0x02014b50) {
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === target) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("docx 目录损坏");
      const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      return { method, data: bytes.subarray(start, start + compSize) };
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

export async function parseBudgetFromBytes(bytes: Uint8Array): Promise<BudgetParseResult> {
  const entry = readZipEntry(bytes, "word/document.xml");
  if (!entry) throw new Error("docx 内缺少 word/document.xml");
  const xmlBytes = entry.method === 0 ? entry.data : await inflateRaw(entry.data);
  return parseBudgetXml(new TextDecoder().decode(xmlBytes));
}

export async function parseBudgetFromDocx(path: string): Promise<BudgetParseResult> {
  const b64 = await invoke<string>("read_file_base64", { path });
  return parseBudgetFromBytes(base64ToBytes(b64));
}
