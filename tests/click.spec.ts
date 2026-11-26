import { test, expect, Locator, Page } from '@playwright/test'

/**
 * Drives `tests/page` with real input: vue-click ignores untrusted (scripted) events, so every press here goes through
 * Playwright's mouse and keyboard or through CDP `Input.dispatchTouchEvent`.
 */

interface PageState {
  bound: boolean
  useB: boolean
  showHold: boolean
  showDebounce: boolean
  altLabel: boolean
}

declare global {
  interface Window {
    calls: Array<{ id: string, arg: unknown }>
    state: PageState
    TimeParser: (time: string) => number | null
    windowMouseListeners: () => number
  }
}

interface Point {
  x: number
  y: number
}

interface TouchPoint extends Point {
  id: number
}

type Button = 'left' | 'right' | 'middle'

const center = async (locator: Locator): Promise<Point> => {
  const box = await locator.boundingBox()
  if (box === null) {
    throw new Error('element is not visible')
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** A point in the margin of an element with others inside it, clear of them. */
const margin = async (page: Page, testId: string): Promise<Point> => {
  const box = await page.getByTestId(testId).boundingBox()
  if (box === null) {
    throw new Error('element is not visible')
  }
  return { x: box.x + 6, y: box.y + 6 }
}

const callsOf = async (page: Page, id: string) => {
  return await page.evaluate((id) => window.calls.filter(call => call.id === id).map(call => call.arg), id)
}

/** Waits for `id` to have dispatched `expected`, then makes sure nothing else follows. */
const expectCalls = async (page: Page, id: string, expected: unknown[], settle = 150) => {
  await expect.poll(async () => await callsOf(page, id)).toEqual(expected)
  await page.waitForTimeout(settle)
  expect(await callsOf(page, id)).toEqual(expected)
}

/** Waits long enough for any timer to fire, then checks that `id` dispatched `expected`. */
const expectCallsAfter = async (page: Page, wait: number, id: string, expected: unknown[]) => {
  await page.waitForTimeout(wait)
  expect(await callsOf(page, id)).toEqual(expected)
}

const pointAt = async (page: Page, testId: string) => {
  const point = await center(page.getByTestId(testId))
  await page.mouse.move(point.x, point.y)
  return point
}

const click = async (page: Page, testId: string, button: Button = 'left') => {
  const point = await center(page.getByTestId(testId))
  await page.mouse.click(point.x, point.y, { button })
}

const pressFor = async (page: Page, testId: string, time: number, button: Button = 'left') => {
  await pointAt(page, testId)
  await page.mouse.down({ button })
  await page.waitForTimeout(time)
  await page.mouse.up({ button })
}

const finger = async (page: Page, testId: string, id = 1): Promise<TouchPoint> => {
  return { ...await center(page.getByTestId(testId)), id }
}

/**
 * Real touch input through CDP. `start` and `move` list every finger on the screen (a new id presses a new finger);
 * `end` lifts the fingers it lists, or all of them when it lists none.
 */
const touchscreen = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page)
  const send = async (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', touchPoints: TouchPoint[] = []) => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
  }

  return {
    start: async (...points: TouchPoint[]) => await send('touchStart', points),
    move: async (...points: TouchPoint[]) => await send('touchMove', points),
    end: async (...points: TouchPoint[]) => await send('touchEnd', points),
    cancel: async () => await send('touchCancel'),
    tap: async (point: TouchPoint) => {
      await send('touchStart', [point])
      await send('touchEnd')
    }
  }
}

/**
 * Counts the `mouseup` events from here on. A `touchend` that nothing cancels is followed by emulated mouse events, so
 * any count after a touch means v-click missed its `touchend`.
 */
const countMouseUps = async (page: Page) => {
  await page.evaluate(() => {
    Object.assign(window, { mouseUps: 0 })
    window.addEventListener('mouseup', () => { (window as unknown as { mouseUps: number }).mouseUps++ }, true)
  })
  return async () => await page.evaluate(() => (window as unknown as { mouseUps: number }).mouseUps)
}

const setState = async (page: Page, patch: Partial<PageState>) => {
  await page.evaluate(async (patch) => {
    Object.assign(window.state, patch)
    // Let Vue flush the re-render before the next input arrives.
    await new Promise(resolve => setTimeout(resolve, 0))
  }, patch)
}

/** Reloads the page reporting `platform` as `navigator.platform`. */
const onPlatform = async (page: Page, platform: string) => {
  await page.addInitScript((platform) => {
    Object.defineProperty(Navigator.prototype, 'platform', { get: () => platform })
  }, platform)
  await page.reload()
  await expect(page.getByTestId('single')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('single')).toBeVisible()
})

test.describe('behaviors', () => {
  test('single fires once for a mouse click and once for a tap', async ({ page }) => {
    await click(page, 'single')
    await expectCalls(page, 'single', [null])

    const touch = await touchscreen(page)
    await touch.tap(await finger(page, 'single'))
    await expectCalls(page, 'single', [null, null])
  })

  test('single passes its argument', async ({ page }) => {
    await click(page, 'singleArg')
    await expectCalls(page, 'singleArg', ['5'])
  })

  test('single fires when pressed and released on a child element', async ({ page }) => {
    await click(page, 'nestedLabel')
    await expectCalls(page, 'nested', [null])
  })

  test('single ignores a press held past the click window', async ({ page }) => {
    await pressFor(page, 'single', 500)
    await expectCallsAfter(page, 200, 'single', [])
  })

  test('double fires on two quick clicks only', async ({ page }) => {
    await click(page, 'double')
    await expectCallsAfter(page, 500, 'double', [])
    await click(page, 'double')
    await expectCallsAfter(page, 50, 'double', [])
    await click(page, 'double')
    await expectCalls(page, 'double', [null])
  })

  test('double.1s accepts a second click half a second later', async ({ page }) => {
    await click(page, 'double1s')
    await page.waitForTimeout(500)
    await click(page, 'double1s')
    await expectCalls(page, 'double1s', [null])
  })

  test('hold fires while held past its time, not on a short click', async ({ page }) => {
    await click(page, 'hold')
    await expectCallsAfter(page, 500, 'hold', [])

    await pointAt(page, 'hold')
    await page.mouse.down()
    await expect.poll(async () => await callsOf(page, 'hold')).toEqual([null])
    await page.mouse.up()

    const touch = await touchscreen(page)
    await touch.start(await finger(page, 'hold'))
    await expect.poll(async () => await callsOf(page, 'hold')).toEqual([null, null])
    await touch.end()
  })

  test('hold.1s waits a second', async ({ page }) => {
    await pointAt(page, 'hold1s')
    await page.mouse.down()
    await expectCallsAfter(page, 600, 'hold1s', [])
    await expect.poll(async () => await callsOf(page, 'hold1s')).toEqual([null])
    await page.mouse.up()
  })

  test('hold.500ms:40 passes its argument', async ({ page }) => {
    await pressFor(page, 'holdArg', 700)
    await expectCalls(page, 'holdArg', ['40'])
  })

  test('press fires on the way down', async ({ page }) => {
    await pointAt(page, 'press')
    await page.mouse.down()
    await expect.poll(async () => await callsOf(page, 'press')).toEqual([null])
    await page.mouse.up()

    const touch = await touchscreen(page)
    await touch.start(await finger(page, 'press'))
    await expect.poll(async () => await callsOf(page, 'press')).toEqual([null, null])
    await touch.end()
    await expectCalls(page, 'press', [null, null])
  })

  test('release fires on the way up', async ({ page }) => {
    await pointAt(page, 'release')
    await page.mouse.down()
    await expectCallsAfter(page, 100, 'release', [])
    await page.mouse.up()
    await expectCalls(page, 'release', [null])

    const touch = await touchscreen(page)
    await touch.start(await finger(page, 'release'))
    await expectCallsAfter(page, 100, 'release', [null])
    await touch.end()
    await expectCalls(page, 'release', [null, null])
  })

  test('once fires a single time, then marks the element deactivated', async ({ page }) => {
    const once = page.getByTestId('once')
    await expect(once).toHaveAttribute('data-vc-bind-click', 'once')
    await click(page, 'once')
    await click(page, 'once')
    await expectCalls(page, 'once', [null])
    await expect(once).not.toHaveAttribute('data-vc-bind-click')
    await expect(once).toHaveAttribute('data-vc-state-deactivated', '')
  })

  test('throttle fires the first click and restarts its interval on every click', async ({ page }) => {
    await click(page, 'throttle')
    await page.waitForTimeout(600)
    await click(page, 'throttle')
    await page.waitForTimeout(600)
    // A second and a quarter after the first click, but only 600ms after the last one.
    await click(page, 'throttle')
    await expectCallsAfter(page, 100, 'throttle', [null])
    await page.waitForTimeout(1200)
    await click(page, 'throttle')
    await expectCalls(page, 'throttle', [null, null])
  })

  test('throttle passes its argument', async ({ page }) => {
    await click(page, 'throttleArg')
    await expectCalls(page, 'throttleArg', ['open'])
  })

  test('debounce fires once after the clicks stop', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await click(page, 'debounce')
      await page.waitForTimeout(100)
    }
    expect(await callsOf(page, 'debounce')).toEqual([])
    await expectCalls(page, 'debounce', [null], 600)
  })

  test('a disabled element never fires', async ({ page }) => {
    await click(page, 'disabled')
    const touch = await touchscreen(page)
    await touch.tap(await finger(page, 'disabled'))
    await expectCallsAfter(page, 400, 'disabled', [])
  })

  test('time units parse to milliseconds', async ({ page }) => {
    const times = await page.evaluate(() => ['20', '20ms', '2s', '1m'].map(time => window.TimeParser(time)))
    expect(times).toEqual([20, 20, 2000, 60000])
  })

  test('data attributes mark the binding and the active state', async ({ page }) => {
    await expect(page.getByTestId('hold')).toHaveAttribute('data-vc-bind-hold', '')
    await expect(page.getByTestId('throttle')).toHaveAttribute('data-vc-bind-click', 'throttle')

    const release = page.getByTestId('release')
    await pointAt(page, 'release')
    await page.mouse.down()
    await expect(release).toHaveAttribute('data-vc-state-active', '')
    await page.mouse.up()
    await expect(release).not.toHaveAttribute('data-vc-state-active')
  })

  test('two directives on one element fire independently', async ({ page }) => {
    await click(page, 'combo')
    await expectCalls(page, 'comboSingle', [null])
    await pressFor(page, 'combo', 700)
    await expectCalls(page, 'comboHold', [null])
    expect(await callsOf(page, 'comboSingle')).toEqual([null])
  })
})

test.describe('primary mouse button only', () => {
  for (const button of ['right', 'middle'] as const) {
    test(`a ${button} click fires nothing`, async ({ page }) => {
      for (const id of ['single', 'double', 'press', 'release']) {
        await click(page, id, button)
        await click(page, id, button)
      }
      await pressFor(page, 'hold', 500, button)
      await page.waitForTimeout(400)
      for (const id of ['single', 'double', 'hold', 'press', 'release']) {
        expect(await callsOf(page, id), id).toEqual([])
      }
    })
  }

  test('a right press does not set the active state', async ({ page }) => {
    await pointAt(page, 'single')
    await page.mouse.down({ button: 'right' })
    expect(await page.getByTestId('single').getAttribute('data-vc-state-active')).toBeNull()
    await page.mouse.up({ button: 'right' })
  })

  test('on macOS a Control-click is the secondary click and fires nothing', async ({ page }) => {
    await onPlatform(page, 'MacIntel')
    await page.keyboard.down('Control')
    for (const id of ['single', 'double', 'press', 'release']) {
      await click(page, id)
      await click(page, id)
    }
    await pointAt(page, 'hold')
    await page.mouse.down()
    expect(await page.getByTestId('hold').getAttribute('data-vc-state-active')).toBeNull()
    await page.waitForTimeout(500)
    await page.mouse.up()
    await page.keyboard.up('Control')
    await page.waitForTimeout(400)
    for (const id of ['single', 'double', 'hold', 'press', 'release']) {
      expect(await callsOf(page, id), id).toEqual([])
    }

    await click(page, 'single')
    await expectCalls(page, 'single', [null])
  })

  test('elsewhere a Control-click is a primary click', async ({ page }) => {
    await onPlatform(page, 'Win32')
    await page.keyboard.down('Control')
    await click(page, 'single')
    await click(page, 'press')
    await page.keyboard.up('Control')
    await expectCalls(page, 'single', [null])
    expect(await callsOf(page, 'press')).toEqual([null])
  })
})

test.describe('movement tolerance', () => {
  test('a mouse drag released on the element is not a click', async ({ page }) => {
    const { x, y } = await pointAt(page, 'single')
    await page.mouse.down()
    await page.mouse.move(x + 40, y, { steps: 4 })
    await page.mouse.up()
    await expectCallsAfter(page, 400, 'single', [])
  })

  test('a swipe is not a tap', async ({ page }) => {
    const touch = await touchscreen(page)
    const start = await finger(page, 'single')
    await touch.start(start)
    for (const dx of [10, 20, 30, 40]) {
      await touch.move({ ...start, x: start.x + dx })
    }
    await touch.end()
    await expectCallsAfter(page, 400, 'single', [])
  })

  test('a hold is cancelled once the pointer slides away', async ({ page }) => {
    const { x, y } = await pointAt(page, 'hold')
    await page.mouse.down()
    await page.mouse.move(x + 40, y, { steps: 4 })
    await expectCallsAfter(page, 500, 'hold', [])
    await page.mouse.up()

    const touch = await touchscreen(page)
    const start = await finger(page, 'hold')
    await touch.start(start)
    await touch.move({ ...start, x: start.x + 20 })
    await touch.move({ ...start, x: start.x + 40 })
    await expectCallsAfter(page, 500, 'hold', [])
    await touch.end()
  })

  test('double ignores a dragged second click', async ({ page }) => {
    await click(page, 'double')
    const { x, y } = await pointAt(page, 'double')
    await page.mouse.down()
    await page.mouse.move(x + 40, y, { steps: 4 })
    await page.mouse.up()
    await expectCallsAfter(page, 400, 'double', [])
  })

  test('movement within the tolerance still clicks', async ({ page }) => {
    const { x, y } = await pointAt(page, 'single')
    await page.mouse.down()
    await page.mouse.move(x + 5, y + 3, { steps: 2 })
    await page.mouse.up()
    await expectCalls(page, 'single', [null])

    const touch = await touchscreen(page)
    const start = await finger(page, 'single')
    await touch.start(start)
    await touch.move({ ...start, x: start.x + 5, y: start.y + 3 })
    await touch.end()
    await expectCalls(page, 'single', [null, null])
  })
})

test.describe('multi-touch', () => {
  test('a second finger on a hold cancels it', async ({ page }) => {
    const touch = await touchscreen(page)
    const first = await finger(page, 'hold', 1)
    await touch.start(first)
    await touch.start(first, { x: first.x + 30, y: first.y, id: 2 })
    await touch.end()
    await expectCallsAfter(page, 500, 'hold', [])
    await expect(page.getByTestId('hold')).not.toHaveAttribute('data-vc-state-active')
  })

  test('a second finger on a tap cancels it', async ({ page }) => {
    const touch = await touchscreen(page)
    const first = await finger(page, 'single', 1)
    await touch.start(first)
    await touch.start(first, { x: first.x + 30, y: first.y, id: 2 })
    await touch.end()
    await expectCallsAfter(page, 400, 'single', [])
  })

  test('holding one element does not interrupt a tap on another', async ({ page }) => {
    const touch = await touchscreen(page)
    const a = await finger(page, 'tileA', 1)
    const b = await finger(page, 'tileB', 2)
    await touch.start(a)
    await touch.start(a, b)
    await touch.end(b)
    await expectCalls(page, 'tileB', [null])
    await expect.poll(async () => await callsOf(page, 'tileA')).toEqual([null])
    await touch.end()
  })
})

// Re-rendering the touched child mid-press sends the rest of the touch to the detached node, which never reaches the
// element on its own.
test.describe('content re-rendered mid-press', () => {
  test('a tap still clicks, and so does the next one', async ({ page }) => {
    const touch = await touchscreen(page)
    await touch.start(await finger(page, 'relabelLabel'))
    await setState(page, { altLabel: true })
    await touch.end()
    await expectCalls(page, 'relabel', [null])
    await touch.tap(await finger(page, 'relabel'))
    await expectCalls(page, 'relabel', [null, null])
  })

  test('a hold released early never fires and clears the active state', async ({ page }) => {
    const relabelHold = page.getByTestId('relabelHold')
    const touch = await touchscreen(page)
    await touch.start(await finger(page, 'relabelHoldLabel'))
    await setState(page, { altLabel: true })
    await expect(relabelHold).toHaveAttribute('data-vc-state-active', '')
    await page.waitForTimeout(300)
    await touch.end()
    await expect(relabelHold).not.toHaveAttribute('data-vc-state-active')
    await expectCallsAfter(page, 1000, 'relabelHold', [])
  })

  test('a release still fires, from the touch itself', async ({ page }) => {
    const mouseUps = await countMouseUps(page)
    const touch = await touchscreen(page)
    await touch.start(await finger(page, 'relabelReleaseLabel'))
    await setState(page, { altLabel: true })
    await touch.end()
    await expectCalls(page, 'relabelRelease', [null])
    expect(await mouseUps()).toBe(0)
  })
})

test.describe('release on touch', () => {
  // CDP lifts each finger in a touchend of its own. (Fingers lifted in one touchend are one release, which CDP can't
  // send.)
  test('each finger lifted is a release', async ({ page }) => {
    const touch = await touchscreen(page)
    const first = await finger(page, 'release', 1)
    await touch.start(first)
    await touch.start(first, { x: first.x + 30, y: first.y, id: 2 })
    await touch.end()
    await expectCalls(page, 'release', [null, null])
  })

  test('a scripted touchend does not stop a touch from releasing', async ({ page }) => {
    await page.evaluate(() => {
      const release = document.querySelector('[data-testid="release"]')
      release?.addEventListener('touchstart', (event) => {
        Object.assign(window, { touchId: (event as TouchEvent).changedTouches[0].identifier })
      }, { capture: true, once: true })
    })
    const mouseUps = await countMouseUps(page)
    const touch = await touchscreen(page)
    await touch.start(await finger(page, 'release'))
    await page.evaluate(() => {
      const release = document.querySelector('[data-testid="release"]') as HTMLElement
      const identifier = (window as unknown as { touchId: number }).touchId
      const changedTouches = [new Touch({ identifier, target: release })]
      release.dispatchEvent(new TouchEvent('touchend', { changedTouches, bubbles: true, cancelable: true }))
    })
    await touch.end()
    await expectCalls(page, 'release', [null])
    expect(await mouseUps()).toBe(0)
  })
})

test.describe('cancel and release outside', () => {
  test('touchcancel cancels a hold and clears the active state', async ({ page }) => {
    const hold = page.getByTestId('hold')
    const touch = await touchscreen(page)
    await touch.start(await finger(page, 'hold'))
    await expect(hold).toHaveAttribute('data-vc-state-active', '')
    await touch.cancel()
    await expect(hold).not.toHaveAttribute('data-vc-state-active')
    await expectCallsAfter(page, 500, 'hold', [])
  })

  test('a mouse release just outside the element cancels a hold and clears the active state', async ({ page }) => {
    const tiny = page.getByTestId('tiny')
    const { x, y } = await pointAt(page, 'tiny')
    await page.mouse.down()
    await expect(tiny).toHaveAttribute('data-vc-state-active', '')
    // Off the 8px element, yet still within the movement tolerance.
    await page.mouse.move(x + 7, y, { steps: 2 })
    await page.mouse.up()
    await expect(tiny).not.toHaveAttribute('data-vc-state-active')
    await expectCallsAfter(page, 500, 'tiny', [])
  })

  test('a mouse release far from the element clears the active state', async ({ page }) => {
    const single = page.getByTestId('single')
    const { x, y } = await pointAt(page, 'single')
    await page.mouse.down()
    await page.mouse.move(x, y + 300, { steps: 4 })
    await page.mouse.up()
    await expect(single).not.toHaveAttribute('data-vc-state-active')
    await expectCallsAfter(page, 400, 'single', [])
  })
})

// A cancelled touchend means the browser generates no click for a tap; mouse clicks match by having their action
// cancelled.
test.describe('the browser\'s click action', () => {
  const hash = async (page: Page) => await page.evaluate(() => location.hash)

  test('a mouse click does not submit a form or follow a link', async ({ page }) => {
    await click(page, 'formSingle')
    await click(page, 'formHold')
    await click(page, 'link')
    await expectCalls(page, 'formSingle', [null])
    await expectCalls(page, 'link', [null])
    expect(await callsOf(page, 'formHold')).toEqual([])
    expect(await callsOf(page, 'formSubmit')).toEqual([])
    expect(await hash(page)).toBe('')
  })

  test('nor does a tap', async ({ page }) => {
    const touch = await touchscreen(page)
    await touch.tap(await finger(page, 'formSingle'))
    await touch.tap(await finger(page, 'formHold'))
    await touch.tap(await finger(page, 'link'))
    await expectCalls(page, 'formSingle', [null])
    await expectCalls(page, 'link', [null])
    expect(await callsOf(page, 'formSubmit')).toEqual([])
    expect(await hash(page)).toBe('')
  })

  test('nor the mouse press that fires a once, though the next click, unbound, does', async ({ page }) => {
    await page.evaluate(() => {
      const prevented: boolean[] = []
      Object.assign(window, { prevented })
      document.querySelector('[data-testid="once"]')?.addEventListener('click', event => { prevented.push(event.defaultPrevented) })
    })
    await click(page, 'once')
    await click(page, 'once')
    await expectCalls(page, 'once', [null])
    expect(await page.evaluate(() => (window as unknown as { prevented: boolean[] }).prevented)).toEqual([true, false])
  })

  test('a keyboard click right after a mouse click keeps its action', async ({ page }) => {
    await click(page, 'formHold')
    await page.getByTestId('formHold').focus()
    await page.keyboard.press('Enter')
    await expectCalls(page, 'formSubmit', [null])
  })

  // Chromium dispatches no click for this press at all, so here the test only pins the result; the guard also waits
  // for the primary button's own release for browsers that do.
  test('another button pressed and released meanwhile does not end the mouse press', async ({ page }) => {
    await pointAt(page, 'formHold')
    await page.mouse.down()
    await page.mouse.down({ button: 'right' })
    await page.mouse.up({ button: 'right' })
    await page.waitForTimeout(700)
    await page.mouse.up()
    await expectCalls(page, 'formHold', [null])
    expect(await callsOf(page, 'formSubmit')).toEqual([])
  })

  test('keyboard activation keeps it', async ({ page }) => {
    await page.getByTestId('formSingle').focus()
    await page.keyboard.press('Enter')
    await expectCalls(page, 'formSingle', [null])
    await expectCalls(page, 'formSubmit', [null])
  })
})

test.describe('nested elements', () => {
  test('a press on a v-click inside another fires both', async ({ page }) => {
    await click(page, 'inner')
    const touch = await touchscreen(page)
    await touch.tap(await finger(page, 'inner'))
    await expectCalls(page, 'inner', [null, null])
    await expectCalls(page, 'outer', [null, null])
  })

  test('stop keeps keyboard, mouse and touch input from the v-click around it', async ({ page }) => {
    // Keyboard first: a click just after a pointer press on the element counts as that press's own.
    await page.getByTestId('innerStop').focus()
    await page.keyboard.press('Enter')
    await click(page, 'innerStopLabel')
    const touch = await touchscreen(page)
    await touch.tap(await finger(page, 'innerStopLabel'))
    await expectCalls(page, 'innerStop', [null, null, null])
    expect(await callsOf(page, 'outer')).toEqual([])
  })

  test('the element around a stop is not marked active by its presses', async ({ page }) => {
    const outer = page.getByTestId('outer')
    await pointAt(page, 'innerStop')
    await page.mouse.down()
    await expect(page.getByTestId('innerStop')).toHaveAttribute('data-vc-state-active', '')
    await expect(outer).not.toHaveAttribute('data-vc-state-active')
    await page.mouse.up()
  })

  test('stop combines with a behavior', async ({ page }) => {
    // A short click is no hold, and the stop keeps it from the outer click.
    await click(page, 'innerHoldStop')
    await pressFor(page, 'innerHoldStop', 500)
    await expectCalls(page, 'innerHoldStop', [null])
    expect(await callsOf(page, 'outer')).toEqual([])
  })

  test('the element around still gets its own presses', async ({ page }) => {
    const { x, y } = await margin(page, 'outer')
    await page.mouse.click(x, y)
    await expectCalls(page, 'outer', [null])
  })

  test('a finger held on a stop does not cancel a tap on the element around it', async ({ page }) => {
    const touch = await touchscreen(page)
    const held = await finger(page, 'innerStop', 1)
    const tap = { ...await margin(page, 'outer'), id: 2 }
    await touch.start(held)
    await touch.start(held, tap)
    await touch.end(tap)
    await expectCalls(page, 'outer', [null])
    await touch.end()
  })

  test('a keyboard click right after a press on a stop still reaches the element around', async ({ page }) => {
    await click(page, 'innerStop')
    await page.getByTestId('inner').focus()
    await page.keyboard.press('Enter')
    await expectCalls(page, 'inner', [null])
    await expectCalls(page, 'outer', [null])
  })

  test('a press that starts on a stop never releases the element around it', async ({ page }) => {
    // Released over the element around it, outside the stop.
    await pointAt(page, 'releaseStopChild')
    await page.mouse.down()
    const { x, y } = await margin(page, 'outerRelease')
    await page.mouse.move(x, y, { steps: 4 })
    await page.mouse.up()
    // Released on a press.once.stop, whose claim ends as it fires on the way down.
    await pressFor(page, 'pressOnceStopChild', 50)
    await expectCalls(page, 'pressOnceStopChild', [null])
    await expectCallsAfter(page, 100, 'outerRelease', [])
  })
})

test.describe('handler errors', () => {
  test('reach the app\'s errorHandler, thrown or rejected, as with v-on', async ({ page }) => {
    const uncaught: string[] = []
    page.on('pageerror', error => uncaught.push(error.message))
    await click(page, 'throws')
    await click(page, 'rejects')
    await expectCalls(page, 'errorHandler', ['thrown', 'rejected'])
    expect(uncaught).toEqual([])
  })
})

test.describe('keyboard and assistive tech', () => {
  test('Enter and Space each activate a single v-click once', async ({ page }) => {
    await page.getByTestId('single').focus()
    await page.keyboard.press('Enter')
    await expectCalls(page, 'single', [null])
    await page.keyboard.press('Space')
    await expectCalls(page, 'single', [null, null])
  })

  test('a keyboard click passes the argument and goes through the modifier', async ({ page }) => {
    await page.getByTestId('singleArg').focus()
    await page.keyboard.press('Enter')
    await expectCalls(page, 'singleArg', ['5'])

    await page.getByTestId('throttle').focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expectCalls(page, 'throttle', [null])
  })

  test('double and hold stay pointer gestures', async ({ page }) => {
    await page.getByTestId('double').focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.getByTestId('hold').focus()
    await page.keyboard.press('Enter')
    await expectCallsAfter(page, 500, 'double', [])
    expect(await callsOf(page, 'hold')).toEqual([])
  })
})

test.describe('unmount', () => {
  test('a hold pressed as its element unmounts never fires and leaves no window listeners', async ({ page }) => {
    const windowMouseListeners = async () => await page.evaluate(() => window.windowMouseListeners())
    await pointAt(page, 'unmountHold')
    // Taken after the first locator call, which installs Playwright's own window listeners.
    const baseline = await windowMouseListeners()
    await page.mouse.down()
    const pressing = await windowMouseListeners()
    await setState(page, { showHold: false })
    await expect(page.getByTestId('unmountHold')).toHaveCount(0)
    await expectCallsAfter(page, 500, 'unmountHold', [])
    await page.mouse.up()
    expect(pressing).toBeGreaterThan(baseline)
    expect(await windowMouseListeners()).toBe(baseline)
  })

  test('a pending debounce never fires after its element unmounts', async ({ page }) => {
    await click(page, 'unmountDebounce')
    await setState(page, { showDebounce: false })
    await expectCallsAfter(page, 800, 'unmountDebounce', [])
  })
})

test.describe('binding updates', () => {
  test('a handler bound after mount fires, and stops once unbound', async ({ page }) => {
    await click(page, 'bound')
    await expectCallsAfter(page, 100, 'bound', [])
    await setState(page, { bound: true })
    await click(page, 'bound')
    await expectCalls(page, 'bound', [null])
    await setState(page, { bound: false })
    await click(page, 'bound')
    await expectCallsAfter(page, 100, 'bound', [null])
  })

  test('a re-bound handler replaces the old one', async ({ page }) => {
    await click(page, 'swap')
    await expectCalls(page, 'swapA', [null])
    await setState(page, { useB: true })
    await click(page, 'swap')
    await expectCalls(page, 'swapB', [null])
    expect(await callsOf(page, 'swapA')).toEqual([null])
  })
})

test.describe('press.once', () => {
  test('fires once for repeated taps', async ({ page }) => {
    const touch = await touchscreen(page)
    const point = await finger(page, 'pressOnce')
    await touch.tap(point)
    await touch.tap(point)
    await expectCalls(page, 'pressOnce', [null])
  })

  test('fires once for repeated clicks', async ({ page }) => {
    await click(page, 'pressOnce')
    await click(page, 'pressOnce')
    await expectCalls(page, 'pressOnce', [null])
  })
})
