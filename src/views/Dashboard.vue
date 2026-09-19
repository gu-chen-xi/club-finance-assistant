<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { getDb } from "../api/db";
import { getSettings } from "../api/settings";

const router = useRouter();
const settings = ref<any>(null);
const activities = ref<any[]>([]);

onMounted(load);

async function load() {
  const db = await getDb();
  settings.value = await getSettings();
  activities.value = await db.select("SELECT * FROM activities ORDER BY created_at DESC");
}

// 当前余额 = 初始余额 - 已归档活动实际支出
const balance = computed(() => {
  const initial = settings.value?.initialBalance || 0;
  const spent = activities.value
    .filter((a) => a.archived)
    .reduce((s, a) => s + (a.actual_cost || 0), 0);
  return (initial - spent) / 100;
});

// 本月支出（已归档）
const monthSpent = computed(() => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return (
    activities.value
      .filter((a) => {
        if (!a.archived || !a.date) return false;
        const d = new Date(a.date);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .reduce((s, a) => s + (a.actual_cost || 0), 0) / 100
  );
});

// 待报销金额（未归档活动的发票总额）
const pendingAmount = computed(() => {
  return activities.value
    .filter((a) => !a.archived)
    .reduce((s, a) => s + (a.budget || 0), 0) / 100;
});

// 进行中的活动
const ongoing = computed(() => activities.value.filter((a) => !a.archived));

const balanceLow = computed(() => balance.value < 50);
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">工作台</h1>
      <button @click="router.push('/activities')" class="px-4 py-2 bg-blue-600 text-white rounded">+ 新建活动</button>
    </div>

    <!-- 三张卡片 -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white p-5 rounded shadow" :class="{ 'animate-pulse bg-red-50 border-2 border-red-400': balanceLow }">
        <div class="text-sm text-gray-500">当前余额</div>
        <div class="text-3xl font-bold mt-2" :class="balanceLow ? 'text-red-600' : 'text-gray-800'">
          ¥{{ balance.toFixed(2) }}
        </div>
        <div v-if="balanceLow" class="text-xs text-red-500 mt-1">⚠️ 余额不足，请尽快拉赞助</div>
      </div>
      <div class="bg-white p-5 rounded shadow">
        <div class="text-sm text-gray-500">本月支出</div>
        <div class="text-3xl font-bold mt-2 text-gray-800">¥{{ monthSpent.toFixed(2) }}</div>
      </div>
      <div class="bg-white p-5 rounded shadow">
        <div class="text-sm text-gray-500">待报销活动</div>
        <div class="text-3xl font-bold mt-2 text-gray-800">{{ ongoing.length }}</div>
      </div>
    </div>

    <!-- 待办事项 -->
    <div class="bg-white p-5 rounded shadow">
      <h2 class="text-lg font-semibold mb-3">进行中的活动</h2>
      <div v-if="ongoing.length === 0" class="text-gray-400 text-sm">暂无进行中的活动</div>
      <div v-else class="space-y-2">
        <div
          v-for="a in ongoing" :key="a.id"
          @click="router.push(`/activities/${a.id}`)"
          class="flex items-center justify-between p-3 border rounded hover:bg-gray-50 cursor-pointer"
        >
          <div>
            <div class="font-medium">{{ a.name }}</div>
            <div class="text-xs text-gray-500 mt-1">日期：{{ a.date }} · 当前到 Step {{ a.current_step }}</div>
          </div>
          <span class="text-xs px-2 py-1 rounded" :class="{
            'bg-gray-100 text-gray-600': a.review_status === 'pending',
            'bg-purple-100 text-purple-700': a.review_status === 'submitted',
            'bg-blue-100 text-blue-700': a.review_status === 'reviewing',
            'bg-red-100 text-red-700': a.review_status === 'rejected',
          }">
            {{ { pending: '待提交', submitted: '已提交', reviewing: '审核中', rejected: '已退回' }[a.review_status] || a.review_status }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
