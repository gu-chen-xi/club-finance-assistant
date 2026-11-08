<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { balanceStore, balance, loadBalanceData } from "../api/balance";

const router = useRouter();

onMounted(load);

async function load() {
  await loadBalanceData();
  // 真实花到 0（存在已归档活动）→ 清零烟花；新装软件余额本来就是 0，不放
  if (balance.value === 0 && hasArchived.value) launchFireworks();
}

// 是否存在已归档活动（区分"新装软件余额为0"和"真的花到0"）
const hasArchived = computed(() => balanceStore.activities.some((a) => a.archived));

// 活动列表来自共享余额数据源（与侧边栏余额同源）
const activities = computed(() => balanceStore.activities);

// 当前月份（取电脑系统时间，用于"本月支出"标签展示）
const currentMonth = new Date().getMonth() + 1;

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

// —— 余额彩蛋 ——
// 三态：>50 正常；0<余额<=50 红闪提醒；==0 全屏烟花
const balanceState = computed(() => {
  if (balance.value > 50) return "ok";
  if (balance.value > 0) return "low";
  if (balance.value === 0) return "zero";
  return "low"; // 超支也按不足提醒
});

// —— 清零烟花 ——
const showFireworks = ref(false);
const fireCanvas = ref<HTMLCanvasElement | null>(null);
let fireRaf = 0;

function launchFireworks() {
  showFireworks.value = true;
  nextTick(() => {
    const canvas = fireCanvas.value;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = (canvas.width = canvas.offsetWidth);
    const H = (canvas.height = canvas.offsetHeight);
    const colors = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ef4444", "#22d3ee"];
    type P = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
    let particles: P[] = [];
    let rockets: { x: number; y: number; vy: number; color: string }[] = [];
    let t = 0;
    function burst(x: number, y: number, color: string) {
      const n = 60 + Math.floor(Math.random() * 40);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const sp = 2 + Math.random() * 5;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color, size: 2 + Math.random() * 2 });
      }
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      // 定时发射火箭
      if (t % 18 === 0 && rockets.length < 4) {
        rockets.push({
          x: 80 + Math.random() * (W - 160),
          y: H,
          vy: -(7 + Math.random() * 3),
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
      // 火箭上升 → 爆炸
      rockets = rockets.filter((r) => {
        r.y += r.vy;
        if (r.y < H * 0.25 + Math.random() * H * 0.3) {
          burst(r.x, r.y, r.color);
          return false;
        }
        ctx.beginPath();
        ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        return true;
      });
      // 粒子运动
      particles = particles.filter((p) => p.life > 0);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.life -= 0.012;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      t++;
      fireRaf = requestAnimationFrame(frame);
    }
    fireRaf = requestAnimationFrame(frame);
  });
}

function closeFireworks() {
  showFireworks.value = false;
  cancelAnimationFrame(fireRaf);
}

// 余额变成 0 时触发烟花（运行中归零；避免初始未加载状态/新装软件误判）
watch(balance, (v) => {
  if (v === 0 && !showFireworks.value && hasArchived.value) launchFireworks();
});
onBeforeUnmount(() => cancelAnimationFrame(fireRaf));
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">工作台</h1>
      <button @click="router.push('/activities')" class="px-4 py-2 bg-blue-600 text-white rounded">+ 新建活动</button>
    </div>

    <!-- 三张卡片 -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white p-5 rounded shadow" :class="{ 'alert-blink': balanceState === 'low' }">
        <div class="text-sm text-gray-500">当前余额</div>
        <div class="text-3xl font-bold mt-2" :class="balanceState === 'ok' ? 'text-gray-800' : 'text-red-600'">
          ¥{{ balance.toFixed(2) }}
        </div>
        <div v-if="balanceState === 'low'" class="text-xs text-red-600 mt-1 font-medium">⚠️ 余粮不足，请社长速速去拉赞助！</div>
        <div v-if="balanceState === 'zero'" class="text-xs text-emerald-600 mt-1 font-medium">🎉 已清零，无债一身轻！</div>
      </div>
      <div class="bg-white p-5 rounded shadow">
        <div class="text-sm text-gray-500">本月支出（{{ currentMonth }}月）</div>
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

    <!-- 清零烟花（余额 == 0 时弹出） -->
    <div v-if="showFireworks" class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center cursor-pointer" @click="closeFireworks">
      <canvas ref="fireCanvas" class="absolute inset-0 w-full h-full"></canvas>
      <div class="relative z-10 text-center px-6">
        <div class="text-5xl mb-4">🎉</div>
        <div class="text-2xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">恭喜！本社团财务工作完美清零，无债一身轻！</div>
        <div class="mt-6 inline-block text-sm text-white/90 bg-black/40 rounded-full px-4 py-2">点击任意处关闭</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 余额不足红闪 */
@keyframes alertBlink {
  0%, 100% { background-color: #fef2f2; box-shadow: inset 0 0 0 2px #f87171; }
  50% { background-color: #fee2e2; box-shadow: inset 0 0 0 3px #ef4444; }
}
.alert-blink {
  animation: alertBlink 0.8s ease-in-out infinite;
}
</style>
