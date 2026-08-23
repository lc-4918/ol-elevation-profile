// Integration test against a REAL OpenLayers, for what the mocked smoke test cannot reach:
// the DataTile path (ol/source/GeoTIFF and its family), which shares nothing with the XYZ
// one - no URL, no Web Mercator, no 256 pixel tiles, and values rather than colours.
//
// ol is a devDependency here and a peerDependency for consumers: nothing is bundled.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.Image = dom.window.Image;

const { default: DataTile } = await import('ol/source/DataTile.js');
const { fromLonLat, get: getProj } = await import('ol/proj.js');
const { default: Profile } = await import('../src/ol-elevation-profile.js');

let ok = true;
const check = (n, c) => { console.log((c ? 'OK  ' : 'NOK ') + n); if (!c) ok = false; };

const TS = 256, HALF = 20037508.342789244;
// Elevation = easting in kilometres: linear, so the expectation is analytic. Bilinear
// interpolation of a plane must return the plane, which a nearest-pixel read would not.
const linearSource = (bands = 1, band = 0) => new DataTile({
  loader: (z, x) => {
    const d = new Float32Array(TS * TS * bands);
    const size = 2 * HALF / Math.pow(2, z) / TS, x0 = -HALF + x * TS * size;
    for (let r = 0; r < TS; r++) for (let c = 0; c < TS; c++) {
      for (let b = 0; b < bands; b++) d[(r * TS + c) * bands + b] = b === band ? (x0 + (c + 0.5) * size) / 1000 : -9999;
    }
    return d;
  },
  bandCount: bands, tileSize: TS, maxZoom: 12
});

const pts = [[6.0, 45.0], [6.05, 45.02], [6.1, 45.04]];
const geom = {
  getType: () => 'LineString',
  getCoordinates: () => pts.map((ll) => fromLonLat(ll)),
  getClosestPoint: () => [0, 0], getExtent: () => [0, 0, 1, 1]
};
const feature = { getGeometry: () => geom, get: () => null, getProperties: () => ({}), getStyle: () => null };
const expected = pts.map((ll) => fromLonLat(ll)[0] / 1000);

const fill = (dem) => new Promise((resolve) => {
  const p = new Profile({ dem });
  p.on('demload', (e) => resolve({ e, p }));
  p.setFeature(feature);
  setTimeout(() => resolve({ e: { ok: null }, p, timeout: true }), 20000);
});

let r = await fill({ olSource: linearSource(), maxTiles: 64 });
check('DataTile: fills from a real ol/source/DataTile', r.e.ok === true);
check('DataTile: plane returned exactly (bilinear)',
  Math.abs(r.p.getStats().min - Math.min(...expected)) < 0.01 &&
  Math.abs(r.p.getStats().max - Math.max(...expected)) < 0.01);
check('DataTile: reported as a non-tile source', r.e.zoom === null && r.e.tiles === 0);

// A multi-band coverage: the wrong band would read the -9999 filler, not an elevation.
r = await fill({ olSource: linearSource(3, 1), band: 1, maxTiles: 64 });
check('DataTile: band selection honoured', r.e.ok === true && r.p.getStats().min > 0);
r = await fill({ olSource: linearSource(3, 1), maxTiles: 64 });
check('DataTile: wrong band reads the filler, not the elevations', r.p.getStats().min === -9999);

// A tile that never arrives must fail the fill, not hang it.
r = await fill({ olSource: new DataTile({ loader: () => { throw new Error('no data'); }, tileSize: TS, maxZoom: 12 }), maxTiles: 64 });
check('DataTile: a failing tile abandons the fill', r.e.ok === false && !r.timeout);

// The ol/source/GeoTIFF shape: no tile grid until getView() has settled. Awaiting that
// promise unconditionally would hang on a plain DataTile, whose getView() never settles.
const late = linearSource();
const realGrid = late.getTileGrid();
let released;
late.getTileGrid = () => released ? realGrid : null;
late.getView = () => new Promise((res) => setTimeout(() => { released = true; res({ tileGrid: realGrid, projection: getProj('EPSG:3857') }); }, 50));
r = await fill({ olSource: late, maxTiles: 64 });
check('DataTile: waits for getView when the grid is not known yet', r.e.ok === true && !r.timeout);

// ---- a real GeoTIFF, through ol/source/GeoTIFF -----------------------------
// Written on the fly with geotiff.js (a dependency of ol, so nothing extra is installed)
// and served over HTTP with range support, which is how a Cloud-Optimized GeoTIFF or a
// WCS GetCoverage is actually read.
const { writeArrayBuffer } = await import('geotiff');
const http = await import('node:http');
const { default: GeoTIFFSource } = await import('ol/source/GeoTIFF.js');

const GW = 64, GH = 64, OX = 600000, OY = 5700000, PXS = 100;
const grid = new Float32Array(GW * GH);
for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) grid[r * GW + c] = (OX + (c + 0.5) * PXS) / 1000;
const tif = Buffer.from(await writeArrayBuffer(grid, {
  width: GW, height: GH, SamplesPerPixel: 1, BitsPerSample: [32], SampleFormat: [3],
  ModelPixelScale: [PXS, PXS, 0], ModelTiepoint: [0, 0, 0, OX, OY, 0],
  GeoKeyDirectory: [1, 1, 0, 2, 1024, 0, 1, 1, 3857, 0, 1, 3857],
  ProjectedCSTypeGeoKey: 3857, GTModelTypeGeoKey: 1
}));
const server = http.createServer((req, res) => {
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
  if (req.method === 'HEAD') { res.writeHead(200, { 'content-length': tif.length, 'accept-ranges': 'bytes' }); res.end(); return; }
  if (m) {
    // Clamped: geotiff.js asks for a 64 KB block whatever the file size, and a
    // content-length longer than the body makes the fetch fail.
    const a2 = +m[1], b2 = Math.min(m[2] ? +m[2] : tif.length - 1, tif.length - 1);
    res.writeHead(206, { 'content-type': 'image/tiff', 'content-length': b2 - a2 + 1,
      'content-range': `bytes ${a2}-${b2}/${tif.length}`, 'accept-ranges': 'bytes' });
    res.end(tif.subarray(a2, b2 + 1));
  } else { res.writeHead(200, { 'content-type': 'image/tiff', 'content-length': tif.length, 'accept-ranges': 'bytes' }); res.end(tif); }
});
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const tifUrl = `http://127.0.0.1:${server.address().port}/dem.tif`;

// Points deliberately off the pixel centres: reading the containing pixel would show up
// as steps of up to half a pixel, which on this field is 50 m of "elevation".
const fx = [1.81, 3.5, 7.12, 12.63].map((f) => OX + f * PXS);
const tifCoords = fx.map((x) => [x, OY - 1500]);
const tifGeom = { getType: () => 'LineString', getCoordinates: () => tifCoords,
  getClosestPoint: () => tifCoords[0], getExtent: () => [fx[0], OY - 2000, fx[3], OY - 1000] };
const tifFeature = { getGeometry: () => tifGeom, get: () => null, getProperties: () => ({}), getStyle: () => null };

const tifSource = new GeoTIFFSource({ sources: [{ url: tifUrl }], normalize: false, interpolate: false, convertToRGB: false });
await tifSource.getView();
const tifRes = await new Promise((resolve) => {
  const q = new Profile({ dem: { olSource: tifSource, band: 0, maxTiles: 64 } });
  q.on('demload', (e) => resolve({ e, q }));
  q.setFeature(tifFeature);
  setTimeout(() => resolve({ e: { ok: null }, timeout: true }), 20000);
});
check('GeoTIFF: fills from a real ol/source/GeoTIFF over HTTP', tifRes.e.ok === true && !tifRes.timeout);
const errMax = Math.max(...(tifRes.q ? tifRes.q._demZ : []).map((v, i) => Math.abs(v - fx[i] / 1000)));
check('GeoTIFF: bilinear interpolation is exact off the pixel centres', errMax < 1e-4);

// Half a pixel outside the first pixel centre: the edge value is held, not extrapolated,
// and above all the fill is not dropped for a point that is inside the coverage.
const edgeX = OX + 0.37 * PXS;
const edgeGeom = { getType: () => 'LineString', getCoordinates: () => [[edgeX, OY - 1500], [OX + 5 * PXS, OY - 1500]],
  getClosestPoint: () => [edgeX, OY - 1500], getExtent: () => [edgeX, OY - 2000, OX + 5 * PXS, OY - 1000] };
const edgeRes = await new Promise((resolve) => {
  const q = new Profile({ dem: { olSource: tifSource, band: 0, maxTiles: 64 } });
  q.on('demload', (e) => resolve({ e, q }));
  q.setFeature({ getGeometry: () => edgeGeom, get: () => null, getProperties: () => ({}), getStyle: () => null });
  setTimeout(() => resolve({ e: { ok: null }, timeout: true }), 20000);
});
check('GeoTIFF: a point half a pixel from the edge does not fail the fill', edgeRes.e.ok === true);
check('GeoTIFF: the edge pixel value is held, not extrapolated',
  Math.abs(edgeRes.q._demZ[0] - (OX + 0.5 * PXS) / 1000) < 1e-4);
server.close();

console.log(ok ? '\n>>> ALL OL SOURCE TESTS PASS' : '\n>>> FAILURES');
process.exit(ok ? 0 : 1);
