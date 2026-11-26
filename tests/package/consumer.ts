// `npm run test:package` type-checks this against the packed package (tests/package/tsconfig.json), the way an app's
// TypeScript sees vue-click: through package.json's `types`, with nothing from src.
import { createApp, type Directive, type GlobalDirectives, type ObjectDirective } from 'vue'
import VueClick, { ClickDirective, type ClickHandler } from 'vue-click'

const directive: Directive = ClickDirective

createApp({})
  .use(VueClick)
  .directive('click', directive)

// Installing the plugin registers `v-click` for template type-checking, with a typed value. What a template binds is
// checked against `Value`.
type Value = GlobalDirectives['vClick'] extends ObjectDirective<HTMLElement, infer V> ? V : never

export const values: Value[] = [
  (argument: string | null) => argument,
  () => {},
  null,
  undefined
]

const handler: ClickHandler = (argument) => argument?.toUpperCase()
export const handlerValue: Value = handler

const remove = (item: string): void => { console.log(item) }
// @ts-expect-error `v-click="remove(item)"` binds what the call returns, not a function.
export const callResult: Value = remove('item')

// @ts-expect-error A handler is called with the directive's argument, a string, so it can't expect a number.
export const numberHandler: Value = (id: number) => id
