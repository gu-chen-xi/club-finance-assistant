import { reactive, computed } from "vue";
import { getDb } from "./db";
import { getSettings, type Settings } from "./settings";

// 全局共享的余额数据源：工作台"当前余额"卡片和左侧导航栏底部共用同一份数据
export const balanceStore = reactive({
  settings: null as Settings | null,
  activities: [] as any[],
});

export const balanceLoaded = computed(() => balanceStore.settings !== null);

export async function loadBalanceData() {
  const db = await getDb();
  balanceStore.settings = await getSettings();
  balanceStore.activities = await db.select(
    "SELECT * FROM activities ORDER BY created_at DESC"
  );
}

// 当前余额（元）= 初始余额 - 已归档活动实际支出
export const balance = computed(() => {
  const initial = balanceStore.settings?.initialBalance || 0;
  const spent = balanceStore.activities
    .filter((a) => a.archived)
    .reduce((s, a) => s + (a.actual_cost || 0), 0);
  return (initial - spent) / 100;
});
