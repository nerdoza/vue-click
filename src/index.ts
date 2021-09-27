import { Directive } from 'vue'
import { ParseBinding, Behavior, Modifier, BindingOptions } from './binding'

const defaultEventTimeout = 300
const dataBindingPrefix = 'vcBind'
const dataBindClickPostfix = 'Click'
const dataBindDoublePostfix = 'Double'
const dataBindHoldPostfix = 'Hold'
const dataBindPressPostfix = 'Press'
const dataBindReleasePostfix = 'Release'
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

const bindClassStates = (el: HTMLElement) => {
  if (
    typeof el.dataset[dataBindingPrefix + dataBindClickPostfix] !== 'undefined' ||
     typeof el.dataset[dataBindingPrefix + dataBindDoublePostfix] !== 'undefined' ||
     typeof el.dataset[dataBindingPrefix + dataBindHoldPostfix] !== 'undefined' ||
     typeof el.dataset[dataBindingPrefix + dataBindPressPostfix] !== 'undefined' ||
     typeof el.dataset[dataBindingPrefix + dataBindReleasePostfix] !== 'undefined'
  ) {
    return () => {}
  }

  const eventCallback = (event: MouseEvent | TouchEvent) => {
    if (event.type === 'mousedown' || event.type === 'touchstart') {
      el.dataset[dataStatePrefix + dataStateActivePostfix] = ''
    } else {
      delete (el.dataset[dataStatePrefix + dataStateActivePostfix])
    }
  }

  el.addEventListener('touchstart', eventCallback, eventOptions)
  el.addEventListener('touchend', eventCallback, eventOptions)
  el.addEventListener('mousedown', eventCallback, eventOptions)
  el.addEventListener('mouseup', eventCallback, eventOptions)

  return () => {
    el.removeEventListener('touchstart', eventCallback, eventOptions)
    el.removeEventListener('touchend', eventCallback, eventOptions)
    el.removeEventListener('mousedown', eventCallback, eventOptions)
    el.removeEventListener('mouseup', eventCallback, eventOptions)
    el.dataset[dataStatePrefix + dataStateDeactivatedPostfix] = ''
  }
}

const singleBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const dataBinding = dataBindingPrefix + dataBindClickPostfix
  const clickTimeout = defaultEventTimeout
  let clickState: number | null = null

  const eventCallback = (event: MouseEvent | TouchEvent) => {
    if (event.isTrusted) {
      if (event.cancelable) {
        event.preventDefault()
      }

      if (event.type === 'mousedown' || event.type === 'touchstart') {
        if (clickState !== null) {
          clearTimeout(clickState)
        }
        clickState = window.setTimeout(() => {
          if (clickState !== null) {
            clearTimeout(clickState)
            clickState = null
          }
        }, clickTimeout)
      } else if ((event.type === 'mouseup' || event.type === 'touchend') && clickState !== null) {
        clearTimeout(clickState)
        clickState = null

        onEvent(() => {
          unbindClasses()
          el.removeEventListener('touchstart', eventCallback, eventOptions)
          el.removeEventListener('touchend', eventCallback, eventOptions)
          el.removeEventListener('mousedown', eventCallback, eventOptions)
          el.removeEventListener('mouseup', eventCallback, eventOptions)
          delete (el.dataset[dataBinding])
        })
      }
    }
  }

  const unbindClasses = bindClassStates(el)
  el.addEventListener('touchstart', eventCallback, eventOptions)
  el.addEventListener('touchend', eventCallback, eventOptions)
  el.addEventListener('mousedown', eventCallback, eventOptions)
  el.addEventListener('mouseup', eventCallback, eventOptions)
  el.dataset[dataBinding] = bindingOptions.modifier ?? ''
}

const doubleBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const dataBinding = dataBindingPrefix + dataBindDoublePostfix
  const clickTimeout = defaultEventTimeout
  const doubleClickTimeout = bindingOptions.time ?? defaultEventTimeout
  let clickState: number | null = null
  let clickCount: number = 0

  const eventCallback = (event: MouseEvent | TouchEvent) => {
    if (event.isTrusted) {
      if (event.cancelable) {
        event.preventDefault()
      }

      if (event.type === 'mousedown' || event.type === 'touchstart') {
        if (clickState !== null) {
          clearTimeout(clickState)
        }
        clickState = window.setTimeout(() => {
          if (clickState !== null) {
            clearTimeout(clickState)
            clickState = null
            clickCount = 0
          }
        }, clickTimeout)
      } else if ((event.type === 'mouseup' || event.type === 'touchend') && clickState !== null) {
        clearTimeout(clickState)
        clickState = null
        if (clickCount === 0) {
          clickCount++
          clickState = window.setTimeout(() => {
            if (clickState !== null) {
              clearTimeout(clickState)
              clickState = null
              clickCount = 0
            }
          }, doubleClickTimeout)
        } else {
          clickCount = 0
          onEvent(() => {
            unbindClasses()
            el.removeEventListener('touchstart', eventCallback, eventOptions)
            el.removeEventListener('touchend', eventCallback, eventOptions)
            el.removeEventListener('mousedown', eventCallback, eventOptions)
            el.removeEventListener('mouseup', eventCallback, eventOptions)
            delete (el.dataset[dataBinding])
          })
        }
      }
    }
  }

  const unbindClasses = bindClassStates(el)
  el.addEventListener('touchstart', eventCallback, eventOptions)
  el.addEventListener('touchend', eventCallback, eventOptions)
  el.addEventListener('mousedown', eventCallback, eventOptions)
  el.addEventListener('mouseup', eventCallback, eventOptions)
  el.dataset[dataBinding] = bindingOptions.modifier ?? ''
}

const holdBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const dataBinding = dataBindingPrefix + dataBindHoldPostfix
  const holdTimeout = bindingOptions.time ?? defaultEventTimeout
  let holdState: number | null = null

  const eventCallback = (event: MouseEvent | TouchEvent) => {
    if (event.isTrusted) {
      if (event.cancelable) {
        event.preventDefault()
      }

      if (event.type === 'mousedown' || event.type === 'touchstart') {
        holdState = window.setTimeout(() => {
          onEvent(() => {
            unbindClasses()
            el.removeEventListener('touchstart', eventCallback, eventOptions)
            el.removeEventListener('touchend', eventCallback, eventOptions)
            el.removeEventListener('mousedown', eventCallback, eventOptions)
            el.removeEventListener('mouseup', eventCallback, eventOptions)
            delete (el.dataset[dataBinding])
          })
        }, holdTimeout)
      } else if ((event.type === 'mouseup' || event.type === 'touchend') && holdState !== null) {
        clearTimeout(holdState)
        holdState = null
      }
    }
  }

  const unbindClasses = bindClassStates(el)
  el.addEventListener('touchstart', eventCallback, eventOptions)
  el.addEventListener('touchend', eventCallback, eventOptions)
  el.addEventListener('mousedown', eventCallback, eventOptions)
  el.addEventListener('mouseup', eventCallback, eventOptions)
  el.dataset[dataBinding] = bindingOptions.modifier ?? ''
}

const pressBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const dataBinding = dataBindingPrefix + dataBindPressPostfix
  const eventCallback = (event: MouseEvent | TouchEvent) => {
    if (event.isTrusted) {
      if (event.cancelable) {
        event.preventDefault()
      }

      onEvent(() => {
        unbindClasses()
        el.removeEventListener('touchend', eventCallback, eventOptions)
        el.removeEventListener('mousedown', eventCallback, eventOptions)
        delete (el.dataset[dataBinding])
      })
    }
  }

  const unbindClasses = bindClassStates(el)
  el.addEventListener('touchstart', eventCallback, eventOptions)
  el.addEventListener('mousedown', eventCallback, eventOptions)
  el.dataset[dataBinding] = bindingOptions.modifier ?? ''
}

const releaseBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const dataBinding = dataBindingPrefix + dataBindReleasePostfix
  const eventCallback = (event: MouseEvent | TouchEvent) => {
    if (event.isTrusted) {
      if (event.cancelable) {
        event.preventDefault()
      }

      onEvent(() => {
        unbindClasses()
        el.removeEventListener('touchend', eventCallback, eventOptions)
        el.removeEventListener('mouseup', eventCallback, eventOptions)
        delete (el.dataset[dataBinding])
      })
    }
  }

  const unbindClasses = bindClassStates(el)
  el.addEventListener('touchend', eventCallback, eventOptions)
  el.addEventListener('mouseup', eventCallback, eventOptions)
  el.dataset[dataBinding] = bindingOptions.modifier ?? ''
}

const onceModifier = (bindingOptions: BindingOptions) => {
  return (removeBinding: () => void) => {
    removeBinding()
    bindingOptions.dispatch()
  }
}

const throttleModifier = (bindingOptions: BindingOptions) => {
  const throttleTime = bindingOptions.time ?? defaultEventTimeout
  let throttledState: number | null = null

  return () => {
    if (throttledState === null) {
      bindingOptions.dispatch()
    } else {
      clearTimeout(throttledState)
    }
    throttledState = window.setTimeout(() => { throttledState = null }, throttleTime)
  }
}

const debounceModifier = (bindingOptions: BindingOptions) => {
  const debounceTime = bindingOptions.time ?? defaultEventTimeout
  let debouncedState: number | null = null

  return () => {
    if (debouncedState !== null) {
      clearTimeout(debouncedState)
    }

    debouncedState = window.setTimeout(() => {
      debouncedState = null
      bindingOptions.dispatch()
    }, debounceTime)
  }
}

export const ClickDirective: Directive = {
  mounted (el, binding) {
    const bindingOptions = ParseBinding(binding)
    let dispatch: (removeBinding: () => void) => void = () => bindingOptions.dispatch()

    switch (bindingOptions.modifier) {
      case Modifier.Once:
        dispatch = onceModifier(bindingOptions)
        break
      case Modifier.Throttle:
        dispatch = throttleModifier(bindingOptions)
        break
      case Modifier.Debounce:
        dispatch = debounceModifier(bindingOptions)
        break
    }

    const disableableDispatch: (removeBinding: () => void) => void = (removeBinding) => {
      if (el.disabled !== true) {
        dispatch(removeBinding)
      }
    }

    switch (bindingOptions.behavior) {
      case Behavior.Single:
        singleBehavior(el, bindingOptions, disableableDispatch)
        break
      case Behavior.Double:
        doubleBehavior(el, bindingOptions, disableableDispatch)
        break
      case Behavior.Hold:
        holdBehavior(el, bindingOptions, disableableDispatch)
        break
      case Behavior.Press:
        pressBehavior(el, bindingOptions, disableableDispatch)
        break
      case Behavior.Release:
        releaseBehavior(el, bindingOptions, disableableDispatch)
        break
    }
  }
}

export default {
  install: (app: any) => {
    app.directive('click', ClickDirective)
  }
}
