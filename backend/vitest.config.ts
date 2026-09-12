import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The crawler/pipeline integration tests make several real (local)
    testTimeout: 20000,
  },
});