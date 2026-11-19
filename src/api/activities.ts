import { getDb } from "./db";

export interface Activity {
  id: string;
  name: string;
  date: string; // yyyy-MM-dd
  currentStep: number; // 1..10
  budget: number | null; // 分
  actualCost: number; // 分
  folderPath: string | null;
  reviewStatus: "pending" | "submitted" | "reviewing" | "approved" | "rejected";
  reviewRejectReason: string;
  paperSubmitted: boolean;
  archived: boolean;
  archivePath: string;
  createdAt: string;
}

function newId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Math.floor(
    Math.random() * 10000
  )}`;
  return `a-${stamp}`;
}

export async function listActivities(includeArchived = false): Promise<Activity[]> {
  const db = await getDb();
  const sql = includeArchived
    ? "SELECT * FROM activities ORDER BY created_at DESC"
    : "SELECT * FROM activities WHERE archived = 0 ORDER BY created_at DESC";
  const rows = await db.select(sql);
  return (rows as any[]).map(rowToActivity);
}

export async function createActivity(name: string, date: string): Promise<Activity> {
  const db = await getDb();
  const a: Activity = {
    id: newId(),
    name,
    date,
    currentStep: 1,
    budget: null,
    actualCost: 0,
    folderPath: null,
    reviewStatus: "pending",
    reviewRejectReason: "",
    paperSubmitted: false,
    archived: false,
    archivePath: "",
    createdAt: new Date().toISOString(),
  };
  await db.execute(
    `INSERT INTO activities (id, name, date, current_step, budget, actual_cost, folder_path,
       review_status, review_reject_reason, paper_submitted, archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.id, a.name, a.date, a.currentStep, a.budget, a.actualCost, a.folderPath,
      a.reviewStatus, a.reviewRejectReason, 0, 0, a.createdAt,
    ]
  );
  return a;
}

export interface PlanFile {
  id: string;
  activityId: string;
  filePath: string;
}

export async function listPlanFiles(activityId: string): Promise<PlanFile[]> {
  const db = await getDb();
  const rows = await db.select(
    "SELECT * FROM plan_files WHERE activity_id = ? ORDER BY sort, rowid",
    [activityId]
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    filePath: r.file_path,
  }));
}

export async function addPlanFile(activityId: string, filePath: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select(
    "SELECT COUNT(*) AS n FROM plan_files WHERE activity_id = ?",
    [activityId]
  );
  const sort = (rows as any[])[0]?.n || 0;
  await db.execute(
    "INSERT INTO plan_files (id, activity_id, file_path, sort) VALUES (?, ?, ?, ?)",
    [`pf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, activityId, filePath, sort]
  );
}

export async function deletePlanFile(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM plan_files WHERE id = ?", [id]);
}

export async function deleteActivity(id: string): Promise<void> {
  const db = await getDb();
  // 先清关联表，避免留下孤儿数据（与总账页删除逻辑保持一致）
  await db.execute("DELETE FROM plan_files WHERE activity_id = ?", [id]);
  await db.execute("DELETE FROM purchase_items WHERE activity_id = ?", [id]);
  await db.execute("DELETE FROM invoices WHERE activity_id = ?", [id]);
  await db.execute("DELETE FROM vouchers WHERE activity_id = ?", [id]);
  await db.execute("DELETE FROM receipts WHERE activity_id = ?", [id]);
  await db.execute("DELETE FROM non_card WHERE activity_id = ?", [id]);
  await db.execute("DELETE FROM activities WHERE id = ?", [id]);
}

function rowToActivity(r: any): Activity {
  return {
    id: r.id,
    name: r.name,
    date: r.date,
    currentStep: r.current_step,
    budget: r.budget,
    actualCost: r.actual_cost,
    folderPath: r.folder_path,
    reviewStatus: r.review_status,
    reviewRejectReason: r.review_reject_reason ?? "",
    paperSubmitted: !!r.paper_submitted,
    archived: !!r.archived,
    archivePath: r.archive_path ?? "",
    createdAt: r.created_at,
  };
}
