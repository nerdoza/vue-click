import { createApp, reactive } from 'vue'
import VueClick from 'vue-click'
import { TimeParser } from '../../src/time'

/**
 * A page for the Playwright suite: each button binds one behavior or modifier and records what it dispatches to
 * `window.calls`. The suite drives it with real (trusted) mouse, keyboard and touch input.
 */

interface Call {
  id: string
  arg: unknown
}

interface WindowListener {
  type: string
  listener: unknown
  capture: boolean
}

const calls: Call[] = []
const state = reactive({
  bound: false,
  useB: false,
  showHold: true,
  showDebounce: true,
  altLabel: false
})

// Count the listeners added to `window`, so the suite can tell that an unmount removed them.
const windowListeners: WindowListener[] = []
const capture = (options?: boolean | EventListenerOptions) => typeof options === 'boolean' ? options : options?.capture === true
const indexOfListener = (type: string, listener: unknown, options?: boolean | EventListenerOptions) => {
  return windowListeners.findIndex(entry => entry.type === type && entry.listener === listener && entry.capture === capture(options))
}
const addEventListener = window.addEventListener.bind(window)
const removeEventListener = window.removeEventListener.bind(window)
window.addEventListener = (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
  if (indexOfListener(type, listener, options) === -1) {
    windowListeners.push({ type, listener, capture: capture(options) })
  }
  addEventListener(type, listener, options)
}
window.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
  const index = indexOfListener(type, listener, options)
  if (index !== -1) {
    windowListeners.splice(index, 1)
  }
  removeEventListener(type, listener, options)
}

const ids = [
  'single', 'singleArg', 'nested', 'double', 'double1s', 'hold', 'hold1s', 'holdArg', 'tiny', 'press', 'pressOnce',
  'release', 'once', 'throttle', 'throttleArg', 'debounce', 'disabled', 'comboSingle', 'comboHold', 'bound', 'swapA',
  'swapB', 'unmountHold', 'unmountDebounce', 'tileA', 'tileB', 'relabel'
]
const handlers: Record<string, (arg: unknown) => void> = {}
ids.forEach(id => { handlers[id] = (arg) => { calls.push({ id, arg }) } })

Object.assign(window, {
  calls,
  state,
  TimeParser,
  windowMouseListeners: () => windowListeners.filter(entry => entry.type.startsWith('mouse')).length
})

const app = createApp({
  setup: () => ({ h: handlers, state }),
  template: `
    <button data-testid="single" v-click="h.single">single</button>
    <button data-testid="singleArg" v-click:5="h.singleArg">single:5</button>
    <button data-testid="nested" v-click="h.nested"><span data-testid="nestedLabel">nested</span></button>
    <button data-testid="double" v-click.double="h.double">double</button>
    <button data-testid="double1s" v-click.double.1s="h.double1s">double.1s</button>
    <button data-testid="hold" v-click.hold="h.hold">hold</button>
    <button data-testid="hold1s" v-click.hold.1s="h.hold1s">hold.1s</button>
    <button data-testid="holdArg" v-click.hold.500ms:40="h.holdArg">hold.500ms:40</button>
    <button data-testid="tiny" class="tiny" v-click.hold="h.tiny"></button>
    <button data-testid="press" v-click.press="h.press">press</button>
    <button data-testid="pressOnce" v-click.press.once="h.pressOnce">press.once</button>
    <button data-testid="release" v-click.release="h.release">release</button>
    <button data-testid="once" v-click.once="h.once">once</button>
    <button data-testid="throttle" v-click.throttle.1s="h.throttle">throttle.1s</button>
    <button data-testid="throttleArg" v-click.throttle:open="h.throttleArg">throttle:open</button>
    <button data-testid="debounce" v-click.debounce.500ms="h.debounce">debounce.500ms</button>
    <button data-testid="disabled" disabled v-click="h.disabled">disabled</button>
    <button data-testid="combo" v-click="h.comboSingle" v-click.hold.500ms="h.comboHold">single + hold</button>
    <button data-testid="bound" v-click="state.bound ? h.bound : undefined">bound</button>
    <button data-testid="swap" v-click="state.useB ? h.swapB : h.swapA">swap</button>
    <button data-testid="unmountHold" v-if="state.showHold" v-click.hold="h.unmountHold">unmount hold</button>
    <button data-testid="unmountDebounce" v-if="state.showDebounce" v-click.debounce.500ms="h.unmountDebounce">unmount debounce</button>
    <button data-testid="tileA" v-click.hold.500ms="h.tileA">tile A</button>
    <button data-testid="tileB" v-click="h.tileB">tile B</button>
    <button data-testid="relabel" v-click="h.relabel">
      <span v-if="state.altLabel">relabelled</span>
      <span v-else data-testid="relabelLabel">relabel</span>
    </button>
  `
})

app.use(VueClick)
app.mount('#app')
