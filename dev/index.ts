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
    click: function () {
      this.count++
    }
  }
})
/* tslint:enable:no-unused-expression */
