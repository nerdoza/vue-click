import { DirectiveBinding } from 'vue/types/options'
import { TimeParser, IsTime } from './time'

export enum Behavior {
  Single = 'single',
  Double = 'double'
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
  dispatch: Function | (() => void)
}

export const ParseBinding = (binding: DirectiveBinding) => {
  const result = {
    behavior: Behavior.Single,
    modifier: null,
    time: null,
    argument: null,
    dispatch: () => { return }
  } as BindingOptions

  for (let modKey in binding.modifiers) {
    const mods = modKey.split(':')
    if (mods[1]) {
      result.argument = mods[1]
    }

    if (IsTime(mods[0])) {
      result.time = TimeParser(mods[0])
    } else if (Object.values(Behavior).indexOf(mods[0] as Behavior) >= 0) {
      result.behavior = mods[0] as Behavior
    } else if (Object.values(Modifier).indexOf(mods[0] as Modifier) >= 0) {
      result.modifier = mods[0] as Modifier
    }
  }

  if (binding.arg) {
    result.argument = binding.arg
  }

  if (typeof binding.value === 'function') {
    result.dispatch = () => binding.value(result.argument)
  }

  return result
}
