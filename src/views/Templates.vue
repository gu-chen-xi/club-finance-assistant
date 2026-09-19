<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";

// 模板文件（开发阶段指向项目根目录，打包后改为资源目录）
const templates = [
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

async function openTemplate(file: string) {
  // 项目根目录路径（开发阶段）
  const base = "D:\\project\\社团财务软件项目\\";
  try {
    await invoke("open_file", { path: base + file });
  } catch (e) {
    alert("打开失败：" + e);
  }
}
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">模板库</h1>
    <p class="text-sm text-gray-500 mb-6">点击模板用系统默认程序打开，可直接填写后打印。</p>

    <div class="grid grid-cols-3 gap-4">
      <div v-for="t in templates" :key="t.name" class="bg-white p-5 rounded shadow hover:shadow-md transition-shadow">
        <div class="text-3xl mb-3">📄</div>
        <div class="font-semibold">{{ t.name }}</div>
        <div class="text-xs text-gray-500 mt-1 mb-4">{{ t.desc }}</div>
        <button @click="openTemplate(t.file)" class="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm">
          打开模板
        </button>
      </div>
    </div>
  </div>
</template>
