const path = require('path')

// Builds the UMD bundle; `npm run build` then emits the type declarations next to it (see tsconfig.build.json).
module.exports = {
  mode: 'production',
  entry: './src/index.ts',
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
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, '../dist'),
    clean: true,
    library: {
      name: 'VueClick',
      type: 'umd'
    },
    // UMD's default global is `self`, which doesn't exist in Node, so requiring the bundle there (SSR, tests) threw.
    globalObject: 'this'
  }
}
