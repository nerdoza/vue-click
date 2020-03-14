import { DirectiveOptions } from 'vue/types/options'
import { VueConstructor } from 'vue/types/vue'
import { ParseBinding, Behavior, Modifier, BindingOptions } from './binding'

const defaultEventTimeout = 300

const singleBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const eventCallback = (event: MouseEvent) => {
    if (event.isTrusted) {
      onEvent(() => {
        el.removeEventListener('click', eventCallback)
      })
    }
  }

  el.addEventListener('click', eventCallback)
}

const doubleBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const doubleClickTimeout = bindingOptions.time ?? defaultEventTimeout
  let doubleClickState: number | null = null

  const eventCallback = (event: MouseEvent) => {
    if (event.isTrusted) {
      if (doubleClickState) {
        clearTimeout(doubleClickState)
        doubleClickState = null

        onEvent(() => {
          el.removeEventListener('click', eventCallback)
        })
      } else {
        doubleClickState = window.setTimeout(() => {
          if (doubleClickState) {
            clearTimeout(doubleClickState)
            doubleClickState = null
          }
        }, doubleClickTimeout)
      }
    }
  }

  el.addEventListener('click', eventCallback)
}

const holdBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const holdTimeout = bindingOptions.time ?? defaultEventTimeout
  let holdState: number | null = null

  const eventCallback = (event: MouseEvent) => {
    if (event.isTrusted) {
      if (event.type === 'mousedown') {
        holdState = window.setTimeout(() => {
          onEvent(() => {
            el.removeEventListener('mousedown', eventCallback)
            el.removeEventListener('mouseup', eventCallback)
          })
        }, holdTimeout)
      } else if (event.type === 'mouseup' && holdState) {
        clearTimeout(holdState)
        holdState = null
      }
    }
  }

  el.addEventListener('mousedown', eventCallback)
  el.addEventListener('mouseup', eventCallback)
}

const startBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const eventCallback = (event: MouseEvent) => {
    if (event.isTrusted) {
      onEvent(() => {
        el.removeEventListener('mousedown', eventCallback)
      })
    }
  }

  el.addEventListener('mousedown', eventCallback)
}

const stopBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const eventCallback = (event: MouseEvent) => {
    if (event.isTrusted) {
      onEvent(() => {
        el.removeEventListener('mouseup', eventCallback)
      })
    }
  }

  el.addEventListener('mouseup', eventCallback)
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

export const ClickDirective: DirectiveOptions = {
  inserted (el, binding) {
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

    switch (bindingOptions.behavior) {
      case Behavior.Single:
        singleBehavior(el, bindingOptions, dispatch)
        break
      case Behavior.Double:
        doubleBehavior(el, bindingOptions, dispatch)
        break
      case Behavior.Hold:
        holdBehavior(el, bindingOptions, dispatch)
        break
      case Behavior.Start:
        startBehavior(el, bindingOptions, dispatch)
        break
      case Behavior.Stop:
        stopBehavior(el, bindingOptions, dispatch)
        break
    }
  }
}

export default {
  install: (Vue: VueConstructor) => {
    Vue.directive('click', ClickDirective)
  }
}
