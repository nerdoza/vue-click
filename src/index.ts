import { DirectiveBinding, DirectiveOptions } from 'vue/types/options'
import { VueConstructor } from 'vue/types/vue'
import { TimeSearcher } from './time'

const defaultThrottleTimeout = 300

const throttleBinding = (el: HTMLElement, binding: DirectiveBinding) => {
  const throttleTime = TimeSearcher(binding.modifiers) ?? defaultThrottleTimeout
  const getNewThrottleId = () => setTimeout(() => { delete el.dataset.throttledState }, throttleTime).toString()

  el.addEventListener('click', (event) => {
    if (event.isTrusted) {
      if (typeof el.dataset.throttledState === 'undefined') {
        if (typeof binding?.value === 'function') {
          binding.value()
        }

        el.dataset.throttledState = getNewThrottleId()
      } else {
        clearTimeout(parseInt(el.dataset.throttledState, 10))
        el.dataset.throttledState = getNewThrottleId()
      }
    }
  }, true)
}

const defaultBinding = (el: HTMLElement, binding: DirectiveBinding) => {
  el.addEventListener('click', (event) => {
    if (event.isTrusted) {
      if (typeof binding?.value === 'function') {
        binding.value()
      }
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
