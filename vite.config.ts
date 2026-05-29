/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		setupFiles: "./test/setup.ts",
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
		},
	},
	build: {
		outDir: "dist",
		lib: {
			entry: "src/index.ts",
			name: "@jarigyani/react-spatial-view",
			fileName: "index",
			formats: ["es", "umd"],
		},
		rollupOptions: {
			external: ["react", "react-dom"],
			output: {
				globals: {
					react: "React",
					"react-dom": "ReactDOM",
				},
			},
		},
	},
});
