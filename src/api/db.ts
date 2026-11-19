import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;
let loading: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (db) return Promise.resolve(db);
  // 并发调用共用同一次 load，避免重复打开连接
  if (!loading) loading = init();
  return loading;
}

async function init(): Promise<Database> {
  try {
    let d: Database;
    try {
      d = await Database.load("sqlite:app.db");
    } catch (e) {
      // 插件迁移采用「取出即删除」策略：首次迁移失败后，第二次 load 会在旧结构上成功。
      // 这里重试一次，再由 ensureSchema 幂等补齐新表/字段。
      console.warn("首次加载数据库失败，重试一次：", e);
      d = await Database.load("sqlite:app.db");
    }
    await ensureSchema(d);
    db = d;
    return d;
  } catch (e) {
    loading = null; // 允许下次重试
    console.error("Database.load failed:", e);
    throw new Error(`数据库连接失败: ${e}`);
  }
}

// 幂等补齐新版本所需表/字段：
// 插件迁移只在首次 load 时执行一次，这里兜底，避免升级后缺少 plan_files 等结构。
async function ensureSchema(d: Database): Promise<void> {
  const tables = await d.select(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='plan_files'"
  );
  if ((tables as any[]).length === 0) {
    await d.execute(
      `CREATE TABLE IF NOT EXISTS plan_files (
         id TEXT PRIMARY KEY,
         activity_id TEXT NOT NULL,
         file_path TEXT NOT NULL,
         sort INTEGER NOT NULL DEFAULT 0
       )`
    );
    await d.execute(
      `INSERT OR IGNORE INTO plan_files (id, activity_id, file_path, sort)
       SELECT 'pf-' || id, id, plan_file_path, 0
       FROM activities
       WHERE plan_file_path IS NOT NULL AND plan_file_path <> ''`
    );
  }

  const cols = await d.select("PRAGMA table_info(activities)");
  if (!(cols as any[]).some((c) => c.name === "archive_path")) {
    await d.execute("ALTER TABLE activities ADD COLUMN archive_path TEXT DEFAULT ''");
  }
}
