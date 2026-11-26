import { Directive, DirectiveBinding, VNode } from 'vue'
import { ParseBinding, Behavior, Modifier, BindingOptions } from './binding'

const defaultEventTimeout = 300
/** How far (in CSS pixels) a pointer may travel from where it pressed before the gesture is cancelled. */
const defaultMoveTolerance = 10
/** How long (in ms) after pointer input on an element a `click` on it counts as that pointer's own click. */
const pointerClickGuard = 600
const dataBindingPrefix = 'vcBind'
const dataBindPostfixes: Record<Behavior, string> = {
  [Behavior.Single]: 'Click',
  [Behavior.Double]: 'Double',
  [Behavior.Hold]: 'Hold',
  [Behavior.Press]: 'Press',
  [Behavior.Release]: 'Release'
}
const dataStatePrefix = 'vcState'
const dataStateActivePostfix = 'Active'
const dataStateDeactivatedPostfix = 'Deactivated'

/**
 * @summary `eventOptions` will evaluate as `true` on older browsers, which is consistent behavior so no polyfill is required.
 * @see https://github.com/WICG/EventListenerOptions/blob/gh-pages/explainer.md
 */
const eventOptions: AddEventListenerOptions = {
  capture: true,
  passive: false
}

/** For listeners that never cancel their event, so they don't hold up scrolling. */
const passiveEventOptions: AddEventListenerOptions = {
  capture: true,
  passive: true
}

/**
 * macOS and iPadOS treat Control + click as the secondary (context-menu) click. Chrome and Safari still report it as
 * `button` 0 with `ctrlKey` set, so it has to be told apart from a primary click by platform.
 */
const controlClickIsSecondary = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform)

/** The primary mouse button, unless the platform reads this press as a secondary click. */
const isPrimaryButton = (event: MouseEvent) => event.button === 0 && !(event.ctrlKey && controlClickIsSecondary())

type Teardown = () => void
type Fire = () => void
type BehaviorBinder = (el: HTMLElement, bindingOptions: BindingOptions, fire: Fire) => Teardown

const listen = <E extends Event>(target: EventTarget, types: string[], listener: (event: E) => void, options = eventOptions): Teardown => {
  types.forEach(type => target.addEventListener(type, listener as EventListener, options))
  return () => types.forEach(type => target.removeEventListener(type, listener as EventListener, options))
}

interface Timer {
  pending: () => boolean
  start: (time: number, callback?: () => void) => void
  clear: () => void
}

const createTimer = (): Timer => {
  let timeout: number | null = null
  const clear = () => {
    if (timeout !== null) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return {
    pending: () => timeout !== null,
    start: (time, callback) => {
      clear()
      timeout = window.setTimeout(() => {
        timeout = null
        callback?.()
      }, time)
    },
    clear
  }
}

interface PressTracker {
  /** Whether a pointer is pressing `el`, or pressed or released it within `pointerClickGuard`. */
  recentlyPressed: () => boolean
  teardown: Teardown
}

/**
 * Follows one press of the primary mouse button or of a single finger on `el`. `onEnd(true)` means the press was
 * released on `el` without straying past `defaultMoveTolerance`; `onEnd(false)` means it was cancelled instead: moved
 * too far, released elsewhere, interrupted by `touchcancel` or another touch on `el`, or torn down.
 */
const trackPress = (el: HTMLElement, onStart: () => void, onEnd: (released: boolean) => void, preventDefault = true): PressTracker => {
  let press: { x: number, y: number, touchId: number | null } | null = null
  /** Removes the listeners that follow the current press: on `window` for a mouse, on the touched node for a touch. */
  let unlistenPress: Teardown = () => {}
  let lastPointerAt = 0

  const accept = (event: Event) => {
    if (!event.isTrusted) {
      return false
    }
    if (preventDefault && event.cancelable) {
      event.preventDefault()
    }
    lastPointerAt = Date.now()
    return true
  }

  const begin = (x: number, y: number, touchId: number | null) => {
    press = { x, y, touchId }
    onStart()
  }

  const finish = (released: boolean) => {
    if (press !== null) {
      press = null
      unlistenPress()
      unlistenPress = () => {}
      onEnd(released)
    }
  }

  const movedTooFar = (x: number, y: number) => {
    if (press === null) {
      return false
    }
    const dx = x - press.x
    const dy = y - press.y
    return dx * dx + dy * dy > defaultMoveTolerance * defaultMoveTolerance
  }

  const touching = () => typeof press?.touchId === 'number'

  const findTouch = (touches: TouchList) => {
    for (let i = 0; i < touches.length; i++) {
      if (press !== null && touches[i].identifier === press.touchId) {
        return touches[i]
      }
    }
    return null
  }

  const onTouchStart = (event: TouchEvent) => {
    if (!accept(event)) {
      return
    }

    // A tracked touch that left the screen, or whose id a new touch reuses, ended where we could not see it (its
    // target left the DOM mid-press, so its `touchend` never reached `el`).
    if (touching() && (findTouch(event.touches) === null || findTouch(event.changedTouches) !== null)) {
      finish(false)
    }

    let touchesOnElement = 0
    for (let i = 0; i < event.touches.length; i++) {
      if (el.contains(event.touches[i].target as Node)) {
        touchesOnElement++
      }
    }

    // A second finger (or a palm) on the element cancels the gesture rather than starting another.
    if (press !== null || touchesOnElement > 1) {
      finish(false)
      return
    }

    const touch = event.changedTouches[0]
    begin(touch.clientX, touch.clientY, touch.identifier)
    unlistenPress = followTouch(touch.target)
  }

  const onTouchMove = (event: TouchEvent) => {
    const touch = event.isTrusted ? findTouch(event.changedTouches) : null
    if (touch !== null && movedTooFar(touch.clientX, touch.clientY)) {
      finish(false)
    }
  }

  const onTouchEnd = (event: TouchEvent) => {
    if (accept(event) && findTouch(event.changedTouches) !== null) {
      finish(event.type === 'touchend')
    }
  }

  // A touch's later events go to the node it started on, even once that node has left the DOM (re-rendered mid-press,
  // say), and from a detached node they never reach `el`. Listening on the node too keeps the press in view; while it
  // is attached, whichever listener sees an event first finishes the press and the other finds nothing left to do.
  const followTouch = (target: EventTarget): Teardown => {
    const unlisten = [
      listen(target, ['touchmove'], (event: TouchEvent) => onTouchMove(event), passiveEventOptions),
      listen(target, ['touchend', 'touchcancel'], (event: TouchEvent) => onTouchEnd(event))
    ]
    return () => unlisten.forEach(stop => stop())
  }

  const onWindowMouse = (event: MouseEvent) => {
    if (!event.isTrusted) {
      return
    }

    if (event.type === 'mouseup') {
      if (event.button === 0) {
        finish(event.composedPath().includes(el))
      }
    } else if ((event.buttons & 1) === 0 || movedTooFar(event.clientX, event.clientY)) {
      // No primary button in `buttons` means it was released where no `mouseup` reached the window.
      finish(false)
    }
  }

  const onMouseDown = (event: MouseEvent) => {
    if (!accept(event) || !isPrimaryButton(event)) {
      return
    }

    const secondContact = touching()
    // An open mouse press here missed its release; an open touch press makes this a second contact.
    finish(false)
    if (!secondContact) {
      unlistenPress = listen(window, ['mousemove', 'mouseup'], onWindowMouse, passiveEventOptions)
      begin(event.clientX, event.clientY, null)
    }
  }

  const unlistenElement = [
    listen(el, ['touchstart'], onTouchStart),
    listen(el, ['touchmove'], onTouchMove, passiveEventOptions),
    listen(el, ['touchend', 'touchcancel'], onTouchEnd),
    listen(el, ['mousedown'], onMouseDown),
    listen(el, ['mouseup'], accept)
  ]

  return {
    recentlyPressed: () => press !== null || Date.now() - lastPointerAt < pointerClickGuard,
    teardown: () => {
      unlistenElement.forEach(unlisten => unlisten())
      finish(false)
    }
  }
}

const isPrimaryInput = (event: MouseEvent | TouchEvent) => !('button' in event) || isPrimaryButton(event)

const bindActiveState = (el: HTMLElement): ((deactivate: boolean) => void) => {
  if (Object.values(dataBindPostfixes).some(postfix => typeof el.dataset[dataBindingPrefix + postfix] !== 'undefined')) {
    return () => {}
  }

  const dataState = dataStatePrefix + dataStateActivePostfix
  const tracker = trackPress(el, () => { el.dataset[dataState] = '' }, () => { delete (el.dataset[dataState]) }, false)

  return (deactivate) => {
    tracker.teardown()
    if (deactivate) {
      el.dataset[dataStatePrefix + dataStateDeactivatedPostfix] = ''
    }
  }
}

const singleBehavior: BehaviorBinder = (el, bindingOptions, fire) => {
  const clickTimer = createTimer()
  const tracker = trackPress(el, () => clickTimer.start(defaultEventTimeout), (released) => {
    const inTime = clickTimer.pending()
    clickTimer.clear()
    if (released && inTime) {
      fire()
    }
  })

  // Keyboard and assistive-tech activation reach the element as a `click` with no pointer press before it.
  const unlistenClick = listen(el, ['click'], (event: MouseEvent) => {
    if (event.isTrusted && !tracker.recentlyPressed()) {
      fire()
    }
  })

  return () => {
    tracker.teardown()
    clickTimer.clear()
    unlistenClick()
  }
}

const doubleBehavior: BehaviorBinder = (el, bindingOptions, fire) => {
  const doubleClickTimeout = bindingOptions.time ?? defaultEventTimeout
  const clickTimer = createTimer()
  let clickCount = 0

  const reset = () => {
    clickTimer.clear()
    clickCount = 0
  }

  const tracker = trackPress(el, () => clickTimer.start(defaultEventTimeout, reset), (released) => {
    if (!released || !clickTimer.pending()) {
      reset()
    } else if (clickCount === 0) {
      clickCount++
      clickTimer.start(doubleClickTimeout, reset)
    } else {
      reset()
      fire()
    }
  })

  return () => {
    tracker.teardown()
    reset()
  }
}

const holdBehavior: BehaviorBinder = (el, bindingOptions, fire) => {
  const holdTimer = createTimer()
  const tracker = trackPress(el, () => holdTimer.start(bindingOptions.time ?? defaultEventTimeout, fire), () => holdTimer.clear())

  return () => {
    tracker.teardown()
    holdTimer.clear()
  }
}

/** Fires on each trusted edge event of the primary input, cancelling its default action. */
const onEdge = (fire: Fire) => (event: MouseEvent | TouchEvent) => {
  if (event.isTrusted) {
    if (event.cancelable) {
      event.preventDefault()
    }

    if (isPrimaryInput(event)) {
      fire()
    }
  }
}

const pressBehavior: BehaviorBinder = (el, bindingOptions, fire) => listen(el, ['touchstart', 'mousedown'], onEdge(fire))

const releaseBehavior: BehaviorBinder = (el, bindingOptions, fire) => {
  const onRelease = onEdge(fire)
  const following = new Set<Teardown>()
  /** Fingers lifted together share one `touchend`, which is one release, however many of them were followed. */
  let lastRelease: TouchEvent | null = null

  // A touch ends on the node it started on, even once that node has left the DOM (re-rendered mid-press, say), and
  // from a detached node its `touchend` never reaches `el`, so each touch is followed on its own node instead.
  const onTouchStart = (event: TouchEvent) => {
    if (!event.isTrusted) {
      return
    }
    for (let i = 0; i < event.changedTouches.length; i++) {
      const { identifier, target } = event.changedTouches[i]
      if (!el.contains(target as Node)) {
        continue
      }
      const stop = () => {
        unlisten()
        following.delete(stop)
      }
      const unlisten = listen(target, ['touchend', 'touchcancel'], (end: TouchEvent) => {
        // A scripted event naming this touch must not stop the following of the real one.
        if (!end.isTrusted) {
          return
        }
        for (let j = 0; j < end.changedTouches.length; j++) {
          if (end.changedTouches[j].identifier === identifier) {
            stop()
            if (end.type === 'touchend' && end !== lastRelease) {
              lastRelease = end
              onRelease(end)
            }
            return
          }
        }
      })
      following.add(stop)
    }
  }

  const unlisten = [
    listen(el, ['touchstart'], onTouchStart, passiveEventOptions),
    listen(el, ['mouseup'], onRelease)
  ]

  return () => {
    unlisten.forEach(stop => stop())
    following.forEach(stop => stop())
  }
}

const behaviors: Record<Behavior, BehaviorBinder> = {
  [Behavior.Single]: singleBehavior,
  [Behavior.Double]: doubleBehavior,
  [Behavior.Hold]: holdBehavior,
  [Behavior.Press]: pressBehavior,
  [Behavior.Release]: releaseBehavior
}

interface ModifierHandle {
  fire: (removeBinding: Teardown) => void
  teardown: Teardown
}

const onceModifier = (bindingOptions: BindingOptions): ModifierHandle => ({
  fire: (removeBinding) => {
    removeBinding()
    bindingOptions.dispatch()
  },
  teardown: () => {}
})

const throttleModifier = (bindingOptions: BindingOptions): ModifierHandle => {
  const throttleTime = bindingOptions.time ?? defaultEventTimeout
  const throttleTimer = createTimer()

  return {
    fire: () => {
      if (!throttleTimer.pending()) {
        bindingOptions.dispatch()
      }
      throttleTimer.start(throttleTime)
    },
    teardown: throttleTimer.clear
  }
}

const debounceModifier = (bindingOptions: BindingOptions): ModifierHandle => {
  const debounceTime = bindingOptions.time ?? defaultEventTimeout
  const debounceTimer = createTimer()

  return {
    fire: () => debounceTimer.start(debounceTime, () => bindingOptions.dispatch()),
    teardown: debounceTimer.clear
  }
}

const bindModifier = (bindingOptions: BindingOptions): ModifierHandle => {
  switch (bindingOptions.modifier) {
    case Modifier.Once:
      return onceModifier(bindingOptions)
    case Modifier.Throttle:
      return throttleModifier(bindingOptions)
    case Modifier.Debounce:
      return debounceModifier(bindingOptions)
    default:
      return { fire: () => bindingOptions.dispatch(), teardown: () => {} }
  }
}

interface ClickBinding {
  bindingOptions: BindingOptions
  teardown: Teardown
}

/** Each element's v-click bindings, keyed by their place in `vnode.dirs`: that is how Vue pairs them across renders. */
const elementBindings = new WeakMap<HTMLElement, Map<number, ClickBinding>>()

const bindingKey = (binding: DirectiveBinding, vnode: VNode) => vnode.dirs?.indexOf(binding) ?? -1

export const ClickDirective: Directive = {
  mounted (el: HTMLElement, binding, vnode) {
    const bindingOptions = ParseBinding(binding)
    const modifier = bindModifier(bindingOptions)
    const dataBinding = dataBindingPrefix + dataBindPostfixes[bindingOptions.behavior]
    const deactivate = bindActiveState(el)
    const removeBinding = () => {
      teardownBehavior()
      deactivate(true)
      delete (el.dataset[dataBinding])
    }
    const teardownBehavior = behaviors[bindingOptions.behavior](el, bindingOptions, () => {
      if ((el as { disabled?: unknown }).disabled !== true) {
        modifier.fire(removeBinding)
      }
    })
    el.dataset[dataBinding] = bindingOptions.modifier ?? ''

    const bindings = elementBindings.get(el) ?? new Map<number, ClickBinding>()
    bindings.set(bindingKey(binding, vnode), {
      bindingOptions,
      teardown: () => {
        teardownBehavior()
        modifier.teardown()
        deactivate(false)
      }
    })
    elementBindings.set(el, bindings)
  },
  updated (el: HTMLElement, binding, vnode) {
    const clickBinding = elementBindings.get(el)?.get(bindingKey(binding, vnode))
    if (clickBinding !== undefined) {
      // Only the handler and its argument follow the binding; the behavior, modifier and time stay as mounted.
      clickBinding.bindingOptions.dispatch = ParseBinding(binding).dispatch
    }
  },
  beforeUnmount (el: HTMLElement, binding, vnode) {
    const bindings = elementBindings.get(el)
    const key = bindingKey(binding, vnode)
    bindings?.get(key)?.teardown()
    bindings?.delete(key)
  }
}

export default {
  install: (app: any) => {
    app.directive('click', ClickDirective)
  }
}
