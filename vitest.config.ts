import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const here = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@schema": resolve(here, "packages/schema/src"),
      "@scheduling": resolve(here, "packages/scheduling/src"),
      "@drill": resolve(here, "apps/drill/src"),
    },
  },
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
  },
});
