import { DirectiveBinding, DirectiveOptions } from 'vue/types/options'
import { VueConstructor } from 'vue/types/vue'
import { TimeSearcher } from './time'

const defaultThrottleTimeout = 220
const defaultDebounceTimeout = 300

const throttleBinding = (el: HTMLElement, binding: DirectiveBinding) => {
  const throttleTime = TimeSearcher(binding.modifiers) ?? defaultThrottleTimeout
  let throttledState: number | null = null

  el.addEventListener('click', (event) => {
    if (event.isTrusted) {
      if (throttledState === null) {
        if (binding.value instanceof Function) {
          binding.value(binding.arg)
        }
      } else {
        clearTimeout(throttledState)
      }
      throttledState = window.setTimeout(() => { throttledState = null }, throttleTime)
    }
  }, true)
}

const debounceBinding = (el: HTMLElement, binding: DirectiveBinding) => {
  const debounceTime = TimeSearcher(binding.modifiers) ?? defaultDebounceTimeout
  let debouncedState: number | null = null

  el.addEventListener('click', (event) => {
    if (event.isTrusted) {
      if (debouncedState !== null) {
        clearTimeout(debouncedState)
      }

      debouncedState = window.setTimeout(() => {
        debouncedState = null
        if (binding.value instanceof Function) {
          binding.value(binding.arg)
        }
      }, debounceTime)
    }
  }, true)
}

const defaultBinding = (el: HTMLElement, binding: DirectiveBinding) => {
  el.addEventListener('click', (event) => {
    if (event.isTrusted && binding.value instanceof Function) {
      binding.value(binding.arg)
    }
  }, true)
}

export const ClickDirective: DirectiveOptions = {
  inserted (el, binding) {
    if (binding.modifiers?.throttle === true) {
      throttleBinding(el, binding)
    } else if (binding.modifiers?.debounce === true) {
      debounceBinding(el, binding)
    } else {
      defaultBinding(el, binding)
    }
  }
}

export default {
  install: (Vue: VueConstructor, options: {} = {}) => {
    Vue.directive('click', ClickDirective)
  }
}
