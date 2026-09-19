<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getDb } from "../api/db";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

const route = useRoute();
const router = useRouter();
const activityId = route.params.id as string;

const STEPS = [
  "活动策划", "采购清单", "发票", "凭证", "领取表/验收单",
  "非公务卡", "生成电子包", "电子审核", "纸质提交", "归档",
];

const step = ref(1);
const activity = ref<any>(null);
const purchaseItems = ref<any[]>([]);

onMounted(load);

async function load() {
  const db = await getDb();
  const rows = await db.select("SELECT * FROM activities WHERE id = ?", [activityId]);
  if (rows.length === 0) {
    router.push("/activities");
    return;
  }
  activity.value = rows[0];
  step.value = activity.value.current_step;
  const items = await db.select(
    "SELECT * FROM purchase_items WHERE activity_id = ? ORDER BY rowid",
    [activityId]
  );
  purchaseItems.value = items as any[];
}

// 采购清单
function addRow() {
  purchaseItems.value.push({ name: "", quantity: 1, unit_price: 0 });
}
function removeRow(idx: number) {
  purchaseItems.value.splice(idx, 1);
}
const subtotal = (row: any) => (row.quantity || 0) * (row.unit_price || 0);
const totalAmount = computed(() =>
  purchaseItems.value.reduce((s, r) => s + subtotal(r), 0)
);

async function saveStep() {
  const db = await getDb();
  // 保存当前步数据
  if (step.value === 2) {
    await db.execute("DELETE FROM purchase_items WHERE activity_id = ?", [activityId]);
    for (const r of purchaseItems.value) {
      if (!r.name || !r.quantity || !r.unit_price) continue;
      await db.execute(
        "INSERT INTO purchase_items (id, activity_id, name, quantity, unit_price_cent) VALUES (?, ?, ?, ?, ?)",
        [
          `pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          activityId,
          r.name,
          r.quantity,
          Math.round(r.unit_price * 100),
        ]
      );
    }
  }
  // 更新 current_step
  await db.execute("UPDATE activities SET current_step = ? WHERE id = ?", [step.value, activityId]);
}

async function next() {
  await saveStep();
  if (step.value < 10) step.value++;
}
async function prev() {
  await saveStep();
  if (step.value > 1) step.value--;
}

async function pickFile() {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: "文件", extensions: ["jpg", "jpeg", "pdf"] }],
  });
  if (selected) {
    // TODO Batch 1.5: 复制到活动目录并记录
    alert(`已选择：${selected}\n（文件复制功能下一步实现）`);
  }
}
</script>

<template>
  <div class="p-6">
    <!-- 顶部 -->
    <div class="flex items-center justify-between mb-4">
      <button @click="router.push('/activities')" class="text-gray-500 hover:text-gray-700">← 返回列表</button>
      <h1 class="text-xl font-bold">{{ activity?.name }}</h1>
      <button class="px-4 py-2 bg-amber-500 text-white rounded" disabled>生成电子包（Step 7）</button>
    </div>

    <!-- 步骤条 -->
    <div class="flex items-center mb-6 bg-white p-4 rounded shadow">
      <div
        v-for="(s, i) in STEPS"
        :key="i"
        class="flex items-center flex-1 last:flex-none"
      >
        <div class="flex flex-col items-center">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
            :style="{
              background: i + 1 < step ? '#10B981' : i + 1 === step ? '#3B82F6' : '#9CA3AF',
            }"
          >{{ i + 1 }}</div>
          <div class="text-xs mt-1 whitespace-nowrap">{{ s }}</div>
        </div>
        <div v-if="i < STEPS.length - 1" class="flex-1 h-0.5 mx-2 -mt-4"
          :style="{ background: i + 1 < step ? '#10B981' : '#E5E7EB' }"
        ></div>
      </div>
    </div>

    <!-- 步骤内容 -->
    <div v-if="!activity" class="bg-white p-6 rounded shadow text-gray-400">加载中...</div>
    <div v-else class="bg-white p-6 rounded shadow">
      <!-- Step 1: 活动策划 -->
      <div v-if="step === 1">
        <h2 class="text-lg font-bold mb-3">Step 1：活动策划</h2>
        <p class="text-sm text-gray-500 mb-4">提示：纸质版要交 2 份，需签字。</p>
        <div class="space-y-3 max-w-lg">
          <label class="block">
            <span class="text-sm text-gray-600">活动名称</span>
            <input v-model="activity.name" class="mt-1 block w-full border rounded px-3 py-2" />
          </label>
          <label class="block">
            <span class="text-sm text-gray-600">活动日期</span>
            <input v-model="activity.date" type="date" class="mt-1 block w-full border rounded px-3 py-2" />
          </label>
          <div>
            <span class="text-sm text-gray-600">活动策划书（jpg/pdf）</span>
            <button @click="pickFile" class="mt-1 block w-full border-2 border-dashed rounded px-3 py-6 text-gray-400 hover:border-blue-400 hover:text-blue-500">
              点击选择策划书文件
            </button>
          </div>
        </div>
      </div>

      <!-- Step 2: 采购清单 -->
      <div v-else-if="step === 2">
        <h2 class="text-lg font-bold mb-3">Step 2：采购清单</h2>
        <table class="w-full border">
          <thead>
            <tr class="bg-gray-100">
              <th class="border p-2 text-left">物品名称</th>
              <th class="border p-2 w-24">数量</th>
              <th class="border p-2 w-32">单价（元）</th>
              <th class="border p-2 w-32">小计</th>
              <th class="border p-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in purchaseItems" :key="i">
              <td class="border p-2"><input v-model="row.name" class="w-full" /></td>
              <td class="border p-2"><input v-model.number="row.quantity" type="number" class="w-full" /></td>
              <td class="border p-2"><input v-model.number="row.unit_price" type="number" step="0.01" class="w-full" /></td>
              <td class="border p-2 text-right">¥{{ subtotal(row).toFixed(2) }}</td>
              <td class="border p-2 text-center"><button @click="removeRow(i)" class="text-red-500">×</button></td>
            </tr>
          </tbody>
        </table>
        <button @click="addRow" class="mt-2 px-3 py-1 border rounded text-sm">+ 添加一行</button>
        <div class="mt-4 text-right font-bold">合计：¥{{ totalAmount.toFixed(2) }}</div>
      </div>

      <!-- Step 3~6 占位 -->
      <div v-else>
        <h2 class="text-lg font-bold mb-3">Step {{ step }}：{{ STEPS[step - 1] }}</h2>
        <p class="text-gray-400">此步骤界面将在 Batch 1.5 实现（拖拽上传 + 校验）</p>
      </div>
    </div>

    <!-- 底部导航 -->
    <div class="flex justify-between mt-4">
      <button @click="prev" :disabled="step <= 1" class="px-4 py-2 border rounded disabled:opacity-30">← 上一步</button>
      <button @click="next" :disabled="step >= 10" class="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-30">下一步 →</button>
    </div>
  </div>
</template>
