-- 004_acceptance_confirmed.sql: 验收单整体签字确认（替代原数量/单价/总价与三方签字）
ALTER TABLE receipts ADD COLUMN confirmed INTEGER NOT NULL DEFAULT 0;
