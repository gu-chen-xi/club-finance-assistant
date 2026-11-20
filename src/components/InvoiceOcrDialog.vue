<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  INVOICE_ROI, readImageDataUrl, recognizeInvoiceDataUrl,
} from "../api/ocr";

const props = defineProps<{
  filePath: string;
  itemName: string;
}>();

const emit = defineEmits<{
  confirm: [amountYuan: number, itemName: string];
  cancel: [];
}>();

const nameInput = ref(props.itemName || "");

const fileName = computed(() => props.filePath.split(/[\\/]/).pop() || props.filePath);
const imgUrl = ref("");
const cropUrl = ref("");
const status = ref<"running" | "ok" | "fail">("running");
const progress = ref(0);
const text = ref("");
const confidence = ref(0);
const amountInput = ref("");
const error = ref("");

const roiStyle = computed(() => ({
  left: `${INVOICE_ROI.x * 100}%`,
  top: `${INVOICE_ROI.y * 100}%`,
  width: `${INVOICE_ROI.width * 100}%`,
  height: `${INVOICE_ROI.height * 100}%`,
}));

const amountValue = computed(() => {
  const n = Number(amountInput.value);
  return Number.isFinite(n) && n > 0 ? n : null;
});

onMounted(run);

async function run() {
  status.value = "running";
  error.value = "";
  progress.value = 0;
  cropUrl.value = "";
  try {
    if (!imgUrl.value) imgUrl.value = await readImageDataUrl(props.filePath);
    const res = await recognizeInvoiceDataUrl(imgUrl.value, (p) => { progress.value = p; });
    cropUrl.value = res.dataUrl;
    text.value = res.text;
    confidence.value = res.confidence;
    if (res.amount !== null) amountInput.value = res.amount.toFixed(2);
    status.value = res.ok ? "ok" : "fail";
    if (!res.ok && res.amount === null) error.value = "未在该区域识别出金额，请手动填写。";
  } catch (e: any) {
    status.value = "fail";
    error.value = e?.message || String(e);
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
      <div class="px-5 py-3 border-b">
        <h3 class="font-bold">识别发票金额</h3>
        <p class="text-xs text-gray-500 mt-1 break-all">{{ fileName }}<span v-if="itemName"> · {{ itemName }}</span></p>
      </div>

      <div class="p-5 overflow-auto flex-1">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <!-- 原图 + ROI -->
          <div class="md:col-span-2">
            <div class="text-xs text-gray-500 mb-1">原图（红框为识别区域：价税合计·小写）</div>
            <div class="relative inline-block border rounded overflow-hidden bg-gray-50 max-w-full">
              <img v-if="imgUrl" :src="imgUrl" class="block max-w-full" />
              <div v-else class="w-96 h-64 flex items-center justify-center text-gray-400 text-sm">图片加载中...</div>
              <div class="absolute border-2 border-red-500 pointer-events-none" :style="roiStyle"></div>
            </div>
          </div>

          <!-- 裁剪图 + 结果 -->
          <div class="space-y-3">
            <div>
              <div class="text-xs text-gray-500 mb-1">裁剪区域（放大二值化）</div>
              <div class="border rounded bg-gray-50 min-h-[64px] flex items-center justify-center p-2">
                <img v-if="cropUrl" :src="cropUrl" class="max-w-full" />
                <span v-else class="text-xs text-gray-400">
                  {{ status === "running" ? `识别中 ${Math.round(progress * 100)}%` : "—" }}
                </span>
              </div>
            </div>

            <div
              class="p-2 rounded text-sm font-bold text-center"
              :class="status === 'ok' ? 'bg-green-50 text-green-700' : status === 'fail' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'"
            >
              {{ status === "ok" ? "✅ 识别成功" : status === "fail" ? "❌ 识别失败" : "识别中..." }}
            </div>

            <label class="block">
              <span class="text-xs text-gray-500">物品名（不识别，照原图手动填写）</span>
              <input v-model="nameInput" class="mt-1 block w-full border rounded px-3 py-2" placeholder="如：蜡烛 / 鼠标垫" />
            </label>

            <label class="block">
              <span class="text-xs text-gray-500">识别金额（元，可手动修正）</span>
              <input v-model="amountInput" type="number" step="0.01" class="mt-1 block w-full border rounded px-3 py-2 text-lg font-mono" />
            </label>

            <div class="text-xs text-gray-500 break-all">
              <div>识别原文：{{ text || "—" }}</div>
              <div>置信度：{{ confidence.toFixed(0) }}</div>
            </div>

            <div v-if="error" class="text-xs text-red-600">{{ error }}</div>
          </div>
        </div>
      </div>

      <div class="px-5 py-3 border-t flex justify-end gap-2">
        <button @click="emit('cancel')" class="px-4 py-2 border rounded">取消</button>
        <button @click="run" :disabled="status === 'running'" class="px-4 py-2 border rounded disabled:opacity-40">重新识别</button>
        <button
          @click="amountValue !== null && emit('confirm', amountValue, nameInput.trim())"
          :disabled="amountValue === null"
          class="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-40"
        >确认填入</button>
      </div>
    </div>
  </div>
</template>
