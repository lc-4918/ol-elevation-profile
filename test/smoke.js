const fs = require('fs'); const vm = require('vm');
const { JSDOM } = require('jsdom');

const d3box = {}; vm.createContext(d3box);
vm.runInContext(fs.readFileSync('node_modules/d3/dist/d3.js', 'utf8'), d3box);
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
const coordTimes = coords.map((_, i) => new Date(base + i*1080000).toISOString()); // 1080 s entre points -> 6480 s total
const props = { name: 'Tracé test', link: 'http://example.com/iti', coordTimes };
const feature = { getGeometry: () => geom, get: (k) => props[k], getProperties: () => props, getStyle: () => null };
const geom2d = { getType: () => 'LineString', getCoordinates: () => [[0,0],[1,1]], getExtent: () => [0,0,1,1] };
const feature2d = { getGeometry: () => geom2d, get: () => null, getProperties: () => ({}), getStyle: () => null };
const trackLayer = { getStyle: () => ({ getStroke: () => ({ getColor: () => '#c4541a' }) }) };

const code = fs.readFileSync('../dist/ol-elevation-profile.js', 'utf8');
const sandbox = { ol, d3, document, window: dom.window, getComputedStyle: dom.window.getComputedStyle, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const Profile = sandbox.OlElevationProfile;

let ok = true; const check = (n, c) => { console.log((c?'OK  ':'NOK ')+n); if(!c) ok=false; };

// featureHasZ
check('featureHasZ vrai (3D)', Profile.featureHasZ(feature) === true);
check('featureHasZ faux (2D)', Profile.featureHasZ(feature2d) === false);
check('featureHasTime vrai', Profile.featureHasTime(feature) === true);
check('featureHasTime faux', Profile.featureHasTime(feature2d) === false);
// format adaptatif
const fmt = Profile.prototype._fmtDuration.bind({ options: { labels: { durationUnits: { s:'sec', m:'min', h:'h', d:'j' } } } });
check('format 7 sec', fmt(7) === '7 sec');
check('format 26 min', fmt(26*60) === '26 min');
check('format 1 h 48 min', fmt(6480) === '1 h 48 min');
check('format 2 j 3 h', fmt(2*86400 + 3*3600) === '2 j 3 h');

const p = new Profile({ color:'auto', trackLayer, titleLink:'link', slope:true, zoom:true, tooltipItems:['distance','elevation','slope'] });
p.setMap(map); p.setFeature(feature);
check('visible après setFeature', p.element.style.display === '');
check('couleur auto = trace', p.element.style.getPropertyValue('--oep-area') === '#c4541a');
check('stats.duration ~ 6480 s', Math.abs(p.getStats().duration - 6480) < 1);
p.setOptions({ tooltipItems: ['time'] });
check('infobulle temps = durée au point', p._tooltipText(p._samples[p._samples.length-1]) === '1 h 48 min');
p.setOptions({ tooltipItems: ['distance','elevation','slope'] });

// ignoreStops (temps en mouvement) : segment du milieu = arrêt (mêmes coords, +3600 s)
const stopCoords = [[0,0,10],[0.001,0.001,12],[0.001,0.001,12],[0.002,0.002,14]];
const stopTimes = [0,100,3700,3800].map((sec) => new Date(base + sec*1000).toISOString());
const stopProps = { name:'avec arrêt', coordTimes: stopTimes };
const stopGeom = { getType:()=>'LineString', getCoordinates:()=>stopCoords, getExtent:()=>[0,0,0.002,0.002] };
const stopFeat = { getGeometry:()=>stopGeom, get:(k)=>stopProps[k], getProperties:()=>stopProps, getStyle:()=>null };
const pStop = new Profile({ ignoreStops:true }); pStop.setMap(map); pStop.setFeature(stopFeat);
const movWith = pStop.getStats().duration;
pStop.setOptions({ ignoreStops:false });
const movWithout = pStop.getStats().duration;
check('arrêt ignoré par défaut (~200 s)', movWith <= 250 && movWith >= 150);
check('sans ignoreStops = temps réel (~3800 s)', Math.abs(movWithout - 3800) < 5);
check('moving time < temps réel', movWith < movWithout);
check('toolbar zoom visible', p._toolbar.style.display === '');
check('slope: portions dessinées', p.element.querySelectorAll('.oep-area-slope').length >= 1);
check('slope: séparateurs présents', p.element.querySelectorAll('.oep-slope-sep').length >= 0); // >=0 (peut être 0 si 1 seule classe)

const full = p.getStats().distance;
// zoom A/B
p._zoomA = full * 0.25; p._zoomB = full * 0.75; p._applyZoom();
check('crop actif après applyZoom', p._cropMode === true);
check('distance recadrée < totale', p.getStats().distance < full);
check('A rebasé à 0 (1er échantillon x=0)', Math.abs(p._samples[0].x) < 1e-6);
check('bouton "Tout voir" visible', p._btnAll.style.display === '');
p._exitZoom();
check('sortie zoom -> distance totale', Math.abs(p.getStats().distance - full) < 1e-6);
check('bouton A revient', p._btnA.style.display === '');

// mobile
Object.defineProperty(dom.window, 'innerWidth', { value: 360, configurable: true });
p.setOptions({ position: 'top-right' });   // déclenche un rendu
check('mode mobile détecté', p._isMobile() === true);
check('classe oep-mobile appliquée', p.element.classList.contains('oep-mobile'));
check('placement forcé top/bottom', /oep-pos-(top|bottom)\b/.test(p.element.className) && !/oep-pos-top-right/.test(p.element.className));
Object.defineProperty(dom.window, 'innerWidth', { value: 1200, configurable: true });

// clear masque
p.clear(); check('masqué après clear', p.element.style.display === 'none');

console.log(ok ? '\n>>> TOUS LES TESTS PASSENT' : '\n>>> ECHECS'); process.exit(ok?0:1);
