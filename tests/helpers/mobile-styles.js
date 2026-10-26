const fs = require('node:fs');
const path = require('node:path');
const { appRoot } = require('./refactor-fixtures');

function readMobileStyles() {
  const entry = fs.readFileSync(path.join(appRoot, 'mobile-v2.css'), 'utf8');
  return entry.replace(/@import url\("\/app-assets\/([^"\n]+)"\);\n/g,
    (_, file) => fs.readFileSync(path.join(appRoot, file), 'utf8'));
}

module.exports = { readMobileStyles };
