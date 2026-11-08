import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Tauri 要求的 Vite 配置
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // 开发期禁用一切 HTTP 缓存（解决 WebView2 缓存旧前端资源导致界面不更新的问题）
    headers: {
      "Cache-Control": "no-store",
    },
    watch: {
      // Tauri 自己管理 src-tauri 下的文件
      ignored: ["**/src-tauri/**"],
    },
  },
  // Tauri 打包时用
  build: {
    target: "es2021",
    minify: "esbuild",
  },
});
