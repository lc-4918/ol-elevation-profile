const fs = require('fs'); const vm = require('vm'); const path = require('path');
// Paths relative to the script, not to the cwd: `npm test` runs from the repo root.
const root = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');

const d3box = {}; vm.createContext(d3box);
vm.runInContext(fs.readFileSync(path.join(root, 'node_modules/d3/dist/d3.js'), 'utf8'), d3box);
const d3 = d3box.d3;

const dom = new JSDOM('<!doctype html><body></body>');
const document = dom.window.document;

class Control {
  constructor(o){ this.element = o.element; }
  setMap(m){ this._map = m; } getMap(){ return this._map; }
  // ol/Observable in miniature: _demDone emits `demload` through it.
  on(t, f){ (this._h = this._h || {})[t] = (this._h[t] || []).concat(f); }
  dispatchEvent(e){ ((this._h || {})[e.type] || []).forEach((f) => f(e)); }
}
const ol = {
  control: { Control },
  Overlay: class { constructor(){} setPosition(){} },
  Observable: { unByKey(){} },
  proj: { toLonLat: (c) => [c[0], c[1]], fromLonLat: (c) => [c[0], c[1]], get: (code) => ({ code }) },
  sphere: { getDistance: (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]) * 100000 },
  extent: { boundingExtent: (cs) => { let a=[Infinity,Infinity,-Infinity,-Infinity]; for(const c of cs){a[0]=Math.min(a[0],c[0]);a[1]=Math.min(a[1],c[1]);a[2]=Math.max(a[2],c[0]);a[3]=Math.max(a[3],c[1]);} return a; } }
};
const view = { getProjection: () => 'EPSG:3857', getResolution: () => 1, getResolutionForExtent: () => 2, fit(){}, };
const map = { on: () => ({}), getView: () => view, addOverlay(){}, getPixelFromCoordinate: () => [0,0],
  forEachFeatureAtPixel: () => undefined, getTargetElement: () => ({ clientWidth: 1024 }), getSize: () => [1024,768] };

const coords = [[0,0,10],[1,1,30],[2,2,12],[3,3,80],[4,4,5],[5,5,60],[6,6,20]];
const geom = { getType: () => 'LineString', getCoordinates: () => coords, getClosestPoint: () => coords[0], getExtent: () => [0,0,6,6] };
const base = Date.parse('2020-01-01T00:00:00Z');
const coordTimes = coords.map((_, i) => new Date(base + i*1080000).toISOString()); // 1080 s between points -> 6480 s total
const props = { name: 'Test track', link: 'http://example.com/iti', coordTimes };
const feature = { getGeometry: () => geom, get: (k) => props[k], getProperties: () => props, getStyle: () => null };
const geom2d = { getType: () => 'LineString', getCoordinates: () => [[0,0],[1,1]], getExtent: () => [0,0,1,1] };
const feature2d = { getGeometry: () => geom2d, get: () => null, getProperties: () => ({}), getStyle: () => null };
const trackLayer = { getStyle: () => ({ getStroke: () => ({ getColor: () => '#c4541a' }) }) };

const code = fs.readFileSync(path.join(root, 'dist/ol-elevation-profile.js'), 'utf8');
// Stubs settable by the async tests below: `fetch` for the point APIs, `Image` plus a
// canvas for the tile path. Nothing here reaches the network.
const stub = { fetch: null, tileUrls: null, pixel: [128, 0, 0, 255] };
class FakeImage {
  set src(u) { if (stub.tileUrls) stub.tileUrls.push(u); setTimeout(() => this.onload && this.onload(), 0); }
}
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => ({
  drawImage() {},
  getImageData: (x, y, w, h) => ({ data: (() => { const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { d[i*4] = stub.pixel[0]; d[i*4+1] = stub.pixel[1];
      d[i*4+2] = stub.pixel[2]; d[i*4+3] = stub.pixel[3]; } return d; })() })
}) });
const sandbox = { ol, d3, document, window: dom.window, getComputedStyle: dom.window.getComputedStyle, console,
  setTimeout, clearTimeout, fetch: (...a) => stub.fetch(...a), Image: FakeImage,
  XMLSerializer: dom.window.XMLSerializer, URL: dom.window.URL };
// The tile path builds its canvas through document.createElement.
const realCreate = dom.window.document.createElement.bind(dom.window.document);
sandbox.document = new Proxy(dom.window.document, { get: (t, k) =>
  k === 'createElement' ? ((tag) => tag === 'canvas' ? fakeCanvas() : realCreate(tag)) : Reflect.get(t, k) });
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Profile = sandbox.OlElevationProfile;

let ok = true; const check = (n, c) => { console.log((c?'OK  ':'NOK ')+n); if(!c) ok=false; };

// featureHasZ
check('featureHasZ true (3D)', Profile.featureHasZ(feature) === true);
check('featureHasZ false (2D)', Profile.featureHasZ(feature2d) === false);
check('featureHasTime true', Profile.featureHasTime(feature) === true);
check('featureHasTime false', Profile.featureHasTime(feature2d) === false);
// adaptive duration format
const fmt = Profile.prototype._fmtDuration.bind({ options: { labels: { durationUnits: { s:'sec', m:'min', h:'h', d:'d' } } } });
check('format 7 sec', fmt(7) === '7 sec');
check('format 26 min', fmt(26*60) === '26 min');
check('format 1 h 48 min', fmt(6480) === '1 h 48 min');
check('format 2 d 3 h', fmt(2*86400 + 3*3600) === '2 d 3 h');

const p = new Profile({ color:'auto', trackLayer, titleLink:'link', slope:true, zoom:true, tooltipItems:['distance','elevation','slope'] });
p.setMap(map); p.setFeature(feature);
check('visible after setFeature', p.element.style.display === '');
check('color auto = track colour', p.element.style.getPropertyValue('--oep-area') === '#c4541a');
check('stats.duration ~ 6480 s', Math.abs(p.getStats().duration - 6480) < 1);
p.setOptions({ tooltipItems: ['time'] });
check('tooltip time = elapsed time at the point', p._tooltipText(p._samples[p._samples.length-1]) === '1 h 48 min');
p.setOptions({ tooltipItems: ['distance','elevation','slope'] });

// ignoreStops (moving time): the middle segment is a stop (same coords, +3600 s)
const stopCoords = [[0,0,10],[0.001,0.001,12],[0.001,0.001,12],[0.002,0.002,14]];
const stopTimes = [0,100,3700,3800].map((sec) => new Date(base + sec*1000).toISOString());
const stopProps = { name:'with a stop', coordTimes: stopTimes };
const stopGeom = { getType:()=>'LineString', getCoordinates:()=>stopCoords, getExtent:()=>[0,0,0.002,0.002] };
const stopFeat = { getGeometry:()=>stopGeom, get:(k)=>stopProps[k], getProperties:()=>stopProps, getStyle:()=>null };
const pStop = new Profile({ ignoreStops:true }); pStop.setMap(map); pStop.setFeature(stopFeat);
const movWith = pStop.getStats().duration;
pStop.setOptions({ ignoreStops:false });
const movWithout = pStop.getStats().duration;
check('stop excluded by default (~200 s)', movWith <= 250 && movWith >= 150);
check('without ignoreStops = wall-clock time (~3800 s)', Math.abs(movWithout - 3800) < 5);
check('moving time < wall-clock time', movWith < movWithout);
check('zoom toolbar visible', p._toolbar.style.display === '');
check('slope: portions drawn', p.element.querySelectorAll('.oep-area-slope').length >= 1);
check('slope: separators present', p.element.querySelectorAll('.oep-slope-sep').length >= 0); // >=0 (may be 0 with a single class)

const full = p.getStats().distance;
// A/B crop
p._zoomA = full * 0.25; p._zoomB = full * 0.75; p._applyZoom();
check('crop active after applyZoom', p._cropMode === true);
check('cropped distance < total', p.getStats().distance < full);
check('A rebased to 0 (first sample x=0)', Math.abs(p._samples[0].x) < 1e-6);
check('"show all" button visible', p._btnAll.style.display === '');
p._exitZoom();
check('leaving the crop -> total distance', Math.abs(p.getStats().distance - full) < 1e-6);
check('A button comes back', p._btnA.style.display === '');

// mobile
Object.defineProperty(dom.window, 'innerWidth', { value: 360, configurable: true });
p.setOptions({ position: 'top-right' });   // triggers a render
check('mobile mode detected', p._isMobile() === true);
check('oep-mobile class applied', p.element.classList.contains('oep-mobile'));
check('placement forced to top/bottom', /oep-pos-(top|bottom)\b/.test(p.element.className) && !/oep-pos-top-right/.test(p.element.className));
Object.defineProperty(dom.window, 'innerWidth', { value: 1200, configurable: true });

// clear hides the control
p.clear(); check('hidden after clear', p.element.style.display === 'none');


// ---- geometry types ---------------------------------------------------------
// A polygon is profiled along its OUTER ring: holes are not part of the outline itself. Before geomLines() every call site wrapped getCoordinates() in one extra array
// unless it was a MultiLineString, so a polygon iterated over its rings as if they were
// points - silently, yielding a one-point profile at altitude 0 rather than an error.
const ring  = [[0,0,10],[1,0,50],[1,1,30],[0,1,20],[0,0,10]];   // closed ring
const hole  = [[0.4,0.4,999],[0.6,0.4,999],[0.6,0.6,999],[0.4,0.4,999]];
const mkGeom = (type, coords, closest) => ({ getType: () => type, getCoordinates: () => coords,
  getClosestPoint: (c) => closest ? closest(c) : [0,0], getExtent: () => [0,0,2,2] });
const mkFeat = (g) => ({ getGeometry: () => g, get: () => null, getProperties: () => ({}), getStyle: () => null });

const statsOf = (g) => { const q = new Profile({}); q.setMap(map); q.setFeature(mkFeat(g)); return q.getStats(); };

const poly = statsOf(mkGeom('Polygon', [ring]));
check('polygon: profiled along its outer ring', poly.points === 5);
// The ring is closed, so D+ and D- come out equal by construction - on a loop, that is
// exactly what one climbs going round it. Reported like on any other geometry.
check('polygon: D+ / D- reported', Math.abs(poly.ascent - 40) < 1e-6 && Math.abs(poly.descent - 40) < 1e-6);
check('polygon: closed ring -> D+ equals D-', poly.ascent === poly.descent);
check('polygon: distance and min/max too', poly.distance > 0 && poly.min === 10 && poly.max === 50);

const pHdr = new Profile({ headerItems: ['distance','ascent','descent','minmax'] });
pHdr.setMap(map); pHdr.setFeature(mkFeat(mkGeom('Polygon', [ring])));
check('polygon: header carries D+ and D-', /D\+/.test(pHdr._statsEl.innerHTML) && /D-/.test(pHdr._statsEl.innerHTML));
check('polygon: featureHasZ sees the ring', Profile.featureHasZ(mkFeat(mkGeom('Polygon', [ring]))) === true);

// The hole sits at 999 m: were it profiled, min/max would give it away.
const holed = statsOf(mkGeom('Polygon', [ring, hole]));
check('polygon: holes ignored', holed.points === 5 && holed.max === 50);

const multi = statsOf(mkGeom('MultiPolygon', [[ring], [hole]]));
check('multipolygon: one outer ring per polygon', multi.points === 5 + 4);

// A polygon's own getClosestPoint answers for its SURFACE: inside the ring it returns the
// cursor itself. Taking it at face value would make the marker follow the pointer across
// the whole shape instead of sliding along the outline.
const inside = [0.5, 0.5];
const pPoly = new Profile({});
pPoly.setMap(map); pPoly.setFeature(mkFeat(mkGeom('Polygon', [ring], (c) => c)));
const cp = pPoly._closestOnProfile(inside);
check('polygon: hover snaps to the outline, not the surface', cp[0] !== inside[0] || cp[1] !== inside[1]);
check('polygon: snapped point is a ring vertex', ring.some((r) => r[0] === cp[0] && r[1] === cp[1]));

// Lines keep the geometry's own answer, which is exact rather than limited to the samples.
const pLine = new Profile({});
pLine.setMap(map); pLine.setFeature(mkFeat(mkGeom('LineString', [[0,0,10],[2,2,20]], () => [1.234, 1.234])));
const cpl = pLine._closestOnProfile([9, 9]);
check('line: hover still uses the geometry', cpl[0] === 1.234);


// ---- DEM loading spinner ----------------------------------------------------
// The fill itself cannot run here (no Image in the sandbox), so the flag is set by hand:
// what matters is the render path it drives, not who raised it.
const pSpin = new Profile({});
pSpin.setMap(map); pSpin.setFeature(feature);
check('no spinner when nothing is loading', pSpin.element.querySelectorAll('.oep-spinner').length === 0);
pSpin._demLoading = true; pSpin._render();
check('spinner replaces the chart while loading',
      pSpin.element.querySelectorAll('.oep-spinner').length === 1 &&
      pSpin.element.querySelectorAll('svg.oep-svg').length === 0);
check('spinner keeps the chart height', pSpin.element.querySelector('.oep-loading').style.height === '180px');
// No inline colour: the ring must inherit --oep-area, which is what carries the theme
// and the track colour. Hard-coding one here would silently freeze the spinner blue.
check('spinner takes no colour of its own', !/color|border/i.test(pSpin.element.querySelector('.oep-spinner').getAttribute('style') || ''));
check('stats hidden while loading', pSpin._statsEl.innerHTML === '');
check('spinner is announced', pSpin.element.querySelector('.oep-loading').getAttribute('role') === 'status');
pSpin._demLoading = false; pSpin._render();
check('chart returns once loaded', pSpin.element.querySelectorAll('.oep-spinner').length === 0 &&
      pSpin.element.querySelectorAll('svg.oep-svg').length === 1);
check('stats return once loaded', pSpin._statsEl.innerHTML !== '');


// ---- PNG export -------------------------------------------------------------
// The image cannot be rasterised here (jsdom has no canvas), so what is checked is the
// SVG the export builds - which is where the traps are: a serialized SVG carries no
// stylesheet, and the pointer indicator has no business in a saved file.
const pPng = new Profile({ exportPng: true, slope: true });
pPng.setMap(map); pPng.setFeature(feature);
const built = pPng._exportSvg();
check('export: builds an SVG', !!built && /^<svg xmlns=/.test(built.svg));

const parsed = new dom.window.DOMParser().parseFromString(built.svg, 'image/svg+xml');
check('export: the SVG is well formed', parsed.querySelector('parsererror') === null);

check('export: carries the title', built.svg.indexOf('Test track') >= 0);
check('export: carries the stats line', built.svg.indexOf(pPng._statsEl.textContent) >= 0);
check('export: carries the chart', /oep-line|oep-area/.test(built.svg));
// The indicator marks where the pointer happens to be: meaningless once saved.
check('export: drops the position indicator', built.svg.indexOf('oep-focus') === -1);
check('export: drops the hit-test overlay', built.svg.indexOf('oep-overlay') === -1);
// Painting styles are frozen inline, or the export would come out as black shapes.
check('export: styles frozen inline', /<path[^>]*style="/.test(built.svg));
// The frame must hold the header as well as the chart, not the chart alone.
const chartH = +pPng.element.querySelector('svg.oep-svg').getAttribute('height');
check('export: taller than the chart alone (header included)', built.height > chartH + 20);
// A nested <svg> without width/height fills the parent viewport: the chart would be
// stretched over the header's height too.
check('export: inner chart keeps its own size',
      new RegExp('<svg[^>]*width="' + chartH.toString().replace(/\d+/, String(+pPng.element.querySelector('svg.oep-svg').getAttribute('width'))) + '"').test(built.svg) &&
      built.svg.indexOf('height="' + chartH + '"') > 0);
check('export: wider than the chart (padding)', built.width > +pPng.element.querySelector('svg.oep-svg').getAttribute('width'));

// The button lives in the toolbar, to the right of the zoom buttons.
const tb = [...pPng._toolbar.children];
check('export: button is last in the toolbar', tb[tb.length - 1] === pPng._btnPng);
check('export: button shown when enabled', pPng._btnPng.style.display === '' && pPng._toolbar.style.display === '');
const pNoPng = new Profile({});
pNoPng.setMap(map); pNoPng.setFeature(feature);
check('export: button hidden when disabled', pNoPng._btnPng.style.display === 'none');
// Neither option on: the toolbar itself goes away, as before.
check('export: toolbar still hidden with neither option', pNoPng._toolbar.style.display === 'none');
const pOnlyPng = new Profile({ exportPng: true });
pOnlyPng.setMap(map); pOnlyPng.setFeature(feature);
check('export: toolbar appears for export alone', pOnlyPng._toolbar.style.display === '' &&
      pOnlyPng._btnA.style.display === 'none');


// ---- collapsed mode ---------------------------------------------------------
// The title is the ONLY thing the CSS leaves visible once collapsed, and `_render` is
// skipped in that state: a change of feature used to leave the previous track's name on
// screen. Both the text and the `title` attribute are checked - the latter is what a
// truncated title shows on hover.
const props2 = { name: 'Second track' };
const feat2 = { getGeometry: () => geom, get: (k) => props2[k], getProperties: () => props2, getStyle: () => null };
const pCol = new Profile({ collapsed: true });
pCol.setMap(map); pCol.setFeature(feature);
check('collapsed: title set on first feature', pCol._titleEl.textContent === 'Test track');
pCol.setFeature(feat2);
check('collapsed: title follows a feature change', pCol._titleEl.textContent === 'Second track');
check('collapsed: title attribute follows too', pCol._titleEl.getAttribute('title') === 'Second track');
pCol.toggleCollapsed(false);
check('expanding keeps the current title', pCol._titleEl.textContent === 'Second track');
check('expanding renders the body', pCol.element.querySelectorAll('svg').length >= 1);


// ---- DEM: reading terrain tiles, offline -----------------------------------
// No request is made: hand-made tiles are injected straight into the sampler. The field
// chosen is LINEAR in world-pixel column, which gives an analytic expectation - the
// bilinear interpolation of a plane must return the plane itself, exactly, tile boundary
// included. A test redoing the same bilinear arithmetic would verify nothing.
const Sampler = Profile.DemSampler;
const TS = 256;
const encTerrarium = (m) => { const e = m + 32768, f = Math.floor(e);
  return [Math.floor(f / 256), f % 256, Math.round((e - f) * 256) & 255]; };
const buildTile = (valueAt) => { const d = new Uint8ClampedArray(TS * TS * 4);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const [r, g, b] = encTerrarium(valueAt(x, y)); const o = (y * TS + x) * 4;
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  } return d; };

const Z = 12;
const worldX = (lon) => (lon + 180) / 360 * TS * Math.pow(2, Z);
// Two points straddling a tile boundary: their 4 neighbours fall in two different tiles,
// the common case on a track and the only place where an offset would show.
const edgeLon = (Math.floor(worldX(6.865) / TS) * TS) / (TS * Math.pow(2, Z)) * 360 - 180;
const testPts = [[6.865, 45.832], [edgeLon - 1e-6, 45.832], [edgeLon + 1e-6, 45.832]];

// Elevation = world-pixel column, relative to a reference column: the absolute column
// exceeds 500 000 at this zoom, outside the terrarium encodable range (+/- 32767).
const BASE = Math.floor(worldX(6.865));
const mk = () => {
  const sp = new Sampler({ url: 'x', encoding: 'terrarium', tileSize: TS, concurrency: 1 });
  for (const key of sp.tilesFor(testPts, Z)) {
    const tx = parseInt(key.split('/')[1], 10);
    sp.tiles.set(key, buildTile((x) => tx * TS + x - BASE));
  }
  return sp;
};

const sp = mk();
let planeOk = true, edgeOk = true;
for (const [lon, lat] of testPts) {
  const got = sp.sample(lon, lat, Z);
  if (got == null || Math.abs(got - (worldX(lon) - 0.5 - BASE)) > 0.02) planeOk = false;
}
check('DEM: linear plane returned exactly (bilinear)', planeOk);
// The two points framing the boundary must not jump: they are 2e-6 degree apart, a
// fraction of a pixel.
const a = sp.sample(testPts[1][0], testPts[1][1], Z), b = sp.sample(testPts[2][0], testPts[2][1], Z);
check('DEM: continuity across a tile boundary', a != null && b != null && Math.abs(b - a) < 0.05);
check('DEM: 4 neighbours -> several tiles at an edge', sp.tilesFor([testPts[1]], Z).size >= 1 && sp.tilesFor(testPts, Z).size >= 2);

// Constant elevation: checks the terrarium decoding itself, decimals included.
const spc = new Sampler({ url: 'x', encoding: 'terrarium', tileSize: TS, concurrency: 1 });
for (const key of spc.tilesFor(testPts, Z)) spc.tiles.set(key, buildTile(() => 1234.5));
check('DEM: terrarium decoding (1234.5 m)', Math.abs(spc.sample(6.865, 45.832, Z) - 1234.5) < 0.01);

// All-or-nothing rule: a lost tile yields null, it is never guessed.
const spm = mk();
spm.tiles.set(Array.from(spm.tilesFor([testPts[0]], Z))[0], null);
check('DEM: lost tile -> null (no guessed elevation)', spm.sample(testPts[0][0], testPts[0][1], Z) === null);

// Mapbox encoding: another convention, same read path.
const spx = new Sampler({ url: 'x', encoding: 'mapbox', tileSize: TS, concurrency: 1 });
const encMapbox = (m) => { const v = Math.round((m + 10000) / 0.1);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
for (const key of spx.tilesFor(testPts, Z)) {
  const d = new Uint8ClampedArray(TS * TS * 4);
  for (let i = 0; i < TS * TS; i++) { const [r, g, b] = encMapbox(880); d[i*4]=r; d[i*4+1]=g; d[i*4+2]=b; d[i*4+3]=255; }
  spx.tiles.set(key, d);
}
check('DEM: mapbox decoding (880 m)', Math.abs(spx.sample(6.865, 45.832, Z) - 880) < 0.06);

// The fill never starts when the track already carries its Z, nor outside a browser.
const pDem = new Profile({ dem: true });
pDem.setMap(map); pDem.setFeature(feature);
check('DEM: dem option inert on a 3D track', pDem._demZ === null && pDem.getStats().max > 0);
// On by default: this is the line that decides whether a plain `new Profile()` reaches the
// network on a track without Z. Worth a test of its own rather than a comment.
check('DEM: on by default', new Profile({}).options.dem === 'terrarium');
check('DEM: dem null disables it', new Profile({ dem: null }).options.dem === null);
check('DEM: terrarium preset needs no key', /elevation-tiles-prod/.test(Profile.DEM_PRESETS.terrarium.url) &&
      !/key|token|api/i.test(Profile.DEM_PRESETS.terrarium.url));

// ---- custom samplers and the IGN source (async) -----------------------------
// The `sample` hook is what lets an application reach a GeoServer coverage, a GeoTIFF or
// a national API without this library carrying a decoder for any of them. It has to keep
// the same contract as the tile path: all or nothing, and never leave the spinner up.
const feat2d = mkFeat(mkGeom('LineString', [[6.0,45.0],[6.1,45.1],[6.2,45.2]]));
const fillWith = (dem, feature) => new Promise((resolve) => {
  const q = new Profile({ dem });
  q.setMap(map);
  q.on('demload', (e) => resolve({ e, q }));
  q.setFeature(feature || feat2d);
});

(async () => {
  let r = await fillWith((lonlats) => lonlats.map((_, i) => 100 + i * 10));
  check('sampler: a function fills the profile', r.e.ok === true && r.q.getStats().max === 120);
  check('sampler: zoom/tiles are null/0 for a custom source', r.e.zoom === null && r.e.tiles === 0);
  check('sampler: spinner cleared afterwards', r.q._demLoading === false);

  r = await fillWith({ sample: (ll) => Promise.resolve(ll.map(() => 42)) });
  check('sampler: {sample} form, and a promise', r.e.ok === true && r.q.getStats().min === 42);

  // A result of the wrong length is refused rather than padded: elevations one can no
  // longer map to their points would land on the wrong places, silently.
  r = await fillWith(() => [100, 200]);
  check('sampler: wrong length refused', r.e.ok === false && r.q.getStats().max === 0);

  r = await fillWith((ll) => ll.map((_, i) => (i === 1 ? null : 100)));
  check('sampler: one missing point abandons the fill', r.e.ok === false);

  r = await fillWith(() => { throw new Error('boom'); });
  check('sampler: a throwing source fails cleanly', r.e.ok === false && r.q._demLoading === false);

  // ---- IGN Géoplateforme, on a stubbed fetch --------------------------------
  const calls = [];
  const reply = (values) => (url) => { calls.push(url);
    const n = url.match(/lon=([^&]*)/)[1].split('|').length;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ elevations: values(n) }) }); };

  stub.fetch = reply((n) => Array.from({ length: n }, (_, i) => 200 + i));
  r = await fillWith({ source: 'ign', minInterval: 0 });
  check('IGN: fills from the point API', r.e.ok === true && r.q.getStats().min === 200);
  check('IGN: queries the Géoplateforme', /data\.geopf\.fr\/altimetrie/.test(calls[0]));
  check('IGN: asks for elevations only', /zonly=true/.test(calls[0]) && /resource=ign_rge_alti_wld/.test(calls[0]));
  check('IGN: no key in the URL by default', !/apikey/i.test(calls[0]));

  calls.length = 0;
  r = await fillWith({ source: 'ign', minInterval: 0, apiKey: 'S3CR3T' });
  check('IGN: apiKey appended when given', /apikey=S3CR3T/.test(calls[0]));

  // -99999 is what the service answers outside its coverage - a track straddling the
  // border must fail rather than sit at minus one hundred thousand metres.
  calls.length = 0;
  stub.fetch = reply((n) => Array.from({ length: n }, (_, i) => (i === 0 ? -99999 : 300)));
  r = await fillWith({ source: 'ign', minInterval: 0 });
  check('IGN: out of coverage (-99999) is not an altitude', r.e.ok === false && r.q.getStats().min === 0);

  // 200 points per request: beyond that the URL hits a 414 from intermediate servers.
  calls.length = 0;
  stub.fetch = reply((n) => Array.from({ length: n }, () => 500));
  const many = Array.from({ length: 250 }, (_, i) => [6 + i * 1e-4, 45 + i * 1e-4]);
  r = await fillWith({ source: 'ign', minInterval: 0 }, mkFeat(mkGeom('LineString', many)));
  check('IGN: batched 200 points per request', calls.length === 2 && r.e.ok === true);


  // ---- tile sources: XYZ, WMS, ol/source, custom decoding --------------------
  // stub.pixel is what every tile pixel holds; terrarium reads 128,0,0 as 0 m.
  const grab = async (dem, feature) => { stub.tileUrls = []; const out = await fillWith(dem, feature);
    return { ...out, urls: stub.tileUrls }; };

  let t = await grab({ url: 'https://tiles.example/{z}/{x}/{y}.png', maxZoom: 10 });
  check('XYZ: template expanded', t.e.ok === true && /^https:\/\/tiles\.example\/\d+\/\d+\/\d+\.png$/.test(t.urls[0]));

  // A WMS stands in for the tile template: one GetMap per tile of the same grid.
  t = await grab({ wms: { url: 'https://gs.example/wms', layers: 'dem' }, maxZoom: 10 });
  check('WMS: GetMap request built', /REQUEST=GetMap/.test(t.urls[0]) && /LAYERS=dem/.test(t.urls[0]));
  check('WMS: 1.3.0 uses CRS, not SRS', /CRS=EPSG%3A3857/.test(t.urls[0]) && !/[?&]SRS=/.test(t.urls[0]));
  check('WMS: bbox spans the tile', /BBOX=-?\d[\d.,-]+/.test(t.urls[0]) && /WIDTH=256/.test(t.urls[0]));

  // 1.1.1 names the same thing SRS. Sending CRS there gets the request rejected.
  t = await grab({ wms: { url: 'https://gs.example/wms', layers: 'dem', params: { VERSION: '1.1.1' } }, maxZoom: 10 });
  check('WMS: 1.1.1 switches to SRS', /SRS=EPSG%3A3857/.test(t.urls[0]) && !/[?&]CRS=/.test(t.urls[0]));

  // An ol/source/TileImage delegates URL building to OpenLayers itself.
  const olSource = { getTileUrlFunction: () => (tc) => `ol://${tc[0]}/${tc[1]}/${tc[2]}` };
  t = await grab({ olSource, maxZoom: 10 });
  check('ol source: URL function delegated', t.e.ok === true && /^ol:\/\/\d+\/\d+\/\d+$/.test(t.urls[0]));

  // Custom decoding: the same pixels, read another way.
  stub.pixel = [10, 20, 30, 255];
  t = await grab({ url: 'https://tiles.example/{z}/{x}/{y}.png', maxZoom: 10, encoding: (r, g, b) => r * 100 + g + b / 100 });
  check('encoding: a function decodes the pixels', t.e.ok === true && Math.abs(t.q.getStats().min - 1020.3) < 0.01);

  // A decoder returning null means no measurement, not zero metres.
  t = await grab({ url: 'https://tiles.example/{z}/{x}/{y}.png', maxZoom: 10, encoding: () => null });
  check('encoding: null is refused, not read as 0 m', t.e.ok === false);
  stub.pixel = [128, 0, 0, 255];

  // ---- GetFeatureInfo: one request per point --------------------------------
  const fiCalls = [];
  stub.fetch = (url) => { fiCalls.push(url);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ features: [{ properties: { GRAY_INDEX: 812.5 } }] }) }); };
  r = await fillWith({ featureInfo: { url: 'https://gs.example/wms', layers: 'mnt' } });
  check('GetFeatureInfo: fills from band values', r.e.ok === true && r.q.getStats().min === 812.5);
  check('GetFeatureInfo: one request per point', fiCalls.length === 3);
  check('GetFeatureInfo: queries the layer', /REQUEST=GetFeatureInfo/.test(fiCalls[0]) && /QUERY_LAYERS=mnt/.test(fiCalls[0]));
  check('GetFeatureInfo: one pixel box', /WIDTH=1/.test(fiCalls[0]) && /HEIGHT=1/.test(fiCalls[0]) && /[?&]I=0/.test(fiCalls[0]));

  // The band property is not standard; an explicit name must win over the first number.
  stub.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ features: [{ properties: { id: 7, ELEV: 250 } }] }) });
  r = await fillWith({ featureInfo: { url: 'https://gs.example/wms', layers: 'mnt', property: 'ELEV' } });
  check('GetFeatureInfo: named property wins', r.e.ok === true && r.q.getStats().min === 250);
  r = await fillWith({ featureInfo: { url: 'https://gs.example/wms', layers: 'mnt' } });
  check('GetFeatureInfo: first number otherwise', r.e.ok === true && r.q.getStats().min === 7);

  // A source that throws on construction must not take setFeature down with it: the fill
  // is a supplement, and a profile that worked without it has to keep working.
  const pBad = new Profile({ dem: { olSource: { getTileUrlFunction: () => { throw new Error('nope'); } } } });
  pBad.setMap(map);
  let threw = false;
  try { pBad.setFeature(feat2d); } catch (e) { threw = true; }
  check('source: a throwing source does not break setFeature', threw === false);
  check('source: the profile is still drawn', pBad.element.style.display === '');

  console.log(ok ? '\n>>> ALL TESTS PASS' : '\n>>> FAILURES'); process.exit(ok ? 0 : 1);
})();
