import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", workers: 1,
  use: { baseURL: "http://127.0.0.1:5179", headless: true, trace: "retain-on-failure" },
  webServer: { command: "node node_modules/vite/bin/vite.js --mode test --host 127.0.0.1 --port 5179 --strictPort", url: "http://127.0.0.1:5179", reuseExistingServer: false },
});
