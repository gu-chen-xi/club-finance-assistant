-- 003_custom_templates.sql: 自定义模板
CREATE TABLE IF NOT EXISTS custom_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);
