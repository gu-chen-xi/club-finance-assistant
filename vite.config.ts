import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Tauri 要求的 Vite 配置
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
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
