import { createApp } from 'vue'
import VueClick from '../src'

const app = createApp({
  data() {
    return { count: 0 }
  },
  methods: {
    click (arg?: string | number | MouseEvent) {
      let incrementAmount = 1

      if (typeof arg === 'number') {
        incrementAmount = arg
      }

      if (typeof arg === 'string') {
        incrementAmount = parseInt(arg, 10)
      }

      this.count += incrementAmount
    },
    reset (){
      this.count = 0
    }
  }
})

app.use(VueClick)
app.mount('#app')
