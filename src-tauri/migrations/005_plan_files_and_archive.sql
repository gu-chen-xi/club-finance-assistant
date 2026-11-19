-- 005: 活动策划书支持多文件
-- 注意：archive_path 字段由前端 ensureSchema 幂等补齐，
-- 这里不写 ALTER TABLE，保证迁移可重复执行。

CREATE TABLE IF NOT EXISTS plan_files (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

-- 把旧的单文件路径迁移成一行
INSERT OR IGNORE INTO plan_files (id, activity_id, file_path, sort)
SELECT 'pf-' || id, id, plan_file_path, 0
FROM activities
WHERE plan_file_path IS NOT NULL AND plan_file_path <> '';
