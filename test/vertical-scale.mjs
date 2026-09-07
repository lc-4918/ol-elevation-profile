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

// ---- 3 bis. the axis never dives below sea level -------------------------
// Centring the window used to hollow out space under the track: a wide scale - what a
// fixed exaggeration asks of a long track - pushed the axis to -900 m on a mountain
// profile. The extra room belongs above.
const domaineDe = (verticalScale, geom) => {
  const p = new Profile({ dem: null, smoothing: 0, verticalScale, width: 800, height: 300 });
  p.setFeature(featureOf(geom));
  return p._yScale(p.getStats(), 5, 250, 728).domain();
};
let d = domaineDe({ exaggeration: 6 }, ramp(118, 2265));      // a GR738-shaped traverse
check('the axis starts at zero, not below', d[0] === 0);
check('and the track still fits inside', d[1] >= 600 + 2265);

// A track that genuinely runs below sea level keeps its own floor: a depression is a
// fact, a negative elevation invented by the scale is not.
const creux = (() => {
  const cs = [];
  for (let i = 0; i < 200; i++) {
    const f = i / 199, ll = fromLonLat([6.0 + f * (40 / 78.8), 45.0]);
    cs.push([ll[0], ll[1], -400 + f * 100]);
  }
  return { getType: () => 'LineString', getCoordinates: () => cs,
           getClosestPoint: () => [0, 0], getExtent: () => [0, 0, 1, 1] };
})();
d = domaineDe({ exaggeration: 6 }, creux);
check('a track below sea level keeps a negative floor', d[0] <= -400);

// A short track, where the window still fits centred, is left centred.
d = domaineDe(50, ramp(10, 300));
check('a window that fits is still centred', d[0] > 0);

// ---- 3 ter. a CAP: fill the height, but never steeper than N ---------------
// A fixed exaggeration cannot serve a corpus that holds both a 2.5 km loop and a 680 km
// traverse: whatever the factor, one of the two ends up occupying a tenth of the frame.
// A cap leaves filling the height alone and only reins in the absurd.
const capDe = (n, geom) => {
  const p = new Profile({ dem: null, smoothing: 0, verticalScale: { maxExaggeration: n },
                          width: 1160, height: 300 });
  p.setFeature(featureOf(geom));
  const d = p._yScale(p.getStats(), 5, 250, 1088).domain();
  const st = p.getStats();
  return { part: (st.max - st.min) / (d[1] - d[0]), ex: p._vExaggeration, bas: d[0] };
};
const autoDe = (geom) => {
  const p = new Profile({ dem: null, smoothing: 0, verticalScale: 'auto', width: 1160, height: 300 });
  p.setFeature(featureOf(geom));
  const d = p._yScale(p.getStats(), 5, 250, 1088).domain();
  const st = p.getStats();
  return { part: (st.max - st.min) / (d[1] - d[0]), ex: p._vExaggeration };
};
// A track whose natural exaggeration is already under the cap is left exactly as 'auto'.
const moyenne = ramp(23, 600);
check('cap: a track under the cap is untouched',
  Math.abs(capDe(20, moyenne).part - autoDe(moyenne).part) < 0.001);
check('cap: and it still fills the height', capDe(20, moyenne).part > 0.8);

// A very long, gently sloping track: 'auto' would draw a 0.2 % gradient as a wall.
const tres_longue = ramp(680, 1400);
check('cap: auto alone would exaggerate absurdly', autoDe(tres_longue).ex > 50);
check('cap: the cap holds it at the requested ratio',
  Math.abs(capDe(20, tres_longue).ex - 20) < 0.5);
check('cap: a lower cap flattens further', capDe(12, tres_longue).part < capDe(20, tres_longue).part);
check('cap: the axis still starts at the floor', capDe(20, tres_longue).bas === 0);

// ---- 3 quater. under a cap, the HEIGHT gives way, not the axis ------------
// Holding the cap by widening the window was absurd on a long track: a 1107 km GR
// topping out at 2638 m was given an axis from 0 to 12000 m, and a 296 km traverse
// topping out at 119 m an axis from 0 to 3000. The drawing was right; the panel was
// ninety-five per cent empty and the axis no longer spoke of the terrain.
//
// At a fixed scale the drawing does NOT depend on the chart height: its metres per pixel
// are set, the track covers the same pixels, and all the height adds is emptiness above.
// So the height is taken away instead.
const sous = (km, z0, z1, hMax = 250, innerW = 848, cap = 25) => {
  const cs = [];
  for (let i = 0; i < 400; i++) {
    const f = i / 399, ll = fromLonLat([6.0 + f * (km / 78.8), 45.0]);
    cs.push([ll[0], ll[1], z0 + (z1 - z0) * Math.sin(f * Math.PI / 2)]);
  }
  const geom = { getType: () => 'LineString', getCoordinates: () => cs,
                 getClosestPoint: () => [0, 0], getExtent: () => [0, 0, 1, 1] };
  const p = new Profile({ dem: null, smoothing: 0, verticalScale: { maxExaggeration: cap },
                          width: innerW + 72 + 16, height: hMax + 50 });
  p.setFeature(featureOf(geom));
  const st = p.getStats();
  const dom = p._yScale(st, (st.max - st.min) * 0.1 || 10, hMax, innerW).domain();
  const t = p._yTicks;
  return { dom, ticks: t, pas: t ? t[1] - t[0] : null, h: p._chartHeight,
           dessin: (st.max - st.min) / (dom[1] - dom[0]) * p._chartHeight,
           ex: p._vExaggeration, max: st.max };
};

// The rule, in the words it was given in: a track topping out at 1149 m, on an axis
// stepped every 200 m, ends on a line at 1200.
let r = sous(250, 0, 1149);
check('cap: the step is round', r.pas === 200);
check('cap: the last line is the first round step above the summit', r.dom[1] === 1200);
check('cap: and the graduations are all round', r.ticks.every((v) => v % r.pas === 0));

// The 1107 km GR: the axis used to climb to 12000 m for a 2638 m summit.
r = sous(1107.4, 0, 2638);
check('cap: a very long track no longer gets a four-fold axis', r.dom[1] <= 4000);
check('cap: its panel shrinks instead', r.h < 100);
check('cap: and the drawing keeps its size', r.dessin > 40);
check('cap: the cap is still held', Math.abs(r.ex - 25) < 1);

// The 296 km traverse over flat ground: it must STAY flat. Fitting the axis to the
// terrain would turn 119 m of undulation into a mountain range.
r = sous(296.5, 0, 119);
check('cap: a long flat track keeps a small panel', r.h < 120);
check('cap: its axis stays close to the terrain', r.dom[1] <= 800);
check('cap: and it is still drawn flat', r.dessin / r.h < 0.25);

// Under 200 km the natural exaggeration stays below the cap, so nothing here applies:
// the track is drawn as 'auto' draws it, filling the height. That is the case the corpus
// is mostly made of, and it is left exactly as it was.
r = sous(138.2, 108, 1597);
check('cap: a 138 km track is left to auto', r.ticks === null && r.h === 250);

// A long MOUNTAIN track loses nothing: the height it needs, it keeps.
r = sous(300, 0, 2500);
check('cap: a long mountain track keeps a tall panel', r.h > 150);
check('cap: with an axis fitted to the summit', r.dom[1] === 2500);

// Nonsense is ignored rather than obeyed, as elsewhere.
for (const [nom, v] of [['zero', 0], ['negative', -4], ['not a number', 'twenty']]) {
  const p = new Profile({ dem: null, smoothing: 0, verticalScale: { maxExaggeration: v },
                          width: 1160, height: 300 });
  p.setFeature(featureOf(tres_longue));
  p._yScale(p.getStats(), 5, 250, 1088);
  check(`cap: ${nom} falls back on 'auto'`, p._vScale === null && p._vExaggeration > 50);
}

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
