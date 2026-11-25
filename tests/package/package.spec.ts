import { createRequire } from 'module'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { test, expect } from '@playwright/test'

/**
 * Loads the packed package (installed here by `npm run test:package`) the ways an app can besides a bundler, which the
 * rest of the suite covers. `require` resolves `vue-click` from this folder, so it is always the package, never src.
 */
const require = createRequire(__filename)

interface ScriptGlobals {
  Vue: typeof import('vue')
  VueClick: typeof import('vue-click')
  hits: number
}

test('works from script tags, as in the README\'s CDN example', async ({ page }) => {
  await page.setContent('<div id="app"><button v-click="hit">hit</button></div>')
  await page.addScriptTag({ path: require.resolve('vue/dist/vue.global.prod.js') })
  await page.addScriptTag({ path: require.resolve('vue-click') })
  await page.evaluate(() => {
    const globals = window as unknown as ScriptGlobals
    globals.hits = 0
    globals.Vue.createApp({ methods: { hit: () => { globals.hits++ } } })
      .use(globals.VueClick.default)
      .mount('#app')
  })

  await page.getByRole('button', { name: 'hit' }).click()
  await expect.poll(async () => await page.evaluate(() => (window as unknown as ScriptGlobals).hits)).toBe(1)
})

test('can be required and rendered on the server', async () => {
  const VueClick = (require('vue-click') as typeof import('vue-click')).default
  const app = createSSRApp({ template: '<button v-click="hit">hit</button>', methods: { hit: () => {} } })

  expect(await renderToString(app.use(VueClick))).toBe('<button>hit</button>')
})
