# Vue Click
![Publish](https://github.com/bayssmekanique/vue-click/workflows/Publish/badge.svg)

Vue plugin for advanced click directive.

# Installation

## Npm

```bash
npm install --save vue-click
```

Install the plugin into Vue:

```javascript
import Vue from 'vue'
import VueClick from 'vue-click'

Vue.use(VueClick)
```

Or use the directive directly within individual components:

```typescript
import Vue from 'vue'
import Component from 'vue-class-component'
import { ClickDirective } from 'vue-click'

@Component({
  directives: {
    click: ClickDirective
  }
})
export default class Demo extends Vue {
  count = 0

  increment() {
    this.count++
  }
}

// Example using Vue Class Component
// https://class-component.vuejs.org/
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

## Behaviors

One behavior may be used in a declaration and defines the trigger for the event.

### Single Click Behavior _(Default)_

The `v-click` event will be fired immediately on a click event similar to `v-on:click`.

```html
<button v-click="openModal">
```

### Double Click Behavior

The `v-click` event can be bound to fire only on a double click. The event is fired only after 2 clicks within a time period.

```html
<button v-click.double="openModal">
```

The default time period is `300ms`, but this can be modify by append the preferred time to the `double` modifier.

```html
<button v-click.double.1s="openModal">
```

### Hold Behavior

The `v-click` event can be bound to fire after a specified amount of time that the button is held down.

```html
<button v-click.hold="openModal">
```

The default time period is `300ms`, but this can be modify by append the preferred time to the `hold` modifier.

```html
<button v-click.hold.1s="openModal">
```

### Press Behavior

The `v-click` event will be fired immediately on the `down` event, regardless of if the `up` event has occurred. This binding can be combined with the `release` behavior for advanced bindings or for scenarios where event latency is very important.

```html
<button v-click:press="openModal">
```

### Release Behavior

The `v-click` event will be fired immediately on the `up` event, which will always be preceeded by a `down` event. This binding can be combined with the `press` behavior for advanced bindings or for scenarios where event latency is very important.

```html
<button v-click:release="openModal">
```

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

In order to maintain accessibility it is recommended to use the `vue-click` directive on elements which already support `MouseEvent` events to preserve default characteristics such as `focus` and `active` element states (ie: `<button>`, `<a>`). This class does not re-implement those event state via class or data-set bindings as it's recommended to use the built-in event state bindings.

This plugin does provide data-set bindings for the behavior and modifiers to allow advanced styling based on the desired user experience. The behavior data-set bindings can be combined with element states as well.

```css
button {
  font-size: 1rem;
  margin: 1rem;
  padding: 0.5rem 1rem;
  color: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.2);
  background-color: rgba(0, 0, 0, 0.05);
  text-decoration: none;
  border-radius: 2px;
  cursor: pointer;
}

button:focus {
  outline: none;
}

button:active {
  box-shadow: inset 0px 0px 5px rgba(0, 0, 0, 0.2);
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

button[data-vc-bind-release] {
  background-color: lavenderblush;
}
```

**Note:** When the `once` modifier is applied, the data-set binding will be removed once the event listener is removed (after the event is fired).

---

## Copyright and License
© 2020 Zachary Cardoza under the [MIT license](LICENSE.md).
