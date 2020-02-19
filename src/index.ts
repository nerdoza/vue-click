import { DirectiveBinding, DirectiveOptions } from 'vue/types/options'
import { VueConstructor } from 'vue/types/vue'
import { TimeSearcher } from './time'

const throttledStateHandle = 'data-click-throttle-id'
const defaultThrottleTimeout = 300

const throttleBinding = (el: HTMLElement, binding: DirectiveBinding) => {
  const throttleTime = TimeSearcher(binding.modifiers) ?? defaultThrottleTimeout
  const getNewThrottleId = () => setTimeout(() => el.removeAttribute(throttledStateHandle), throttleTime).toString()

  el.addEventListener('click', (event) => {
    if (event.isTrusted) {
      const throttleState = el.getAttribute(throttledStateHandle)

      if (throttleState === null) {
        if (typeof binding?.value === 'function') {
          binding.value()
        }

        el.setAttribute(throttledStateHandle, getNewThrottleId())
      } else {
        clearTimeout(parseInt(throttleState, 10))
        el.setAttribute(throttledStateHandle, getNewThrottleId())
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
