<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { listActivities, createActivity, deleteActivity, type Activity } from "../api/activities";

const router = useRouter();
const activities = ref<Activity[]>([]);
const loading = ref(true);
const error = ref("");
const showNew = ref(false);
const newName = ref("");
const newDate = ref(new Date().toISOString().slice(0, 10));

onMounted(load);

async function load() {
  try {
    activities.value = await listActivities();
  } catch (e: any) {
    error.value = String(e?.message || e);
  } finally {
    loading.value = false;
  }
}

async function create() {
  if (!newName.value.trim()) return;
  const a = await createActivity(newName.value.trim(), newDate.value);
  showNew.value = false;
  newName.value = "";
  await load();
  router.push(`/activities/${a.id}`);
}

async function remove(a: Activity) {
  if (!confirm(`确定删除活动「${a.name}」？\n（文件仍在磁盘，只删除数据库记录）`)) return;
  await deleteActivity(a.id);
  await load();
}

function statusColor(a: Activity): string {
  if (a.archived) return "#4B5563";
  switch (a.reviewStatus) {
    case "approved": return "#F59E0B";
    case "submitted":
    case "reviewing": return "#8B5CF6";
    case "rejected": return "#EF4444";
    default: return a.currentStep >= 7 ? "#10B981" : "#3B82F6";
  }
}

function statusLabel(a: Activity): string {
  if (a.archived) return "已归档";
  switch (a.reviewStatus) {
    case "approved": return "已通过";
    case "submitted": return "已提交";
    case "reviewing": return "审核中";
    case "rejected": return "已退回";
    default: return `Step ${a.currentStep}/10`;
  }
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">活动报账</h1>
      <button @click="showNew = true" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        + 新建活动
      </button>
    </div>

    <!-- 新建弹窗 -->
    <div v-if="showNew" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded shadow-lg w-96">
        <h2 class="text-lg font-bold mb-4">新建活动</h2>
        <label class="block mb-3">
          <span class="text-sm text-gray-600">活动名称</span>
          <input v-model="newName" class="mt-1 block w-full border rounded px-3 py-2" placeholder="如：第01次迎新晚会" />
        </label>
        <label class="block mb-4">
          <span class="text-sm text-gray-600">活动日期</span>
          <input v-model="newDate" type="date" class="mt-1 block w-full border rounded px-3 py-2" />
        </label>
        <div class="flex gap-2 justify-end">
          <button @click="showNew = false" class="px-3 py-1.5 border rounded">取消</button>
          <button @click="create" class="px-3 py-1.5 bg-blue-600 text-white rounded">创建</button>
        </div>
      </div>
    </div>

    <!-- 活动列表 -->
    <div v-if="loading" class="text-gray-400">加载中...</div>
    <div v-else-if="error" class="bg-red-50 border border-red-300 text-red-700 p-4 rounded">
      <b>错误：</b>{{ error }}
    </div>
    <div v-else-if="activities.length === 0" class="text-gray-400 text-center py-16">
      还没有活动，点右上角"新建活动"开始
    </div>
    <div v-else class="grid gap-3">
      <div
        v-for="a in activities"
        :key="a.id"
        class="bg-white p-4 rounded shadow flex items-center gap-4 cursor-pointer hover:shadow-md"
        @click="router.push(`/activities/${a.id}`)"
      >
        <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: statusColor(a) }"></span>
        <div class="flex-1">
          <div class="font-semibold">{{ a.name }}</div>
          <div class="text-sm text-gray-500">{{ a.date }}</div>
        </div>
        <div class="text-sm text-gray-600">{{ statusLabel(a) }}</div>
        <button
          @click.stop="remove(a)"
          class="text-red-500 hover:text-red-700 text-sm"
        >删除</button>
      </div>
    </div>
  </div>
</template>
