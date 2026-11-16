const fs = require('node:fs');
const { transformSync } = require('@swc/core');
require.extensions['.ts'] = (module, filename) => {
  const { code } = transformSync(fs.readFileSync(filename, 'utf8'), { filename,
    jsc: { parser: { syntax: 'typescript', decorators: true }, target: 'es2021' },
    module: { type: 'commonjs', ignoreDynamic: true } });
  module._compile(code, filename);
};
