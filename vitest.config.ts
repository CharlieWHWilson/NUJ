import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    projects: [
      { extends: true, test: { name: "ui", include: ["src/**/*.{test,spec}.{ts,tsx}"], exclude: ["src/test/*.database.test.ts", "src/test/*.server.test.ts", "**/node_modules/**"] } },
      { extends: true, test: { name: "database", environment: "node", include: ["src/test/*.database.test.ts", "src/test/*.server.test.ts"] } },
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
