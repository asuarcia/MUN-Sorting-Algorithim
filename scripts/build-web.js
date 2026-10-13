// Assembles the browser version into _site/ (deployed to GitHub Pages).
// It is the exact same page the desktop app loads: everything still runs in
// the visitor's browser, and no delegate data is ever sent anywhere.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, '_site');
fs.rmSync(out, { recursive: true, force: true });
for (const f of ['index.html', 'engine.js', 'favicon.png', 'vendor']) {
  fs.cpSync(path.join(root, f), path.join(out, f), { recursive: true });
}
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('web build ->', out);
