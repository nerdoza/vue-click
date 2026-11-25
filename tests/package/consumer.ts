// `npm run test:package` type-checks this against the packed package (tests/package/tsconfig.json), the way an app's
// TypeScript sees vue-click: through package.json's `types`, with nothing from src.
import { createApp, type Directive } from 'vue'
import VueClick, { ClickDirective } from 'vue-click'

const directive: Directive = ClickDirective

createApp({})
  .use(VueClick)
  .directive('click', directive)
