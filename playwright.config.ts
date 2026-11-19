import { defineConfig, devices } from '@playwright/test'

const port = 8089
const ci = process.env.CI !== undefined

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
    // Lets CDP `Input.dispatchTouchEvent` deliver real touch events alongside the mouse.
    hasTouch: true
  },
  webServer: {
    command: `npx webpack serve --config webpack/test.config.js --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !ci
  }
})
