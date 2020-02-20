import { DirectiveBinding, DirectiveOptions } from 'vue/types/options'
import { VueConstructor } from 'vue/types/vue'
import { TimeSearcher } from './time'

const defaultThrottleTimeout = 220

const throttleBinding = (el: HTMLElement, binding: DirectiveBinding) => {
  const throttleTime = TimeSearcher(binding.modifiers) ?? defaultThrottleTimeout
  let toggledState: number | null = null

  const setThrottledState = () => {
    toggledState = window.setTimeout(() => { toggledState = null }, throttleTime)
  }

  el.addEventListener('click', (event) => {
    if (event.isTrusted) {
      if (toggledState === null) {
        if (binding.value instanceof Function) {
          binding.value()
        }
      } else {
        clearTimeout(toggledState)
      }
      setThrottledState()
    }
  }, true)
}

const defaultBinding = (el: HTMLElement, binding: DirectiveBinding) => {
  el.addEventListener('click', (event) => {
    if (event.isTrusted && binding.value instanceof Function) {
      binding.value()
    }
  }, true)
}

const clickDirective: DirectiveOptions = {
  inserted (el, binding) {
    if (binding.modifiers?.throttle === true) {
      throttleBinding(el, binding)
    } else {
      defaultBinding(el, binding)
    }
  }
}

export default {
  install: (Vue: VueConstructor, options: {} = {}) => {
    Vue.directive('click', clickDirective)
  }
}
