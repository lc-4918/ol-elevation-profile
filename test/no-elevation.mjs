// A track that ends up with no elevation at all: none in its geometry, and none any
// terrain model could supply. Before `showWithoutElevation` the control drew the chart
// anyway - a flat line at sea level under "D+ 0 m", which is not a missing figure but a
// wrong one. These tests pin down what replaces it, and that a real profile still wins.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.Image = dom.window.Image;

const { fromLonLat } = await import('ol/proj.js');
const { default: Profile } = await import('../src/ol-elevation-profile.js');

let ok = true;
const check = (n, c) => { console.log((c ? 'OK  ' : 'NOK ') + n); if (!c) ok = false; };

const LL = [[6.0, 45.0], [6.05, 45.02], [6.1, 45.04]];
const geomOf = (z) => ({
  getType: () => 'LineString',
  getCoordinates: () => LL.map((ll, i) => z ? [...fromLonLat(ll), 600 + i * 50] : fromLonLat(ll)),
  getClosestPoint: () => [0, 0], getExtent: () => [0, 0, 1, 1]
});
const featureOf = (geom, props = {}) => ({
  getGeometry: () => geom, get: (k) => props[k],
  getProperties: () => props, getStyle: () => null
});
const panneau = (p) => ({
  visible: p.element.style.display !== 'none',
  message: (p.element.querySelector('.oep-noelev') || {}).textContent || null,
  titre: (p.element.querySelector('.oep-title') || {}).textContent || null,
  stats: (p.element.querySelector('.oep-stats') || {}).textContent || '',
  graphe: !!p.element.querySelector('.oep-body svg')
});

// ---- 1. no Z, no DEM: the message stands in for the chart ------------------
let p = new Profile({ dem: null, lang: 'fr' });
p.setFeature(featureOf(geomOf(false), { name: 'Sans altitude', url: 'https://example.org/' }));
let v = panneau(p);
check('no Z: the panel is shown', v.visible);
check('no Z: the message replaces the chart', v.message === 'Aucune altimétrie');
check('no Z: no chart is drawn', !v.graphe);
check('no Z: the track is still named', v.titre === 'Sans altitude');
check('no Z: no D+ is announced', !/D\+/.test(v.stats));
check('no Z: the distance, which the geometry does know, is kept', /km/.test(v.stats));

// ---- 2. the option hides the panel instead --------------------------------
p = new Profile({ dem: null, showWithoutElevation: false });
p.setFeature(featureOf(geomOf(false), { name: 'Sans altitude' }));
check('showWithoutElevation false: the panel is hidden', !panneau(p).visible);

// ---- 3. a track that has its Z is untouched -------------------------------
p = new Profile({ dem: null, lang: 'fr' });
p.setFeature(featureOf(geomOf(true), { name: 'Avec altitude' }));
v = panneau(p);
check('with Z: the chart is drawn', v.graphe && v.message === null);
check('with Z: the stats are complete', /D\+/.test(v.stats));

// ---- 4. the panel recovers when the next track has a profile --------------
p.setFeature(featureOf(geomOf(false), { name: 'Sans' }));
check('a track with no Z after one with Z shows the message', panneau(p).message !== null);
p.setFeature(featureOf(geomOf(true), { name: 'Avec' }));
v = panneau(p);
check('and the chart comes back on the next one', v.graphe && v.message === null);

// ---- 5. a failed DEM fill lands in the same state --------------------------
p = await new Promise((resolve) => {
  const q = new Profile({ dem: () => { throw new Error('service down'); }, lang: 'fr' });
  q.on('demload', () => setTimeout(() => resolve(q), 0));
  q.setFeature(featureOf(geomOf(false), { name: 'MNT en panne' }));
  setTimeout(() => resolve(q), 3000);
});
v = panneau(p);
check('a failed DEM fill shows the message, not a flat zero',
  v.message === 'Aucune altimétrie' && !v.graphe);

// ---- 6. the message follows the language ----------------------------------
p = new Profile({ dem: null, lang: 'en' });
p.setFeature(featureOf(geomOf(false), { name: 'x' }));
check('the message is localised (en)', panneau(p).message === 'No elevation data');
p.setOptions({ lang: 'es' });
check('the message follows a language change (es)', panneau(p).message === 'Sin datos de altitud');
p.setOptions({ labels: { noElevation: 'Nada' } });
check('and an explicit label overrides it', panneau(p).message === 'Nada');

console.log(ok ? '\n>>> ALL NO-ELEVATION TESTS PASS' : '\n>>> FAILURES');
process.exit(ok ? 0 : 1);
