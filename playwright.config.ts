import { defineConfig, devices } from "@playwright/test";

/**
 * Sem BASE_URL, sobe o app local com um Redis REST falso (com Lua de verdade).
 * Com BASE_URL, testa a URL informada. Cada teste cria a própria sala.
 */
const baseURL = process.env.BASE_URL;
const FAKE_REDIS_PORT = 8079;
const APP_PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/e2e.json" }]],
  use: {
    baseURL: baseURL ?? `http://127.0.0.1:${APP_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: baseURL
    ? undefined
    : [
        {
          command: `node test/fake-upstash.mjs ${FAKE_REDIS_PORT}`,
          port: FAKE_REDIS_PORT,
          reuseExistingServer: true,
        },
        {
          command: `npx next start -p ${APP_PORT}`,
          port: APP_PORT,
          reuseExistingServer: true,
          env: {
            KV_REST_API_URL: `http://127.0.0.1:${FAKE_REDIS_PORT}`,
            KV_REST_API_TOKEN: "test",
          },
        },
      ],
});
