import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const basePath = process.env.VITE_BASE_PATH || "/helix/";
const apiProxyTarget = process.env.VITE_API_PROXY || "http://127.0.0.1:8000";

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      [`${basePath.replace(/\/$/, "")}/api`]: {
        target: apiProxyTarget,
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
        rewrite: (path) => path.replace(new RegExp(`^${basePath.replace(/\/$/, "")}/api`), "/api"),
      },
    },
  },
});

