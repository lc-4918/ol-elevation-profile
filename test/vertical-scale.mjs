// `verticalScale`, and above all its `{ exaggeration }` form.
//
// An absolute scale (metres per centimetre) makes RANGES comparable; it does not make
// slopes comparable, because the horizontal axis always stretches over the whole track.
// An exaggeration fixes the ratio between the two axes, so the gradient read off the
// chart is the real one times a constant. Only the control can compute it: it alone
// knows the chart width once the margins are off, and the distance actually displayed.
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

// A ramp: `n` points spread over `km`, climbing `dz` metres in all.
const ramp = (km, dz, n = 200) => {
  const cs = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const ll = fromLonLat([6.0 + f * (km / 78.8), 45.0]);   // ~78.8 km per degree at 45N
    cs.push([ll[0], ll[1], 600 + f * dz]);
  }
  return {
    getType: () => 'LineString', getCoordinates: () => cs,
    getClosestPoint: () => [0, 0], getExtent: () => [0, 0, 1, 1]
  };
};
const featureOf = (geom) => ({
  getGeometry: () => geom, get: () => null, getProperties: () => ({}), getStyle: () => null
});

// jsdom lays nothing out, so the panel has no size: the chart dimensions are forced.
const profileOf = (verticalScale, geom) => {
  const p = new Profile({ dem: null, smoothing: 0, verticalScale, width: 800, height: 300 });
  p.setFeature(featureOf(geom));
  const s = p.getStats();
  const innerW = 800 - 48 - 24, innerH = 300 - 20 - 30;
  p._yScale(s, 5, innerH, innerW);                 // the render path, without a renderer
  return p;
};

const cm = (px, p) => px / p._pxPerCm();

// ---- 1. 'auto' fixes nothing --------------------------------------------
let p = profileOf('auto', ramp(10, 300));
check('auto: no absolute scale is published', p._vScale === null);
// The ratio is reported all the same - it exists in every mode, it is simply not held.
check('auto: the ratio obtained is still reported', p._vExaggeration > 0);
// And that is the whole difference: under 'auto' it drifts from one track to the next.
const a10 = profileOf('auto', ramp(10, 300))._vExaggeration;
const a30 = profileOf('auto', ramp(30, 300))._vExaggeration;
check('auto: the ratio drifts with the track, which is why slopes are not comparable',
  Math.abs(a10 - a30) / a10 > 0.5);

// ---- 2. a number is metres per centimetre --------------------------------
p = profileOf(50, ramp(10, 300));
check('number: the requested m/cm is applied', Math.abs(p._vScale - 50) < 0.01);

// A range too tall for the height widens the scale rather than spilling out.
p = profileOf(50, ramp(10, 4000));
check('number: the value is a floor, not a cage', p._vScale > 50);

// ---- 3. an exaggeration fixes the ratio between the axes ------------------
// Two tracks, three times apart in length, same requested exaggeration.
const court = profileOf({ exaggeration: 6 }, ramp(10, 300));
const long = profileOf({ exaggeration: 6 }, ramp(30, 900));
check('exaggeration: obtained on a 10 km track', Math.abs(court._vExaggeration - 6) < 0.05);
check('exaggeration: obtained on a 30 km track', Math.abs(long._vExaggeration - 6) < 0.05);
check('exaggeration: it is the ratio that is held, not the scale',
  Math.abs(court._vExaggeration - long._vExaggeration) < 0.05 && court._vScale !== long._vScale);
check('exaggeration: the m/cm differ, which is the whole point',
  long._vScale > court._vScale * 2.5);

// The same 5 % ramp must occupy the same angle on both, which an absolute scale fails.
// The gradient as DRAWN: centimetres climbed over centimetres travelled. At a fixed
// exaggeration it must equal the real gradient times that factor, whatever the length.
const angle = (p) => {
  const s = p.getStats(), innerW = 800 - 48 - 24;
  return ((s.max - s.min) / p._vScale) / cm(innerW, p);
};
const a1 = angle(profileOf({ exaggeration: 6 }, ramp(10, 500)));
const a2 = angle(profileOf({ exaggeration: 6 }, ramp(30, 1500)));
check('exaggeration: a 5 % ramp is drawn at the same angle whatever the length',
  Math.abs(a1 - a2) / a1 < 0.02);
check('exaggeration: that angle is the real 5 % gradient times six',
  Math.abs(a1 - 0.05 * 6) < 0.005);

// ---- 4. the floor applies here too ---------------------------------------
// A wall: 3000 m over 2 km cannot be drawn at 6x in 250 px, so the ratio drops.
p = profileOf({ exaggeration: 6 }, ramp(2, 3000));
check('exaggeration: a track too steep falls back rather than spilling out',
  p._vExaggeration !== null && p._vExaggeration < 6);

// ---- 5. nonsense is ignored, not obeyed ----------------------------------
for (const [nom, v] of [['zero', { exaggeration: 0 }], ['negative', { exaggeration: -3 }],
                        ['not a number', { exaggeration: 'six' }], ['empty object', {}]]) {
  p = profileOf(v, ramp(10, 300));
  check(`exaggeration: ${nom} falls back on 'auto'`, p._vScale === null);
}

console.log(ok ? '\n>>> ALL VERTICAL SCALE TESTS PASS' : '\n>>> FAILURES');
process.exit(ok ? 0 : 1);
