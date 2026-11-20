import { reactive, computed } from "vue";

export interface HealthItem {
  level: "error" | "warning" | "ok" | "ok-note";
  text: string;
  step?: number; // 点击跳转的步骤
}

export const healthStore = reactive({
  items: [] as HealthItem[],
  // 当前打开活动的名称，侧栏体检面板顶部展示
  activityName: "",
  // 供 Flow.vue 更新
  set(items: HealthItem[], activityName = "") {
    this.items = items;
    this.activityName = activityName;
  },
});

export const healthErrors = computed(() => healthStore.items.filter((i) => i.level === "error"));
export const healthWarnings = computed(() => healthStore.items.filter((i) => i.level === "warning"));
export const healthOks = computed(() => healthStore.items.filter((i) => i.level === "ok"));
export const healthOkNotes = computed(() => healthStore.items.filter((i) => i.level === "ok-note"));
