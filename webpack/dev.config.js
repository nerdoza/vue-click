const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')

module.exports = {
  mode: 'development',
  entry: './dev/index.ts',
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
      'vue': 'vue/dist/vue.esm-bundler.js'
    }
  },
  devtool: 'inline-source-map',
  devServer: {
    host: '0.0.0.0',
    contentBase: './dev',
    hot: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './dev/index.html'
    }),
    new webpack.HotModuleReplacementPlugin()
  ],
  output: {
    filename: 'index.js'
  }
}
