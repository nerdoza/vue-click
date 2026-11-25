import path from 'path'
import { defineConfig, devices } from '@playwright/test'

const ci = process.env.CI !== undefined

/**
 * `src` runs the suite against the source; `package` runs it against the packed npm package, plus the package-only
 * tests in `tests/package` (see tests/package/playwright.config.ts).
 */
export const config = (target: 'src' | 'package') => {
  // A port per target, so a local server left running for one target is never reused for the other.
  const port = target === 'src' ? 8089 : 8090

  return defineConfig({
    testDir: path.join(__dirname, 'tests'),
    testIgnore: target === 'src' ? ['**/tests/package/**'] : [],
    outputDir: path.join(__dirname, 'test-results', target),
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
      cwd: __dirname,
      env: { VUE_CLICK_TARGET: target },
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: !ci
    }
  })
}

export default config('src')
