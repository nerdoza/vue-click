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
  altLabel: false,
  debounceDisabled: false
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
  'swapB', 'unmountHold', 'unmountDebounce', 'tileA', 'tileB', 'relabel', 'relabelHold', 'relabelRelease',
  'formSingle', 'formHold', 'formSubmit', 'link', 'outer', 'inner', 'innerStop', 'innerHoldStop', 'outerRelease',
  'releaseStopChild', 'pressOnceStopChild', 'debounceDisable', 'onceThenHold', 'holdAfterOnce', 'holdThenOnce',
  'onceAfterHold', 'onceA', 'onceB', 'bareUnit', 'typo', 'twoBehaviors'
]
const handlers: Record<string, (arg: unknown) => unknown> = {}
ids.forEach(id => { handlers[id] = (arg) => { calls.push({ id, arg }) } })
// Handlers that fail, for the app's errorHandler below.
handlers.throws = () => { throw new Error('thrown') }
handlers.rejects = async () => await Promise.reject(new Error('rejected'))

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
    <button data-testid="relabelHold" v-click.hold.1s="h.relabelHold">
      <span v-if="state.altLabel">relabelled</span>
      <span v-else data-testid="relabelHoldLabel">relabel hold.1s</span>
    </button>
    <button data-testid="relabelRelease" v-click.release="h.relabelRelease">
      <span v-if="state.altLabel">relabelled</span>
      <span v-else data-testid="relabelReleaseLabel">relabel release</span>
    </button>
    <form @submit.prevent="h.formSubmit(null)">
      <button data-testid="formSingle" v-click="h.formSingle">submit (single)</button>
      <button data-testid="formHold" v-click.hold="h.formHold">submit (hold)</button>
    </form>
    <a data-testid="link" href="#followed" v-click="h.link">link</a>
    <div data-testid="outer" class="outer" v-click="h.outer">
      <button data-testid="inner" v-click="h.inner">inner</button>
      <button data-testid="innerStop" v-click.stop="h.innerStop"><span data-testid="innerStopLabel">inner.stop</span></button>
      <button data-testid="innerHoldStop" v-click.hold.stop="h.innerHoldStop">inner.hold.stop</button>
    </div>
    <div data-testid="outerRelease" class="outer" v-click.release="h.outerRelease">
      <button data-testid="releaseStopChild" v-click.stop="h.releaseStopChild">inner.stop</button>
      <button data-testid="pressOnceStopChild" v-click.press.once.stop="h.pressOnceStopChild">inner.press.once.stop</button>
    </div>
    <button data-testid="debounceDisable" :disabled="state.debounceDisabled" v-click.debounce.500ms="h.debounceDisable">debounce, then disabled</button>
    <button data-testid="onceThenHold" v-click.once="h.onceThenHold" v-click.hold.500ms="h.holdAfterOnce">once + hold</button>
    <button data-testid="holdThenOnce" v-click.hold.500ms="h.holdThenOnce" v-click.once="h.onceAfterHold">hold + once</button>
    <button data-testid="bareUnit" v-click.hold.s="h.bareUnit">hold.s</button>
    <button data-testid="typo" v-click.dubble="h.typo">dubble</button>
    <button data-testid="twoBehaviors" v-click.double.hold.1s.2s="h.twoBehaviors">double.hold.1s.2s</button>
    <button data-testid="twoOnces" v-click.once="h.onceA" v-click.press.once="h.onceB">once + press.once</button>
    <button data-testid="throws" v-click="h.throws">throws</button>
    <button data-testid="rejects" v-click="h.rejects">rejects</button>
  `
})

app.config.errorHandler = (error) => {
  calls.push({ id: 'errorHandler', arg: error instanceof Error ? error.message : error })
}
app.use(VueClick)
app.mount('#app')
