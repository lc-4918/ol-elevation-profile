// The precomputed-profile source: `dem: { track: { url } }`.
//
// It is the one source that does not sample a terrain model at the track's points. The
// application computed the profile once, elsewhere, on the model it chose - and it may
// well have decimated it, so the answer carries its own geometry and REPLACES the
// feature's. That substitution, and the refusal to accept a half-usable answer, are what
// these tests pin down.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.Image = dom.window.Image;

const { fromLonLat } = await import('ol/proj.js');
const { getDistance } = await import('ol/sphere.js');
const { default: Profile } = await import('../src/ol-elevation-profile.js');

let ok = true;
const check = (n, c) => { console.log((c ? 'OK  ' : 'NOK ') + n); if (!c) ok = false; };

// The track on the map: three points, no Z.
const PTS = [[6.0, 45.0], [6.05, 45.02], [6.1, 45.04]];
const geom = {
  getType: () => 'LineString',
  getCoordinates: () => PTS.map((ll) => fromLonLat(ll)),
  getClosestPoint: () => [0, 0], getExtent: () => [0, 0, 1, 1]
};
const featureOf = (props) => ({
  getGeometry: () => geom, get: (k) => props[k],
  getProperties: () => props, getStyle: () => null
});

// The profile the application holds: five points, denser than the track and slightly
// longer - a decimation that no per-point source could ever produce.
const PROFIL = [
  [6.00, 45.00, 600], [6.03, 45.012, 640], [6.06, 45.024, 700],
  [6.09, 45.036, 660], [6.12, 45.048, 690]
];
const dist = (cs) => { let d = 0; for (let i = 1; i < cs.length; i++) d += getDistance(cs[i - 1], cs[i]); return d; };

let demandees = [];
const serve = (rep) => { globalThis.fetch = async (url) => { demandees.push(url); return rep(url); }; };
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

const fill = (dem, props = { id: 'abc' }) => new Promise((resolve) => {
  const p = new Profile({ dem, smoothing: 0 });
  p.on('demload', (e) => resolve({ e, p }));
  p.setFeature(featureOf(props));
  setTimeout(() => resolve({ e: { ok: null }, p, timeout: true }), 10000);
});

const URL_PROFIL = { track: { url: '/profils/{id}.json' } };

// ---- 1. triples: the answer's geometry wins -------------------------------
demandees = [];
serve(() => json({ coords: PROFIL }));
let r = await fill(URL_PROFIL);
check('track: the {id} template is read off the feature', demandees[0] === '/profils/abc.json');
check('track: the fill succeeds', r.e.ok === true);
check('track: reported as a non-tile source', r.e.zoom === null && r.e.tiles === 0);
check('track: elevations come from the profile',
  r.p.getStats().min === 600 && r.p.getStats().max === 700);
check('track: D+ is the profile\'s, not a flat zero', Math.round(r.p.getStats().ascent) === 130);
check('track: the substituted geometry sets the distance',
  Math.abs(r.p.getStats().distance - dist(PROFIL.map((c) => [c[0], c[1]]))) < 1);
check('track: the map feature is left untouched', geom.getCoordinates().length === 3);

// ---- 2. a bare array of numbers keeps the old meaning ----------------------
serve(() => json([500, 550, 520]));
r = await fill(URL_PROFIL);
check('track: a plain [z,…] lines up with the geometry',
  r.e.ok === true && r.p._demZ && r.p._demZ.length === 3 && r.p.getStats().max === 550);
check('track: no geometry substituted in that case',
  Math.abs(r.p.getStats().distance - dist(PTS)) < 1);

// ---- 3. the answer is refused rather than patched up -----------------------
serve(() => json({ coords: [[6.0, 45.0, 600], [6.03, 45.012, null], [6.06, 45.024, 700]] }));
r = await fill(URL_PROFIL);
check('track: one unusable triple fails the whole fill', r.e.ok === false);

serve(() => json({ coords: [[6.0, 45.0, 600]] }));
r = await fill(URL_PROFIL);
check('track: a single point is not a profile', r.e.ok === false);

serve(() => json({}, 404));
r = await fill(URL_PROFIL);
check('track: a track with no profile answers 404, which is a fact not a crash', r.e.ok === false);

// ---- 4. an incomplete template asks nothing --------------------------------
demandees = [];
serve(() => json({ coords: PROFIL }));
r = await fill(URL_PROFIL, {});
check('track: a missing property sends no request at all', demandees.length === 0 && r.e.ok === false);

// ---- 5. url as a function, and a custom parse ------------------------------
demandees = [];
serve(() => json({ releve: { pts: PROFIL } }));
r = await fill({ track: {
  url: (f) => `/api/${f.get('id')}/profile`,
  parse: (j) => j.releve.pts
} });
check('track: url may be a function', demandees[0] === '/api/abc/profile');
check('track: parse reshapes any answer', r.e.ok === true && r.p.getStats().max === 700);

// ---- 6. the newest click wins ----------------------------------------------
// The first request resolves LAST: without sequencing it would overwrite the second.
let n = 0;
globalThis.fetch = async () => {
  const moi = ++n;
  await new Promise((res) => setTimeout(res, moi === 1 ? 120 : 10));
  return json({ coords: moi === 1 ? PROFIL : PROFIL.map((c) => [c[0], c[1], 900]) });
};
const p = new Profile({ dem: URL_PROFIL, smoothing: 0 });
p.setFeature(featureOf({ id: 'lent' }));
p.setFeature(featureOf({ id: 'rapide' }));
await new Promise((res) => setTimeout(res, 400));
check('track: a slower earlier answer does not overwrite the current track',
  p.getStats() && p.getStats().max === 900);

// ---- 7. a feature whose geometry cannot be read ---------------------------
// The case this source exists for: a vector-tile feature. Its coordinates live in the
// tile's own frame, so no sampled source could ever query it - but the profile is keyed
// by the track, and identity is all it takes.
const sansGeom = {
  getGeometry: () => null, get: (k) => ({ id: 'mvt' })[k],
  getProperties: () => ({ id: 'mvt' }), getStyle: () => null
};
demandees = [];
serve(() => json({ coords: PROFIL }));
r = await new Promise((resolve) => {
  const q = new Profile({ dem: URL_PROFIL, smoothing: 0 });
  q.on('demload', (e) => resolve({ e, p: q }));
  q.setFeature(sansGeom);
  setTimeout(() => resolve({ e: { ok: null }, p: q, timeout: true }), 10000);
});
check('track: a feature with no readable geometry is still profiled',
  r.e.ok === true && r.p.getStats().max === 700);
check('track: it was asked for by identity alone', demandees[0] === '/profils/mvt.json');

// A sampled source, on the same feature, has nothing to work with and must not pretend.
r = await new Promise((resolve) => {
  const q = new Profile({ dem: (lls) => lls.map(() => 100), smoothing: 0 });
  q.on('demload', (e) => resolve({ e, p: q }));
  q.setFeature(sansGeom);
  setTimeout(() => resolve({ e: { ok: null }, p: q, timeout: true }), 1200);
});
check('track: a sampled source still refuses a feature it cannot read', r.timeout === true);

console.log(ok ? '\n>>> ALL TRACK SOURCE TESTS PASS' : '\n>>> FAILURES');
process.exit(ok ? 0 : 1);
