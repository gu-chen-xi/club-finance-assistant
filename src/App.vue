<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { computed } from "vue";
import { healthStore, healthErrors, healthWarnings, healthOks } from "./api/health";

const route = useRoute();
const router = useRouter();
const showHealthPanel = computed(() => route.path.startsWith("/activities"));

function jump(step?: number) {
  if (!step) return;
  // 当前就在活动页时，直接改 step；否则跳到活动页
  const id = route.params.id;
  if (id) {
    // 通过 query 传目标 step，Flow.vue 监听后跳转
    router.push({ path: `/activities/${id}`, query: { step } });
  }
}
</script>

<template>
  <div class="flex h-full w-full overflow-hidden">
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
      <div class="p-3 text-xs text-slate-400 border-t border-slate-700">余额：¥ --</div>
    </aside>

    <main class="flex-1 overflow-auto bg-gray-50">
      <RouterView />
    </main>

    <aside v-if="showHealthPanel" class="w-[320px] shrink-0 bg-white border-l border-gray-200 p-4 overflow-auto">
      <h2 class="text-base font-semibold mb-3">报账体检</h2>

      <div v-if="healthStore.items.length === 0" class="text-sm text-gray-400">
        进入活动后自动体检
      </div>

      <div v-else class="space-y-3">
        <!-- 错误项 -->
        <div v-if="healthErrors.length">
          <div class="text-xs font-semibold text-red-600 mb-1">❌ 待解决 ({{ healthErrors.length }})</div>
          <button
            v-for="(item, i) in healthErrors" :key="'e'+i"
            @click="jump(item.step)"
            class="block w-full text-left text-sm py-1 px-2 rounded hover:bg-red-50 text-red-700"
          >{{ item.text }}</button>
        </div>
        <!-- 警告项 -->
        <div v-if="healthWarnings.length">
          <div class="text-xs font-semibold text-amber-600 mb-1">⚠️ 警告 ({{ healthWarnings.length }})</div>
          <button
            v-for="(item, i) in healthWarnings" :key="'w'+i"
            @click="jump(item.step)"
            class="block w-full text-left text-sm py-1 px-2 rounded hover:bg-amber-50 text-amber-700"
          >{{ item.text }}</button>
        </div>
        <!-- 已齐全 -->
        <div v-if="healthOks.length">
          <div class="text-xs font-semibold text-green-600 mb-1">✅ 已齐全 ({{ healthOks.length }})</div>
          <div v-for="(item, i) in healthOks" :key="'o'+i" class="text-sm py-1 px-2 text-green-700">
            {{ item.text }}
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>
