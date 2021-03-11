import { Directive } from 'vue'
import { ParseBinding, Behavior, Modifier, BindingOptions } from './binding'

const defaultEventTimeout = 300
const dataBindingPrefix = 'vcBind'

const singleBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const dataBinding = dataBindingPrefix + 'Click'
  const clickTimeout = defaultEventTimeout
  let clickState: number | null = null

  const eventCallback = (event: MouseEvent | TouchEvent) => {
    if (event.isTrusted) {
      event.preventDefault()

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
          el.removeEventListener('touchstart', eventCallback)
          el.removeEventListener('touchend', eventCallback)
          el.removeEventListener('mousedown', eventCallback)
          el.removeEventListener('mouseup', eventCallback)
          delete (el.dataset[dataBinding])
        })
      }
    }
  }

  el.addEventListener('touchstart', eventCallback)
  el.addEventListener('touchend', eventCallback)
  el.addEventListener('mousedown', eventCallback)
  el.addEventListener('mouseup', eventCallback)
  el.dataset[dataBinding] = bindingOptions.modifier ?? ''
}

const doubleBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const dataBinding = dataBindingPrefix + 'Double'
  const clickTimeout = defaultEventTimeout
  const doubleClickTimeout = bindingOptions.time ?? defaultEventTimeout
  let clickState: number | null = null
  let clickCount: number = 0

  const eventCallback = (event: MouseEvent | TouchEvent) => {
    if (event.isTrusted) {
      event.preventDefault()

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
            el.removeEventListener('touchstart', eventCallback)
            el.removeEventListener('touchend', eventCallback)
            el.removeEventListener('mousedown', eventCallback)
            el.removeEventListener('mouseup', eventCallback)
            delete (el.dataset[dataBinding])
          })
        }
      }
    }
  }

  el.addEventListener('touchstart', eventCallback)
  el.addEventListener('touchend', eventCallback)
  el.addEventListener('mousedown', eventCallback)
  el.addEventListener('mouseup', eventCallback)
  el.dataset[dataBinding] = bindingOptions.modifier ?? ''
}

const holdBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const dataBinding = dataBindingPrefix + 'Hold'
  const holdTimeout = bindingOptions.time ?? defaultEventTimeout
  let holdState: number | null = null

  const eventCallback = (event: MouseEvent | TouchEvent) => {
    if (event.isTrusted) {
      event.preventDefault()

      if (event.type === 'mousedown' || event.type === 'touchstart') {
        holdState = window.setTimeout(() => {
          onEvent(() => {
            el.removeEventListener('touchstart', eventCallback)
            el.removeEventListener('touchend', eventCallback)
            el.removeEventListener('mousedown', eventCallback)
            el.removeEventListener('mouseup', eventCallback)
            delete (el.dataset[dataBinding])
          })
        }, holdTimeout)
      } else if ((event.type === 'mouseup' || event.type === 'touchend') && holdState !== null) {
        clearTimeout(holdState)
        holdState = null
      }
    }
  }

  el.addEventListener('touchstart', eventCallback)
  el.addEventListener('touchend', eventCallback)
  el.addEventListener('mousedown', eventCallback)
  el.addEventListener('mouseup', eventCallback)
  el.dataset[dataBinding] = bindingOptions.modifier ?? ''
}

const pressBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const dataBinding = dataBindingPrefix + 'Press'
  const eventCallback = (event: MouseEvent | TouchEvent) => {
    if (event.isTrusted) {
      event.preventDefault()

      onEvent(() => {
        el.removeEventListener('touchend', eventCallback)
        el.removeEventListener('mousedown', eventCallback)
        delete (el.dataset[dataBinding])
      })
    }
  }

  el.addEventListener('touchstart', eventCallback)
  el.addEventListener('mousedown', eventCallback)
  el.dataset[dataBinding] = bindingOptions.modifier ?? ''
}

const releaseBehavior = (el: HTMLElement, bindingOptions: BindingOptions, onEvent: (removeBinding: () => void) => void) => {
  const dataBinding = dataBindingPrefix + 'Release'
  const eventCallback = (event: MouseEvent | TouchEvent) => {
    if (event.isTrusted) {
      event.preventDefault()
      onEvent(() => {
        el.removeEventListener('touchend', eventCallback)
        el.removeEventListener('mouseup', eventCallback)
        delete (el.dataset[dataBinding])
      })
    }
  }

  el.addEventListener('touchend', eventCallback)
  el.addEventListener('mouseup', eventCallback)
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
      case Behavior.Press:
        pressBehavior(el, bindingOptions, dispatch)
        break
      case Behavior.Release:
        releaseBehavior(el, bindingOptions, dispatch)
        break
    }
  }
}

export default {
  install: (app: any) => {
    app.directive('click', ClickDirective)
  }
}
