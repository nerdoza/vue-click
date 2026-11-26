import type { DirectiveBinding, ObjectDirective, Plugin, VNode } from 'vue'
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

/** Elements with a `v-click.stop`, and how many: they claim the input that starts inside them. */
const claimingElements = new WeakMap<Node, number>()

const claim = (el: HTMLElement): Teardown => {
  claimingElements.set(el, (claimingElements.get(el) ?? 0) + 1)
  let claimed = true
  return () => {
    if (claimed) {
      claimed = false
      const count = (claimingElements.get(el) ?? 1) - 1
      if (count > 0) {
        claimingElements.set(el, count)
      } else {
        claimingElements.delete(el)
      }
    }
  }
}

/** Whether input aimed at `target` was claimed by a `v-click.stop` element inside `el`, so `el` leaves it alone. */
const claimedInside = (el: HTMLElement, target: EventTarget | null) => {
  for (let node = target as Node | null; node !== null && node !== el; node = node.parentNode) {
    if (claimingElements.has(node)) {
      return true
    }
  }
  return false
}

interface Claims {
  /** Whether the mouse press under way on `el`, or the click its release makes, started in a claimed descendant. */
  mouse: () => boolean
  /** Whether the touch with this identifier started in a claimed descendant. */
  touch: (identifier: number) => boolean
  teardown: Teardown
}

/**
 * Remembers which presses on `el` a `v-click.stop` descendant claimed. That's decided as each press starts and holds
 * through its release and the click after it, even if the claim goes away meanwhile (a `once.stop` that fires on the
 * way down) or the release lands outside the descendant. Listening in the capture phase on `el`, this sees each press
 * before the descendant's own directives do.
 */
const rememberClaims = (el: HTMLElement): Claims => {
  let mouseClaimed = false
  let unlistenRelease: Teardown = () => {}
  const claimedTouches = new Set<number>()

  const unlisten = [
    listen(el, ['mousedown'], (event: MouseEvent) => {
      if (!event.isTrusted) {
        return
      }
      unlistenRelease()
      unlistenRelease = () => {}
      mouseClaimed = claimedInside(el, event.target)
      if (mouseClaimed) {
        unlistenRelease = listen(window, ['mouseup'], (release: MouseEvent) => {
          if (release.isTrusted && release.button === event.button) {
            unlistenRelease()
            unlistenRelease = () => {}
            // The browser dispatches a release's click right after its mouseup, before any timer runs.
            setTimeout(() => { mouseClaimed = false })
          }
        }, passiveEventOptions)
      }
    }, passiveEventOptions),
    listen(el, ['touchstart'], (event: TouchEvent) => {
      if (event.isTrusted) {
        for (let i = 0; i < event.changedTouches.length; i++) {
          const { identifier, target } = event.changedTouches[i]
          if (claimedInside(el, target)) {
            claimedTouches.add(identifier)
          } else {
            claimedTouches.delete(identifier)
          }
        }
      }
    }, passiveEventOptions)
  ]

  return {
    mouse: () => mouseClaimed,
    touch: (identifier) => claimedTouches.has(identifier),
    teardown: () => {
      unlisten.forEach(stop => stop())
      unlistenRelease()
    }
  }
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
  claims: Claims
  teardown: Teardown
}

/**
 * Follows one press of the primary mouse button or of a single finger on `el`. `onEnd(true)` means the press was
 * released on `el` without straying past `defaultMoveTolerance`; `onEnd(false)` means it was cancelled instead: moved
 * too far, released elsewhere, interrupted by `touchcancel` or another touch on `el`, or torn down.
 */
const trackPress = (el: HTMLElement, onStart: () => void, onEnd: (released: boolean) => void, preventDefault = true): PressTracker => {
  const claims = rememberClaims(el)
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
    if (claimedInside(el, event.target) || !accept(event)) {
      return
    }

    // A tracked touch that left the screen, or whose id a new touch reuses, ended where we could not see it (its
    // target left the DOM mid-press, so its `touchend` never reached `el`).
    if (touching() && (findTouch(event.touches) === null || findTouch(event.changedTouches) !== null)) {
      finish(false)
    }

    // Fingers on a claimed descendant belong to it, not to this element's gesture.
    let touchesOnElement = 0
    for (let i = 0; i < event.touches.length; i++) {
      const { identifier, target } = event.touches[i]
      if (el.contains(target as Node) && !claims.touch(identifier)) {
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
    // The end of a claimed touch is its descendant's alone; it mustn't count as recent input here.
    let claimedOnly = true
    for (let i = 0; i < event.changedTouches.length; i++) {
      claimedOnly &&= claims.touch(event.changedTouches[i].identifier)
    }
    if (!claimedOnly && accept(event) && findTouch(event.changedTouches) !== null) {
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
    if (claimedInside(el, event.target) || !accept(event) || !isPrimaryButton(event)) {
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
    listen(el, ['mouseup'], (event: MouseEvent) => {
      if (!claims.mouse()) {
        accept(event)
      }
    })
  ]

  return {
    recentlyPressed: () => press !== null || Date.now() - lastPointerAt < pointerClickGuard,
    claims,
    teardown: () => {
      unlistenElement.forEach(unlisten => unlisten())
      claims.teardown()
      finish(false)
    }
  }
}

const isPrimaryInput = (event: MouseEvent | TouchEvent) => !('button' in event) || isPrimaryButton(event)

interface ClickActionGuard {
  /** Stops guarding new presses; the click that ends a press already under way is still cancelled. */
  stop: Teardown
  teardown: Teardown
}

/**
 * The behaviors cancel the `touchend` of a touch, so the browser never generates a `click` for it, and a tap never
 * submits a form, follows a link or toggles a checkbox. This gives mouse input the same result: the `click` that ends
 * a mouse press on `el` has its default action cancelled. A keyboard or assistive-tech `click` has no mouse press
 * before it and keeps its action.
 */
const guardClickActions = (el: HTMLElement): ClickActionGuard => {
  /** Set by the release of a primary press on `el`, for the `click` (if any) that the release makes. */
  let armed = false
  let unlistenRelease: Teardown = () => {}

  const unlistenPress = listen(el, ['mousedown'], (event: MouseEvent) => {
    if (event.isTrusted && event.button === 0) {
      unlistenRelease()
      // Wherever the button is released; other buttons pressed and released meanwhile don't end this press.
      unlistenRelease = listen(window, ['mouseup'], (release: MouseEvent) => {
        if (release.isTrusted && release.button === 0) {
          unlistenRelease()
          // The browser dispatches a release's `click` right after its `mouseup`, before any timer runs, so this
          // covers that click alone: a later click, from the keyboard say, keeps its action.
          armed = true
          setTimeout(() => { armed = false })
        }
      }, passiveEventOptions)
    }
  }, passiveEventOptions)

  const unlistenClick = listen(el, ['click'], (event: MouseEvent) => {
    // Only a mouse's click (`detail`, its click count, above 0): input can be handled ahead of the timer that disarms
    // the guard, so a keyboard click can arrive while it's still armed.
    if (armed && event.isTrusted && event.detail > 0) {
      armed = false
      event.preventDefault()
    }
  })

  return {
    stop: unlistenPress,
    teardown: () => {
      unlistenPress()
      unlistenRelease()
      unlistenClick()
    }
  }
}

interface ClickBinding {
  bindingOptions: BindingOptions
  teardown: Teardown
}

/** What an element's v-click directives share: its pressed and deactivated states belong to the element, not to one directive. */
interface ElementState {
  /** The element's bindings, keyed by their place in `vnode.dirs`: that is how Vue pairs them across renders. */
  bindings: Map<number, ClickBinding>
  /** How many bindings can still fire: all of them, less each `once` that has fired. */
  live: number
  /** Stops the tracking behind `data-vc-state-active`. */
  stopActiveState: Teardown
}

const elementStates = new WeakMap<HTMLElement, ElementState>()

const elementState = (el: HTMLElement): ElementState => {
  let state = elementStates.get(el)
  if (state === undefined) {
    const dataState = dataStatePrefix + dataStateActivePostfix
    const tracker = trackPress(el, () => { el.dataset[dataState] = '' }, () => { delete (el.dataset[dataState]) }, false)
    state = { bindings: new Map(), live: 0, stopActiveState: tracker.teardown }
    elementStates.set(el, state)
  }
  return state
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
    // The click a claimed mouse press makes is a mouse click (`detail` above 0). A keyboard click can arrive before the
    // claim is cleared, since input is handled ahead of the timer that clears it, so it mustn't be taken for one.
    const claimedPressClick = event.detail > 0 && tracker.claims.mouse()
    if (event.isTrusted && !tracker.recentlyPressed() && !claimedPressClick && !claimedInside(el, event.target)) {
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

/** Fires on each trusted edge event of the primary input on `el`, cancelling its default action. */
const onEdge = (el: HTMLElement, fire: Fire) => (event: MouseEvent | TouchEvent) => {
  if (event.isTrusted && !claimedInside(el, event.target)) {
    if (event.cancelable) {
      event.preventDefault()
    }

    if (isPrimaryInput(event)) {
      fire()
    }
  }
}

const pressBehavior: BehaviorBinder = (el, bindingOptions, fire) => listen(el, ['touchstart', 'mousedown'], onEdge(el, fire))

/**
 * Whether a touch was lifted over `el`. A `mouseup` goes to the element under the pointer, but a `touchend` goes to the
 * node the touch started on, wherever the finger is lifted, so the point has to be looked up.
 */
const liftedOver = (el: HTMLElement, touch: Touch) => {
  // Through the element's own root: inside a shadow root, the document would only find the shadow host.
  const root = el.getRootNode() as Partial<DocumentOrShadowRoot>
  const over = root.elementFromPoint?.(touch.clientX, touch.clientY) ?? null
  return over !== null && el.contains(over)
}

const releaseBehavior: BehaviorBinder = (el, bindingOptions, fire) => {
  const onRelease = onEdge(el, fire)
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
      if (!el.contains(target as Node) || claimedInside(el, target)) {
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
          const touch = end.changedTouches[j]
          if (touch.identifier === identifier) {
            stop()
            if (end.cancelable) {
              end.preventDefault()
            }
            if (end.type === 'touchend' && end !== lastRelease && liftedOver(el, touch)) {
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

  // A mouse press claimed as it started stays claimed through its release, wherever that lands.
  const claims = rememberClaims(el)
  const unlisten = [
    listen(el, ['touchstart'], onTouchStart, passiveEventOptions),
    listen(el, ['mouseup'], (event: MouseEvent) => {
      if (!claims.mouse()) {
        onRelease(event)
      }
    })
  ]

  return () => {
    unlisten.forEach(stop => stop())
    claims.teardown()
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

/** Calls the binding's handler, unless the element has been disabled since the input arrived. */
type Dispatch = () => void

const onceModifier = (dispatch: Dispatch): ModifierHandle => ({
  fire: (removeBinding) => {
    removeBinding()
    dispatch()
  },
  teardown: () => {}
})

const throttleModifier = (bindingOptions: BindingOptions, dispatch: Dispatch): ModifierHandle => {
  const throttleTime = bindingOptions.time ?? defaultEventTimeout
  const throttleTimer = createTimer()

  return {
    fire: () => {
      if (!throttleTimer.pending()) {
        dispatch()
      }
      throttleTimer.start(throttleTime)
    },
    teardown: throttleTimer.clear
  }
}

const debounceModifier = (bindingOptions: BindingOptions, dispatch: Dispatch): ModifierHandle => {
  const debounceTime = bindingOptions.time ?? defaultEventTimeout
  const debounceTimer = createTimer()

  return {
    fire: () => debounceTimer.start(debounceTime, dispatch),
    teardown: debounceTimer.clear
  }
}

const bindModifier = (bindingOptions: BindingOptions, dispatch: Dispatch): ModifierHandle => {
  switch (bindingOptions.modifier) {
    case Modifier.Once:
      return onceModifier(dispatch)
    case Modifier.Throttle:
      return throttleModifier(bindingOptions, dispatch)
    case Modifier.Debounce:
      return debounceModifier(bindingOptions, dispatch)
    default:
      return { fire: dispatch, teardown: () => {} }
  }
}

const isDisabled = (el: HTMLElement) => (el as { disabled?: unknown }).disabled === true

const bindingKey = (binding: DirectiveBinding, vnode: VNode) => vnode.dirs?.indexOf(binding) ?? -1

/** A v-click handler. It's called with the directive's argument, or `null` without one, and never with the event. */
export type ClickHandler = (argument: string | null) => unknown

export const ClickDirective: ObjectDirective<HTMLElement, ClickHandler | null | undefined> = {
  mounted (el: HTMLElement, binding, vnode) {
    const bindingOptions = ParseBinding(binding)
    if (bindingOptions.problems.length > 0) {
      const directive = 'v-click' + (binding.arg !== undefined ? `:${binding.arg}` : '') + Object.keys(binding.modifiers).map(modifier => `.${modifier}`).join('')
      console.warn(`[vue-click] ${directive}: ${bindingOptions.problems.join('; ')}.`)
    }
    // Checked again on dispatch, which a debounce does later: disabling the element drops a pending one.
    const modifier = bindModifier(bindingOptions, () => {
      if (!isDisabled(el)) {
        bindingOptions.dispatch()
      }
    })
    const dataBinding = dataBindingPrefix + dataBindPostfixes[bindingOptions.behavior]
    const state = elementState(el)
    const key = bindingKey(binding, vnode)
    const clickActions = guardClickActions(el)
    const unclaim = bindingOptions.stop ? claim(el) : () => {}

    state.live++
    let live = true
    /** Marks this binding as no longer able to fire; true when it was the element's last one that could. */
    const retire = () => {
      if (live) {
        live = false
        state.live--
        return state.live === 0
      }
      return false
    }

    const removeBinding = () => {
      teardownBehavior()
      // The press that fired this `once` may still be under way, and its click still has to be cancelled.
      clickActions.stop()
      unclaim()
      delete (el.dataset[dataBinding])
      if (retire()) {
        state.stopActiveState()
        el.dataset[dataStatePrefix + dataStateDeactivatedPostfix] = ''
      }
    }
    const teardownBehavior = behaviors[bindingOptions.behavior](el, bindingOptions, () => {
      if (!isDisabled(el)) {
        modifier.fire(removeBinding)
      }
    })
    el.dataset[dataBinding] = bindingOptions.modifier ?? ''

    state.bindings.set(key, {
      bindingOptions,
      teardown: () => {
        teardownBehavior()
        modifier.teardown()
        clickActions.teardown()
        unclaim()
        retire()
        state.bindings.delete(key)
        if (state.bindings.size === 0) {
          state.stopActiveState()
          elementStates.delete(el)
        }
      }
    })
  },
  updated (el: HTMLElement, binding, vnode) {
    const clickBinding = elementStates.get(el)?.bindings.get(bindingKey(binding, vnode))
    if (clickBinding !== undefined) {
      // Only the handler and its argument follow the binding; the behavior, modifier and time stay as mounted.
      clickBinding.bindingOptions.dispatch = ParseBinding(binding).dispatch
    }
  },
  beforeUnmount (el: HTMLElement, binding, vnode) {
    elementStates.get(el)?.bindings.get(bindingKey(binding, vnode))?.teardown()
  }
}

// Registered for template type-checking (Volar, vue-tsc) under the name the plugin installs it as, as Vue registers its
// own directives. GlobalDirectives exists from Vue 3.5; before that this declares an interface nothing reads.
declare module 'vue' {
  interface GlobalDirectives {
    vClick: typeof ClickDirective
  }
}

const VueClick: Plugin = {
  install: (app) => {
    app.directive('click', ClickDirective)
  }
}

export default VueClick
