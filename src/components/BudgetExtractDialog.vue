<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { BudgetRow } from "../api/docxBudget";

const props = defineProps<{
  rows: BudgetRow[];
  fileName: string;
  warnings: string[];
  existingCount: number;
}>();

const emit = defineEmits<{
  confirm: [mode: "replace" | "append", rows: BudgetRow[]];
  cancel: [];
}>();

const local = ref<BudgetRow[]>([]);
watch(
  () => props.rows,
  (v) => { local.value = v.map((r) => ({ ...r })); },
  { immediate: true },
);

const subtotal = (r: BudgetRow) => (r.quantity || 0) * (r.unitPrice || 0);
const total = computed(() => local.value.reduce((s, r) => s + subtotal(r), 0));

function remove(idx: number) { local.value.splice(idx, 1); }

function confirm(mode: "replace" | "append") {
  emit("confirm", mode, local.value.filter((r) => r.name.trim()));
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
      <div class="px-5 py-3 border-b">
        <h3 class="font-bold">从策划书识别预算</h3>
        <p class="text-xs text-gray-500 mt-1 break-all">来源：{{ fileName }}</p>
      </div>

      <div class="p-5 overflow-auto flex-1">
        <div class="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          识别结果仅供参考，请逐行核对后再导入。
        </div>

        <div v-if="warnings.length > 0" class="mb-3 p-2 bg-gray-50 border rounded text-xs text-gray-600">
          <div v-for="(w, i) in warnings" :key="i">· {{ w }}</div>
        </div>

        <table class="w-full border text-sm">
          <thead>
            <tr class="bg-gray-100">
              <th class="border p-2 text-left">物品名称</th>
              <th class="border p-2 w-24">数量</th>
              <th class="border p-2 w-32">单价（元）</th>
              <th class="border p-2 w-32">小计</th>
              <th class="border p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in local" :key="i">
              <td class="border p-2"><input v-model="r.name" class="w-full" /></td>
              <td class="border p-2"><input v-model.number="r.quantity" type="number" class="w-full" /></td>
              <td class="border p-2"><input v-model.number="r.unitPrice" type="number" step="0.01" class="w-full" /></td>
              <td class="border p-2 text-right">¥{{ subtotal(r).toFixed(2) }}</td>
              <td class="border p-2 text-center"><button @click="remove(i)" class="text-red-500">×</button></td>
            </tr>
          </tbody>
        </table>

        <div class="mt-3 text-right font-bold">共 {{ local.length }} 项，合计 ¥{{ total.toFixed(2) }}</div>
      </div>

      <div class="px-5 py-3 border-t flex items-center justify-between gap-2">
        <span class="text-xs text-gray-500">现有采购清单 {{ existingCount }} 项</span>
        <div class="flex gap-2">
          <button @click="emit('cancel')" class="px-4 py-2 border rounded">取消</button>
          <button
            @click="confirm('append')"
            :disabled="local.length === 0"
            class="px-4 py-2 border rounded disabled:opacity-40"
          >追加到现有</button>
          <button
            @click="confirm('replace')"
            :disabled="local.length === 0"
            class="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-40"
          >覆盖现有清单</button>
        </div>
      </div>
    </div>
  </div>
</template>
