/**
 * Copyright (c) 2018-2020 aetheryx & Bowser65
 * All Rights Reserved. Licensed under the Porkord License
 * https://powercord.dev/porkord-license
 */
const path = require('path');
if (process.argv.includes('--install-path')) {
  installPath = process.argv[process.argv.indexOf('--install-path') + 1]
  console.log('\x1b[35m%s\x1b[0m', 'Installing to ' + installPath)
  exports.getAppDir = async () => path.join(installPath, 'Contents/Resources/app')
} else {
  exports.getAppDir = async () => '/Applications/Discord Canary.app/Contents/Resources/app';
}
