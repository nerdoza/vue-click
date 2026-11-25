const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

// The test page imports the plugin as `vue-click`: the source by default, or with VUE_CLICK_TARGET=package the packed
// package that `npm run test:package` installs (resolved through its package.json, as an app's bundler would).
const vueClick = process.env.VUE_CLICK_TARGET === 'package'
  ? path.resolve(__dirname, '../tests/package/node_modules/vue-click')
  : path.resolve(__dirname, '../src/index.ts')

// Serves `tests/page` for the Playwright suite (see playwright.config.ts).
module.exports = {
  mode: 'development',
  entry: './tests/page/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
      'vue-click$': vueClick
    }
  },
  devtool: 'inline-source-map',
  devServer: {
    host: '127.0.0.1',
    static: false,
    hot: false,
    liveReload: false,
    client: false
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './tests/page/index.html'
    })
  ],
  output: {
    filename: 'index.js'
  }
}
