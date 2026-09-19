import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;
  try {
    db = await Database.load("sqlite:app.db");
  } catch (e) {
    console.error("Database.load failed:", e);
    throw new Error(`数据库连接失败: ${e}`);
  }
  return db;
}
