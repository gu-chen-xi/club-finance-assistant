<script setup lang="ts">
import { useRoute } from "vue-router";
import { computed } from "vue";

const route = useRoute();
// 右栏体检面板只在活动报账相关页显示，见 UI_TREE.md §0
const showHealthPanel = computed(() => route.path.startsWith("/activities"));
</script>

<template>
  <div class="flex h-full w-full overflow-hidden">
    <!-- 左侧导航 220px -->
    <aside class="w-[220px] shrink-0 bg-slate-800 text-white flex flex-col">
      <div class="p-4 border-b border-slate-700">
        <div class="text-lg font-bold">社团财务助手</div>
        <div class="text-xs text-slate-400 mt-1">v0.1.0</div>
      </div>
      <nav class="flex-1 p-2 space-y-1">
        <RouterLink
          v-for="item in [
            { to: '/dashboard', label: '工作台', icon: '🏠' },
            { to: '/activities', label: '活动报账', icon: '📋' },
            { to: '/ledger', label: '总账', icon: '📊' },
            { to: '/tracking', label: '报销跟踪', icon: '🔍' },
            { to: '/templates', label: '模板库', icon: '📁' },
            { to: '/settings', label: '设置', icon: '⚙️' },
          ]"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-700 transition-colors"
          active-class="bg-slate-600 text-white"
        >
          <span>{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="p-3 text-xs text-slate-400 border-t border-slate-700">
        余额：¥ --
      </div>
    </aside>

    <!-- 中间主区 -->
    <main class="flex-1 overflow-auto bg-gray-50">
      <RouterView />
    </main>

    <!-- 右侧体检面板 320px（仅活动页） -->
    <aside
      v-if="showHealthPanel"
      class="w-[320px] shrink-0 bg-white border-l border-gray-200 p-4 overflow-auto"
    >
      <h2 class="text-base font-semibold mb-3">报账体检</h2>
      <div class="text-sm text-gray-400">体检面板占位</div>
    </aside>
  </div>
</template>
