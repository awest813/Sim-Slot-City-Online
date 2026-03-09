import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@slot-city/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 3001,
    proxy: {
      "/auth": "http://localhost:2567",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
