import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", workers: 1,
  use: { baseURL: "http://127.0.0.1:5179", headless: true, trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", testMatch: /deployment-smoke\.spec\.ts/ },
    { name: "accessibility", testMatch: /accessibility\.spec\.ts/ },
    { name: "visual", testMatch: /visual\.spec\.ts/ },
    { name: "mobile-chrome", testMatch: /mobile\.spec\.ts/, use: { ...devices["Pixel 7"] } },
    {
      name: "tablet-chromium",
      testMatch: /mobile\.spec\.ts/,
      use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
    },
    { name: "staging", testMatch: /staging\.spec\.ts/ },
  ],
  webServer: { command: "node node_modules/vite/bin/vite.js --mode test --host 127.0.0.1 --port 5179 --strictPort", url: "http://127.0.0.1:5179", reuseExistingServer: false },
});
