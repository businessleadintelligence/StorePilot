import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["app/services/__tests__/setup/vitest.setup.ts"],
    include: ["app/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "app/services/product.server.ts",
        "app/services/inventory.server.ts",
        "app/services/webhook.server.ts",
      ],
      reporter: ["text", "text-summary"],
    },
  },
});
