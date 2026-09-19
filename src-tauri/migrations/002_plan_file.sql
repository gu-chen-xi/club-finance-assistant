-- 002: 给 activities 加策划书文件路径
ALTER TABLE activities ADD COLUMN plan_file_path TEXT DEFAULT '';
