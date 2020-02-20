# Vue Click
![Push](https://github.com/bayssmekanique/vue-click/workflows/Push/badge.svg)

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

The `v-click` can be throttled to prevent accidentally issuing multiple click events. The event is fired immediately upon the first click, but subsequent clicks are ignored until the desired cool-off time. Each click resets the cool-off timer.

```html
<button v-click.throttle="openModal">
```

The default cool-off time is `220ms`, but this can be modify by append the preferred time to the `throttle` modifier.

```html
<button v-click.throttle.500ms="openModal">
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

---

## Copyright and License
© 2020 Zachary Cardoza under the [MIT license](LICENSE.md).
