// Packaging invariants: what npm would publish must match what package.json declares.
// These are the mistakes that survive every other test, because they are invisible from
// inside the code - a stale bundle, a version stamped by hand, a subpath pointing nowhere.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const racine = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8'));

let ok = true;
const check = (n, c) => { console.log((c ? 'OK  ' : 'NOK ') + n); if (!c) ok = false; };

// The version is declared once, in package.json, and stamped into the bundles at build
// time. Published 2.0.1 announced itself as 0.6.0 because that number was kept by hand.
for (const f of ['ol-elevation-profile.js', 'ol-elevation-profile.esm.js']) {
  const code = readFileSync(join(racine, 'dist', f), 'utf8');
  const m = /ElevationProfile\.version = '([^']*)'/.exec(code);
  check(`${f}: stamped with the declared version`, m && m[1] === pkg.version);
  check(`${f}: the banner carries it too`, code.startsWith(`/*! ol-elevation-profile ${pkg.version} |`));
}
// The source keeps no released number of its own: read directly, it says what it is.
check('src: holds a development placeholder, not a version',
  /ElevationProfile\.version = '0\.0\.0-dev'/.test(
    readFileSync(join(racine, 'src', 'ol-elevation-profile.js'), 'utf8')));

// Every file the exports map promises must be there, types included.
const cibles = [];
const collect = (v) => {
  if (typeof v === 'string') cibles.push(v);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
collect(pkg.exports);
collect(pkg.types);
for (const c of cibles) {
  if (c.includes('*')) continue;                       // a pattern, not a file
  check(`exports: ${c} exists`, existsSync(join(racine, c)));
}
check('exports: the main entry is typed first', Object.keys(pkg.exports['.'])[0] === 'types');
check('exports: the stylesheet subpath is typed', !!pkg.exports['./css'].types);

console.log(ok ? '\n>>> ALL PACKAGE TESTS PASS' : '\n>>> FAILURES');
process.exit(ok ? 0 : 1);
