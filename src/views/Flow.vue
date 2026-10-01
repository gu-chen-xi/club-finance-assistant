<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getDb } from "../api/db";
import { getSettings } from "../api/settings";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { healthStore, healthErrors, type HealthItem } from "../api/health";
import {
  listInvoices, addInvoice, deleteInvoice, updateInvoice, type Invoice,
  listVouchers, addVoucher, deleteVoucher, type Voucher,
} from "../api/invoices";

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
const invoices = ref<Invoice[]>([]);
const vouchers = ref<Voucher[]>([]);
const settings = ref<any>(null);
// Step5: 领取表/验收单
const receiptTab = ref<"receipt" | "acceptance">("receipt");
const receipts = ref<any[]>([]);
// 验收单整体签字确认（替代原数量/单价/总价与三方签字）
const acceptanceConfirmed = ref(false);
// Step6: 非公务卡
const nonCardApplicable = ref(false);
const nonCardFiles = ref<string[]>([]);
// Step7: 生成电子包
const outputDir = ref("");
const generating = ref(false);
const genLog = ref("");

onMounted(load);

async function load() {
  const db = await getDb();
  const rows = await db.select("SELECT * FROM activities WHERE id = ?", [activityId]);
  if (rows.length === 0) { router.push("/activities"); return; }
  activity.value = rows[0];
  step.value = activity.value.current_step;
  const items = await db.select("SELECT * FROM purchase_items WHERE activity_id = ? ORDER BY rowid", [activityId]);
  purchaseItems.value = (items as any[]).map((r) => ({
    name: r.name,
    quantity: r.quantity,
    unit_price: (r.unit_price_cent || 0) / 100, // 分 → 元
  }));
  invoices.value = await listInvoices(activityId);
  vouchers.value = await listVouchers(activityId);
  receipts.value = await db.select("SELECT * FROM receipts WHERE activity_id = ? ORDER BY rowid", [activityId]);
  acceptanceConfirmed.value = !!(receipts.value.find((r: any) => r.type === "acceptance")?.confirmed);
  const nc = await db.select("SELECT * FROM non_card WHERE activity_id = ?", [activityId]);
  if (nc.length > 0) {
    nonCardApplicable.value = !!nc[0].applicable;
    try { nonCardFiles.value = JSON.parse(nc[0].files || "[]"); } catch { nonCardFiles.value = []; }
  }
  settings.value = await getSettings();
}

// 采购清单
function addRow() { purchaseItems.value.push({ name: "", quantity: 1, unit_price: 0 }); }
function removeRow(idx: number) { purchaseItems.value.splice(idx, 1); }
const subtotal = (row: any) => (row.quantity || 0) * (row.unit_price || 0);
const totalAmount = computed(() => purchaseItems.value.reduce((s, r) => s + subtotal(r), 0));

// 发票
async function pickInvoices() {
  const selected = await openDialog({
    multiple: true,
    filters: [{ name: "发票", extensions: ["jpg", "jpeg", "pdf"] }],
  });
  if (!selected) return;
  for (const f of selected as string[]) {
    await addInvoice(activityId, f, "", 0);
  }
  invoices.value = await listInvoices(activityId);
}
async function saveInvoice(inv: Invoice) {
  await updateInvoice(inv.id, inv.itemName, inv.amountCent / 100, inv.headChecked);
}
async function removeInvoice(id: string) {
  await deleteInvoice(id);
  invoices.value = await listInvoices(activityId);
}
const invoiceTotal = computed(() => invoices.value.reduce((s, i) => s + i.amountCent, 0));

// 凭证
async function pickVouchers() {
  const selected = await openDialog({ multiple: true, filters: [{ name: "凭证", extensions: ["jpg", "jpeg", "png"] }] });
  if (!selected) return;
  for (const f of selected as string[]) {
    await addVoucher(activityId, f, 0, settings.value?.cardLastFour || "", false);
  }
  vouchers.value = await listVouchers(activityId);
}
async function removeVoucher(id: string) {
  await deleteVoucher(id);
  vouchers.value = await listVouchers(activityId);
}
const voucherTotal = computed(() =>
  vouchers.value.filter((v) => !v.isRefund).reduce((s, v) => s + v.amountCent, 0)
);
const refundTotal = computed(() =>
  vouchers.value.filter((v) => v.isRefund).reduce((s, v) => s + v.amountCent, 0)
);

// Step5: 领取表/验收单
async function pickReceipt() {
  const selected = await openDialog({ multiple: true, filters: [{ name: "领取表", extensions: ["jpg", "jpeg"] }] });
  if (!selected) return;
  const db = await getDb();
  for (const f of selected as string[]) {
    await db.execute(
      "INSERT INTO receipts (id, activity_id, type, file_path) VALUES (?, ?, 'receipt', ?)",
      [`rct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, activityId, f]
    );
  }
  receipts.value = await db.select("SELECT * FROM receipts WHERE activity_id = ? ORDER BY rowid", [activityId]);
}
async function pickAcceptance() {
  const selected = await openDialog({ multiple: true, filters: [{ name: "验收单", extensions: ["jpg", "jpeg", "docx", "xlsx"] }] });
  if (!selected) return;
  const db = await getDb();
  for (const f of selected as string[]) {
    await db.execute(
      "INSERT INTO receipts (id, activity_id, type, file_path) VALUES (?, ?, 'acceptance', ?)",
      [`rct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, activityId, f]
    );
  }
  receipts.value = await db.select("SELECT * FROM receipts WHERE activity_id = ? ORDER BY rowid", [activityId]);
}
async function removeReceipt(id: string) {
  const db = await getDb();
  await db.execute("DELETE FROM receipts WHERE id = ?", [id]);
  receipts.value = await db.select("SELECT * FROM receipts WHERE activity_id = ? ORDER BY rowid", [activityId]);
}
// 验收单显示名：jpg → 纸质验收单N；docx/xlsx → 电子验收单（统一前缀，扩展名保留区分）
function acceptanceLabel(r: any) {
  const p = String(r.file_path).toLowerCase();
  if (p.endsWith(".docx")) return "电子验收单.docx";
  if (p.endsWith(".xlsx")) return "电子验收单.xlsx";
  const jpgs = receipts.value.filter((x) => x.type === "acceptance" && !String(x.file_path).toLowerCase().endsWith(".docx") && !String(x.file_path).toLowerCase().endsWith(".xlsx"));
  return `纸质验收单${jpgs.indexOf(r) + 1}.jpg`;
}

// Step6: 非公务卡
async function pickNonCard() {
  const selected = await openDialog({ multiple: true, filters: [{ name: "审批表", extensions: ["jpg", "jpeg", "pdf"] }] });
  if (!selected) return;
  nonCardFiles.value = nonCardFiles.value.concat(selected as string[]);
}
async function removeNonCardFile(idx: number) {
  nonCardFiles.value.splice(idx, 1);
}

// Step7: 选输出目录
async function pickOutputDir() {
  const selected = await openDialog({ directory: true, multiple: false });
  if (selected) outputDir.value = selected as string;
}

// Step7: 生成电子包
async function generatePackage() {
  if (!outputDir.value) { alert("请先选择输出目录"); return; }
  const redCount = healthErrors.value.length;
  if (redCount > 0) {
    if (!confirm(`还有 ${redCount} 个红项未解决，确定要生成吗？`)) return;
  }
  generating.value = true;
  genLog.value = "开始生成...";

  const club = settings.value?.clubName || "社团";
  const teacher = settings.value?.teacherName || "老师";
  const totalYuan = (invoiceTotal.value / 100).toFixed(2);
  genLog.value = `社团=${club} 老师=${teacher} totalYuan=${totalYuan} invoiceTotal分=${invoiceTotal.value}`;
  const topName = `${club}打给${teacher}${totalYuan}元`;
  const topDir = `${outputDir.value}/${topName}`;

  const tasks: [string, string][] = [];

  // 发票目录
  const invDir = `${topDir}/${invoices.value.length}张发票${totalYuan}元`;
  invoices.value.forEach((inv, i) => {
    const ext = inv.fileExt || "jpg";
    const name = `${inv.itemName || "物品"}+${(inv.amountCent/100).toFixed(2)}.${ext}`;
    tasks.push([inv.filePath, `${invDir}/${name}`]);
  });

  // 凭证目录
  const expenseV = vouchers.value.filter(v => !v.isRefund);
  const refundV = vouchers.value.filter(v => v.isRefund);
  const vchTotal = (expenseV.reduce((s,v)=>s+v.amountCent,0)/100).toFixed(2);
  const vchDir = `${topDir}/${expenseV.length}张消费凭证${vchTotal}元`;
  expenseV.forEach((v, i) => {
    tasks.push([v.filePath, `${vchDir}/消费凭证${(v.amountCent/100).toFixed(2)}.jpg`]);
  });
  refundV.forEach((v) => {
    tasks.push([v.filePath, `${vchDir}/退款${(v.amountCent/100).toFixed(2)}.jpg`]);
  });

  // 领取表/验收单目录
  const receiptFiles = receipts.value.filter(r => r.type === "receipt");
  const acceptanceFiles = receipts.value.filter(r => r.type === "acceptance");
  if (receiptFiles.length > 0) {
    const rDir = `${topDir}/${receiptFiles.length}张领取表`;
    receiptFiles.forEach((r, i) => {
      tasks.push([r.file_path, `${rDir}/领取表${i+1}.jpg`]);
    });
  }
  if (acceptanceFiles.length > 0) {
    const aDir = `${topDir}/验收单`;
    let jpgIdx = 0;
    acceptanceFiles.forEach((r) => {
      const ext = String(r.file_path).split('.').pop().toLowerCase();
      if (ext === 'docx') tasks.push([r.file_path, `${aDir}/电子验收单.docx`]);
      else if (ext === 'xlsx') tasks.push([r.file_path, `${aDir}/电子验收单.xlsx`]);
      else { jpgIdx += 1; tasks.push([r.file_path, `${aDir}/纸质验收单${jpgIdx}.jpg`]); }
    });
  }

  // 活动策划目录
  if (activity.value.plan_file_path) {
    const pDir = `${topDir}/${activity.value.name}`;
    const ext = activity.value.plan_file_path.split('.').pop();
    tasks.push([activity.value.plan_file_path, `${pDir}/活动策划.${ext}`]);
  }

  // 非公务卡
  if (nonCardApplicable.value && nonCardFiles.value.length > 0) {
    const nDir = `${topDir}/非公务卡结算审批表`;
    nonCardFiles.value.forEach((f, i) => {
      tasks.push([f, `${nDir}/非公务卡结算特殊情况审批表${i+1}.pdf`]);
    });
  }

  try {
    genLog.value = `共 ${tasks.length} 个文件，开始复制...`;
    await invoke("copy_files", { files: tasks });
    genLog.value = `✅ 完成！\n社团=${club}\n老师=${teacher}\ntotalYuan=${totalYuan}\ninvoiceTotal分=${invoiceTotal.value}\n已生成到：${topDir}`;
    // 更新活动状态
    const db = await getDb();
    await db.execute("UPDATE activities SET review_status = 'submitted', folder_path = ? WHERE id = ?", [topDir, activityId]);
    activity.value.review_status = "submitted";
  } catch (e: any) {
    genLog.value = `❌ 失败：${e}`;
  } finally {
    generating.value = false;
  }
}

// Step8: 电子审核状态流转
const rejectReason = ref("");
async function changeReviewStatus(newStatus: string) {
  const db = await getDb();
  let reason = "";
  if (newStatus === "rejected") {
    reason = prompt("请输入退回原因：") || "";
    if (!reason) return;
  }
  await db.execute("UPDATE activities SET review_status = ?, review_reject_reason = ? WHERE id = ?", [newStatus, reason, activityId]);
  activity.value.review_status = newStatus;
  activity.value.review_reject_reason = reason;
}

// Step10: 归档
async function archiveActivity() {
  const actualCost = invoiceTotal.value - refundTotal.value;
  const db = await getDb();
  await db.execute(
    "UPDATE activities SET archived = 1, actual_cost = ? WHERE id = ?",
    [actualCost, activityId]
  );
  activity.value.archived = 1;
  activity.value.actual_cost = actualCost;
}

async function saveStep() {
  const db = await getDb();
  if (step.value === 1) {
    await db.execute(
      "UPDATE activities SET name = ?, date = ?, plan_file_path = ? WHERE id = ?",
      [activity.value.name, activity.value.date, activity.value.plan_file_path || "", activityId]
    );
  }
  if (step.value === 2) {
    await db.execute("DELETE FROM purchase_items WHERE activity_id = ?", [activityId]);
    for (const r of purchaseItems.value) {
      if (!r.name || !r.quantity || !r.unit_price) continue;
      await db.execute(
        "INSERT INTO purchase_items (id, activity_id, name, quantity, unit_price_cent) VALUES (?, ?, ?, ?, ?)",
        [`pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, activityId, r.name, r.quantity, Math.round(r.unit_price * 100)]
      );
    }
  }
  if (step.value === 4) {
    // 保存凭证的编辑（金额/尾号/退款）
    for (const v of vouchers.value) {
      await db.execute(
        "UPDATE vouchers SET amount_cent = ?, card_last_four = ?, is_refund = ? WHERE id = ?",
        [v.amountCent, v.cardLastFour, v.isRefund ? 1 : 0, v.id]
      );
    }
  }
  if (step.value === 5) {
    // 保存验收单整体签字确认
    for (const r of receipts.value) {
      if (r.type !== "acceptance") continue;
      await db.execute("UPDATE receipts SET confirmed = ? WHERE id = ?", [acceptanceConfirmed.value ? 1 : 0, r.id]);
    }
  }
  if (step.value === 6) {
    await db.execute(
      "INSERT INTO non_card (activity_id, applicable, files) VALUES (?, ?, ?) ON CONFLICT(activity_id) DO UPDATE SET applicable = excluded.applicable, files = excluded.files",
      [activityId, nonCardApplicable.value ? 1 : 0, JSON.stringify(nonCardFiles.value)]
    );
  }
  await db.execute("UPDATE activities SET current_step = ? WHERE id = ?", [step.value, activityId]);
}

async function next() {
  if (step.value === 9 && !activity.value.paper_submitted) {
    alert("请先勾选'已交到指定位置'后再进入下一步");
    return;
  }
  await saveStep();
  if (step.value < 10) step.value++;
}
async function prev() { await saveStep(); if (step.value > 1) step.value--; }

async function pickFile() {
  const selected = await openDialog({ multiple: false, filters: [{ name: "策划书", extensions: ["jpg", "jpeg", "pdf", "doc", "docx"] }] });
  if (selected) {
    activity.value.plan_file_path = selected as string;
  }
}

async function saveCurrent() {
  await saveStep();
  alert("本步已保存");
}

// ===== 体检面板 =====
const healthItems = computed<HealthItem[]>(() => {
  const items: HealthItem[] = [];
  if (!activity.value) return items;

  // Step1
  if (!activity.value.name) items.push({ level: "error", text: "活动名为空", step: 1 });
  if (!activity.value.date) items.push({ level: "error", text: "活动日期未选", step: 1 });
  if (!activity.value.plan_file_path) items.push({ level: "warning", text: "未上传活动策划书", step: 1 });
  if (activity.value.name && activity.value.date && activity.value.plan_file_path)
    items.push({ level: "ok", text: "活动策划齐全" });

  // Step2
  if (purchaseItems.value.length === 0) items.push({ level: "error", text: "采购清单为空", step: 2 });
  else if (purchaseItems.value.every((r) => r.name && r.quantity && r.unit_price))
    items.push({ level: "ok", text: `采购清单 ${purchaseItems.value.length} 项` });

  // Step3
  if (invoices.value.length === 0) items.push({ level: "error", text: "未上传发票", step: 3 });
  else {
    const unchecked = invoices.value.filter((i) => !i.headChecked);
    if (unchecked.length > 0) items.push({ level: "warning", text: `${unchecked.length} 张发票未核对抬头`, step: 3 });
    const noAmount = invoices.value.filter((i) => !i.amountCent);
    if (noAmount.length > 0) items.push({ level: "warning", text: `${noAmount.length} 张发票未填金额`, step: 3 });
    // 独立数量统计，用于报账包文件夹名
    items.push({ level: "ok", text: `📄 ${invoices.value.length} 张发票，共 ¥${(invoiceTotal.value/100).toFixed(2)}` });
  }

  // Step4 金额容差校验（分做整数比对，容差 ±10 分）
  const expenseVouchers = vouchers.value.filter((v) => !v.isRefund);
  if (expenseVouchers.length === 0) items.push({ level: "error", text: "未上传消费凭证", step: 4 });
  else {
    const invTotal = invoiceTotal.value;      // 发票合计（分）
    const vchTotal = voucherTotal.value;      // 凭证支出合计（分）
    const diff = invTotal - vchTotal;         // >0: 凭证不足；<0: 凭证超出
    const diffAbs = Math.abs(diff);

    // 独立数量统计，用于报账包文件夹名
    items.push({ level: "ok", text: `🧾 ${expenseVouchers.length} 张凭证，共 ¥${(vchTotal/100).toFixed(2)}` });

    if (invTotal <= 0) {
      // 发票金额还没填全，先不做金额比对
    } else if (diffAbs <= 10) {
      if (diff === 0) {
        items.push({ level: "ok", text: "✅ 金额校验通过" });
      } else {
        items.push({ level: "ok-note", text: `✅ 金额校验通过（存在 ${diffAbs} 分微小差额，请注意核验支付平台满减或抹零）` });
      }
    } else if (diff > 10) {
      // 凭证支出 < 发票，差 > 0.1 元 → 红项阻断
      items.push({ level: "error", text: `凭证总金额（¥${(vchTotal/100).toFixed(2)}）与发票总金额（¥${(invTotal/100).toFixed(2)}）不符，差额超出0.1元容差范围`, step: 4 });
    } else {
      // 凭证支出 > 发票，差 > 0.1 元 → 黄项警告
      items.push({ level: "warning", text: `凭证总金额（¥${(vchTotal/100).toFixed(2)}）与发票总金额（¥${(invTotal/100).toFixed(2)}）不符，差额超出0.1元容差范围`, step: 4 });
    }
  }

  // Step5
  const receiptFiles = receipts.value.filter((r) => r.type === "receipt");
  const acceptanceFiles = receipts.value.filter((r) => r.type === "acceptance");
  if (receiptFiles.length === 0 && acceptanceFiles.length === 0)
    items.push({ level: "error", text: "未上传领取表或验收单", step: 5 });
  if (acceptanceFiles.length > 0 && !acceptanceConfirmed.value)
    items.push({ level: "warning", text: "验收单尚未确认签字完成（请手动打钩）", step: 5 });
  if (receiptFiles.length > 0) items.push({ level: "ok", text: `领取表 ${receiptFiles.length} 张` });
  if (acceptanceFiles.length > 0 && acceptanceConfirmed.value)
    items.push({ level: "ok", text: `验收单 ${acceptanceFiles.length} 份，已确认签字` });

  // Step6
  if (nonCardApplicable.value && nonCardFiles.value.length === 0)
    items.push({ level: "error", text: "非公务卡适用但未上传审批表", step: 6 });
  else if (!nonCardApplicable.value)
    items.push({ level: "ok", text: "非公务卡：不适用，已跳过" });
  else
    items.push({ level: "ok", text: `非公务卡审批表 ${nonCardFiles.value.length} 份` });

  return items;
});

watch(healthItems, (items) => healthStore.set(items), { immediate: true, deep: true });
</script>

<template>
  <div class="flex flex-col h-full p-6">
    <div class="flex items-center justify-between mb-4">
      <button @click="router.push('/activities')" class="text-gray-500 hover:text-gray-700">← 返回列表</button>
      <h1 class="text-xl font-bold">{{ activity?.name }}</h1>
      <button class="px-4 py-2 bg-amber-500 text-white rounded" disabled>生成电子包（Step 7）</button>
    </div>

    <!-- 步骤条 -->
    <div class="flex items-center mb-6 bg-white p-4 rounded shadow">
      <div v-for="(s, i) in STEPS" :key="i" class="flex items-center flex-1 last:flex-none">
        <div class="flex flex-col items-center">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
            :style="{ background: i + 1 < step ? '#10B981' : i + 1 === step ? '#3B82F6' : '#9CA3AF' }">{{ i + 1 }}</div>
          <div class="text-xs mt-1 whitespace-nowrap">{{ s }}</div>
        </div>
        <div v-if="i < STEPS.length - 1" class="flex-1 h-0.5 mx-2 -mt-4"
          :style="{ background: i + 1 < step ? '#10B981' : '#E5E7EB' }"></div>
      </div>
    </div>

    <div class="flex-1 overflow-auto min-h-0">
      <div v-if="!activity" class="bg-white p-6 rounded shadow text-gray-400">加载中...</div>
      <div v-else class="bg-white p-6 rounded shadow">

      <!-- Step 1 -->
      <div v-if="step === 1">
        <h2 class="text-lg font-bold mb-3">Step 1：活动策划</h2>
        <p class="text-sm text-gray-500 mb-4">提示：纸质版要交 2 份，需签字。</p>
        <div class="space-y-3 max-w-lg">
          <label class="block"><span class="text-sm text-gray-600">活动名称</span>
            <input v-model="activity.name" class="mt-1 block w-full border rounded px-3 py-2" /></label>
          <label class="block"><span class="text-sm text-gray-600">活动日期</span>
            <input v-model="activity.date" type="date" class="mt-1 block w-full border rounded px-3 py-2" /></label>
          <div><span class="text-sm text-gray-600">活动策划书（jpg/pdf/doc/docx）</span>
            <button @click="pickFile" class="mt-1 block w-full border-2 border-dashed rounded px-3 py-4 text-gray-400 hover:border-blue-400 hover:text-blue-500">
              {{ activity.plan_file_path ? activity.plan_file_path.split(/[\\/]/).pop() : "点击选择策划书文件" }}
            </button></div>
        </div>
      </div>

      <!-- Step 2 -->
      <div v-else-if="step === 2">
        <h2 class="text-lg font-bold mb-3">Step 2：采购清单</h2>
        <table class="w-full border">
          <thead><tr class="bg-gray-100">
            <th class="border p-2 text-left">物品名称</th><th class="border p-2 w-24">数量</th>
            <th class="border p-2 w-32">单价（元）</th><th class="border p-2 w-32">小计</th><th class="border p-2 w-16"></th>
          </tr></thead>
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

      <!-- Step 3: 发票 -->
      <div v-else-if="step === 3">
        <h2 class="text-lg font-bold mb-3">Step 3：发票</h2>
        <p class="text-sm text-gray-500 mb-3">仅支持 jpg/pdf，遇到 png 请先转换。每张发票需填物品名和金额，并勾选抬头已核对。</p>
        <button @click="pickInvoices" class="mb-3 w-full border-2 border-dashed rounded px-3 py-4 text-gray-400 hover:border-blue-400 hover:text-blue-500">
          + 点击选择发票文件（可多选）
        </button>
        <div v-if="invoices.length === 0" class="text-gray-400 text-sm">还没有发票</div>
        <table v-else class="w-full border">
          <thead><tr class="bg-gray-100">
            <th class="border p-2 text-left">文件</th><th class="border p-2 text-left">物品名</th>
            <th class="border p-2 w-28">金额(元)</th><th class="border p-2 w-24">抬头核对</th><th class="border p-2 w-10"></th>
          </tr></thead>
          <tbody>
            <tr v-for="inv in invoices" :key="inv.id">
              <td class="border p-2 text-xs text-gray-500 max-w-[200px] truncate" :title="inv.filePath">{{ inv.filePath.split(/[\\/]/).pop() }}</td>
              <td class="border p-2"><input v-model="inv.itemName" @change="saveInvoice(inv)" class="w-full text-sm" placeholder="物品名" /></td>
              <td class="border p-2"><input :value="(inv.amountCent / 100).toFixed(2)" @change="inv.amountCent = Math.round(parseFloat(($event.target as HTMLInputElement).value) * 100); saveInvoice(inv)" type="number" step="0.01" class="w-full text-sm" /></td>
              <td class="border p-2 text-center"><input type="checkbox" v-model="inv.headChecked" @change="saveInvoice(inv)" /></td>
              <td class="border p-2 text-center"><button @click="removeInvoice(inv.id)" class="text-red-500">×</button></td>
            </tr>
          </tbody>
        </table>
        <div class="mt-3 text-right font-bold">共 {{ invoices.length }} 张，合计 ¥{{ (invoiceTotal / 100).toFixed(2) }}</div>
      </div>

      <!-- Step 4: 凭证 -->
      <div v-else-if="step === 4">
        <h2 class="text-lg font-bold mb-3">Step 4：消费凭证</h2>
        <p class="text-sm text-gray-500 mb-3">每张凭证需填金额和公务卡后四位；退款请勾选"退款"。</p>
        <button @click="pickVouchers" class="mb-3 w-full border-2 border-dashed rounded px-3 py-4 text-gray-400 hover:border-blue-400 hover:text-blue-500">
          + 点击选择凭证截图（可多选）
        </button>
        <div v-if="vouchers.length === 0" class="text-gray-400 text-sm">还没有凭证</div>
        <table v-else class="w-full border">
          <thead><tr class="bg-gray-100">
            <th class="border p-2 text-left">文件</th><th class="border p-2 w-28">金额(元)</th>
            <th class="border p-2 w-28">尾号</th><th class="border p-2 w-20">退款</th><th class="border p-2 w-10"></th>
          </tr></thead>
          <tbody>
            <tr v-for="v in vouchers" :key="v.id">
              <td class="border p-2 text-xs text-gray-500 max-w-[200px] truncate" :title="v.filePath">{{ v.filePath.split(/[\\/]/).pop() }}</td>
              <td class="border p-2"><input :value="(v.amountCent / 100).toFixed(2)" @change="v.amountCent = Math.round(parseFloat(($event.target as HTMLInputElement).value) * 100)" type="number" step="0.01" class="w-full text-sm" /></td>
              <td class="border p-2"><input v-model="v.cardLastFour" maxlength="4" class="w-full text-sm" /></td>
              <td class="border p-2 text-center"><input type="checkbox" v-model="v.isRefund" /></td>
              <td class="border p-2 text-center"><button @click="removeVoucher(v.id)" class="text-red-500">×</button></td>
            </tr>
          </tbody>
        </table>
        <div class="mt-3 text-right text-sm">
          支出 ¥{{ (voucherTotal / 100).toFixed(2) }}　退款 ¥{{ (refundTotal / 100).toFixed(2) }}
        </div>
      </div>

      <!-- Step 5: 领取表/验收单 -->
      <div v-else-if="step === 5">
        <h2 class="text-lg font-bold mb-3">Step 5：领取表 / 验收单</h2>
        <div class="flex gap-2 mb-4">
          <button @click="receiptTab = 'receipt'" :class="receiptTab === 'receipt' ? 'bg-blue-600 text-white' : 'border'" class="px-4 py-1.5 rounded">领取表</button>
          <button @click="receiptTab = 'acceptance'" :class="receiptTab === 'acceptance' ? 'bg-blue-600 text-white' : 'border'" class="px-4 py-1.5 rounded">验收单</button>
        </div>

        <!-- 领取表 -->
        <div v-if="receiptTab === 'receipt'">
          <p class="text-sm text-gray-500 mb-3">领取表按张上传 jpg，命名规则：领取表1.jpg、领取表2.jpg...</p>
          <button @click="pickReceipt" class="mb-3 w-full border-2 border-dashed rounded px-3 py-4 text-gray-400 hover:border-blue-400 hover:text-blue-500">
            + 点击选择领取表文件（可多选）
          </button>
          <div v-if="receipts.filter(r => r.type === 'receipt').length === 0" class="text-gray-400 text-sm">还没有领取表</div>
          <ul v-else class="space-y-1">
            <li v-for="(r, i) in receipts.filter(r => r.type === 'receipt')" :key="r.id" class="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
              <span class="text-sm">领取表{{ i + 1 }}.jpg — {{ r.file_path.split(/[\\/]/).pop() }}</span>
              <button @click="removeReceipt(r.id)" class="text-red-500 text-sm">删除</button>
            </li>
          </ul>
        </div>

        <!-- 验收单 -->
        <div v-else>
          <button @click="pickAcceptance" class="mb-3 w-full border-2 border-dashed rounded px-3 py-6 text-gray-400 hover:border-blue-400 hover:text-blue-500">
            点击上传 / 拖拽图片到此区域
          </button>
          <div v-if="receipts.filter(r => r.type === 'acceptance').length === 0" class="text-gray-400 text-sm">还没有验收单</div>
          <ul v-else class="space-y-1">
            <li v-for="r in receipts.filter(r => r.type === 'acceptance')" :key="r.id" class="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
              <span class="text-sm">✅ {{ acceptanceLabel(r) }}</span>
              <button @click="removeReceipt(r.id)" class="text-red-500 text-sm">删除</button>
            </li>
          </ul>
          <label class="mt-3 flex items-center gap-2 border rounded p-3 bg-white cursor-pointer">
            <input type="checkbox" v-model="acceptanceConfirmed" class="w-4 h-4" />
            <span class="text-sm">我已确认该验收单已完成全部签字（手动打钩）</span>
          </label>
        </div>
      </div>

      <!-- Step 6: 非公务卡 -->
      <div v-else-if="step === 6">
        <h2 class="text-lg font-bold mb-3">Step 6：非公务卡结算</h2>
        <p class="text-sm text-gray-500 mb-4">如不适用公务卡结算，请选"适用"并上传《非公务卡结算特殊情况审批表》（一式两份）。不适用则跳过此步。</p>
        <div class="flex gap-4 mb-4">
          <label class="flex items-center gap-2"><input type="radio" v-model="nonCardApplicable" :value="false" /> 不适用（跳过）</label>
          <label class="flex items-center gap-2"><input type="radio" v-model="nonCardApplicable" :value="true" /> 适用</label>
        </div>
        <div v-if="nonCardApplicable">
          <button @click="pickNonCard" class="mb-3 w-full border-2 border-dashed rounded px-3 py-4 text-gray-400 hover:border-blue-400 hover:text-blue-500">
            + 点击选择审批表文件（jpg/pdf，可多选）
          </button>
          <ul v-if="nonCardFiles.length > 0" class="space-y-1">
            <li v-for="(f, i) in nonCardFiles" :key="i" class="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
              <span class="text-sm">{{ f.split(/[\\/]/).pop() }}</span>
              <button @click="removeNonCardFile(i)" class="text-red-500 text-sm">删除</button>
            </li>
          </ul>
        </div>
      </div>

      <!-- Step 7: 生成电子包 -->
      <div v-else-if="step === 7">
        <h2 class="text-lg font-bold mb-3">Step 7：生成电子包</h2>
        <p class="text-sm text-gray-500 mb-4">按学校规则自动创建文件夹结构并复制重命名文件。</p>

        <div class="mb-4">
          <label class="text-sm text-gray-600 block mb-1">输出目录</label>
          <div class="flex gap-2">
            <input :value="outputDir" readonly class="flex-1 border rounded px-3 py-2 text-sm bg-gray-50" placeholder="选择一个空文件夹" />
            <button @click="pickOutputDir" class="px-4 py-2 border rounded">浏览...</button>
          </div>
        </div>

        <div v-if="healthErrors.length > 0" class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          ⚠️ 还有 {{ healthErrors.length }} 个红项未解决，建议先解决再生成。
        </div>

        <button @click="generatePackage" :disabled="generating" class="px-6 py-3 bg-amber-500 text-white rounded font-bold disabled:opacity-50">
          {{ generating ? "生成中..." : "🚀 开始生成" }}
        </button>

        <div v-if="genLog" class="mt-4 p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap font-mono">{{ genLog }}</div>
      </div>

      <!-- Step 8: 电子审核 -->
      <div v-else-if="step === 8">
        <h2 class="text-lg font-bold mb-3">Step 8：电子审核</h2>
        <p class="text-sm text-gray-500 mb-4">电子包提交给"社团管理部财务部"审核，通过后才能打印纸质版。</p>

        <div class="border rounded p-4 mb-4">
          <div class="text-sm text-gray-500 mb-2">当前状态：</div>
          <div class="text-lg font-bold" :class="{
            'text-gray-400': activity.review_status === 'pending',
            'text-purple-600': activity.review_status === 'submitted',
            'text-blue-600': activity.review_status === 'reviewing',
            'text-amber-600': activity.review_status === 'approved',
            'text-red-600': activity.review_status === 'rejected',
          }">
            {{ { pending: '待提交', submitted: '已提交社管财务部', reviewing: '审核中', approved: '✅ 已通过', rejected: '❌ 已退回' }[activity.review_status] || activity.review_status }}
          </div>
          <div v-if="activity.review_status === 'rejected' && activity.review_reject_reason" class="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            退回原因：{{ activity.review_reject_reason }}
          </div>
        </div>

        <div class="space-y-2">
          <button v-if="activity.review_status === 'pending' || activity.review_status === 'submitted'" @click="changeReviewStatus('submitted')" class="w-full px-4 py-2 bg-purple-600 text-white rounded">
            📤 提交到社管财务部
          </button>
          <button v-if="activity.review_status === 'submitted'" @click="changeReviewStatus('reviewing')" class="w-full px-4 py-2 bg-blue-600 text-white rounded">
            🔄 标记为审核中
          </button>
          <template v-if="activity.review_status === 'reviewing'">
            <button @click="changeReviewStatus('approved')" class="w-full px-4 py-2 bg-green-600 text-white rounded">
              ✅ 审核通过
            </button>
            <button @click="changeReviewStatus('rejected')" class="w-full px-4 py-2 bg-red-600 text-white rounded">
              ❌ 审核退回
            </button>
          </template>
          <button v-if="activity.review_status === 'rejected'" @click="changeReviewStatus('submitted')" class="w-full px-4 py-2 bg-purple-600 text-white rounded">
            📤 修改后重新提交
          </button>
        </div>
      </div>

      <!-- Step 9: 纸质提交 -->
      <div v-else-if="step === 9">
        <h2 class="text-lg font-bold mb-3">Step 9：纸质提交</h2>
        <div v-if="activity.review_status !== 'approved'" class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
          ⚠️ 电子审核尚未通过，请先在 Step 8 审核通过后再提交纸质版。
        </div>
        <p class="text-sm text-gray-500 mb-4">审核通过后，打印纸质版并签字，然后交到指定位置。</p>

        <div class="border rounded p-4 mb-4">
          <div class="text-sm font-semibold mb-2">📋 纸质材料清单：</div>
          <ul class="text-sm space-y-1 list-disc list-inside text-gray-700">
            <li>活动策划书（纸质 2 份，需签字）</li>
            <li>领取表原件（{{ receipts.filter(r => r.type === 'receipt').length }} 张）</li>
            <li>验收单（{{ receipts.filter(r => r.type === 'acceptance').length }} 份，需三方签字）</li>
            <li v-if="nonCardApplicable">非公务卡审批表（一式两份）</li>
          </ul>
        </div>

        <label class="flex items-center gap-2 text-sm p-3 bg-green-50 border border-green-200 rounded cursor-pointer">
          <input type="checkbox" :checked="!!activity.paper_submitted" @change="async (e) => {
            const db = await getDb();
            await db.execute('UPDATE activities SET paper_submitted = ? WHERE id = ?', [e.target.checked ? 1 : 0, activityId]);
            activity.paper_submitted = e.target.checked ? 1 : 0;
          }" />
          <span>✅ 已交到 {{ settings?.submit_location || '303办公室社管柜子财务部那一格' }}</span>
        </label>
      </div>

      <!-- Step 10: 归档 -->
      <div v-else-if="step === 10">
        <h2 class="text-lg font-bold mb-3">Step 10：归档</h2>

        <div v-if="activity.archived" class="p-4 bg-green-50 border border-green-200 rounded text-center">
          <div class="text-4xl mb-2">📦</div>
          <div class="text-lg font-bold text-green-700">已归档</div>
          <div class="text-sm text-gray-500 mt-2">本活动已归档到历史，总账已更新</div>
        </div>

        <template v-else>
          <div class="border rounded p-4 mb-4">
            <div class="text-sm font-semibold mb-2">📊 本次报账汇总：</div>
            <div class="text-sm space-y-1">
              <div>发票总额：¥{{ (invoiceTotal/100).toFixed(2) }}</div>
              <div>退款总额：¥{{ (refundTotal/100).toFixed(2) }}</div>
              <div class="font-bold border-t pt-1">实际支出：¥{{ ((invoiceTotal - refundTotal)/100).toFixed(2) }}</div>
            </div>
          </div>

          <div v-if="activity.review_status !== 'approved'" class="mb-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
            ⚠️ 电子审核尚未通过，无法归档。
          </div>
          <div v-if="!activity.paper_submitted" class="mb-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
            ⚠️ 纸质材料尚未提交，请先在 Step 9 勾选确认。
          </div>

          <button @click="archiveActivity" :disabled="activity.review_status !== 'approved' || !activity.paper_submitted" class="w-full px-4 py-3 bg-gray-800 text-white rounded font-bold disabled:opacity-40">
            📦 归档此活动
          </button>
        </template>
      </div>
    </div>
    </div>

    <!-- 底部导航：固定在页面底部 -->
    <div class="shrink-0 flex justify-between items-center mt-4 border-t border-gray-200 pt-4">
      <button @click="prev" :disabled="step <= 1" class="px-4 py-2 border rounded disabled:opacity-30">← 上一步</button>
      <button v-if="step <= 6" @click="saveCurrent" class="px-4 py-2 bg-green-600 text-white rounded">💾 保存本步</button>
      <button @click="next" :disabled="step >= 10" class="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-30">下一步 →</button>
    </div>
  </div>
</template>










