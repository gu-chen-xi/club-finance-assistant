<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { getDb } from "../api/db";

const router = useRouter();
const activities = ref<any[]>([]);
const filter = ref<"all" | "ongoing" | "archived">("all");

onMounted(load);

async function load() {
  const db = await getDb();
  activities.value = await db.select("SELECT * FROM activities ORDER BY created_at DESC");
}

const filtered = computed(() => {
  if (filter.value === "ongoing") return activities.value.filter((a) => !a.archived);
  if (filter.value === "archived") return activities.value.filter((a) => a.archived);
  return activities.value;
});

const statusLabel = (s: string) =>
  ({ pending: "待提交", submitted: "已提交", reviewing: "审核中", approved: "已通过", rejected: "已退回" }[s] || s);

const statusClass = (s: string) =>
  ({
    pending: "bg-gray-100 text-gray-600",
    submitted: "bg-purple-100 text-purple-700",
    reviewing: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  }[s] || "bg-gray-100 text-gray-600");
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">报销跟踪</h1>

    <div class="flex gap-2 mb-4">
      <button @click="filter = 'all'" :class="filter === 'all' ? 'bg-blue-600 text-white' : 'border'" class="px-4 py-1.5 rounded text-sm">全部</button>
      <button @click="filter = 'ongoing'" :class="filter === 'ongoing' ? 'bg-blue-600 text-white' : 'border'" class="px-4 py-1.5 rounded text-sm">进行中</button>
      <button @click="filter = 'archived'" :class="filter === 'archived' ? 'bg-blue-600 text-white' : 'border'" class="px-4 py-1.5 rounded text-sm">已归档</button>
    </div>

    <table class="w-full border bg-white">
      <thead>
        <tr class="bg-gray-100">
          <th class="border p-2 text-left">活动名称</th>
          <th class="border p-2 text-left">日期</th>
          <th class="border p-2 w-28">当前步骤</th>
          <th class="border p-2 w-28">状态</th>
          <th class="border p-2 w-32">实际支出</th>
          <th class="border p-2 w-20">归档</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in filtered" :key="a.id" @click="router.push(`/activities/${a.id}`)" class="hover:bg-gray-50 cursor-pointer">
          <td class="border p-2">{{ a.name }}</td>
          <td class="border p-2 text-sm">{{ a.date }}</td>
          <td class="border p-2 text-sm text-center">Step {{ a.current_step }}</td>
          <td class="border p-2 text-center">
            <span class="text-xs px-2 py-1 rounded" :class="statusClass(a.review_status)">{{ statusLabel(a.review_status) }}</span>
          </td>
          <td class="border p-2 text-right text-sm">¥{{ ((a.actual_cost || 0) / 100).toFixed(2) }}</td>
          <td class="border p-2 text-center text-sm">
            <span v-if="a.archived" class="text-green-600">✅</span>
            <span v-else class="text-gray-400">—</span>
          </td>
        </tr>
        <tr v-if="filtered.length === 0">
          <td colspan="6" class="border p-4 text-center text-gray-400">暂无数据</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
