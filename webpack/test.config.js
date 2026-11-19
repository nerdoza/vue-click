const HtmlWebpackPlugin = require('html-webpack-plugin')

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
      vue: 'vue/dist/vue.esm-bundler.js'
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
    hashFunction: 'xxhash64',
    filename: 'index.js'
  }
}
