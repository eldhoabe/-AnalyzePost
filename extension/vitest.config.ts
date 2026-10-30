import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __API_BASE__: JSON.stringify(process.env.API_BASE_URL ?? "http://localhost:8000"),
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
