// The package must be usable from TypeScript without the consumer writing a single
// declaration. Two errors used to make that impossible - TS7016 on the default import,
// TS2882 on the `/css` subpath - and both are silent from JavaScript, so only a real
// compilation catches them coming back.
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const racine = resolve(import.meta.dirname, '..');
const bac = mkdtempSync(join(tmpdir(), 'oep-types-'));
let ok = true;
const check = (n, c) => { console.log((c ? 'OK  ' : 'NOK ') + n); if (!c) ok = false; };

// A consumer's tree: the package under test, and its peers, reachable by name.
mkdirSync(join(bac, 'node_modules'), { recursive: true });
symlinkSync(racine, join(bac, 'node_modules', 'ol-elevation-profile'), 'dir');
for (const pair of ['ol', 'd3']) {
  symlinkSync(join(racine, 'node_modules', pair), join(bac, 'node_modules', pair), 'dir');
}

writeFileSync(join(bac, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    strict: true, noEmit: true, target: 'ES2022', module: 'ESNext',
    moduleResolution: 'bundler', skipLibCheck: true, types: []
  },
  include: ['app.ts']
}, null, 2));

// Everything a consumer actually touches, typed: the options that used to need a
// hand-written .d.ts, the stylesheet subpath, and the methods.
writeFileSync(join(bac, 'app.ts'), `
import 'ol-elevation-profile/css';
import ElevationProfile from 'ol-elevation-profile';
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';

const p = new ElevationProfile({
  position: 'bottom', width: 'auto', height: 300,
  theme: 'steelblue', slope: true, smoothing: 100,
  dem: { track: { url: 'profils/{id}.json' } },
  verticalScale: { exaggeration: 6 },
  titleProperty: 'name', titleLink: 'url',
  headerItems: ['distance', 'ascent', 'descent', 'minmax'],
  tooltipItems: ['distance', 'elevation', 'slope'],
  lang: 'fr'
});
p.setFeature(new Feature({ geometry: new LineString([[0, 0, 10], [1, 1, 20]]) }));
p.setOptions({ verticalScale: 'auto', height: 200 });
const s = p.getStats();
const dplus: number = s ? s.ascent : 0;
const z: boolean = ElevationProfile.featureHasZ(new Feature());
p.clear();
export { dplus, z };
`);

const tsc = join(racine, 'node_modules', '.bin', 'tsc');
let sortie = '';
try {
  execFileSync(tsc, ['-p', join(bac, 'tsconfig.json')], { encoding: 'utf8', stdio: 'pipe' });
} catch (e) {
  sortie = (e.stdout || '') + (e.stderr || '');
}
if (sortie) console.log(sortie.split('\n').slice(0, 12).map((l) => '    ' + l).join('\n'));
check('a TypeScript consumer compiles with no declaration of its own', sortie === '');
check('TS7016 is gone: the default import is typed', !/TS7016/.test(sortie));
check('TS2882 is gone: the /css subpath resolves', !/TS2882/.test(sortie));

rmSync(bac, { recursive: true, force: true });
console.log(ok ? '\n>>> ALL TYPE TESTS PASS' : '\n>>> FAILURES');
process.exit(ok ? 0 : 1);
