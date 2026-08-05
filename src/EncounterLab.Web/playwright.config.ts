import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const e2eDirectory = path.resolve(import.meta.dirname, '.e2e');
fs.mkdirSync(e2eDirectory, { recursive: true });
const databasePath = path.join(e2eDirectory, `encounterlab-${process.pid}.db`);
for (const suffix of ['', '-shm', '-wal']) {
  fs.rmSync(databasePath + suffix, { force: true });
}

const processEnvStrings = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

export default defineConfig({
  testDir: './e2e',
  timeout: 100_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'dotnet run --project ../EncounterLab.Api/EncounterLab.Api.csproj --urls http://127.0.0.1:5000',
      url: 'http://127.0.0.1:5000/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...processEnvStrings,
        ConnectionStrings__EncounterLab: `Data Source=${databasePath}`,
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      timeout: 120_000,
      env: processEnvStrings,
    },
  ],
});
