import react from "@vitejs/plugin-react-swc";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@jarigyani/react-spatial-view": resolve(__dirname, "../src/index.ts"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
});
