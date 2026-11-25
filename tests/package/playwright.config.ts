import { config } from '../../playwright.config'

// The whole suite against the packed package, plus the tests in this folder. Run it with `npm run test:package`, which
// builds and installs the package first.
export default config('package')
