import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  // 避免多份 React 实例导致 hooks / 预打包异常
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  // 仅对最终打包产物降级；勿对 optimizeDeps 全局施加 es2015（曾导致 react 预打包异常）
  build: {
    target: "es2015",
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api/anthropic": {
        target: "https://api.anthropic.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ""),
      },
    },
  },
});
