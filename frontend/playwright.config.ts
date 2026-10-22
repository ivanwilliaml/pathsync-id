import { defineConfig } from "@playwright/test";

// Demo-flow checks against a running site: the live one by default, or a local build with E2E_BASE_URL.
//   npx playwright test                         (https://pathsync-id.vercel.app)
//   E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  retries: 1,
  use: { baseURL: process.env.E2E_BASE_URL ?? "https://pathsync-id.vercel.app", locale: "id-ID", trace: "retain-on-failure" },
});
