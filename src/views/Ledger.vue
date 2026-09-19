<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { getDb } from "../api/db";
import { getSettings } from "../api/settings";

const router = useRouter();
const activities = ref<any[]>([]);
const settings = ref<any>(null);

onMounted(load);

async function load() {
  const db = await getDb();
  settings.value = await getSettings();
  activities.value = await db.select("SELECT * FROM activities WHERE archived = 1 ORDER BY date DESC");
}

const totalSpent = computed(() =>
  activities.value.reduce((s, a) => s + (a.actual_cost || 0), 0) / 100
);
const balance = computed(() => (settings.value?.initialBalance || 0) / 100 - totalSpent.value);

async function deleteActivity(a: any) {
  if (!confirm(`确定删除活动"${a.name}"吗？\n所有发票、凭证、领取表等关联数据都会被删除，且不可恢复！`)) return;
  const db = await getDb();
  await db.execute("DELETE FROM purchase_items WHERE activity_id = ?", [a.id]);
  await db.execute("DELETE FROM invoices WHERE activity_id = ?", [a.id]);
  await db.execute("DELETE FROM vouchers WHERE activity_id = ?", [a.id]);
  await db.execute("DELETE FROM receipts WHERE activity_id = ?", [a.id]);
  await db.execute("DELETE FROM non_card WHERE activity_id = ?", [a.id]);
  await db.execute("DELETE FROM activities WHERE id = ?", [a.id]);
  activities.value = await db.select("SELECT * FROM activities WHERE archived = 1 ORDER BY date DESC");
}
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">总账</h1>

    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white p-5 rounded shadow">
        <div class="text-sm text-gray-500">初始余额</div>
        <div class="text-2xl font-bold mt-2">¥{{ ((settings?.initialBalance || 0) / 100).toFixed(2) }}</div>
      </div>
      <div class="bg-white p-5 rounded shadow">
        <div class="text-sm text-gray-500">累计支出</div>
        <div class="text-2xl font-bold mt-2 text-red-600">¥{{ totalSpent.toFixed(2) }}</div>
      </div>
      <div class="bg-white p-5 rounded shadow">
        <div class="text-sm text-gray-500">当前余额</div>
        <div class="text-2xl font-bold mt-2" :class="balance < 50 ? 'text-red-600' : 'text-green-600'">¥{{ balance.toFixed(2) }}</div>
      </div>
    </div>

    <table class="w-full border bg-white">
      <thead>
        <tr class="bg-gray-100">
          <th class="border p-2 text-left">日期</th>
          <th class="border p-2 text-left">活动名称</th>
          <th class="border p-2 w-32 text-right">支出</th>
          <th class="border p-2 w-32 text-right">余额</th>
          <th class="border p-2 w-16">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in activities" :key="a.id" @click="router.push(`/activities/${a.id}`)" class="hover:bg-gray-50 cursor-pointer">
          <td class="border p-2 text-sm">{{ a.date }}</td>
          <td class="border p-2">{{ a.name }}</td>
          <td class="border p-2 text-right text-sm">-¥{{ ((a.actual_cost || 0) / 100).toFixed(2) }}</td>
          <td class="border p-2 text-right text-sm">¥{{ (((settings?.initialBalance || 0) / 100) - activities.slice(0, activities.indexOf(a) + 1).reduce((s, x) => s + (x.actual_cost || 0), 0) / 100).toFixed(2) }}</td>
          <td class="border p-2 text-center">
            <button @click.stop="deleteActivity(a)" class="text-red-500 hover:text-red-700 text-sm">删除</button>
          </td>
        </tr>
        <tr v-if="activities.length === 0">
          <td colspan="5" class="border p-4 text-center text-gray-400">暂无已归档活动</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
