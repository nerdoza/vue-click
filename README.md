# Vue Click
[![Publish](https://github.com/nerdoza/vue-click/actions/workflows/publish.yml/badge.svg)](https://github.com/nerdoza/vue-click/actions/workflows/publish.yml)

A `v-click` directive for Vue 3. It adds double click, hold, press and release behaviors, plus `once`, `throttle` and `debounce` modifiers. Mouse and touch input behave the same way, and keyboard activation works for plain clicks.

**[Try the demo](https://nerdoza.github.io/vue-click/)**

# Installation

```bash
npm install vue-click
```

Register it for the whole app:

```javascript
import { createApp } from 'vue'
import VueClick from 'vue-click'
import App from './App.vue'

createApp(App).use(VueClick).mount('#app')
```

Or import the directive only where you need it:

```vue
<script setup>
import { ClickDirective as vClick } from 'vue-click'
</script>
```

With the Options API, add `directives: { click: ClickDirective }` to the component. To give it another name, register it yourself: `app.directive('tap', ClickDirective)` makes it `v-tap`. TypeScript types are included.

## CDN

Without a build step, load the UMD build from [unpkg](https://unpkg.com/) or [jsDelivr](https://www.jsdelivr.com/package/npm/vue-click), after Vue. It defines a `VueClick` global:

```html
<script src="https://unpkg.com/vue@3"></script>
<script src="https://unpkg.com/vue-click@2"></script>
<script>
  Vue.createApp({ /* ... */ }).use(VueClick.default).mount('#app')
</script>
```

# Usage

```html
<button v-click="save">Save</button>
<button v-click.double="zoomIn">Zoom in</button>
<button v-click.hold.1s="clearAll">Hold to clear</button>
<button v-click.throttle="submit">Submit</button>
```

`v-click` takes a function. Unlike `v-on`, it doesn't take inline statements, so `v-click="remove(item)"` would call `remove` while rendering. To pass a value, use an arrow function: `v-click="() => remove(item)"`.

Each `v-click` takes at most one behavior, which sets when it fires, and one modifier, which limits how often. You can put several on one element (see [Combining](#combining)). The handler and its argument can change after mount, and when the value isn't a function, nothing fires. The behavior, modifier and time are fixed at mount.

As with `v-on`, an error the handler throws, or a promise it returns that rejects, goes to `onErrorCaptured` and `app.config.errorHandler`.

## Behaviors

| Behavior | Fires when | Default time |
| --- | --- | --- |
| _(none)_ | the element is clicked: pressed and released on it within 300ms | |
| `double` | the element is clicked twice, with the second click starting within the time | 300ms |
| `hold` | the element has been held down for the time | 300ms |
| `press` | the element is pressed (`mousedown` or `touchstart`); it doesn't wait for the release | |
| `release` | the pointer is released over the element (`mouseup` or `touchend`) | |

## Modifiers

| Modifier | Effect | Default time |
| --- | --- | --- |
| `once` | fires the first time, then the directive removes itself | |
| `throttle` | fires right away, then ignores clicks until none have come for the time | 300ms |
| `debounce` | fires once the clicks have stopped for the time | 300ms |

## Times

Add a time after the behavior or modifier to change its default:

```html
<button v-click.double.500ms="zoomIn">
<button v-click.hold.2s="clearAll">
<button v-click.debounce.1m="autosave">
```

The units are `ms`, `s` and `m`, and a bare number is milliseconds (`v-click.throttle.200`). When a directive has both a behavior and a modifier, the time applies to both (`v-click.double.throttle.1s`).

A unit needs its number: `v-click.hold.s` isn't a time. An unknown modifier like that, or a second behavior, modifier or time, logs a warning when the directive mounts.

## Arguments

The directive's argument is passed to the handler as a string:

```html
<button v-click:open="toggle">Open</button>  <!-- calls toggle('open') -->
<button v-click:close.throttle="toggle">Close</button>
```

Without an argument, the handler gets `null`; it never gets the event. For any other value, use an arrow function.

## Combining

`v-click` and `v-click.hold` on the same element tell a tap from a long press. A tap has to be released within 300ms, so only one of them fires, as long as the hold time is at least 300ms.

```html
<button v-click="open" v-click.hold="showMenu">
```

Other pairs fire independently. For example, `v-click` with `v-click.double` fires the click on each of the two clicks as well as the double.

## Nested elements

A press on a `v-click` element inside another fires both. Add `stop` to the inner one to keep its presses and keyboard clicks from the `v-click` directives around it, the way `@click.stop` works:

```html
<div v-click="openCard">
  <button v-click.stop="removeCard">Remove</button>
</div>
```

`stop` combines with a behavior and a modifier (`v-click.hold.stop`), and only affects other `v-click` directives.

## Input handling

- **Mouse buttons:** only the primary button counts. On macOS and iPadOS, a <kbd>Control</kbd>-click is a right click, so it's ignored too.
- **Cancelled presses:** a click, double click or hold is cancelled if the pointer moves more than 10px, is released off the element, or the browser cancels the touch. A second finger on the element cancels it too.
- **Keyboard:** <kbd>Enter</kbd>, <kbd>Space</kbd> and screen reader activation trigger a plain `v-click`, modifier included. `double`, `hold`, `press` and `release` are pointer gestures, so make their actions reachable another way too.
- **Scripted events:** events dispatched from scripts (`el.click()`, `dispatchEvent()`) are ignored.
- **Disabled elements:** presses and clicks on a `disabled` element are ignored, and a `debounce` that comes due while the element is disabled is dropped.
- **Default handling:** `v-click` cancels the browser's default handling of presses on the element. The element doesn't take focus on mouse down, and a touch that starts on it doesn't scroll the page.
- **Click actions:** a mouse click or tap on the element doesn't perform the browser's click action: a button doesn't submit its form, a link doesn't follow its `href`, and a checkbox doesn't toggle. Keyboard activation still does, so give buttons in a form `type="button"` and submit from the handler. A `@click` on the same element runs for mouse clicks and keyboard activation, but not for taps.

# Styling

`v-click` sets data attributes you can style:

| Attribute | Present |
| --- | --- |
| `data-vc-bind-click`, `-double`, `-hold`, `-press`, `-release` | while that behavior is bound; the value is its modifier, if any (`once`, `throttle`, `debounce`) |
| `data-vc-state-active` | while the element is pressed |
| `data-vc-state-deactivated` | once every `v-click` on the element is a `once` that has fired and removed itself |

Use `data-vc-state-active` instead of `:active`. With the browser's default handling cancelled, `:active` and `:focus` don't apply reliably, and the attribute is cleared as soon as a press ends or is cancelled. Keep a `:focus-visible` style for keyboard users.

```css
button {
  user-select: none;                        /* holding doesn't select text */
  -webkit-tap-highlight-color: transparent;
  touch-action: none;                       /* no double-tap zoom */
}

button[data-vc-state-active] {
  box-shadow: inset 0 0 8px rgb(0 0 0 / 40%);
}

button[data-vc-state-deactivated] {
  opacity: 0.5;
  cursor: default;
}

button[data-vc-bind-hold] {
  border-style: dashed;                     /* hint that this one needs a long press */
}
```

# Development

Development needs Node.js 22.15 or later (CI runs Node.js 26). `npm run dev` serves the demo page from `dev/`, and `npm run lint` and `npm run typecheck` check the code.

`npm test` runs the Playwright suite in `tests/`, which drives a test page with real mouse, keyboard and touch input in Chromium. Install the browser once with `npx playwright install chromium`. `npm run test:package` builds and packs the package as npm would publish it. It then type-checks a consumer against the package's typings, runs the same suite against the packed bundle, and loads the bundle from a `<script>` tag and on the server (see `tests/package`).

To release, bump `version` in `package.json` and merge to `main`. The Publish workflow runs the tests, then publishes any version npm doesn't have yet. It publishes through npm trusted publishing, so no npm token is stored and provenance is attached automatically. It then deploys the demo and creates the GitHub release. If a release fails partway, re-run the workflow, or run it by hand from the Actions tab: it finishes whichever steps haven't succeeded for that version.

---

## Copyright and License
© 2022 Zachary Cardoza under the [MIT license](LICENSE.md).
