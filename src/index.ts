import { DirectiveOptions } from 'vue/types/options'
import { VueConstructor } from 'vue/types/vue'
import { ParseBinding, Behavior, BindingResult } from './binding'

const defaultThrottleTimeout = 220
const defaultDebounceTimeout = 300
const defaultDoubleClickTimeout = 300

const defaultBinding = (el: HTMLElement, binding: BindingResult) => {
  el.addEventListener('click', (event) => {
    if (event.isTrusted) {
      binding.dispatch()
    }
  }, { once: binding.once })
}

const throttleBinding = (el: HTMLElement, binding: BindingResult) => {
  const throttleTime = binding.time ?? defaultThrottleTimeout
  let throttledState: number | null = null

  el.addEventListener('click', (event) => {
    if (event.isTrusted) {
      if (throttledState === null) {
        binding.dispatch()
      } else {
        clearTimeout(throttledState)
      }
      throttledState = window.setTimeout(() => { throttledState = null }, throttleTime)
    }
  }, { once: binding.once })
}

const debounceBinding = (el: HTMLElement, binding: BindingResult) => {
  const debounceTime = binding.time ?? defaultDebounceTimeout
  let debouncedState: number | null = null

  el.addEventListener('click', (event) => {
    if (event.isTrusted) {
      if (debouncedState !== null) {
        clearTimeout(debouncedState)
      }

      debouncedState = window.setTimeout(() => {
        debouncedState = null
        binding.dispatch()
      }, debounceTime)
    }
  }, { once: binding.once })
}

const doubleClickBinding = (el: HTMLElement, binding: BindingResult) => {
  const doubleClickTimeout = binding.time ?? defaultDoubleClickTimeout
  let doubleClickState: number | null = null

  const onEvent = (event: MouseEvent) => {
    if (event.isTrusted) {
      if (doubleClickState) {
        clearTimeout(doubleClickState)
        doubleClickState = null
        if (binding.once) {
          el.removeEventListener('click', onEvent)
        }
        binding.dispatch()
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

  el.addEventListener('click', onEvent)
}

export const ClickDirective: DirectiveOptions = {
  inserted (el, binding) {
    const bindingResult = ParseBinding(binding)

    switch (bindingResult.behavior) {
      case Behavior.Default:
        defaultBinding(el, bindingResult)
        break
      case Behavior.Throttle:
        throttleBinding(el, bindingResult)
        break
      case Behavior.Debounce:
        debounceBinding(el, bindingResult)
        break
      case Behavior.Double:
        doubleClickBinding(el, bindingResult)
        break
    }
  }
}

export default {
  install: (Vue: VueConstructor) => {
    Vue.directive('click', ClickDirective)
  }
}
