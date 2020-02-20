import { DirectiveOptions } from 'vue/types/options'
import { VueConstructor } from 'vue/types/vue'
import { ParseBinding, Behavior, BindingResult } from './binding'

const defaultThrottleTimeout = 220
const defaultDebounceTimeout = 300

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
  }, true)
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
  }, true)
}

const defaultBinding = (el: HTMLElement, binding: BindingResult) => {
  el.addEventListener('click', (event) => {
    if (event.isTrusted) {
      binding.dispatch()
    }
  }, true)
}

export const ClickDirective: DirectiveOptions = {
  inserted (el, binding) {
    const bindingResult = ParseBinding(binding)

    switch (bindingResult.behavior) {
      case Behavior.Throttle:
        throttleBinding(el, bindingResult)
        break
      case Behavior.Debounce:
        debounceBinding(el, bindingResult)
        break
      case Behavior.Default:
        defaultBinding(el, bindingResult)
        break
    }
  }
}

export default {
  install: (Vue: VueConstructor) => {
    Vue.directive('click', ClickDirective)
  }
}
