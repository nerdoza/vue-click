const fs = require('fs')
const path = require('path')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

const DIST = path.resolve(__dirname, '../dist')

function DtsBundlePlugin (options) { this.options = options }
DtsBundlePlugin.prototype.apply = function (compiler) {
  compiler.hooks.afterEmit.tap('DtsBundlePlugin', () => {
    require('dts-bundle').bundle(this.options)
    replace(this.options.out, [
      {
        search: /^\/\/.*\r?\n/gm,
        replace: ''
      },
      {
        search: /^[\t ]*\r?\n/gm,
        replace: ''
      },
      {
        search: /^\}(?:\r?\n|\r)(?!$)/gm,
        replace: '}\n\n'
      }
    ])
  })
}

function replace (file, rules) {
  const src = path.resolve(file)
  let template = fs.readFileSync(src, 'utf8')

  template = rules.reduce(
    (template, rule) => template.replace(rule.search, rule.replace),
    template
  )

  fs.writeFileSync(src, template)
}

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
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [DIST],
      cleanAfterEveryBuildPatterns: [path.join(DIST, 'types')]
    }),
    new DtsBundlePlugin({
      name: 'VueClick',
      main: path.join(DIST, 'types/index.d.ts'),
      out: path.join(DIST, 'index.d.ts'),
      removeSource: true,
      newLine: 'lf',
      indent: '  ',
      outputAsModuleFolder: true
    })
  ],
  output: {
    hashFunction: 'xxhash64',
    filename: 'index.js',
    path: DIST,
    libraryTarget: 'umd',
    library: 'VueClick'
  }
}
