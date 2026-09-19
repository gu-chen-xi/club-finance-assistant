<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getSettings, saveSettings } from "../api/settings";

const clubName = ref("");
const teacherName = ref("");
const cardLastFour = ref("");
const schoolTaxNo = ref("");
const submitLocation = ref("");
const initialBalanceYuan = ref(0); // 显示用元
const saved = ref(false);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    const s = await getSettings();
    clubName.value = s.clubName;
    teacherName.value = s.teacherName;
    cardLastFour.value = s.cardLastFour;
    schoolTaxNo.value = s.schoolTaxNo;
    submitLocation.value = s.submitLocation;
    initialBalanceYuan.value = s.initialBalance / 100;
  } catch (e: any) {
    error.value = String(e?.message || e);
  } finally {
    loading.value = false;
  }
});

async function save() {
  await saveSettings({
    clubName: clubName.value.trim(),
    teacherName: teacherName.value.trim(),
    cardLastFour: cardLastFour.value.trim(),
    schoolTaxNo: schoolTaxNo.value.trim(),
    submitLocation: submitLocation.value.trim(),
    initialBalance: Math.round(initialBalanceYuan.value * 100), // 元 → 分
  });
  saved.value = true;
  setTimeout(() => (saved.value = false), 2000);
}
</script>

<template>
  <div class="p-6 max-w-2xl">
    <h1 class="text-2xl font-bold mb-4">设置</h1>
    <div v-if="loading" class="text-gray-400">加载中...</div>
    <div v-else-if="error" class="bg-red-50 border border-red-300 text-red-700 p-4 rounded">
      <b>错误：</b>{{ error }}
    </div>
    <div v-else class="space-y-4 bg-white p-6 rounded shadow">
      <label class="block">
        <span class="text-sm text-gray-600">社团名称</span>
        <input v-model="clubName" class="mt-1 block w-full border rounded px-3 py-2" placeholder="如：青年网络思行社" />
      </label>
      <label class="block">
        <span class="text-sm text-gray-600">指导老师姓名</span>
        <input v-model="teacherName" class="mt-1 block w-full border rounded px-3 py-2" />
      </label>
      <label class="block">
        <span class="text-sm text-gray-600">公务卡后四位</span>
        <input v-model="cardLastFour" maxlength="4" class="mt-1 block w-full border rounded px-3 py-2" placeholder="4 位数字" />
      </label>
      <label class="block">
        <span class="text-sm text-gray-600">学校税号</span>
        <input v-model="schoolTaxNo" class="mt-1 block w-full border rounded px-3 py-2" />
      </label>
      <label class="block">
        <span class="text-sm text-gray-600">默认交表位置</span>
        <input v-model="submitLocation" class="mt-1 block w-full border rounded px-3 py-2" />
      </label>
      <label class="block">
        <span class="text-sm text-gray-600">初始余额（元）</span>
        <input v-model.number="initialBalanceYuan" type="number" step="0.01" class="mt-1 block w-full border rounded px-3 py-2" />
      </label>
      <button @click="save" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        {{ saved ? "已保存 ✓" : "保存" }}
      </button>
    </div>
  </div>
</template>
