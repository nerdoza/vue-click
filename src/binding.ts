import { DirectiveBinding } from 'vue'
import { TimeParser, IsTime } from './time'

export enum Behavior {
  Single = 'single',
  Double = 'double',
  Hold = 'hold',
  Press = 'press',
  Release = 'release'
}

export enum Modifier {
  Once = 'once',
  Throttle = 'throttle',
  Debounce = 'debounce'
}

export interface BindingOptions {
  behavior: Behavior
  modifier: Modifier | null
  time: number | null
  argument: string | null
  once: boolean
  /** Claim the input that starts inside the element, so v-click on the elements around it ignores it. */
  stop: boolean
  dispatch: Function | (() => void)
}

const enumHasValue = (enumerator: object, value: string) => {
  return Object.keys(enumerator).filter(key => Object(enumerator)[key] === value).length > 0
}

export const ParseBinding = (binding: DirectiveBinding) => {
  const result: BindingOptions = {
    behavior: Behavior.Single,
    modifier: null,
    time: null,
    argument: null,
    once: false,
    stop: false,
    dispatch: () => { }
  }

  for (const modKey in binding.modifiers) {
    const mods = modKey.split(':')
    if (typeof mods[1] !== 'undefined') {
      result.argument = mods[1]
    }

    if (IsTime(mods[0])) {
      result.time = TimeParser(mods[0])
    } else if (enumHasValue(Behavior, mods[0])) {
      result.behavior = mods[0] as Behavior
    } else if (enumHasValue(Modifier, mods[0])) {
      result.modifier = mods[0] as Modifier
    } else if (mods[0] === 'stop') {
      result.stop = true
    }
  }

  if (typeof binding.arg !== 'undefined') {
    result.argument = binding.arg
  }

  if (typeof binding.value === 'function') {
    result.dispatch = () => binding.value(result.argument)
  }

  return result
}
