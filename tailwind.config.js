/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 全局状态色板，见 SPEC.md §5
        status: {
          idle: "#9CA3AF",      // 灰-未开始
          active: "#3B82F6",     // 蓝-进行中
          ready: "#10B981",      // 绿-已齐全
          error: "#EF4444",      // 红-有问题
          submitted: "#8B5CF6",  // 紫-已提交
          approved: "#F59E0B",   // 金-已通过
          archived: "#4B5563",   // 深灰-已归档
        },
      },
    },
  },
  plugins: [],
};
