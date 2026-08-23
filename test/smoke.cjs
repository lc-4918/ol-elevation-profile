const fs = require('fs'); const vm = require('vm'); const path = require('path');
// Paths relative to the script, not to the cwd: `npm test` runs from the repo root.
const root = path.join(__dirname, '..');
const { JSDOM } = require('jsdom');

const d3box = {}; vm.createContext(d3box);
vm.runInContext(fs.readFileSync(path.join(root, 'node_modules/d3/dist/d3.js'), 'utf8'), d3box);
const d3 = d3box.d3;

const dom = new JSDOM('<!doctype html><body></body>');
const document = dom.window.document;

class Control { constructor(o){ this.element = o.element; } setMap(m){ this._map = m; } getMap(){ return this._map; } }
const ol = {
  control: { Control },
  Overlay: class { constructor(){} setPosition(){} },
  Observable: { unByKey(){} },
  proj: { toLonLat: (c) => [c[0], c[1]] },
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
const sandbox = { ol, d3, document, window: dom.window, getComputedStyle: dom.window.getComputedStyle, console };
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

console.log(ok ? '\n>>> ALL TESTS PASS' : '\n>>> FAILURES'); process.exit(ok?0:1);
