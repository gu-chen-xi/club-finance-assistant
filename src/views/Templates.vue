<script setup lang="ts">
import { ref, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getDb } from "../api/db";

// 内置模板（开发阶段指向项目根目录，打包后改为资源目录）
const builtinTemplates = [
  {
    name: "领取表",
    desc: "活动物资领取表，纸质交原件",
    file: "领取表模板.xlsx",
  },
  {
    name: "低值易耗品验收单",
    desc: "需电子版+纸质版，三方签字",
    file: '低值易耗品“验收单”模板.docx',
  },
  {
    name: "非公务卡结算特殊情况审批表",
    desc: "一式两份，不适用公务卡时使用",
    file: '”非公务卡“结算特殊情况审批表模板.docx',
  },
];

const basePath = "D:\\project\\社团财务软件项目\\开发期使用的东西\\";
const desktopPath = "C:\\Users\\asus\\Desktop\\";

const customTemplates = ref<any[]>([]);

onMounted(loadCustom);

async function loadCustom() {
  const db = await getDb();
  customTemplates.value = await db.select("SELECT * FROM custom_templates ORDER BY created_at DESC");
}

async function openTemplate(path: string) {
  try {
    await invoke("open_file", { path });
  } catch (e) {
    alert("打开失败：" + e);
  }
}

async function addTemplate() {
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: "模板", extensions: ["pdf", "doc", "docx", "xlsx"] }],
  });
  if (!selected) return;
  const name = prompt("给这个模板起个名字：", (selected as string).split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "自定义模板");
  if (!name) return;
  const db = await getDb();
  await db.execute(
    "INSERT INTO custom_templates (id, name, file_path, created_at) VALUES (?, ?, ?, ?)",
    [`tpl-${Date.now()}`, name, selected as string, new Date().toISOString()]
  );
  await loadCustom();
}

async function removeTemplate(id: string) {
  if (!confirm("确定删除这个模板吗？（只删除记录，不删除原文件）")) return;
  const db = await getDb();
  await db.execute("DELETE FROM custom_templates WHERE id = ?", [id]);
  await loadCustom();
}

async function exportToDesktop(filePath: string, name: string) {
  const ext = filePath.split(".").pop();
  const dst = `${desktopPath}${name}.${ext}`;
  // 如果文件已在桌面，直接提示
  if (filePath === dst || filePath === dst.replace(/\//g, "\\")) {
    alert("文件已在桌面，无需重复导出");
    return;
  }
  try {
    await invoke("copy_files", { files: [[filePath, dst]] });
    alert(`已导出到桌面：${name}.${ext}`);
  } catch (e) {
    alert("导出失败：" + e);
  }
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">模板库</h1>
      <button @click="addTemplate" class="px-4 py-2 bg-blue-600 text-white rounded text-sm">+ 添加模板</button>
    </div>
    <p class="text-sm text-gray-500 mb-6">点击"打开"用系统默认程序编辑；点击"导出到桌面"复制一份到桌面，方便填写后打印。</p>

    <h2 class="text-base font-semibold mb-3">内置模板</h2>
    <div class="grid grid-cols-3 gap-4 mb-8">
      <div v-for="t in builtinTemplates" :key="t.name" class="bg-white p-5 rounded shadow">
        <div class="text-3xl mb-3">📄</div>
        <div class="font-semibold">{{ t.name }}</div>
        <div class="text-xs text-gray-500 mt-1 mb-4">{{ t.desc }}</div>
        <div class="flex gap-2">
          <button @click="openTemplate(basePath + t.file)" class="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm">打开</button>
          <button @click="exportToDesktop(basePath + t.file, t.name)" class="flex-1 px-3 py-2 border rounded text-sm">导出到桌面</button>
        </div>
      </div>
    </div>

    <h2 class="text-base font-semibold mb-3">我的模板</h2>
    <div v-if="customTemplates.length === 0" class="text-gray-400 text-sm mb-4">暂无自定义模板，点右上角"添加模板"添加</div>
    <div v-else class="grid grid-cols-3 gap-4">
      <div v-for="t in customTemplates" :key="t.id" class="bg-white p-5 rounded shadow">
        <div class="text-3xl mb-3">📎</div>
        <div class="font-semibold">{{ t.name }}</div>
        <div class="text-xs text-gray-500 mt-1 mb-4 truncate">{{ t.file_path.split(/[\\/]/).pop() }}</div>
        <div class="flex gap-2">
          <button @click="openTemplate(t.file_path)" class="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm">打开</button>
          <button @click="exportToDesktop(t.file_path, t.name)" class="flex-1 px-3 py-2 border rounded text-sm">导出到桌面</button>
          <button @click="removeTemplate(t.id)" class="px-3 py-2 border rounded text-sm text-red-500">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>
