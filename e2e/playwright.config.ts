import { defineConfig, devices } from '@playwright/test';

/**
 * E2E con tiendas simuladas (mock-stores.mjs) a partir de respuestas reales capturadas.
 * Requisitos: compilar Angular (comparahorro/dist) y el servidor (server/dist). Desde la raíz:
 *   npm run test:e2e
 * Si Chromium no está instalado: npx playwright install chromium (desde e2e/).
 */
const APP_PORT = Number(process.env.E2E_APP_PORT ?? 3100);
const MOCK_PORT = Number(process.env.MOCK_STORES_PORT ?? 4010);
const mockBase = `http://127.0.0.1:${MOCK_PORT}`;
const executablePath = process.env.CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    locale: 'es-GT',
    timezoneId: 'America/Guatemala',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: [
    {
      command: 'node mock-stores.mjs',
      url: `${mockBase}/walmart/api/checkout/pub/regions?postalCode=01001`,
      reuseExistingServer: false,
      env: { MOCK_STORES_PORT: String(MOCK_PORT) },
    },
    {
      command: 'node ../server/dist/index.js',
      url: `http://127.0.0.1:${APP_PORT}/api/health`,
      reuseExistingServer: false,
      env: {
        PORT: String(APP_PORT),
        HOST: '127.0.0.1',
        STATIC_DIR: '../comparahorro/dist/comparahorro/browser',
        STORE_TIMEOUT_MS: '8000',
        HTTP_CACHE_TTL_MS: '0',
        ALLOW_TEST_STORE_BASE_URLS: '1',
        TEST_STORE_BASE_URLS: JSON.stringify({
          'walmart-gt': `${mockBase}/walmart`,
          'la-torre-gt': `${mockBase}/latorre`,
          'maxi-despensa-gt': `${mockBase}/maxi`,
          'paiz-gt': `${mockBase}/sin-conexion`,
          'walmart-sv': `${mockBase}/sin-conexion`,
          'maxi-despensa-sv': `${mockBase}/sin-conexion`,
          'despensa-don-juan-sv': `${mockBase}/sin-conexion`,
        }),
        KROGER_CLIENT_ID: '',
        KROGER_CLIENT_SECRET: '',
        NO_PROXY: '127.0.0.1,localhost',
      },
    },
  ],
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }, grepInvert: /@movil/ },
    { name: 'movil', use: { ...devices['Pixel 7'] }, grep: /@movil/ },
  ],
});
