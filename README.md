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
<button v-click.throttle="openModal">
```

## Throttle Modifier

The `v-click` can be throttled to prevent accidentally issuing multiple click events. The event is fired immediately upon the first click, but subsequent clicks are ignored until the desired time interval has passed. Each click resets the time interval.

```html
<button v-click.throttle="openModal">
```

The default time interval is `220ms`, but this can be modify by append the preferred time to the `throttle` modifier.

```html
<button v-click.throttle.500ms="openModal">
```

## Debounce Modifier

The `v-click` can be debounced to prevent the premature issuance of click events. The event is fired only after a time period of inactivity. Each click resets the time period.

```html
<button v-click.debounce="openModal">
```

The default time period is `300ms`, but this can be modify by append the preferred time to the `debounce` modifier.

```html
<button v-click.debounce.20ms="openModal">
```

## Double Modifier

The `v-click` event can be bound to fire only on a double click. The event is fired only after 2 clicks within a time period.

```html
<button v-click.double="openModal">
```

The default time period is `300ms`, but this can be modify by append the preferred time to the `double` modifier.

```html
<button v-click.double.1s="openModal">
```

## Time Modifiers

Time modifiers allow overriding of default times by appending the time period to the end of the behavior modifier (ie: `throttle`, `debounce`).

Time modifiers automatically use milliseconds as the default unit of measure, but additional units are supported by appending the unit abbreviation to the value.

**Time Units:**

- `ms` - Milliseconds
- `s` - Seconds
- `m` - Minutes

```html
<button v-click.throttle.1s="openModal">
```

## Once Modifiers

The `once` modifier causes the click listener to only issue a call once. The listener is then disposed. The `once` modifier can be appended to any modifier.

```html
<button v-click.double.once="openModal">
```

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

---

## Copyright and License
© 2020 Zachary Cardoza under the [MIT license](LICENSE.md).
