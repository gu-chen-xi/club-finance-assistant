import { getDb } from "./db";

export interface Settings {
  clubName: string;
  teacherName: string;
  cardLastFour: string;
  schoolTaxNo: string;
  submitLocation: string;
  initialBalance: number; // 分
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select("SELECT key, value FROM settings");
  if ((rows as any[]).length === 0) {
    // 首次启动写入默认值
    await db.execute("INSERT INTO settings (key, value) VALUES ('club_name', '')");
    await db.execute("INSERT INTO settings (key, value) VALUES ('teacher_name', '')");
    await db.execute("INSERT INTO settings (key, value) VALUES ('card_last_four', '')");
    await db.execute("INSERT INTO settings (key, value) VALUES ('school_tax_no', '')");
    await db.execute("INSERT INTO settings (key, value) VALUES ('submit_location', '303办公室社管柜子财务部那一格')");
    await db.execute("INSERT INTO settings (key, value) VALUES ('initial_balance', '0')");
  }
  const rows2 = await db.select("SELECT key, value FROM settings");
  const map: Record<string, string> = {};
  for (const r of rows2 as { key: string; value: string }[]) {
    map[r.key] = r.value;
  }
  return {
    clubName: map.club_name ?? "",
    teacherName: map.teacher_name ?? "",
    cardLastFour: map.card_last_four ?? "",
    schoolTaxNo: map.school_tax_no ?? "",
    submitLocation: map.submit_location ?? "",
    initialBalance: parseInt(map.initial_balance ?? "0", 10),
  };
}

export async function saveSettings(s: Settings): Promise<void> {
  const db = await getDb();
  const pairs: [string, string][] = [
    ["club_name", s.clubName],
    ["teacher_name", s.teacherName],
    ["card_last_four", s.cardLastFour],
    ["school_tax_no", s.schoolTaxNo],
    ["submit_location", s.submitLocation],
    ["initial_balance", String(s.initialBalance)],
  ];
  for (const [k, v] of pairs) {
    await db.execute(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [k, v]
    );
  }
}
