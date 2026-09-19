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
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in activities" :key="a.id" @click="router.push(`/activities/${a.id}`)" class="hover:bg-gray-50 cursor-pointer">
          <td class="border p-2 text-sm">{{ a.date }}</td>
          <td class="border p-2">{{ a.name }}</td>
          <td class="border p-2 text-right text-sm">-¥{{ ((a.actual_cost || 0) / 100).toFixed(2) }}</td>
          <td class="border p-2 text-right text-sm">¥{{ (((settings?.initialBalance || 0) / 100) - activities.slice(0, activities.indexOf(a) + 1).reduce((s, x) => s + (x.actual_cost || 0), 0) / 100).toFixed(2) }}</td>
        </tr>
        <tr v-if="activities.length === 0">
          <td colspan="4" class="border p-4 text-center text-gray-400">暂无已归档活动</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
