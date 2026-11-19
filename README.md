# Vue Click
![Publish](https://github.com/nerdoza/vue-click/workflows/Publish/badge.svg)

Vue 3 plugin for advanced click directive.

### [🖱️ Demo Page](https://nerdoza.github.io/vue-click/)

# Installation

## Npm

```bash
npm install --save vue-click
```

Install the plugin into Vue:

```javascript
import { createApp } from 'vue'
import VueClick from 'vue-click'

const app = createApp({/* App Config */})
app.use(VueClick)
app.mount('#app')
```

## CDN

This package is available from the [**JSDELIVR**](https://www.jsdelivr.com/) and [**UNPKG**](https://unpkg.com/) content delivery networks (CDNs) and utilizes the [**UMD**](https://github.com/umdjs/umd#readme) module system so it's ready to use directly in the browser without a build step.

```html
<script src="https://unpkg.com/vue@next"></script>
<script src="https://unpkg.com/vue-click@latest"></script>
<script>
  const app = Vue.createApp({/* App Config */})
  app.use(VueClick.default)
  app.mount('#app')
</script>
  
```

# Usage

## Directive

Use the `v-click` directive very similarly to how you would use `v-on:click`:

```html
<button v-click="openModal">
```

Further modify the behavior of the button by adding modifiers:

```html
<button v-click.double.once="removeAd">
<button v-click.throttle.400s="openModal">
```

Only one behavior and one modifier can be used in a single directive declaration, but multiple directives can be placed on the same element.

The bound function can change after the element mounts (ex: `v-click="ready ? openModal : undefined"`), and each directive removes its listeners and cancels its pending timers when its element unmounts.

## Behaviors

One behavior may be used in a declaration and defines the trigger for the event.

### Single Click Behavior _(Default)_

The `v-click` event will be fired immediately on a click event similar to `v-on:click`: a press that is released on the element within `300ms`.

```html
<button v-click="openModal">
```

Keyboard and assistive-technology activation fires it too, once and through the same modifier: <kbd>Enter</kbd> or <kbd>Space</kbd> on a focused `<button>`, or a screen reader's activate command, produce a `click` event with no pointer press before it.

### Double Click Behavior

The `v-click` event can be bound to fire only on a double click. The event is fired only after 2 clicks within a time period.

```html
<button v-click.double="openModal">
```

The default time period is `300ms`, but this can be modify by append the preferred time to the `double` modifier.

```html
<button v-click.double.1s="openModal">
```

Double click is a pointer gesture: keyboard and assistive-technology activation doesn't trigger it, so keep its action reachable another way.

### Hold Behavior

The `v-click` event can be bound to fire after a specified amount of time that the button is held down.

```html
<button v-click.hold="openModal">
```

The default time period is `300ms`, but this can be modify by append the preferred time to the `hold` modifier.

```html
<button v-click.hold.1s="openModal">
```

Like double click, hold is a pointer gesture that keyboard and assistive-technology activation doesn't trigger.

### Press Behavior

The `v-click` event will be fired immediately on the `down` event, regardless of if the `up` event has occurred. This binding can be combined with the `release` behavior for advanced bindings or for scenarios where event latency is very important.

```html
<button v-click.press="openModal">
```

### Release Behavior

The `v-click` event will be fired immediately on the `up` event, which will always be preceded by a `down` event. This binding can be combined with the `press` behavior for advanced bindings or for scenarios where event latency is very important.

```html
<button v-click.release="openModal">
```

## Pointer Input

The behaviors listen to touch and mouse events directly, with a few rules that keep stray input from firing them:

- **Primary button only:** only the primary mouse button (usually the left) counts; right and middle clicks never fire a behavior or set the active state.
- **Movement tolerance:** a single, double or hold press is cancelled once the pointer moves more than `10px` from where it went down, so a swipe or drag is not a click and a hold doesn't fire after the finger slides away.
- **Cancel and release outside:** a press ends when the pointer is released anywhere, on the element or off it, when the browser cancels the touch (`touchcancel`), or when a second finger touches the element. Only a release on the element can complete a click, and every way a press ends clears its pending hold and the `data-vc-state-active` attribute.
- **Trusted input only:** events dispatched by scripts (ex: `element.click()` or `dispatchEvent()`) are ignored.

## Modifiers

One modifier may be used in a declaration and changes the behavior of the event trigger to reduce unintended event firing.

### Once Modifiers

The `once` modifier causes the click listener to only issue a call once and then the binding is disposed.

```html
<button v-click.double.once="openModal">
```

### Throttle Modifier

The `v-click` can be throttled to prevent accidentally issuing multiple click events. The event is fired immediately upon the first click, but subsequent clicks are ignored until the desired time interval has passed. Each click resets the time interval.

```html
<button v-click.throttle="openModal">
```

The default time interval is `300ms`, but this can be modify by append the preferred time to the `throttle` modifier.

```html
<button v-click.throttle.500ms="openModal">
```

### Debounce Modifier

The `v-click` can be debounced to prevent the premature issuance of click events. The event is fired only after a time period of inactivity. Each click resets the time period.

```html
<button v-click.debounce="openModal">
```

The default time period is `300ms`, but this can be modify by append the preferred time to the `debounce` modifier.

```html
<button v-click.debounce.20ms="openModal">
```

## Time

The time attribute allows overriding of default times by appending the time period to the end of the behavior or modifier (ie: `double`, `throttle`, `debounce`).

Time modifiers automatically use milliseconds as the default unit of measure, but additional units are supported by appending the unit abbreviation to the value.

**Time Units:**

- `ms` - Milliseconds
- `s` - Seconds
- `m` - Minutes

```html
<button v-click.throttle.1s="openModal">
```

**Note:** When applied to a declaration with two time sensitive interactions (ex: `double.throttle`) the same time is applied to both attributes.

## Function Call Arguments

When it is necessary to pass an argument to the function triggered on the click event, add the argument to the end of the directive as an argument.

```html
<button v-click.throttle:open="buttonPress">
```

```javascript
buttonPress (arg) {
  if (arg === 'open') {
    openModal()
  }
}
```

For the above example, the `buttonPress` function will be called with the string `open` passed in as the argument. There is only support for a single argument and it will always be passed in as a string.

## Styling

The addition of `TouchEvent` support has resulted in the breaking of normal event propagation which means pseudo selectors like `:active` and `:focus` will no longer active on events. Instead, the `data-vc-state-active` data attribute will be applied during the target elements active state. This works better across both mobile and desktop environments than the `:active` state as it's cleared when the user's finger is removed (where `:active` persists until focus is changed). It's also cleared when the press is cancelled: released off the element, moved past the [movement tolerance](#pointer-input) or interrupted by `touchcancel` or a second finger. There is also a `data-vc-state-deactivated` data attribute which is applied when the binding is removed from an element (ex: `once` modifier).

This plugin also provides data attributes for the behavior to allow advanced styling based on the desired user experience.

```css
button {
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
}

button:focus {
  outline: none;
}

button:active,
button[data-vc-state-active] {
  outline: none;
  box-shadow: inset 0px 0px 8px rgba(0, 0, 0, 0.4);
}

button:disabled,
button[data-vc-state-deactivated] {
  background: ghostwhite !important;
  cursor: inherit;
  outline: none;
  box-shadow: none;
}

button[data-vc-bind-click] {
  background-color: aquamarine;
}

button[data-vc-bind-double] {
  background-color: aqua;
}

button[data-vc-bind-hold] {
  background-color: lightcyan;
}

button[data-vc-bind-press] {
  background-color: lavender;
}
```

**Note:** When the `once` modifier is applied, the data-set binding will be removed once the event listener is removed (after the event is fired).

# Development

`npm run dev` serves the demo page. `npm test` runs the Playwright suite in `tests/`, which drives a test page with real mouse, keyboard and touch input in Chromium; install the browser once with `npx playwright install chromium`.

To release, bump `version` in `package.json` and merge to `main`. The Publish workflow publishes any version npm doesn't have yet through npm trusted publishing (no npm token is stored; provenance is attached automatically), then deploys the demo and creates the GitHub release. If a publish fails, re-run the workflow, or run it by hand from the Actions tab.

---

## Copyright and License
© 2022 Zachary Cardoza under the [MIT license](LICENSE.md).
