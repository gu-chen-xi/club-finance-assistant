import { reactive, computed } from "vue";

export interface HealthItem {
  level: "error" | "warning" | "ok";
  text: string;
  step?: number; // 点击跳转的步骤
}

export const healthStore = reactive({
  items: [] as HealthItem[],
  // 供 Flow.vue 更新
  set(items: HealthItem[]) {
    this.items = items;
  },
});

export const healthErrors = computed(() => healthStore.items.filter((i) => i.level === "error"));
export const healthWarnings = computed(() => healthStore.items.filter((i) => i.level === "warning"));
export const healthOks = computed(() => healthStore.items.filter((i) => i.level === "ok"));
