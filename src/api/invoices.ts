import { getDb } from "./db";

// ===== 发票 =====
export interface Invoice {
  id: string;
  activityId: string;
  itemName: string;
  amountCent: number;
  filePath: string;
  fileExt: string;
  headChecked: boolean;
}

export async function listInvoices(activityId: string): Promise<Invoice[]> {
  const db = await getDb();
  const rows = await db.select("SELECT * FROM invoices WHERE activity_id = ?", [activityId]);
  return (rows as any[]).map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    itemName: r.item_name,
    amountCent: r.amount_cent,
    filePath: r.file_path,
    fileExt: r.file_ext,
    headChecked: !!r.head_checked,
  }));
}

export async function addInvoice(activityId: string, filePath: string, itemName: string, amountYuan: number): Promise<void> {
  const db = await getDb();
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  await db.execute(
    "INSERT INTO invoices (id, activity_id, item_name, amount_cent, file_path, file_ext, head_checked) VALUES (?, ?, ?, ?, ?, ?, 0)",
    [`inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, activityId, itemName, Math.round(amountYuan * 100), filePath, ext]
  );
}

export async function deleteInvoice(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM invoices WHERE id = ?", [id]);
}

export async function updateInvoice(id: string, itemName: string, amountYuan: number, headChecked: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE invoices SET item_name = ?, amount_cent = ?, head_checked = ? WHERE id = ?",
    [itemName, Math.round(amountYuan * 100), headChecked ? 1 : 0, id]
  );
}

// ===== 凭证 =====
export interface Voucher {
  id: string;
  activityId: string;
  amountCent: number;
  filePath: string;
  cardLastFour: string;
  isRefund: boolean;
}

export async function listVouchers(activityId: string): Promise<Voucher[]> {
  const db = await getDb();
  const rows = await db.select("SELECT * FROM vouchers WHERE activity_id = ?", [activityId]);
  return (rows as any[]).map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    amountCent: r.amount_cent,
    filePath: r.file_path,
    cardLastFour: r.card_last_four,
    isRefund: !!r.is_refund,
  }));
}

export async function addVoucher(activityId: string, filePath: string, amountYuan: number, cardLastFour: string, isRefund: boolean): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO vouchers (id, activity_id, amount_cent, file_path, card_last_four, is_refund) VALUES (?, ?, ?, ?, ?, ?)",
    [`vch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, activityId, Math.round(amountYuan * 100), filePath, cardLastFour, isRefund ? 1 : 0]
  );
}

export async function deleteVoucher(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM vouchers WHERE id = ?", [id]);
}
