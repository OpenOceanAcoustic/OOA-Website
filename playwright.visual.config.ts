import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/visual",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  snapshotPathTemplate: "{testDir}/baseline/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview:test --workspace @ooa/web",
    port: 4174,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
