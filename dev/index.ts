import Vue from 'vue'
import VueClick from '../src'

Vue.use(VueClick)

/* tslint:disable:no-unused-expression */
new Vue({
  el: '#app',
  data: {
    count: 0
  },
  methods: {
    click: function (arg?: string | number | MouseEvent) {
      let incrementAmount = 1

      if (typeof arg === 'number') {
        incrementAmount = arg
      }

      if (typeof arg === 'string') {
        incrementAmount = parseInt(arg, 10)
      }

      this.count += incrementAmount
    }
  }
})
/* tslint:enable:no-unused-expression */
