<script setup lang="ts">
import { ref, onMounted } from "vue";

const clubName = ref("");
const teacherName = ref("");
const cardLastFour = ref("");
const schoolTaxNo = ref("");
const submitLocation = ref("");
const initialBalance = ref(0);
const saved = ref(false);

onMounted(async () => {
  // TODO Batch 1: 从 SQLite 读 settings
});

async function save() {
  // TODO Batch 1: 写回 SQLite
  saved.value = true;
  setTimeout(() => (saved.value = false), 2000);
}
</script>

<template>
  <div class="p-6 max-w-2xl">
    <h1 class="text-2xl font-bold mb-4">设置</h1>
    <div class="space-y-4 bg-white p-6 rounded shadow">
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
        <input v-model.number="initialBalance" type="number" class="mt-1 block w-full border rounded px-3 py-2" />
      </label>
      <button @click="save" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        {{ saved ? "已保存 ✓" : "保存" }}
      </button>
    </div>
  </div>
</template>
