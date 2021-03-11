const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')

const DIST = path.resolve(__dirname, '../demo')

module.exports = {
  mode: 'production',
  entry: './dev/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js'
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './dev/index.html'
    }),
    new CopyPlugin({
      patterns: [
        { from: './dev/style.css', to: path.resolve(DIST, 'style.css') }
      ]
    })
  ],
  output: {
    filename: 'index.js',
    path: DIST
  }
}
