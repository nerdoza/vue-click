import { createApp } from 'vue'
import VueClick from '../src'

// The count on each demo button. Its `key` changes with every hit, so the badge is re-created and its CSS animation
// replays.
const HitCount = {
  props: {
    n: { type: Number, default: 0 },
    label: { type: String, default: '' }
  },
  template: '<output :key="n" :class="{ fired: n > 0 }"><template v-if="label">{{ label }}&nbsp;</template>{{ n }}</output>'
}

createApp({
  data: () => ({
    hits: {} as Record<string, number>,
    received: 'nothing yet',
    disabled: true,
    // Bumped by Reset to remount every button, which re-binds the `once` directives.
    round: 0
  }),
  methods: {
    hit (name: string) {
      this.hits[name] = (this.hits[name] ?? 0) + 1
    },
    show (value: unknown) {
      this.received = JSON.stringify(value)
    },
    reset () {
      this.hits = {}
      this.received = 'nothing yet'
      this.round++
    }
  }
})
  .component('hit-count', HitCount)
  .use(VueClick)
  .mount('#app')
