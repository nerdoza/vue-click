import { callWithAsyncErrorHandling, type ComponentPublicInstance, type DirectiveBinding, type ErrorCodes } from 'vue'
import { TimeParser, IsTime } from './time'

/**
 * `ErrorCodes.NATIVE_EVENT_HANDLER`, the code `v-on` reports handler errors under. Spelled out because `ErrorCodes` is
 * a const enum, with no value at runtime, before Vue 3.4.
 */
const nativeEventHandler = 5 as ErrorCodes.NATIVE_EVENT_HANDLER

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
  /** What's wrong with the modifiers, if anything, for a warning when the directive mounts. */
  problems: string[]
}

/** Notes a problem when a kind of modifier was given more than once: only the last one applies. */
const checkOne = (problems: string[], kind: string, given: string[]) => {
  if (given.length > 1) {
    problems.push(`more than one ${kind} (${given.join(', ')}); only "${given[given.length - 1]}" applies`)
  }
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
    dispatch: () => { },
    problems: []
  }
  const given = { times: [] as string[], behaviors: [] as string[], modifiers: [] as string[] }

  for (const modKey in binding.modifiers) {
    const mods = modKey.split(':')
    if (typeof mods[1] !== 'undefined') {
      result.argument = mods[1]
    }

    if (IsTime(mods[0])) {
      result.time = TimeParser(mods[0])
      given.times.push(mods[0])
    } else if (enumHasValue(Behavior, mods[0])) {
      result.behavior = mods[0] as Behavior
      given.behaviors.push(mods[0])
    } else if (enumHasValue(Modifier, mods[0])) {
      result.modifier = mods[0] as Modifier
      given.modifiers.push(mods[0])
    } else if (mods[0] === 'stop') {
      result.stop = true
    } else {
      result.problems.push(`unknown modifier "${mods[0]}", which is ignored`)
    }
  }
  checkOne(result.problems, 'behavior', given.behaviors)
  checkOne(result.problems, 'modifier', given.modifiers)
  checkOne(result.problems, 'time', given.times)

  if (typeof binding.arg !== 'undefined') {
    result.argument = binding.arg
  }

  if (typeof binding.value === 'function') {
    const handler: Function = binding.value
    const instance = (binding.instance as ComponentPublicInstance | null)?.$ ?? null
    // Like a `v-on` handler: what it throws or rejects with goes to `onErrorCaptured` and `app.config.errorHandler`.
    result.dispatch = () => callWithAsyncErrorHandling(handler, instance, nativeEventHandler, [result.argument])
  }

  return result
}
