// Packs vue-click the way `npm publish` would and installs the tarball at tests/package/node_modules/vue-click, so the
// package tests exercise exactly what gets published. `npm run test:package` builds, runs this, then the tests.
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const pkg = require(path.join(root, 'package.json'))
const install = path.join(__dirname, 'node_modules', pkg.name)

const [packed] = JSON.parse(execSync('npm pack --json --loglevel=error --pack-destination tests/package', { cwd: root, encoding: 'utf8' }))
const files = packed.files.map(file => file.path)

try {
  const missing = [pkg.main, pkg.types].map(file => path.posix.normalize(file)).filter(file => !files.includes(file))
  if (missing.length > 0) {
    throw new Error(`package.json points at ${missing.join(' and ')}, which the package doesn't include. Packed: ${files.join(', ')}`)
  }

  fs.rmSync(install, { recursive: true, force: true })
  fs.mkdirSync(install, { recursive: true })
  // Relative paths only: GNU tar (Git Bash on Windows) reads a drive letter's colon as a remote host.
  execSync(`tar -xzf ${packed.filename} -C ${path.relative(__dirname, install).split(path.sep).join('/')} --strip-components=1`, { cwd: __dirname, stdio: 'inherit' })
} finally {
  fs.rmSync(path.join(__dirname, packed.filename), { force: true })
}

console.log(`Installed ${packed.id} (${files.join(', ')}) at ${path.relative(root, install)}`)
