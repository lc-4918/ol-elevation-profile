/**
 * Synchronized elevation profile control for OpenLayers, rendered with d3.
 *
 * Reads elevation (Z) directly from 3D line geometries (`[lon, lat, z]`). A track without
 * Z is completed from a terrain model - keyless AWS Terrain Tiles by default, which means
 * the control fetches tiles on its own; set `dem: null` to keep it entirely offline.
 * Clicking (or hovering) a track shows its profile; a marker stays synchronized on both
 * the map and the chart.
 *
 * Peer dependencies (provided by the host application, not bundled):
 *  - OpenLayers >= 6  (https://openlayers.org/)
 *  - d3 >= 7          (https://d3js.org/)
 *
 * @module ol-elevation-profile
 * @license MIT
 */
import Control from 'ol/control/Control.js';
import Overlay from 'ol/Overlay.js';
import { unByKey } from 'ol/Observable.js';
import { toLonLat, fromLonLat, transform, get as getProj } from 'ol/proj.js';
import TileState from 'ol/TileState.js';
import { getDistance } from 'ol/sphere.js';
import { boundingExtent } from 'ol/extent.js';
import * as d3 from 'd3';

  const THEMES = {
    steelblue: { area: '#4682b4', line: '#3a6d96', axis: '#555', text: '#222', focus: '#e6550d' },
    lime:      { area: '#9ccc2f', line: '#7da521', axis: '#555', text: '#222', focus: '#d62728' },
    purple:    { area: '#9467bd', line: '#76529c', axis: '#555', text: '#222', focus: '#ff9f1c' },
    slate:     { area: '#7c8a99', line: '#4a5560', axis: '#5a6570', text: '#26303a', focus: '#2f81f7' },
    graphite:  { area: '#9a948c', line: '#5c574f', axis: '#5c574f', text: '#2b2823', focus: '#e07a3f' },
    amber:     { area: '#f0a23b', line: '#c4671a', axis: '#7a5a36', text: '#3a2a16', focus: '#1f6fb2' }
  };

  const POSITIONS = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

  /**
   * Jeux de libellés livrés avec la librairie. `en` est le défaut et la retombée : une
   * langue inconnue rend l'anglais plutôt que des clés vides ou un mélange.
   *
   * Un jeu est complet, jamais partiel. Une traduction à trous laisserait deux langues
   * cohabiter dans le même panneau, ce qui se voit ; `labels` reste là pour corriger une
   * clé isolée sans avoir à redéclarer les autres.
   *
   * `ascent` et `descent` valent `D+` / `D-` partout : la notation est celle des cartes et
   * des topos, pas un mot à traduire.
   */
  const LOCALES = {
    en: {
      distance: 'Distance', elevation: 'Elevation', slope: 'Slope',
      ascent: 'D+', descent: 'D-', empty: 'Click a track',
      noElevation: 'No elevation data',
      untitled: 'Profile',
      time: 'Time', duration: 'Duration',
      durationUnits: { s: 'sec', m: 'min', h: 'h', d: 'd' },
      zoomStart: 'Set start (A)', zoomEnd: 'Set end (B)', zoomAll: 'Show all',
      zoomBack: 'Back one level',
      exportPng: 'Export as PNG',
      collapse: 'Collapse the profile', expand: 'Expand the profile',
      loading: 'Loading the elevation profile'
    },
    fr: {
      distance: 'Distance', elevation: 'Altitude', slope: 'Pente',
      ascent: 'D+', descent: 'D-', empty: 'Cliquez un tracé',
      noElevation: 'Aucune altimétrie',
      untitled: 'Profil',
      time: 'Temps', duration: 'Durée',
      durationUnits: { s: 'sec', m: 'min', h: 'h', d: 'j' },
      zoomStart: 'Définir le début (A)', zoomEnd: 'Définir la fin (B)', zoomAll: 'Tout voir',
      zoomBack: 'Revenir au niveau précédent',
      exportPng: 'Exporter en PNG',
      collapse: 'Réduire le profil', expand: 'Agrandir le profil',
      loading: 'Chargement du profil altimétrique'
    },
    es: {
      distance: 'Distancia', elevation: 'Altitud', slope: 'Pendiente',
      ascent: 'D+', descent: 'D-', empty: 'Haga clic en una traza',
      noElevation: 'Sin datos de altitud',
      untitled: 'Perfil',
      time: 'Tiempo', duration: 'Duración',
      durationUnits: { s: 'seg', m: 'min', h: 'h', d: 'd' },
      zoomStart: 'Definir el inicio (A)', zoomEnd: 'Definir el final (B)', zoomAll: 'Ver todo',
      zoomBack: 'Volver al nivel anterior',
      exportPng: 'Exportar como PNG',
      collapse: 'Contraer el perfil', expand: 'Desplegar el perfil',
      loading: 'Cargando el perfil de elevación'
    }
  };

  const DEFAULTS = {
    immersion: 'docked',
    position: 'bottom',
    width: 520,                   // number (px, capped to the map width) or 'auto'/'100%'/'full' = map width
    height: 180,
    margins: { unit: 'px', top: 20, right: 24, bottom: 30, left: 48 },
    units: 'meters',
    dataProjection: null,
    dem: 'terrarium',             // AWS tiles by default; null = off; or { url, encoding, zoom, maxTiles }
    maxPoints: 2000,
    smoothing: 0,                 // elevation smoothing: window in METRES (0 = none)
    theme: 'steelblue',
    color: null,                  // null = theme, 'auto' = track colour, or a CSS colour
    trackLayer: null,
    transparency: false,          // false | true | nombre 0..1
    transparencyLevel: 0.45,
    grid: true,
    slope: false,
    slopeClassSize: 2.5,
    slopeColors: null,            // null = blue->red ramp (HSL); otherwise an interpolated array
    slopeSeparators: true,        // vertical line at each class change
    slopeLegend: true,
    maxClasses: 8,                // maximum number of slope classes (colours + legend)
    xTicks: null,
    yTicks: null,
    verticalScale: 'auto',        // 'auto' : le profil remplit la hauteur ;
                                  // un nombre : mètres par centimètre physique ;
                                  // { exaggeration } : rapport fixe vertical/horizontal
    show: 'click',
    showWithoutElevation: true,   // trace sans Z, et aucun MNT n'a pu en fournir :
                                  // le panneau paraît quand même, avec un message
    collapsable: true,
    collapsed: false,
    followMap: true,
    marker: true,
    hideOnMapClick: true,
    responsive: true,             // adapts width/placement, mobile included
    mobileBreakpoint: 640,        // <= screen width -> mobile mode (100% width, top/bottom)
    zoom: false,                  // start/end buttons cropping map + profile to A..B
    zoomLevels: 3,                // niveaux de recadrage imbriqués (1 = l'ancien niveau unique)
    exportPng: false,             // toolbar button exporting the panel as a PNG
    ignoreStops: true,            // duration = moving time (stops excluded)
    stopSpeed: 0.5,               // stop threshold in m/s (~1.8 km/h)
    tooltipItems: ['distance', 'elevation'],
    headerItems: ['distance', 'ascent', 'descent', 'minmax'],
    titleProperty: 'name',        // ou une liste, essayée dans l'ordre
    titleLink: null,              // ou un nom, ou une liste : la première vraie URL gagne
    lang: 'en',                   // 'en' | 'fr' | 'es' : jeu de libellés livré
    labels: {}                    // surcharges clé à clé, appliquées par-dessus la langue
  };

  /** Libellés de la langue [lang], corrigés par les surcharges [over]. */
  function resolveLabels(lang, over) {
    return deepMerge(LOCALES[lang] || LOCALES.en, over || null);
  }

  // ----- helpers ---------------------------------------------------------
  function deepMerge(base, over) {
    const out = {};
    Object.keys(base).forEach((k) => { out[k] = base[k]; });
    if (over) Object.keys(over).forEach((k) => {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') out[k] = deepMerge(base[k], over[k]);
      else out[k] = over[k];
    });
    return out;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isUrl = (v) => typeof v === 'string' && /^(https?:)?\/\/|^mailto:/i.test(v);

  /**
   * Coordinate segments to profile, whatever the geometry type: an array of point arrays.
   *
   * A polygon is profiled along its **outer ring only**; the holes are not part of the
   * outline itself. The ring being closed, the profile returns to its starting point -
   * that is the outline, faithfully, not a defect.
   *
   * One place for the five that used to test `getType()` themselves: they all wrapped
   * `getCoordinates()` in one extra array unless it was a MultiLineString, which silently
   * made a polygon iterate over its rings as if they were points.
   */
  function geomLines(geom) {
    if (!geom || !geom.getCoordinates) return [];
    const c = geom.getCoordinates();
    switch (geom.getType()) {
      case 'LineString':
      case 'LinearRing': return [c];
      case 'MultiLineString': return c;
      case 'Polygon': return c.length ? [c[0]] : [];
      case 'MultiPolygon': return c.map((poly) => poly[0]).filter(Boolean);
      default: return [];
    }
  }

  /** Whether a geometry can be profiled at all - the map-selection filter and nothing more. */
  function isProfilable(geom) {
    return !!geom && /^(Multi)?(LineString|Polygon)$|^LinearRing$/.test(geom.getType());
  }

  // Flat array of timestamps (epoch ms) aligned on the flat coordinate order, read from
  // properties.coordTimes (ISO or number), coordinateProperties.times, or the 4th (M) dimension.
  function extractTimes(feature, lines) {
    const props = (feature && feature.getProperties) ? feature.getProperties() : {};
    let raw = props.coordTimes;
    if (raw == null && props.coordinateProperties) raw = props.coordinateProperties.times || props.coordinateProperties.coordTimes;
    let flat = null;
    if (Array.isArray(raw)) flat = Array.isArray(raw[0]) ? raw.reduce((a, b) => a.concat(b), []) : raw.slice();
    if (!flat && lines) {                          // fallback: 4th M dimension (XYZM layout)
      const tmp = []; let any = false;
      for (const seg of lines) for (const c of seg) { const v = c.length > 3 ? c[3] : null; tmp.push(v); if (v != null && isFinite(v)) any = true; }
      flat = any ? tmp : null;
    }
    if (!flat) return null;
    let valid = 0;
    const ms = flat.map((v) => {
      if (v == null || v === '') return null;
      const t = (typeof v === 'number') ? (v > 1e12 ? v : v * 1000) : Date.parse(v);  // epoch ms / epoch s / ISO
      if (!isFinite(t)) return null;
      valid++; return t;
    });
    return valid >= 2 ? ms : null;
  }

  function colorToCss(c) {
    if (c == null) return null;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) { const a = c.length > 3 ? c[3] : 1; return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
    return null;
  }
  function strokeColorOf(styleLike, feature, res) {
    let st = styleLike;
    if (typeof st === 'function') { try { st = st(feature, res); } catch (e) { return null; } }
    if (Array.isArray(st)) st = st[0];
    if (st && st.getStroke) { const s = st.getStroke(); if (s) return s.getColor(); }
    return null;
  }
  const fmtDistance = (m, units) => {
    if (units === 'imperial') { const mi = m / 1609.344; return mi < 0.2 ? `${Math.round(m * 3.28084)} ft` : `${mi.toFixed(mi < 10 ? 2 : 1)} mi`; }
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
  };
  const fmtElevation = (z, units) => units === 'imperial' ? `${Math.round(z * 3.28084)} ft` : `${Math.round(z)} m`;
  const fmtSlope = (p) => `${p >= 0 ? '+' : ''}${p.toFixed(1)} %`;
  const distAxisLabel = (units) => units === 'imperial' ? 'mi' : 'km';
  const distAxisScale = (units) => units === 'imperial' ? 1609.344 : 1000;

  function buildElement(o) {
    const el = document.createElement('div');
    el.className = 'ol-elevation-profile ol-unselectable ol-control'
      + ` oep-pos-${o.position}`
      + ` oep-theme-${typeof o.theme === 'string' ? o.theme : 'custom'}`
      + (o.immersion === 'floating' ? ' oep-floating' : '');
    return el;
  }

  const ICON_COLLAPSE = '<svg viewBox="0 0 24 24"><path d="M5 13h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const ICON_EXPAND = '<svg viewBox="0 0 24 24"><path d="M3 19l5-7 4 4 4-6 5 9z" fill="currentColor" opacity=".85"/></svg>';
  const ICON_A = '<svg viewBox="0 0 24 24"><path d="M7 5v14M11 12h8m0 0-3-3m3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_B = '<svg viewBox="0 0 24 24"><path d="M17 5v14M13 12H5m0 0 3-3m-3 3 3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_PNG = '<svg viewBox="0 0 24 24"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_BACK = '<svg viewBox="0 0 24 24"><path d="M10 6 4 12l6 6M4 12h10a6 6 0 0 1 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_ALL = '<svg viewBox="0 0 24 24"><path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // Recherche du segment contenant une abscisse. Construit une fois : le survol la sollicite
  // à chaque mouvement de souris.
  const bisectX = d3.bisector((d) => d.x).left;

  // ----- digital elevation model (DEM) -----------------------------------
  /**
   * Known terrain-tile sources.
   *
   * A PNG tile carries elevation in its R/G/B channels; it is read on a canvas rather
   * than queried point by point from an API. That is what makes a 10 000-point track a
   * handful of requests, with no key, no quota and no rate limit, where the free
   * elevation APIs cap out at 100 or 200 points per call.
   *
   * Attribution is not automatic: the library does not own the map. It is up to the
   * application to carry `attributions` in its own basemap source - and since the DEM is
   * on by default, that obligation arrives without having been asked for. `dem: null`
   * turns the whole thing off.
   */
  const DEM_PRESETS = {
    terrarium: {
      url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
      encoding: 'terrarium',
      maxZoom: 14,
      attributions: 'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a> (AWS Open Data)'
    },
    /**
     * IGN Géoplateforme, serving the RGE ALTI over France and its overseas territories.
     *
     * A point API rather than tiles, hence its own sampler: it answers 200 points per
     * request and announces one request per second, so a 10 000 point track takes about
     * fifty calls spread over as many seconds. In exchange it is metre-accurate where the
     * world models are at ninety.
     *
     * **No key is required** on the public endpoint - verified against the live service.
     * `apiKey` exists for a deployment that does demand one; it is appended as a query
     * parameter, named by `apiKeyParam`.
     *
     * Outside its coverage the service does not error: it answers OUT_OF_COVERAGE for the
     * point. No border is coded here - one asks, and it says itself where it does not know.
     */
    ign: {
      api: 'ign',
      url: 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json',
      resource: 'ign_rge_alti_wld',
      batch: 200,            // more fits, but the URL grows ~20 bytes a point and hits 414
      minInterval: 1100,     // ms between calls; the service announces 1 req/s
      attributions: 'Elevation: <a href="https://geoservices.ign.fr/rgealti">RGE ALTI</a> (IGN)'
    }
  };

  /** Value the IGN service returns where it holds no measurement. */
  const IGN_NO_DATA = -99999;

  /**
   * Request URL for one batch, in the order given: the response returns the elevations in
   * the same one.
   *
   * `zonly=true` cuts the response down to the elevations alone, without echoing the
   * coordinates - a third of the weight for the same information. Coordinates rounded to
   * the millionth of a degree, about ten centimetres: beyond that one only adds digits to
   * the URL.
   */
  function ignUrl(cfg, pts) {
    const f = (v) => v.toFixed(6);
    const sep = cfg.url.indexOf('?') >= 0 ? '&' : '?';
    let u = cfg.url + sep + 'resource=' + encodeURIComponent(cfg.resource) +
      '&delimiter=|&zonly=true' +
      '&lon=' + pts.map((p) => f(p[0])).join('|') +
      '&lat=' + pts.map((p) => f(p[1])).join('|');
    if (cfg.apiKey) u += '&' + (cfg.apiKeyParam || 'apikey') + '=' + encodeURIComponent(cfg.apiKey);
    return u;
  }

  /**
   * Sampler for the IGN service: batches, paces, and maps out-of-coverage to null.
   *
   * A batch whose response does not carry exactly as many elevations as points were asked
   * for fails the whole fill. Elevations one can no longer map to their points are worse
   * than absent ones: they would land on the wrong places, silently.
   */
  function ignSampler(cfg) {
    const size = Math.max(1, cfg.batch || 200);
    const gap = cfg.minInterval || 0;
    return (lonlats) => {
      const out = [];
      let last = 0;
      const step = (i) => {
        if (i >= lonlats.length) return Promise.resolve(out);
        const chunk = lonlats.slice(i, i + size);
        const wait = Math.max(0, gap - (Date.now() - last));
        return new Promise((r) => setTimeout(r, wait))
          .then(() => { last = Date.now(); return fetch(ignUrl(cfg, chunk)); })
          .then((r) => (r && r.ok) ? r.json() : null)
          .then((body) => {
            const z = body && body.elevations;
            if (!Array.isArray(z) || z.length !== chunk.length) return null;
            for (const v of z) out.push((v == null || v <= IGN_NO_DATA) ? null : v);
            return step(i + size);
          });
      };
      return step(0);
    };
  }

  const DEM_DEFAULTS = { source: 'terrarium', zoom: 'auto', maxZoom: 14, maxTiles: 32, concurrency: 6, tileSize: 256 };

  /**
   * RGB to metres decoders, one per encoding convention.
   *
   * `encoding` also takes a function `(r, g, b, a) => metres`, for a tile set that packs
   * elevation its own way. Return null where the pixel carries no measurement: the fill is
   * abandoned rather than guessed.
   *
   * A GeoServer greyscale DEM is NOT decoded here. What a WMS returns is a rendered image,
   * stretched and quantised by its style, not the coverage values; reading it back would
   * be reading the rendering. Those go through `featureInfo`, which asks the server for the
   * band value itself (see demConfig).
   */
  const DEM_DECODERS = {
    terrarium: (r, g, b) => (r * 256 + g + b / 256) - 32768,
    mapbox: (r, g, b) => -10000 + (r * 65536 + g * 256 + b) * 0.1
  };

  /** Half the Web Mercator world, in metres: the bound of EPSG:3857. */
  const MERC_HALF = 20037508.342789244;

  /** Extent of an XYZ tile in EPSG:3857, for the WMS requests built below. */
  function tileExtent(z, x, y) {
    const span = 2 * MERC_HALF / Math.pow(2, z);
    const minX = -MERC_HALF + x * span, maxY = MERC_HALF - y * span;
    return [minX, maxY - span, minX + span, maxY];
  }

  function query(base, params) {
    const sep = base.indexOf('?') >= 0 ? '&' : '?';
    return base.replace(/[?&]$/, '') + sep +
      Object.keys(params).map((k) => k + '=' + encodeURIComponent(params[k])).join('&');
  }

  /**
   * WMS GetMap URL covering one XYZ tile, so a WMS behaves like any other tile source.
   *
   * The axis-order trap: WMS 1.3.0 names the reference system `CRS`, 1.1.1 names it `SRS`,
   * and sending the wrong one gets the request rejected or silently mis-georeferenced.
   * The version actually in force decides, after the caller's params are merged in.
   */
  function wmsTileUrl(w, z, x, y, tileSize) {
    const p = Object.assign({
      SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', FORMAT: 'image/png',
      TRANSPARENT: 'false', STYLES: ''
    }, w.params || {});
    const key = String(p.VERSION).indexOf('1.1') === 0 ? 'SRS' : 'CRS';
    delete p.SRS; delete p.CRS;
    p[key] = w.projection || 'EPSG:3857';
    p.LAYERS = w.layers;
    p.WIDTH = tileSize; p.HEIGHT = tileSize;
    p.BBOX = tileExtent(z, x, y).join(',');
    return query(w.url, p);
  }

  /**
   * Where a tile comes from: an OpenLayers source, a WMS, or an XYZ template.
   *
   * Handing an `ol/source/TileImage` (XYZ, TileWMS, or any subclass) delegates URL building
   * to OpenLayers itself, which already knows that source's quirks - subdomains, custom
   * params, tile grid. Cheaper and safer than reimplementing each one here.
   */
  function tileUrlFn(cfg) {
    const src = cfg.olSource;
    if (src && typeof src.getTileUrlFunction === 'function') {
      const fn = src.getTileUrlFunction();
      const proj = getProj('EPSG:3857');
      return (z, x, y) => fn([z, x, y], 1, proj);
    }
    if (cfg.wms) return (z, x, y) => wmsTileUrl(cfg.wms, z, x, y, cfg.tileSize);
    return (z, x, y) => cfg.url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  }

  /**
   * Values of one DataTile, or null if it never arrived.
   *
   * A DataTile carries no URL: it is loaded by the source itself and its values are read
   * back with getData(). The state has to be watched rather than awaited - OpenLayers
   * announces it through a `change` event, not a promise.
   */
  function loadDataTile(tile) {
    return new Promise((resolve) => {
      const settle = () => {
        const st = tile.getState();
        if (st === TileState.LOADED) { resolve(tile.getData ? tile.getData() : null); return true; }
        if (st === TileState.ERROR || st === TileState.EMPTY) { resolve(null); return true; }
        return false;
      };
      if (settle()) return;
      const onChange = () => { if (settle()) tile.removeEventListener('change', onChange); };
      tile.addEventListener('change', onChange);
      if (tile.load) tile.load();
    });
  }

  /**
   * Sampler for an `ol/source/DataTile` - `ol/source/GeoTIFF` above all.
   *
   * Its own path because such a source shares nothing with the XYZ one: no URL, no Web
   * Mercator, no 256 pixel tiles. A GeoTIFF keeps **its own projection and its own tile
   * grid**, both only known once `getView()` has resolved, and its values are real numbers
   * rather than colours - so nothing here goes through a decoder.
   *
   * Positions are held in grid pixels, as with the XYZ tiles and for the same reason: the
   * four neighbours of a point straddle two tiles as soon as it runs along an edge.
   *
   * `normalize: false` matters on the source, otherwise OpenLayers rescales the values to
   * 0..1 and the profile comes out in fractions of nothing.
   */
  function dataTileSampler(cfg) {
    const src = cfg.olSource;
    const band = cfg.band || 0;
    return (lonlats) => {
      // getView() is only awaited when the grid is not known yet - which is the GeoTIFF
      // case, where it settles once the metadata has been read. On a plain DataTile that
      // promise never settles at all, and awaiting it unconditionally hangs the fill.
      const known = src.getTileGrid && src.getTileGrid();
      const ready = known ? Promise.resolve(null) : Promise.resolve(src.getView ? src.getView() : null);
      return ready.then((view) => {
      const grid = known || (src.getTileGrid && src.getTileGrid()) || (view && view.tileGrid);
      if (!grid) return null;
      const proj = getProj((view && view.projection) || (src.getProjection && src.getProjection()) || 'EPSG:3857');
      const zs = grid.getResolutions ? grid.getResolutions().length - 1 : 0;
      const bands = src.bandCount || 1;
      const coords = lonlats.map((ll) => transform([ll[0], ll[1]], 'EPSG:4326', proj));

      // Finest level whose tile count stays within maxTiles, as for the XYZ tiles: it is
      // the tiling that widens with the track, not the model that degrades.
      // Pixel bounds of the coverage, when it declares an extent. A point inside the raster
      // but within half a pixel of its edge lands on a neighbour that does not exist: its
      // tile would come back empty and the all-or-nothing rule would drop the whole track.
      // Half a pixel of tolerance at the borders, as on any regular grid.
      const ext = (grid.getExtent && grid.getExtent()) || (view && view.extent) || null;
      const plan = (z) => {
        const res = grid.getResolution(z), origin = grid.getOrigin(z);
        let ts = grid.getTileSize(z); ts = Array.isArray(ts) ? ts : [ts, ts];
        const cols = ext ? Math.round((ext[2] - ext[0]) / res) : Infinity;
        const rows = ext ? Math.round((ext[3] - ext[1]) / res) : Infinity;
        const clampI = (i) => Math.min(cols - 1, Math.max(0, i));
        const clampJ = (j) => Math.min(rows - 1, Math.max(0, j));
        const need = new Map();
        const at = coords.map((c) => {
          const px = (c[0] - origin[0]) / res - 0.5, py = (origin[1] - c[1]) / res - 0.5;
          const i0 = clampI(Math.floor(px)), j0 = clampJ(Math.floor(py));
          for (let di = 0; di < 2; di++) for (let dj = 0; dj < 2; dj++) {
            const tx = Math.floor(clampI(i0 + di) / ts[0]), ty = Math.floor(clampJ(j0 + dj) / ts[1]);
            need.set(tx + '/' + ty, [tx, ty]);
          }
          // Interpolation fractions clamped too: a point beyond the last pixel centre keeps
          // that pixel's value rather than extrapolating past the edge of the data.
          return { i0, j0, tx: Math.min(1, Math.max(0, px - i0)), ty: Math.min(1, Math.max(0, py - j0)), clampI, clampJ };
        });
        return { res, origin, ts, need, at, clampI, clampJ };
      };
      let z = zs, p = plan(z);
      while (z > 0 && p.need.size > cfg.maxTiles) { z--; p = plan(z); }
      if (p.need.size > cfg.maxTiles) return null;

      const keys = Array.from(p.need.keys());
      return Promise.all(keys.map((k) => {
        const t = p.need.get(k);
        return loadDataTile(src.getTile(z, t[0], t[1], 1, proj)).then((d) => [k, d]);
      })).then((pairs) => {
        const tiles = new Map(pairs);
        const value = (i, j) => {
          const tx = Math.floor(p.clampI(i) / p.ts[0]), ty = Math.floor(p.clampJ(j) / p.ts[1]);
          i = p.clampI(i); j = p.clampJ(j);
          const d = tiles.get(tx + '/' + ty);
          if (!d) return null;
          const col = i - tx * p.ts[0], row = j - ty * p.ts[1];
          const v = d[(row * p.ts[0] + col) * bands + band];
          return (v == null || !isFinite(v)) ? null : v;
        };
        return p.at.map((n) => {
          const a = value(n.i0, n.j0), b = value(n.i0 + 1, n.j0);
          const c = value(n.i0, n.j0 + 1), e = value(n.i0 + 1, n.j0 + 1);
          if (a == null || b == null || c == null || e == null) return null;
          const north = a + (b - a) * n.tx, south = c + (e - c) * n.tx;
          return north + (south - north) * n.ty;
        });
      });
      });
    };
  }

  /**
   * WMS GetFeatureInfo sampler: one request per point, for a coverage served as a rendered
   * greyscale that cannot be decoded from its pixels.
   *
   * **It is slow**, unavoidably: a thousand-point track is a thousand round trips, where a
   * tile source needs a handful. Worth it only when nothing else can reach the data - and
   * `concurrency` is what keeps it bearable.
   */
  function featureInfoSampler(cfg) {
    const fi = cfg.featureInfo;
    const lanes = Math.max(1, cfg.concurrency || 6);
    return (lonlats) => {
      const out = new Array(lonlats.length);
      let next = 0, broken = false;
      const one = () => {
        if (broken || next >= lonlats.length) return Promise.resolve();
        const i = next++;
        return fetch(featureInfoUrl(fi, lonlats[i]))
          .then((r) => (r && r.ok) ? r.json() : null)
          .then((body) => { out[i] = bandValue(body, fi.property); return one(); })
          .catch(() => { broken = true; });
      };
      const running = [];
      for (let i = 0; i < Math.min(lanes, lonlats.length); i++) running.push(one());
      return Promise.all(running).then(() => broken ? null : out);
    };
  }

  /** GetFeatureInfo URL for one point: a one-pixel image centred on it. */
  function featureInfoUrl(fi, ll) {
    const c = fromLonLat([ll[0], ll[1]]);
    const d = fi.resolution || 1;                       // half-size of the box, in metres
    const p = Object.assign({
      SERVICE: 'WMS', REQUEST: 'GetFeatureInfo', VERSION: '1.3.0',
      INFO_FORMAT: 'application/json', STYLES: '', FEATURE_COUNT: 1
    }, fi.params || {});
    const key = String(p.VERSION).indexOf('1.1') === 0 ? 'SRS' : 'CRS';
    delete p.SRS; delete p.CRS;
    p[key] = fi.projection || 'EPSG:3857';
    p.LAYERS = fi.layers;
    p.QUERY_LAYERS = fi.queryLayers || fi.layers;
    p.WIDTH = 1; p.HEIGHT = 1; p.I = 0; p.J = 0; p.X = 0; p.Y = 0;   // I/J is 1.3.0, X/Y is 1.1.1
    p.BBOX = [c[0] - d, c[1] - d, c[0] + d, c[1] + d].join(',');
    return query(fi.url, p);
  }

  /**
   * Band value in a GetFeatureInfo response.
   *
   * The band's property name is not standard - GeoServer calls it GRAY_INDEX for a
   * single-band coverage, but a styled or renamed layer answers otherwise. Without an
   * explicit `property` the first finite number wins, which is right whenever the coverage
   * carries one band, and is why `property` exists for when it does not.
   */
  function bandValue(body, property) {
    const f = body && body.features && body.features[0];
    const props = f && f.properties;
    if (!props) return null;
    if (property) { const v = Number(props[property]); return isFinite(v) ? v : null; }
    for (const k of Object.keys(props)) { const v = Number(props[k]); if (props[k] !== null && props[k] !== '' && isFinite(v)) return v; }
    return null;
  }

  /** Web Mercator pixel coordinates at zoom `z`, origin at the top-left corner of the world. */
  function worldPixel(lon, lat, z, tileSize) {
    const n = tileSize * Math.pow(2, z);
    const s = Math.sin(lat * Math.PI / 180);
    return [(lon + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
  }

  /**
   * Reads elevations from a set of terrain tiles.
   *
   * Positions are held in **world pixels** rather than tile by tile: the four neighbours
   * of a point can fall in two different tiles whenever it runs along an edge, which is
   * the common case on a track. Converting to world pixels first, then resolving the
   * tile, makes the edge case disappear instead of handling it.
   */
  class DemSampler {
    /** @param {Object} cfg `url`, `encoding`, `tileSize`, `concurrency`. */
    constructor(cfg) {
      this.cfg = cfg;
      this.decode = (typeof cfg.encoding === 'function') ? cfg.encoding
        : (DEM_DECODERS[cfg.encoding] || DEM_DECODERS.terrarium);
      this.tileUrl = tileUrlFn(cfg);
      this.tiles = new Map();          // "z/x/y" -> RGBA pixels, or null if the tile was lost
    }

    /**
     * North-west neighbour of the point plus the interpolation fractions, in world pixels.
     *
     * The half-pixel subtracted is not a fudge: pixel centres fall on half-integers, and
     * without that shift `floor()` would return the cell containing the point rather than
     * its western neighbour, offsetting the whole profile by half a pixel.
     */
    _neighbours(lon, lat, z) {
      const wp = worldPixel(lon, lat, z, this.cfg.tileSize);
      const px = wp[0] - 0.5, py = wp[1] - 0.5;
      const i0 = Math.floor(px), j0 = Math.floor(py);
      return { i0, j0, tx: px - i0, ty: py - j0 };
    }

    /** Tile key of a world pixel; x wraps around the globe, y clamps at the poles. */
    _key(i, j, z) {
      const ts = this.cfg.tileSize, span = ts * Math.pow(2, z);
      const jj = Math.min(span - 1, Math.max(0, j)), ii = ((i % span) + span) % span;
      return { key: z + '/' + Math.floor(ii / ts) + '/' + Math.floor(jj / ts), ii, jj };
    }

    /** Elevation of one pixel, or null if its tile is missing. */
    _at(i, j, z) {
      const ts = this.cfg.tileSize;
      const r = this._key(i, j, z);
      const data = this.tiles.get(r.key);
      if (!data) return null;
      const o = ((r.jj % ts) * ts + (r.ii % ts)) * 4;
      const v = this.decode(data[o], data[o + 1], data[o + 2], data[o + 3]);
      return (v == null || !isFinite(v)) ? null : v;
    }

    /**
     * Elevation **bilinearly interpolated** between the four surrounding pixels; null as
     * soon as a single one is missing.
     *
     * Bilinear rather than "the pixel containing the point": on a 30 or 90 m model, taking
     * the pixel value makes the profile advance in stairs, and every stair counts as a
     * climb then a descent in the ascent total. The interpolation invents no relief: it
     * renders the same surface, without the steps of the sampling grid.
     */
    sample(lon, lat, z) {
      const n = this._neighbours(lon, lat, z);
      const a = this._at(n.i0, n.j0, z), b = this._at(n.i0 + 1, n.j0, z);
      const c = this._at(n.i0, n.j0 + 1, z), d = this._at(n.i0 + 1, n.j0 + 1, z);
      if (a == null || b == null || c == null || d == null) return null;
      const north = a + (b - a) * n.tx, south = c + (d - c) * n.tx;
      return north + (south - north) * n.ty;
    }

    /** Keys of the tiles needed by the four neighbours of each of the points. */
    tilesFor(lonlats, z) {
      const keys = new Set();
      for (const ll of lonlats) {
        const n = this._neighbours(ll[0], ll[1], z);
        for (let di = 0; di < 2; di++) for (let dj = 0; dj < 2; dj++) keys.add(this._key(n.i0 + di, n.j0 + dj, z).key);
      }
      return keys;
    }

    /** Pixels of one tile, or null if it could not be read. */
    _fetch(key) {
      const parts = key.split('/');
      const url = this.tileUrl(+parts[0], +parts[1], +parts[2]);
      return new Promise((resolve) => {
        const img = new Image();
        // Without this attribute the canvas is tainted and getImageData throws: the tile
        // would display, but stay unreadable. The intended sources answer with
        // Access-Control-Allow-Origin: *.
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const ts = this.cfg.tileSize;
            const cv = document.createElement('canvas');
            cv.width = ts; cv.height = ts;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, ts, ts);
            resolve(ctx.getImageData(0, 0, ts, ts).data);
          } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }

    /**
     * Loads the missing tiles, `concurrency` in flight. Resolves false if one is missing.
     *
     * Lost tiles are remembered as such: without that, a second pass over the same track
     * would fire the same requests, doomed to fail again.
     */
    load(keys) {
      const todo = Array.from(keys).filter((k) => !this.tiles.has(k));
      let next = 0, ok = true;
      const worker = () => {
        if (next >= todo.length) return Promise.resolve();
        const k = todo[next++];
        return this._fetch(k).then((data) => { this.tiles.set(k, data); if (!data) ok = false; return worker(); });
      };
      const lanes = [];
      for (let i = 0; i < Math.min(this.cfg.concurrency, todo.length); i++) lanes.push(worker());
      return Promise.all(lanes).then(() => ok);
    }
  }

  /**
   * The `dem` option (true | source name | sampling function | object) into
   * a full configuration, or null.
   *
   * A `sample` function short-circuits the tile machinery entirely: the application
   * answers with the elevations itself, from wherever it can reach them - a GeoServer
   * WCS coverage, a GeoTIFF decoded with geotiff.js, a national elevation API. Only the
   * transport is delegated; the control keeps the sequencing, the all-or-nothing rule,
   * the spinner and the `demload` event, which is where the subtle parts live.
   *
   * That extension point rather than a WMS/WCS/GeoTIFF mode per protocol: reading a
   * GeoTIFF means a full decoder, and this library has no runtime dependency to spend
   * on one that most users would never load.
   */
  function demConfig(opt) {
    if (!opt) return null;
    if (typeof opt === 'function') return Object.assign({}, DEM_DEFAULTS, { sample: opt });
    const raw = (opt === true || typeof opt === 'string') ? { source: opt === true ? 'terrarium' : opt } : Object.assign({}, opt);
    if (typeof raw.sample === 'function') return Object.assign({}, DEM_DEFAULTS, raw);
    // A precomputed profile, held by the application and keyed by the track. It is the one
    // source that answers with the WHOLE track rather than one value per point: no grid to
    // choose, no pixels to decode, and nothing to sample.
    if (raw.track) {
      const trCfg = Object.assign({}, DEM_DEFAULTS, raw);
      trCfg.track = Object.assign({ coords: 'coords', parse: null, fetchOptions: null },
                                  typeof raw.track === 'string' ? { url: raw.track } : raw.track);
      return trCfg.track.url ? trCfg : null;
    }
    // A point-query source: no tile grid, no pixel decoding.
    if (raw.featureInfo) {
      const fiCfg = Object.assign({}, DEM_DEFAULTS, raw);
      fiCfg.sample = featureInfoSampler(fiCfg);
      return fiCfg;
    }
    // An ol/source/DataTile (GeoTIFF above all) carries values, not URLs: its own path.
    if (raw.olSource && typeof raw.olSource.getTileUrlFunction !== 'function' &&
        typeof raw.olSource.getTile === 'function') {
      const dtCfg = Object.assign({}, DEM_DEFAULTS, raw);
      dtCfg.sample = dataTileSampler(dtCfg);
      return dtCfg;
    }
    // Tiles: an OpenLayers source or a WMS both stand in for the url template.
    const hasTiles = raw.url || raw.wms || raw.olSource;
    const preset = DEM_PRESETS[raw.source] || (hasTiles ? {} : DEM_PRESETS.terrarium);
    const cfg = Object.assign({}, DEM_DEFAULTS, preset, raw);
    if (cfg.api === 'ign') { cfg.sample = ignSampler(cfg); return cfg; }   // a point API
    return (cfg.url || cfg.wms || cfg.olSource) ? cfg : null;
  }

  /**
   * L'URL du profil d'une trace : un gabarit `{propriete}` lu sur l'entité, ou une fonction.
   *
   * Une propriété absente rend `null` plutôt qu'une URL trouée : demander `/profils/.json`
   * ferait répondre le serveur - souvent par un 404, parfois par autre chose - là où la
   * question n'a simplement pas de sens pour cette trace.
   */
  function trackUrl(tpl, feature) {
    if (typeof tpl === 'function') return tpl(feature) || null;
    if (typeof tpl !== 'string' || !feature) return null;
    let complet = true;
    const url = tpl.replace(/\{(\w+)\}/g, (_, cle) => {
      const v = feature.get(cle);
      if (v == null || v === '') { complet = false; return ''; }
      return encodeURIComponent(String(v));
    });
    return complet ? url : null;
  }

  /**
   * Zoom at which to download the model: the finest one that fits within `maxTiles`.
   *
   * It is the tiling that widens as the track grows, not a model that degrades: a 10 km
   * track is read at the finest step available, a 300 km one at a coarser step rather
   * than in three hundred requests.
   */
  function demZoomFor(sampler, lonlats, cfg) {
    if (typeof cfg.zoom === 'number') return cfg.zoom;
    for (let z = cfg.maxZoom; z > 0; z--) if (sampler.tilesFor(lonlats, z).size <= cfg.maxTiles) return z;
    return 1;
  }

  // =======================================================================
  /**
   * @typedef {Object} ElevationProfileOptions
   * @property {'docked'|'floating'} [immersion='docked'] Panel placement strategy (floating is partial).
   * @property {'top'|'bottom'|'left'|'right'|'top-left'|'top-right'|'bottom-left'|'bottom-right'} [position='bottom'] Anchor on the map.
   * @property {number|'auto'|'100%'|'full'} [width=520] Width in px (capped to the map width), or full map width.
   * @property {number} [height=180] Height in px.
   * @property {{unit:('px'|'em'|'rem'),top:number,right:number,bottom:number,left:number}} [margins] Inner chart margins.
   * @property {'meters'|'imperial'} [units='meters'] Distance/elevation units.
   * @property {string} [theme='steelblue'] Built-in theme name or a colors object.
   * @property {?string} [color=null] `null` = theme, `'auto'` = track color (area = color, darker line), or a CSS color.
   * @property {?import('ol/layer/Vector').default} [trackLayer=null] Layer used to read the track color when `color:'auto'`.
   * @property {boolean|number} [transparency=false] `false`, `true` (= transparencyLevel), or alpha 0..1 (0 = fully transparent).
   * @property {number} [transparencyLevel=0.45] Background alpha when `transparency===true`.
   * @property {boolean} [grid=true] Horizontal grid lines.
   * @property {boolean} [slope=false] Split the profile into slope-class colored portions.
   * @property {number} [slopeClassSize=2.5] Slope class width, in percent.
   * @property {number} [maxClasses=8] Maximum number of slope classes (colors + legend).
   * @property {?string[]} [slopeColors=null] `null` = blue-to-red ramp; otherwise an interpolated color array.
   * @property {boolean} [slopeSeparators=true] Vertical separator at each slope-class change.
   * @property {boolean} [slopeLegend=true] Color legend under the title.
   * @property {number} [smoothing=0] Elevation smoothing window, in METERS (0 = none).
   * @property {?number} [xTicks=null] X axis ticks (null = auto from width).
   * @property {?number} [yTicks=null] Y axis ticks (null = auto from height).
   * @property {('auto'|number|{exaggeration:number})} [verticalScale='auto'] `'auto'`: the
   *   profile fills the height, which is legible but changes scale from one track to the
   *   next, so a 2 % ramp looks like a wall and two profiles cannot be compared. A number
   *   fixes the metres covered per physical centimetre, which makes RANGES comparable.
   *   `{exaggeration}` fixes the ratio between the two axes instead, which makes SLOPES
   *   comparable: the gradient read off the chart is the real one, multiplied by the same
   *   factor on every track, and the control recomputes it per track and per A/B crop.
   *   Either form is a **floor**, not a cage: a track whose range exceeds what the height
   *   can show would spill out of the frame, which is worse than losing comparability, so
   *   the scale then widens silently, nothing being drawn on the chart to say so.
   * @property {'click'|'mouseover'} [show='click'] How a track is selected on the map.
   * @property {boolean} [showWithoutElevation=true] What to do with a track that ends up
   *   with no elevation at all: none in its geometry, and none the terrain model could
   *   supply either (`dem: null`, or a fill that failed). `true` shows the panel with the
   *   track's title and the `noElevation` message where the chart would be; `false` hides
   *   the panel outright. Either way no chart is drawn: a flat line at zero under a D+ of
   *   0 m is not a missing figure, it is a wrong one.
   * @property {boolean} [hideOnMapClick=true] Click on empty map hides the profile.
   * @property {boolean} [collapsable=true] Show the collapse/expand button.
   * @property {boolean} [collapsed=false] Initial collapsed state.
   * @property {boolean} [followMap=true] Hovering the map moves the chart indicator.
   * @property {boolean} [marker=true] Show the position marker on the map.
   * @property {boolean} [responsive=true] Adapt width/placement; mobile included.
   * @property {number} [mobileBreakpoint=640] Below this width: mobile mode (100% width, top/bottom only).
   * @property {boolean} [zoom=false] A/B buttons to crop map + profile to a sub-range.
   * @property {number} [zoomLevels=3] Nested crops allowed: a crop can itself be cropped,
   *   down to this depth. `1` restores the former single level. A "back" button appears
   *   from the second level; "show all" empties the stack whatever the depth.
   * @property {boolean} [exportPng=false] Toolbar button exporting the whole panel as a PNG.
   * @property {boolean} [ignoreStops=true] When computing time, ignore stopped segments (moving time).
   * @property {number} [stopSpeed=0.5] Speed threshold (m/s) below which a segment counts as a stop.
   * @property {Array<'distance'|'elevation'|'slope'|'time'>} [tooltipItems=['distance','elevation']] Tooltip content (`'time'` = elapsed time at the cursor, if the track has time data).
   * @property {Array<string|{property:string,label?:string,asLink?:boolean,linkText?:string}>} [headerItems] Header content (string tokens: distance, ascent, descent, min, max, minmax, `'duration'` = total elapsed time).
   * @property {('en'|'fr'|'es')} [lang='en'] Language of the shipped labels. An unknown
   *   code falls back to English rather than leaving keys empty.
   * @property {Object} [labels={}] Per-key overrides applied on top of `lang`. They survive
   *   a later language change, so a corrected key stays corrected.
   * @property {(string|string[])} [titleProperty='name'] Feature property used as the title,
   *   or a list of them tried in order - the first one holding a value wins. A feature with
   *   none falls back on the `untitled` label.
   * @property {?(string|string[])} [titleLink=null] Feature property holding a URL, which
   *   makes the title a link, or a list tried in order - the first one holding an actual
   *   URL wins, so a property carrying something else is stepped over rather than rendered
   *   as a broken link. `null`, the default, never links the title: a dataset is not asked
   *   to explain that its `url` column is not the one meant for the reader.
   * @property {number} [maxPoints=2000] Decimation for render/interaction (stats use full data).
   * @property {?import('ol/proj/Projection').default|string} [dataProjection=null] Projection of the feature coordinates.
   * @property {?(boolean|string|Function|Object)} [dem='terrarium'] Fill missing elevations
   *   from a terrain model. Sources: `'terrarium'` (default) or `true` = AWS Terrain Tiles;
   *   `'ign'` = IGN Géoplateforme RGE ALTI (France, keyless, `apiKey` optional);
   *   `{url}` = XYZ template; `{wms:{url,layers,params}}` = WMS tiles;
   *   `{olSource}` = any `ol/source/TileImage` (XYZ, TileWMS, and so on);
   *   `{featureInfo:{url,layers,property}}` = WMS GetFeatureInfo, one request per point,
   *   for a greyscale coverage that cannot be decoded from its pixels (slow);
   *   `{track:{url,coords,parse,fetchOptions}}` = a profile the application computed
   *   beforehand and serves per track, `url` being a `{property}` template read off the
   *   feature (or a function). Unlike every other source it answers with the whole track:
   *   `[[lon,lat,z],…]` replaces the geometry, so a decimated profile is accepted, while a
   *   plain `[z,…]` still lines up with the geometry's own points;
   *   a function or `{sample}` `(lonlats, ctx) => number[]|Promise<number[]>` to source them
   *   yourself; `null` disables the whole thing.
   *   Decoding: `encoding` is `'terrarium'`, `'mapbox'`, or a function `(r,g,b,a) => metres`.
   */

  /**
   * Elevation profile control.
   * @extends {import('ol/control/Control').default}
   *
   * @example
   * const profile = new OlElevationProfile({ theme: 'steelblue', color: 'auto', trackLayer });
   * map.addControl(profile);
   * profile.setFeature(feature); // feature with a 3D LineString geometry
   */
  class ElevationProfile extends Control {
    /** @param {ElevationProfileOptions} [opts] */
    constructor(opts) {
      const o = deepMerge(DEFAULTS, opts || {});
      if (POSITIONS.indexOf(o.position) === -1) o.position = 'bottom';
      // Les surcharges sont gardées à part de leur résultat : changer de langue plus tard
      // doit reprendre le jeu neuf de la nouvelle langue sans perdre ce que l'appelant a
      // corrigé, ce que le seul jeu résolu ne permettrait plus de démêler.
      const userLabels = o.labels;
      o.labels = resolveLabels(o.lang, userLabels);
      const element = buildElement(o);
      super({ element, target: opts && opts.target });

      this.options = o;
      this._userLabels = userLabels;
      this.slopeColors = o.slopeColors || null;
      this._feature = null;
      this._fullSamples = null; this._fullStats = null;
      this._samples = null; this._stats = null;
      this._marker = null;
      this._collapsed = !!o.collapsed;
      this._crops = []; this._off = 0;
      this._zoomA = null; this._zoomB = null; this._armed = null;
      this._demZ = null; this._demFor = null; this._demSeq = 0; this._demLoading = false;
      // Un profil précalculé apporte sa propre géométrie : elle remplace celle de l'entité
      // le temps du calcul, sans jamais la modifier - l'entité appartient à la carte.
      this._trackLines = null; this._linesFor = null;
      this._onResize = () => { if (this._feature && !this._collapsed) this._render(); };
      this._buildDom(element);
      element.style.display = 'none';
    }

    /** Recadré dès qu'un niveau est empilé. Lu partout où le booléen l'était. */
    get _cropMode() { return this._crops.length > 0; }
    /** Profondeur courante ; 0 quand on voit la trace entière. */
    get _cropDepth() { return this._crops.length; }
    /** Niveaux imbriqués autorisés, au moins un. */
    get _cropMax() { const n = this.options.zoomLevels; return n == null ? 3 : Math.max(1, n | 0); }

    // ---------- static helpers ----------------------------------------
    /**
     * Whether a feature has any Z (elevation) coordinate.
     * @param {import('ol/Feature').default} feature
     * @returns {boolean}
     */
    static featureHasZ(feature) {
      const g = feature && feature.getGeometry && feature.getGeometry();
      if (!g) return false;
      for (const seg of geomLines(g)) for (const c of seg) if (c.length > 2 && isFinite(c[2])) return true;
      return false;
    }

    /**
     * Whether a feature carries per-point time data (coordTimes / XYZM).
     * @param {import('ol/Feature').default} feature
     * @returns {boolean}
     */
    static featureHasTime(feature) {
      const g = feature && feature.getGeometry && feature.getGeometry();
      if (!g) return false;
      return !!extractTimes(feature, geomLines(g));
    }

    // ---------- DOM ---------------------------------------------------
    _buildDom(root) {
      const o = this.options;
      this._applyTheme();
      this._applyTransparency();

      const header = document.createElement('div');
      header.className = 'oep-header';
      this._titleEl = document.createElement('span'); this._titleEl.className = 'oep-title'; this._titleEl.textContent = o.labels.empty;
      this._statsEl = document.createElement('span'); this._statsEl.className = 'oep-stats';
      header.appendChild(this._titleEl);
      header.appendChild(this._statsEl);

      // barre d'outils zoom (A / B / Tout voir)
      this._toolbar = document.createElement('span'); this._toolbar.className = 'oep-toolbar';
      const mkBtn = (cls, html, title, onclick) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = `oep-tbtn ${cls}`;
        b.innerHTML = html; b.title = title; b.setAttribute('aria-label', title);
        b.addEventListener('click', onclick); this._toolbar.appendChild(b); return b;
      };
      this._btnA = mkBtn('oep-a', ICON_A, o.labels.zoomStart, () => this._arm('A'));
      this._btnB = mkBtn('oep-b', ICON_B, o.labels.zoomEnd, () => this._arm('B'));
      this._btnBack = mkBtn('oep-back', ICON_BACK, o.labels.zoomBack, () => this._popCrop());
      this._btnAll = mkBtn('oep-all', ICON_ALL, o.labels.zoomAll, () => this._exitZoom());
      // Last of the toolbar, so it sits to the right of the zoom buttons.
      this._btnPng = mkBtn('oep-png', ICON_PNG, o.labels.exportPng, () => this.exportPNG());
      header.appendChild(this._toolbar);

      const btn = document.createElement('button');
      btn.className = 'oep-toggle'; btn.type = 'button';
      btn.innerHTML = this._collapsed ? ICON_EXPAND : ICON_COLLAPSE;
      btn.addEventListener('click', () => this.toggleCollapsed());
      header.appendChild(btn);
      this._toggleBtn = btn;
      this._applyToggleLabel();

      this._legendEl = document.createElement('div'); this._legendEl.className = 'oep-legend'; this._legendEl.style.display = 'none';
      this._body = document.createElement('div'); this._body.className = 'oep-body';

      root.appendChild(header); root.appendChild(this._legendEl); root.appendChild(this._body);
      this._applyCollapsable();
      this._updateZoomButtons();
      if (this._collapsed) root.classList.add('oep-collapsed');
    }

    /**
     * Reporte les libellés courants sur ce que le rendu ne réécrit pas.
     *
     * Les boutons et le bouton de repli sont construits une fois pour toutes ; sans cela,
     * changer de langue ne toucherait que le graphe et laisserait les infobulles dans
     * l'ancienne. Le titre n'est repris que faute de tracé : sinon il porte le nom du tracé,
     * qui n'est pas un libellé de la librairie.
     */
    _applyLabels() {
      const l = this.options.labels;
      const set = (b, t) => { if (b && t) { b.title = t; b.setAttribute('aria-label', t); } };
      set(this._btnA, l.zoomStart); set(this._btnB, l.zoomEnd);
      set(this._btnBack, l.zoomBack); set(this._btnAll, l.zoomAll); set(this._btnPng, l.exportPng);
      this._applyToggleLabel();
      if (this._titleEl && !this._feature) this._titleEl.textContent = l.empty;
    }
    /**
     * Le bouton de repli dit ce qu'il va faire, non ce qu'il montre.
     *
     * Un seul libellé pour les deux états ("réduire ou agrandir") laisse deviner lequel
     * des deux le clic déclenche ; l'icône, elle, a déjà basculé. Le titre suit donc l'état,
     * et l'infobulle visible dit la même chose que le nom accessible.
     */
    _applyToggleLabel() {
      const l = this.options.labels, t = this._collapsed ? l.expand : l.collapse;
      if (!this._toggleBtn || !t) return;
      this._toggleBtn.title = t; this._toggleBtn.setAttribute('aria-label', t);
    }
    _resolveColor() { const o = this.options; if (!o.color) return null; if (o.color === 'auto') return this._featureColor(); return o.color; }
    _featureColor() {
      const f = this._feature; if (!f) return null;
      const res = this.getMap() ? this.getMap().getView().getResolution() : 1;
      let col = strokeColorOf(f.getStyle && f.getStyle(), f, res);
      if (!col && this.options.trackLayer) col = strokeColorOf(this.options.trackLayer.getStyle && this.options.trackLayer.getStyle(), f, res);
      return colorToCss(col);
    }
    _applyTheme() {
      const o = this.options;
      const c = (typeof o.theme === 'object') ? o.theme : (THEMES[o.theme] || THEMES.steelblue);
      this.themeColors = c;
      const r = this.element, resolved = this._resolveColor();
      const area = resolved || c.area;
      let line = c.line;
      if (resolved) { try { line = String(d3.color(resolved).darker(0.7)); } catch (e) { line = resolved; } }
      r.style.setProperty('--oep-area', area);
      r.style.setProperty('--oep-line', line);
      r.style.setProperty('--oep-axis', c.axis);
      r.style.setProperty('--oep-text', c.text);
      r.style.setProperty('--oep-focus', c.focus);
    }
    _applyTransparency() {
      const t = this.options.transparency;
      let alpha;
      if (t === false || t == null) alpha = 1; else if (t === true) alpha = this.options.transparencyLevel; else alpha = Math.max(0, Math.min(1, +t));
      this.element.style.setProperty('--oep-bg', `rgba(255,255,255,${alpha})`);
      this.element.classList.toggle('oep-transparent', alpha < 1);
    }
    _applyCollapsable() {
      const on = this.options.collapsable;
      this._toggleBtn.style.display = on ? '' : 'none';
      if (!on && this._collapsed) this.toggleCollapsed(false);
    }

    /** @param {boolean} [force] Force collapsed (true) or expanded (false). */
    toggleCollapsed(force) {
      this._collapsed = (typeof force === 'boolean') ? force : !this._collapsed;
      this.element.classList.toggle('oep-collapsed', this._collapsed);
      this._toggleBtn.innerHTML = this._collapsed ? ICON_EXPAND : ICON_COLLAPSE;
      this._applyToggleLabel();
      if (!this._collapsed && this._feature) this._render();
      this._adjustAttribution();
    }

    // ---------- responsive --------------------------------------------
    _availWidth() {
      const map = this.getMap();
      const t = map && map.getTargetElement && map.getTargetElement();
      return (t && t.clientWidth) || (typeof window !== 'undefined' ? window.innerWidth : 1024);
    }
    _isMobile() { return this.options.responsive && (typeof window !== 'undefined') && window.innerWidth <= (this.options.mobileBreakpoint || 640); }
    _applyPlacement() {
      const mobile = this._isMobile();
      let pos = this.options.position;
      if (mobile) pos = /top/.test(pos) ? 'top' : 'bottom';
      this.element.className = this.element.className.replace(/oep-pos-\S+/, `oep-pos-${pos}`);
      this.element.classList.toggle('oep-mobile', mobile);
      return mobile;
    }

    // Lift the OL attribution above the profile when the profile takes the bottom-right corner
    _adjustAttribution() {
      const map = this.getMap();
      const target = map && map.getTargetElement && map.getTargetElement();
      const attr = target && target.querySelector && target.querySelector('.ol-attribution');
      if (!attr) return;
      attr.style.bottom = ''; attr.style.right = '';                 // reset
      if (this.element.style.display === 'none' || this._collapsed) return;
      const mapR = target.getBoundingClientRect();
      const pR = this.element.getBoundingClientRect();
      if (!pR.height) return;
      const bottomGap = mapR.bottom - pR.bottom;                     // map bottom edge <-> profile bottom
      const rightGap = mapR.right - pR.right;
      const atBottom = bottomGap < pR.height;                        // profile sits in the bottom band
      const reachesRight = rightGap < 24;                            // reaches the bottom-right corner (attributions)
      if (atBottom && reachesRight) {
        attr.style.right = `${Math.max(0, Math.round(rightGap))}px`;
        attr.style.bottom = `${Math.round(pR.height + 2 * bottomGap)}px`;  // same gap above the profile
      }
    }

    // ---------- map ---------------------------------------------------
    setMap(map) {
      const prev = this.getMap();
      super.setMap(map);
      if (this._mapKeys) { this._mapKeys.forEach(unByKey); this._mapKeys = null; }
      if (prev && typeof window !== 'undefined') window.removeEventListener('resize', this._onResize);
      if (this._marker && !map) this._marker.setPosition(undefined);
      if (!map) return;

      const o = this.options;
      if (!o.dataProjection) o.dataProjection = map.getView().getProjection();
      if (o.marker && !this._marker) {
        const dot = document.createElement('div'); dot.className = 'oep-marker';
        this._marker = new Overlay({ element: dot, positioning: 'center-center', stopEvent: false });
        map.addOverlay(this._marker);
      }
      if (typeof window !== 'undefined') window.addEventListener('resize', this._onResize);

      const lineAt = (pixel) => map.forEachFeatureAtPixel(pixel, (f) => {
        const g = f.getGeometry(); return isProfilable(g) ? f : undefined;
      });

      this._mapKeys = [];
      // `show`, `hideOnMapClick` et `followMap` sont relus à l'événement, non à
      // l'abonnement. Les abonnements sont posés une fois pour toutes, ici ; les figer
      // rendait ces trois options muettes dès que `setOptions` les changeait ensuite,
      // basculer en survol ne faisait rien, sans que rien ne le dise. Les deux types
      // d'événement sont donc écoutés en permanence, et c'est l'option qui tranche.
      this._mapKeys.push(map.on('click', (evt) => {
        const feature = lineAt(evt.pixel);
        if (this.options.show !== 'mouseover' && feature && feature !== this._feature) this.setFeature(feature);
        if (this.options.hideOnMapClick && !feature && this._feature) this.clear();
      }));
      this._mapKeys.push(map.on('pointermove', (evt) => {
        if (this.options.show === 'mouseover') {
          const feature = lineAt(evt.pixel);
          if (feature && feature !== this._feature) this.setFeature(feature);
        }
        // Le survol coûte un `lineAt` par déplacement : rien n'est cherché tant qu'aucune
        // des deux options ne le demande.
        if (!this.options.followMap || !this._feature || this._collapsed) return;
        const cp = this._closestOnProfile(evt.coordinate); if (!cp) return;
        const px = map.getPixelFromCoordinate(cp); if (!px) return;
        if (Math.hypot(px[0] - evt.pixel[0], px[1] - evt.pixel[1]) < 14) this._focusByCoord(cp); else this._clearFocus();
      }));
      // leave the A/B crop when the map is zoomed out
      this._mapKeys.push(map.on('moveend', () => {
        const cur = this._crops[this._crops.length - 1];
        if (cur && cur.fitRes && map.getView().getResolution() > cur.fitRes * 1.25) this._popCrop();
      }));
      this._mapKeys.push(map.on('change:size', this._onResize));
    }

    // ---------- API ---------------------------------------------------
    /**
     * Show the profile for the given feature (LineString, MultiLineString, or a Polygon /
     * MultiPolygon profiled along its outer ring), ideally 3D.
     * Passing a falsy value hides the control.
     * @param {?import('ol/Feature').default} feature
     * @returns {this}
     */
    setFeature(feature) {
      this._feature = feature || null;
      this._crops = []; this._off = 0; this._zoomA = null; this._zoomB = null; this._armed = null;
      if (!feature) { this._fullSamples = this._samples = null; this._demZ = this._demFor = null; this._trackLines = this._linesFor = null; this._clear(); return this; }
      this.element.style.display = '';
      this._compute();
      // Before the render, not after: it is _fillFromDem that knows whether a fill is
      // starting, and the render needs that to draw the spinner instead of a flat profile.
      this._fillFromDem(feature);
      this._updateZoomButtons();
      if (this._collapsed) this._renderTitle(); else this._render();
      return this;
    }
    /** Hide the profile and clear the current feature. @returns {this} */
    clear() { return this.setFeature(null); }
    /**
     * @returns {?{distance:number,duration:?number,ascent:number,descent:number,min:number,max:number,maxAbsSlope:number,points:number}}
     * `duration` is `null` when the track carries no time data.
     */
    getStats() { return this._stats; }
    /** @param {string|Object} t Theme name or colors object. @returns {this} */
    setTheme(t) { this.options.theme = t; this._applyTheme(); if (this._feature && !this._collapsed) this._render(); return this; }
    /** @param {?string} c CSS color, `'auto'`, or `null` (theme). @returns {this} */
    setColor(c) { this.options.color = c || null; this._applyTheme(); if (this._feature && !this._collapsed) this._render(); return this; }

    /**
     * Update one or more options at runtime and re-render.
     * @param {Partial<ElevationProfileOptions>} patch
     * @returns {this}
     */
    setOptions(patch) {
      this.options = deepMerge(this.options, patch || {});
      if (patch && 'slopeColors' in patch) this.slopeColors = patch.slopeColors || null;
      if (patch && (patch.theme || 'color' in patch)) this._applyTheme();
      if (patch && ('transparency' in patch || 'transparencyLevel' in patch)) this._applyTransparency();
      if (patch && 'collapsable' in patch) this._applyCollapsable();
      if (patch && 'labels' in patch) this._userLabels = deepMerge(this._userLabels || {}, patch.labels);
      // Recalculé depuis la langue, jamais empilé sur le jeu précédent : passer de 'fr' à
      // 'es' ne doit rien laisser en français derrière lui, hors surcharges de l'appelant.
      if (patch && ('lang' in patch || 'labels' in patch)) {
        this.options.labels = resolveLabels(this.options.lang, this._userLabels);
        this._applyLabels();
      }
      if (patch && ('zoom' in patch || 'exportPng' in patch)) this._updateZoomButtons();
      if (patch && typeof patch.width !== 'undefined' && typeof patch.width === 'number') this.options.width = patch.width;
      if (patch && 'dem' in patch) { this._demZ = null; this._demFor = null; this._trackLines = null; this._linesFor = null; }
      if (this._feature) { this._compute(); this._fillFromDem(this._feature); this._updateZoomButtons(); if (this._collapsed) this._renderTitle(); else this._render(); }
      return this;
    }

    // ---------- digital elevation model -------------------------------
    /**
     * Fills the missing elevations from a terrain model, then redraws.
     *
     * **A track is filled entirely or not at all.** A profile missing a few points is not
     * an incomplete profile: points without Z count as zero, the line dives to sea level
     * and the ascent total becomes absurd. Better the flat profile we would have had
     * without the DEM.
     *
     * Nothing is reported to the user on failure: the fill is a supplement, it has no
     * business breaking a display that succeeded without it. The `demload` event lets the
     * application know if it wants to.
     *
     * @param {import('ol/Feature').default} feature
     * @fires demload
     * @private
     */
    _fillFromDem(feature) {
      const cfg = demConfig(this.options.dem);
      if (!cfg || !feature || this._demFor === feature || this._linesFor === feature) return;
      if (ElevationProfile.featureHasZ(feature)) return;              // the track already carries its Z
      // Canvas decoding needs a browser; a `sample` function does not, and must stay
      // usable where there is no DOM.
      if (!cfg.sample && (typeof Image === 'undefined' || typeof document === 'undefined')) return;

      const geom = feature.getGeometry && feature.getGeometry();
      const lines = geom ? geomLines(geom) : [];
      const dataProj = this.options.dataProjection || (this.getMap() && this.getMap().getView().getProjection()) || 'EPSG:3857';
      const lonlats = [];
      for (const seg of lines) for (const c of seg) lonlats.push(toLonLat(c, dataProj));
      // Un profil précalculé rapporte sa propre géométrie : il lui suffit de savoir DE
      // QUELLE trace il s'agit. C'est ce qui le rend utilisable sur une entité de tuile
      // vectorielle, dont les coordonnées sont dans le repère de la tuile et qu'aucune
      // source échantillonnée ne saurait interroger.
      if (!lonlats.length && !cfg.track) return;

      // Sequence number: a track clicked while another is loading must win, otherwise the
      // slowest response would overwrite the profile on screen.
      const seq = ++this._demSeq;
      this._demLoading = true;

      // A misconfigured source must not take the profile down with it. _fillFromDem runs
      // inside setFeature, so anything thrown here would reach the caller and leave no
      // chart at all - where the whole point is that the fill is a supplement.
      try {
        this._startFill(cfg, seq, feature, lonlats, dataProj);
      } catch (e) {
        this._demDone(seq, feature, null, lonlats.length, null, 0);
      }
    }

    /** @private */
    _startFill(cfg, seq, feature, lonlats, dataProj) {
      if (cfg.track) { this._startTrackFill(cfg, seq, feature, lonlats.length, dataProj); return; }
      if (cfg.sample) {
        // Wrapped in a promise chain so a function that throws synchronously fails the
        // same way as one that rejects - a source that misbehaves must not leave the
        // spinner turning forever.
        Promise.resolve()
          .then(() => cfg.sample(lonlats, { feature, projection: dataProj }))
          .then((zs) => this._demDone(seq, feature, zs, lonlats.length, null, 0))
          .catch(() => this._demDone(seq, feature, null, lonlats.length, null, 0));
        return;
      }

      const sampler = new DemSampler(cfg);
      const z = demZoomFor(sampler, lonlats, cfg);
      sampler.load(sampler.tilesFor(lonlats, z)).then((ok) => {
        const zs = ok ? lonlats.map((ll) => sampler.sample(ll[0], ll[1], z)) : null;
        this._demDone(seq, feature, zs, lonlats.length, z, sampler.tiles.size);
      }).catch(() => this._demDone(seq, feature, null, lonlats.length, z, 0));
    }

    /**
     * Va chercher un profil déjà calculé, que l'application tient prêt pour cette trace.
     *
     * Les dix autres sources échantillonnent un modèle de terrain aux points de la trace.
     * Celle-ci ne fait rien de tel : elle demande à l'application le profil qu'elle a déjà,
     * calculé une fois à l'ingestion sur le modèle qu'elle voulait, décimé comme elle
     * l'entendait. C'est le cas d'une application qui a fait son altimétrie en amont et ne
     * veut ni la refaire dans le navigateur ni dépendre d'un service au clic.
     *
     * La réponse peut prendre deux formes, et elles ne veulent pas dire la même chose :
     * un tableau de nombres est une altitude par point de la géométrie, qui rejoint le
     * chemin ordinaire ; un tableau de triplets `[lon, lat, z]` porte SA propre géométrie
     * et remplace celle de la trace, ce qui est le seul moyen d'accepter un profil décimé.
     *
     * @private
     */
    _startTrackFill(cfg, seq, feature, expected, dataProj) {
      const url = trackUrl(cfg.track.url, feature);
      if (!url) { this._demDone(seq, feature, null, expected, null, 0); return; }
      Promise.resolve()
        .then(() => fetch(url, cfg.track.fetchOptions || undefined))
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((json) => {
          const data = cfg.track.parse ? cfg.track.parse(json, feature)
            : (Array.isArray(json) ? json : (json && json[cfg.track.coords]));
          this._trackDone(seq, feature, data, expected, dataProj);
        })
        // Une trace sans profil répond 404, et c'est un fait, pas une panne : elle retombe
        // sur le même sort qu'un remplissage manqué.
        .catch(() => this._demDone(seq, feature, null, expected, null, 0));
    }

    /**
     * Adopte un profil précalculé, sous l'une ou l'autre de ses deux formes.
     *
     * Un triplet incomplet fait tout refuser, par la même règle que `_demDone` : un profil
     * auquel il manque des points n'est pas un profil incomplet, c'est un profil faux.
     *
     * @fires demload
     * @private
     */
    _trackDone(seq, feature, data, expected, dataProj) {
      const rate = () => this._demDone(seq, feature, null, expected, null, 0);
      if (!Array.isArray(data) || !data.length) return rate();
      // Des nombres : une altitude par point, exactement ce qu'un échantillonneur rend.
      if (typeof data[0] === 'number') return void this._demDone(seq, feature, data, expected, null, 0);

      if (seq !== this._demSeq || this._feature !== feature) return;   // un clic plus récent a gagné
      // `isFinite(null)` vaut true - Number(null) est 0 : sans le test de nullité, une
      // altitude absente passerait pour une altitude au niveau de la mer. Même règle que
      // `_demDone`, pour la même raison.
      const fini = (v) => v != null && isFinite(v);
      const lignes = [];
      for (const c of data) {
        if (!c || c.length < 3 || !fini(c[0]) || !fini(c[1]) || !fini(c[2])) return rate();
        const xy = transform([c[0], c[1]], 'EPSG:4326', dataProj);
        lignes.push([xy[0], xy[1], c[2]]);
      }
      if (lignes.length < 2) return rate();

      this._demLoading = false;
      this._trackLines = [lignes]; this._linesFor = feature;
      this._demZ = null; this._demFor = null;
      this._compute();
      this._updateZoomButtons();
      if (!this._collapsed) this._render();
      this.dispatchEvent({ type: 'demload', ok: true, zoom: null, tiles: 0 });
    }

    /**
     * Outcome of a fill, whatever produced it: adopt the elevations, drop the spinner,
     * redraw, announce.
     *
     * A result of the wrong length is refused outright rather than padded. Elevations one
     * can no longer map to their points are worse than absent ones: they would land on the
     * wrong places, and nothing downstream would notice.
     *
     * @fires demload
     * @private
     */
    _demDone(seq, feature, zs, expected, zoom, tiles) {
      // A newer fill has taken over: it owns _demLoading and will clear it itself.
      if (seq !== this._demSeq || this._feature !== feature) return;
      const usable = Array.isArray(zs) && zs.length === expected && zs.every((v) => v != null && isFinite(v));
      this._demLoading = false;
      if (usable) { this._demZ = zs; this._demFor = feature; this._compute(); }
      // Redrawn even on failure: the spinner has to give way to the flat profile.
      this._updateZoomButtons();
      if (!this._collapsed) this._render();
      /**
       * Fired once a terrain-model fill has completed (or failed).
       * @event demload
       * @property {boolean} ok Whether every point could be sampled.
       * @property {?number} zoom Tile zoom level used, `null` for a custom sampler.
       * @property {number} tiles Tiles fetched, `0` for a custom sampler.
       */
      this.dispatchEvent({ type: 'demload', ok: usable, zoom, tiles });
    }

    // ---------- computation -------------------------------------------
    _compute() {
      const o = this.options;
      // Un profil précalculé apporte sa géométrie ; sinon, celle de l'entité.
      const substitue = this._linesFor === this._feature && this._trackLines;
      const geom = this._feature.getGeometry && this._feature.getGeometry();
      const lines = substitue ? this._trackLines : (geom ? geomLines(geom) : []);
      const dataProj = o.dataProjection || (this.getMap() && this.getMap().getView().getProjection()) || 'EPSG:3857';

      // Terrain-model elevations, if they were loaded for THIS feature.
      const demZ = (this._demFor === this._feature) ? this._demZ : null;

      // Les horodatages sont indexés sur les points de l'ENTITÉ : sur une géométrie
      // substituée ils tomberaient à côté, et un temps faux vaut moins que pas de temps.
      const times = substitue ? null : extractTimes(this._feature, lines);
      this._hasTime = !!times;
      const ignoreStops = o.ignoreStops !== false;                   // default: stops are excluded
      const stopSpeed = (o.stopSpeed != null ? o.stopSpeed : 0.5);   // m/s
      const pts = [];
      let cum = 0, prev = null, i = -1, tAcc = 0, prevMs = null;
      for (const seg of lines) for (const c of seg) {
        i++;
        const ll = toLonLat(c, dataProj);
        let dseg = 0;
        if (prev) { dseg = getDistance(prev, ll); cum += dseg; }
        let t = null;
        if (times && times[i] != null) {
          const ms = times[i];
          if (prevMs != null) {
            const dt = (ms - prevMs) / 1000;                          // seconds over the segment
            if (dt > 0 && (!ignoreStops || (dseg / dt) >= stopSpeed)) tAcc += dt;
          }
          t = tAcc; prevMs = ms;
        }
        prev = ll;
        const z = (c.length > 2 && isFinite(c[2])) ? c[2] : (demZ ? demZ[i] : 0);
        pts.push({ x: cum, z, coord: c, t });
      }
      if (o.smoothing > 0) this._smooth(pts, o.smoothing);

      const samples = this._decimate(pts, o.maxPoints);
      this._addSlope(samples);
      this._fullSamples = samples;
      this._fullStats = this._statsOf(samples, true);
      // Un recalcul (option changée, altitudes arrivées du MNT) ne doit pas défaire le
      // recadrage : la pile est rejouée sur les nouveaux échantillons. Pile vide, on
      // retombe sur la trace entière, ce que faisait l'affectation directe d'avant.
      this._applyCrops();
    }
    /**
     * Pixels CSS d'un centimètre physique, mesurés plutôt que déduits.
     *
     * Le rapport nominal est de 96 px par pouce, soit 37,8 px par centimètre, mais le zoom
     * du navigateur le déplace : mesurer un élément d'un centimètre suit ce zoom là où une
     * constante mentirait. Non mémorisé - la mesure force un calcul de disposition, mais un
     * rendu est rare et un cache se périmerait au premier Ctrl+molette.
     */
    _pxPerCm() {
      try {
        const temoin = document.createElement('div');
        temoin.style.cssText = 'position:absolute;left:-9999px;top:0;width:1cm;height:1cm';
        (this.element || document.body).appendChild(temoin);
        const px = temoin.getBoundingClientRect().height;
        temoin.remove();
        if (px > 0) return px;
      } catch (e) { /* document indisponible : on retombe sur la valeur nominale */ }
      return 96 / 2.54;
    }

    /**
     * Échelle verticale du graphe.
     *
     * En `'auto'`, le profil remplit la hauteur : c'est lisible, mais l'échelle change d'une
     * trace à l'autre, si bien qu'une pente de 2 % y prend l'allure d'un mur et que deux
     * profils ne se comparent pas. Un nombre fixe au contraire les mètres couverts par
     * centimètre physique.
     *
     * La valeur demandée est un **plancher**, non un carcan : une trace dont l'amplitude
     * dépasse ce que la hauteur peut montrer déborderait du cadre, ce qui est pire que de
     * perdre la comparabilité. Le graphe n'en dit rien : l'échelle n'est pas une donnée de
     * la trace et n'a pas à encombrer le dessin ; l'échelle réellement appliquée est
     * seulement publiée dans `_vScale`, à qui veut la connaître.
     *
     * `nice()` n'est pas appliqué en échelle absolue : il arrondit le domaine vers
     * l'extérieur, donc il fausserait le rapport qu'on vient de fixer.
     */
    _yScale(s, zpad, innerH, innerW) {
      const bas = s.min - zpad, haut = s.max + zpad;
      const cm = innerH / this._pxPerCm();            // hauteur du graphe, en centimètres
      const cmH = innerW / this._pxPerCm();           // largeur du graphe, en centimètres
      // Le rapport entre les deux axes, quel que soit le mode : c'est la grandeur qu'on
      // tient fixe sous `{ exaggeration }`, et celle qui dérive librement en `'auto'`.
      // La publier partout est le seul moyen de voir la différence plutôt que d'y croire.
      const rapport = (etendue) => (cmH > 0 && etendue > 0) ? (s.distance / cmH) / (etendue / cm) : null;

      const vs = this._verticalScaleFor(s, innerW);
      if (!(vs > 0)) {
        // `'auto'` : la hauteur est remplie, donc c'est l'amplitude qui décide de tout.
        // `nice()` arrondit le domaine vers l'extérieur, d'où la lecture APRÈS coup.
        const echelle = d3.scaleLinear().domain([bas, haut]).range([innerH, 0]).nice();
        const dom = echelle.domain();
        this._vScale = null;                          // aucune échelle absolue demandée
        this._vExaggeration = rapport(dom[1] - dom[0]);
        return echelle;
      }
      const etendue = Math.max(vs * cm, haut - bas);  // jamais moins qu'il n'en faut
      const milieu = (bas + haut) / 2;
      this._vScale = etendue / cm;                    // m/cm effectivement appliqués
      // Sous le plancher, le rapport retombe sous celui demandé : c'est la seule façon de
      // savoir que c'est arrivé.
      this._vExaggeration = rapport(etendue);
      return d3.scaleLinear().domain([milieu - etendue / 2, milieu + etendue / 2]).range([innerH, 0]);
    }

    /**
     * Les mètres par centimètre demandés, sous l'une ou l'autre forme de `verticalScale`.
     *
     * Une échelle absolue rend les AMPLITUDES comparables, pas les pentes : l'axe
     * horizontal s'étire toujours sur toute la trace, si bien qu'une même pente de 5 %
     * paraît trois fois plus raide sur une boucle de 3 km que sur une traversée de 30. Une
     * exagération fixe le RAPPORT entre les deux axes : la pente lue sur le dessin est
     * alors la pente réelle, multipliée par un facteur constant d'une trace à l'autre.
     *
     * Elle se calcule ici et pas chez l'appelant parce qu'elle demande deux choses que lui
     * n'a pas : la largeur du graphe une fois les marges retirées, et la distance
     * réellement affichée - celle du recadrage A/B en cours, non celle de la trace.
     *
     * @private
     */
    _verticalScaleFor(s, innerW) {
      const v = this.options.verticalScale;
      if (typeof v === 'number') return v;
      const ex = (v && typeof v === 'object') ? Number(v.exaggeration) : 0;
      if (!(ex > 0) || !(s.distance > 0) || !(innerW > 0)) return 0;
      const cm = innerW / this._pxPerCm();            // largeur du graphe, en centimètres
      return (s.distance / cm) / ex;                  // horizontale ÷ exagération
    }
    _statsOf(samples, fromTotal) {
      let ascent = 0, descent = 0, zmin = Infinity, zmax = -Infinity, maxAbs = 0;
      for (let k = 0; k < samples.length; k++) {
        const z = samples[k].z; if (z < zmin) zmin = z; if (z > zmax) zmax = z;
        if (k > 0) { const dz = z - samples[k - 1].z; if (dz > 0) ascent += dz; else descent -= dz; }
        const s = Math.abs(samples[k].slope || 0); if (s > maxAbs) maxAbs = s;
      }
      const distance = samples.length ? samples[samples.length - 1].x - samples[0].x : 0;
      const ta = samples.length ? samples[0].t : null, tb = samples.length ? samples[samples.length - 1].t : null;
      const duration = (ta != null && tb != null) ? (tb - ta) : null;
      // Reported for a closed ring too, where they are equal by construction: on a loop,
      // D+ is exactly the figure one is after.
      return { distance, duration, ascent, descent, min: isFinite(zmin) ? zmin : 0, max: isFinite(zmax) ? zmax : 0, maxAbsSlope: maxAbs, points: samples.length };
    }
    _smooth(pts, meters) {
      if (!(meters > 0) || pts.length < 3) return;
      const half = meters / 2;                     // window = +/-(meters/2) along the track
      const z = pts.map((p) => p.z);
      let lo = 0, hi = 0, sum = 0;
      for (let i = 0; i < pts.length; i++) {
        const xi = pts[i].x;
        while (lo < pts.length && pts[lo].x < xi - half) { sum -= z[lo]; lo++; }
        while (hi < pts.length && pts[hi].x <= xi + half) { sum += z[hi]; hi++; }
        pts[i].z = (hi > lo) ? sum / (hi - lo) : z[i];
      }
    }
    _decimate(pts, maxPoints) {
      const copy = (p) => ({ x: p.x, z: p.z, coord: p.coord, t: p.t });
      if (!maxPoints || pts.length <= maxPoints) return pts.map(copy);
      const step = pts.length / maxPoints, out = [];
      for (let i = 0; i < maxPoints; i++) out.push(copy(pts[Math.floor(i * step)]));
      out.push(copy(pts[pts.length - 1])); return out;
    }
    _addSlope(samples) {
      for (let j = 1; j < samples.length; j++) {
        const ddx = samples[j].x - samples[j - 1].x;
        samples[j].slope = ddx > 0 ? ((samples[j].z - samples[j - 1].z) / ddx) * 100 : 0;
      }
      if (samples.length) samples[0].slope = samples.length > 1 ? samples[1].slope : 0;
    }

    // ---------- slope: colours ----------------------------------------
    _slopeScale() {
      const cs = this.options.slopeClassSize || 2.5;
      const maxClasses = this.options.maxClasses || 8;
      const realIdx = Math.max(1, Math.floor((this._stats.maxAbsSlope || 0) / cs));
      const maxIdx = Math.min(realIdx, maxClasses - 1);   // at most `maxClasses` classes (default 8)
      const capped = realIdx > maxIdx;                    // some slopes overflow the last class
      let colorByIndex;
      if (this.slopeColors && this.slopeColors.length) {
        const interp = d3.interpolateRgbBasis(this.slopeColors);
        colorByIndex = (idx) => interp(maxIdx ? idx / maxIdx : 0);
      } else {
        // Ramp with non-uniform stops: the cold end (blue-green, hard to read) is squeezed,
        // PURE yellow in the middle, then orange, red. Class 0 = blue, top class = red.
        const ramp = d3.scaleLinear()
          .domain([0, 0.16, 0.42, 0.68, 1])
          .range(['#2166ac', '#27a35a', '#ffe000', '#f4791f', '#d7191c'])
          .interpolate(d3.interpolateRgb)
          .clamp(true);
        colorByIndex = (idx) => String(ramp(maxIdx ? idx / maxIdx : 0));
      }
      return { classSize: cs, maxIdx, capped, colorByIndex };
    }
    _classIndex(slope, sc) { return Math.min(sc.maxIdx, Math.floor(Math.abs(slope) / sc.classSize)); }

    // ---------- time: adaptive format ---------------------------------
    // 7 sec | 26 min | 1 h 48 min | 2 d 3 h (days + hours normalised)
    _fmtDuration(sec) {
      if (sec == null || !isFinite(sec)) return '';
      const u = (this.options.labels && this.options.labels.durationUnits) || LOCALES.en.durationUnits;
      sec = Math.max(0, Math.round(sec));
      if (sec < 60) return sec + ' ' + u.s;
      if (sec < 3600) return Math.round(sec / 60) + ' ' + u.m;
      if (sec < 86400) {
        let h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
        if (m === 60) { h++; m = 0; }
        return m ? `${h} ${u.h} ${m} ${u.m}` : `${h} ${u.h}`;
      }
      let d = Math.floor(sec / 86400), h = Math.round((sec % 86400) / 3600);
      if (h === 24) { d++; h = 0; }
      return h ? `${d} ${u.d} ${h} ${u.h}` : `${d} ${u.d}`;
    }

    // ---------- header + legend ---------------------------------------
    /**
     * Track title, and its optional link.
     *
     * Its own method because it is the only part of the header that stays visible once
     * collapsed: the CSS hides the body, the stats, the legend and the toolbar. `_render`
     * is skipped while collapsed, so without a separate entry point the title would keep
     * naming the previous track after a change of feature.
     */
    /**
     * Cette trace a-t-elle une altitude, d'où qu'elle vienne ?
     *
     * Trois sources possibles, et une seule suffit : le Z de la géométrie, les altitudes
     * rapportées par un modèle de terrain, ou le profil précalculé d'une source `track`.
     * Aucune des trois, et il n'y a rien à dessiner - ce qui ne veut pas dire zéro.
     *
     * @private
     */
    _hasElevation() {
      const f = this._feature;
      if (!f) return false;
      if (ElevationProfile.featureHasZ(f)) return true;
      if (this._demFor === f && this._demZ) return true;
      if (this._linesFor === f && this._trackLines) return true;
      return false;
    }

    /**
     * Ce qui prend la place du graphe quand la trace n'a aucune altitude.
     *
     * Même forme que le spinner, et pour la même raison : la hauteur du graphe est tenue,
     * si bien que le panneau ne saute pas si un profil finit par arriver. Le titre reste,
     * lui : c'est la trace cliquée, et l'utilisateur a besoin de savoir laquelle.
     *
     * @private
     */
    _renderNoElevation() {
      if (!this.options.showWithoutElevation) { this.element.style.display = 'none'; return; }
      this.element.style.display = '';
      this._applyTheme();
      this._applyPlacement();
      this._renderHeader(true);
      const H = typeof this.options.height === 'number' ? this.options.height : 180;
      this._body.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'oep-noelev';
      box.style.height = `${H}px`;
      box.setAttribute('role', 'status');
      box.textContent = this.options.labels.noElevation;
      this._body.appendChild(box);
      this._clearFocus();
    }

    /**
     * La première propriété qui répond, parmi celles proposées.
     *
     * Un nom de propriété unique reste un nom de propriété unique ; une liste est essayée
     * dans l'ordre. `garde` filtre ce qu'on accepte : n'importe quelle valeur non vide pour
     * un titre, une URL véritable pour un lien - sans quoi une propriété `url` contenant
     * autre chose ferait un lien mort plutôt que pas de lien du tout.
     *
     * @private
     */
    _pickProperty(f, spec, garde) {
      if (!spec || !f || !f.get) return null;
      for (const cle of (Array.isArray(spec) ? spec : [spec])) {
        const v = f.get(cle);
        if (v != null && v !== '' && (!garde || garde(v))) return v;
      }
      return null;
    }

    _renderTitle() {
      const o = this.options, f = this._feature;
      if (!f) return;
      const name = this._pickProperty(f, o.titleProperty) || o.labels.untitled;
      const linkUrl = this._pickProperty(f, o.titleLink, isUrl);
      if (isUrl(linkUrl)) this._titleEl.innerHTML = `<a href="${esc(linkUrl)}" target="_blank" rel="noopener">${esc(name)}</a>`;
      else this._titleEl.textContent = name;
      this._titleEl.setAttribute('title', name);
    }

    _renderHeader(sansAltimetrie) {
      const o = this.options, s = this._stats, f = this._feature;
      this._renderTitle();
      // While the elevations are still unknown, every figure would read zero: a D+ of 0 m
      // then jumping to 1 200 is worse than no figure at all.
      if (this._demLoading) {
        this._statsEl.innerHTML = ''; this._statsEl.removeAttribute('title');
        this._legendEl.innerHTML = ''; this._legendEl.style.display = 'none';
        return;
      }

      const html = [], text = [];
      o.headerItems.forEach((it) => {
        if (typeof it === 'string') {
          // Sans altitude, il reste ce que la géométrie sait dire : la longueur, la durée.
          // Le dénivelé et les altitudes extrêmes, eux, vaudraient zéro - on les tait.
          if (sansAltimetrie && (it === 'ascent' || it === 'descent' || it === 'min' || it === 'max' || it === 'minmax')) return;
          if (it === 'distance') { if (!(s && s.distance > 0)) return; html.push(`<b>${fmtDistance(s.distance, o.units)}</b>`); text.push(fmtDistance(s.distance, o.units)); }
          else if (it === 'ascent') { html.push(`<span class="oep-up">${o.labels.ascent} ${fmtElevation(s.ascent, o.units)}</span>`); text.push(`${o.labels.ascent} ${fmtElevation(s.ascent, o.units)}`); }
          else if (it === 'descent') { html.push(`<span class="oep-down">${o.labels.descent} ${fmtElevation(s.descent, o.units)}</span>`); text.push(`${o.labels.descent} ${fmtElevation(s.descent, o.units)}`); }
          else if (it === 'min') { html.push(fmtElevation(s.min, o.units)); text.push(fmtElevation(s.min, o.units)); }
          else if (it === 'max') { html.push(fmtElevation(s.max, o.units)); text.push(fmtElevation(s.max, o.units)); }
          else if (it === 'minmax') { const v = `${fmtElevation(s.min, o.units)}-${fmtElevation(s.max, o.units)}`; html.push(v); text.push(v); }
          else if (it === 'duration') { if (s.duration != null) { const v = this._fmtDuration(s.duration); html.push(`<span class="oep-time">${esc(o.labels.duration)} ${v}</span>`); text.push(`${o.labels.duration} ${v}`); } }
        } else if (it && it.property) {
          const val = f.get && f.get(it.property); if (val == null || val === '') return;
          const lbl = it.label ? `${it.label} ` : '';
          if (it.asLink && isUrl(val)) { html.push(`${lbl}<a href="${esc(val)}" target="_blank" rel="noopener">${esc(it.linkText || it.label || val)}</a>`); text.push(`${it.label || ''} ${val}`); }
          else { html.push(esc(lbl + val)); text.push(lbl + val); }
        }
      });
      this._statsEl.innerHTML = html.join(' · ');
      this._statsEl.setAttribute('title', text.join('  ·  '));

      this._legendEl.innerHTML = '';
      // Une légende de pentes sans altitude ne légende rien : elle annoncerait des
      // classes qu'aucun trait ne porte, sous un panneau qui dit n'avoir pas de profil.
      if (o.slope && o.slopeLegend && !sansAltimetrie) {
        const sc = this._slopeScale();
        for (let idx = 0; idx <= sc.maxIdx; idx++) {
          const color = sc.colorByIndex(idx);
          const label = (sc.capped && idx === sc.maxIdx) ? `≥ ${idx * sc.classSize} %` : `${idx * sc.classSize}-${(idx + 1) * sc.classSize} %`;
          const item = document.createElement('span'); item.className = 'oep-leg-it';
          item.innerHTML = `<i class="oep-sw" style="background:${color}"></i>${label}`;
          this._legendEl.appendChild(item);
        }
        this._legendEl.style.display = '';
      } else this._legendEl.style.display = 'none';
    }

    /**
     * Spinner shown in place of the chart while the terrain model loads.
     *
     * It keeps the chart's height so the panel does not jump when the profile replaces it,
     * and it carries no colour of its own: the CSS takes `--oep-area`, which `_applyTheme`
     * has just set - the theme colour, or the track colour under `color: 'auto'`.
     */
    _renderSpinner() {
      const H = typeof this.options.height === 'number' ? this.options.height : 180;
      this._body.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'oep-loading';
      box.style.height = `${H}px`;
      box.setAttribute('role', 'status');
      box.setAttribute('aria-label', this.options.labels.loading);
      const sp = document.createElement('div');
      sp.className = 'oep-spinner';
      box.appendChild(sp);
      this._body.appendChild(box);
    }

    // ---------- rendering ---------------------------------------------
    _render() {
      const o = this.options, s = this._stats, data = this._samples;
      // Aucune altitude par aucune voie, et plus rien en chemin : le graphe n'a pas lieu
      // d'être. Le tracer quand même poserait une ligne plate au niveau zéro sous un D+ de
      // 0 m, ce qui n'est pas un chiffre manquant mais un chiffre faux.
      if (!this._demLoading && !this._hasElevation()) { this._renderNoElevation(); return; }
      if (!data || !data.length) return;
      this._applyTheme();
      const mobile = this._applyPlacement();
      this._renderHeader();
      if (this._demLoading) { this._renderSpinner(); return; }

      const m = o.margins, u = m.unit || 'px';
      const toPx = (v) => u === 'px' ? v : v * (parseFloat(getComputedStyle(this.element).fontSize) || 16);

      // Width: 100% on mobile; 'auto'/'100%'/'full' = map width; otherwise a number capped to the map
      const avail = this._availWidth();
      const isAuto = (o.width === 'auto' || o.width === '100%' || o.width === 'full');
      const desktopW = isAuto ? avail : Math.min(typeof o.width === 'number' ? o.width : (parseFloat(o.width) || avail), avail);
      if (mobile) this.element.style.width = '';
      else this.element.style.width = `${desktopW}px`;
      const cw = this.element.clientWidth || (mobile ? avail : desktopW);
      const W = Math.max(220, cw - 16);
      const H = typeof o.height === 'number' ? o.height : 180;

      const mt = toPx(m.top), mr = toPx(m.right), mb = toPx(m.bottom), ml = toPx(m.left);
      const innerW = Math.max(10, W - ml - mr), innerH = Math.max(10, H - mt - mb);
      const xTicks = o.xTicks != null ? o.xTicks : Math.max(2, Math.round(innerW / 80));
      const yTicks = o.yTicks != null ? o.yTicks : Math.max(2, Math.round(innerH / 40));

      this._body.innerHTML = '';
      const svg = d3.select(this._body).append('svg').attr('class', 'oep-svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
      const g = svg.append('g').attr('transform', `translate(${ml},${mt})`);

      const x = d3.scaleLinear().domain([0, s.distance]).range([0, innerW]);
      const zpad = (s.max - s.min) * 0.1 || 10;
      const y = this._yScale(s, zpad, innerH, innerW);
      this._x = x; this._y = y; this._dims = { innerW, innerH };

      if (o.grid) g.append('g').attr('class', 'oep-grid').call(d3.axisLeft(y).ticks(yTicks).tickSize(-innerW).tickFormat(''));

      const dscale = distAxisScale(o.units);
      const areaGen = d3.area().x((d) => x(d.x)).y0(innerH).y1((d) => y(d.z));

      if (o.slope) {
        const sc = this._slopeScale();
        const seps = [];
        let i = 1;
        while (i < data.length) {
          const cls = this._classIndex(data[i].slope, sc);
          let j = i; while (j + 1 < data.length && this._classIndex(data[j + 1].slope, sc) === cls) j++;
          g.append('path').datum(data.slice(i - 1, j + 1)).attr('class', 'oep-area-slope').attr('fill', sc.colorByIndex(cls)).attr('d', areaGen);
          if (i > 1) seps.push(data[i - 1]);   // a class change is a boundary
          i = j + 1;
        }
        if (o.slopeSeparators) seps.forEach((d) => {
          g.append('line').attr('class', 'oep-slope-sep').attr('x1', x(d.x)).attr('x2', x(d.x)).attr('y1', y(d.z)).attr('y2', innerH);
        });
      } else {
        g.append('path').datum(data).attr('class', 'oep-area').attr('d', areaGen);
      }
      g.append('path').datum(data).attr('class', 'oep-line').attr('d', d3.line().x((d) => x(d.x)).y((d) => y(d.z)));

      g.append('g').attr('class', 'oep-axis oep-axis-x').attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(xTicks).tickFormat((d) => (d / dscale).toFixed(d / dscale < 10 ? 1 : 0)));
      g.append('text').attr('class', 'oep-axis-label').attr('x', innerW).attr('y', innerH + mb - 4).attr('text-anchor', 'end').text(distAxisLabel(o.units));
      g.append('g').attr('class', 'oep-axis oep-axis-y').call(d3.axisLeft(y).ticks(yTicks).tickFormat((d) => o.units === 'imperial' ? Math.round(d * 3.28084) : d));

      // A / B markers while a range is being picked
      if (o.zoom && this._cropDepth < this._cropMax) {
        [['A', this._zoomA], ['B', this._zoomB]].forEach(([nm, val]) => {
          if (val == null) return;
          const px = x(val);
          g.append('line').attr('class', 'oep-ab-line').attr('x1', px).attr('x2', px).attr('y1', 0).attr('y2', innerH);
          g.append('text').attr('class', 'oep-ab-label').attr('x', px).attr('y', -6).attr('text-anchor', 'middle').text(nm);
        });
      }

      const focus = g.append('g').attr('class', 'oep-focus').style('display', 'none');
      focus.append('line').attr('class', 'oep-focus-line').attr('y1', 0).attr('y2', innerH);
      focus.append('circle').attr('class', 'oep-focus-dot').attr('r', 4);
      const lbl = focus.append('g').attr('class', 'oep-focus-label'); lbl.append('rect').attr('class', 'oep-focus-bg'); lbl.append('text').attr('class', 'oep-focus-txt');
      this._focus = focus;

      const pick = (event) => { const mx = d3.pointer(event, g.node())[0]; return Math.max(0, Math.min(s.distance, x.invert(mx))); };
      const overlay = svg.append('rect').attr('class', 'oep-overlay').attr('x', ml).attr('y', mt).attr('width', innerW).attr('height', innerH);
      overlay.on('mousemove', (event) => {
        const d = this._sampleAt(pick(event)); if (!d) return;
        this._setFocus(d); if (this._marker) this._marker.setPosition(d.coord);
      }).on('mouseout', () => this._clearFocus());
      overlay.on('click', (event) => this._placeBound(pick(event)));
      if (this._armed) overlay.style('cursor', 'col-resize');
      this._adjustAttribution();
    }

    // ---------- PNG export ---------------------------------------------
    /**
     * Properties frozen onto the exported clone.
     *
     * A serialized SVG carries no stylesheet: rules that live in the CSS file, and every
     * `var(--oep-*)` they resolve, vanish the moment the markup leaves the document. The
     * export would come out as black shapes on nothing. So the computed value of each
     * painting property is written inline, node by node.
     */
    static get _EXPORT_PROPS() {
      return ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray',
        'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size',
        'font-weight', 'text-anchor', 'shape-rendering'];
    }

    /** Copies the computed painting styles of `src` onto `dst`, recursively. */
    _freezeStyles(src, dst) {
      const props = ElevationProfile._EXPORT_PROPS;
      const cs = getComputedStyle(src);
      let inline = '';
      for (const p of props) { const v = cs.getPropertyValue(p); if (v) inline += `${p}:${v};`; }
      dst.setAttribute('style', inline);
      const a = src.children, b = dst.children;
      for (let i = 0; i < a.length && i < b.length; i++) this._freezeStyles(a[i], b[i]);
    }

    /**
     * The whole panel as an SVG string: background, title, stats, legend, chart.
     *
     * Rebuilt rather than screenshotted. The header is HTML and the chart is SVG, and the
     * only way to put HTML in an SVG is a `foreignObject`, which browsers refuse to
     * rasterise consistently. Redrawing the two text lines as `<text>` is a handful of
     * lines and works everywhere.
     *
     * The current-position indicator is dropped: it marks where the pointer happens to be,
     * which means nothing once the image is saved.
     */
    _exportSvg() {
      const chart = this._body.querySelector('svg');
      if (!chart) return null;
      const cs = getComputedStyle(this.element);
      const bg = cs.getPropertyValue('--oep-bg').trim() || '#fff';
      const fg = cs.getPropertyValue('--oep-text').trim() || '#222';
      const font = cs.fontFamily || 'system-ui, sans-serif';
      const W = +chart.getAttribute('width'), H = +chart.getAttribute('height');
      const pad = 8, titleH = 20, statsH = this._statsEl.textContent ? 15 : 0;
      const legend = (this._legendEl.style.display !== 'none') ? this._legendEl : null;
      const legH = legend ? 18 : 0;
      const top = pad + titleH + statsH + legH;

      const clone = chart.cloneNode(true);
      // The pointer indicator and the hit-test overlay have no place in a saved image.
      clone.querySelectorAll('.oep-focus, .oep-overlay').forEach((n) => n.remove());
      this._freezeStyles(chart, clone);
      // width/height are kept: a nested <svg> without them fills the parent viewport, so
      // the chart would be stretched over the header's height as well.

      const esc2 = (t) => esc(String(t));
      const parts = [];
      parts.push(`<rect width="${W + 2 * pad}" height="${H + top + pad}" fill="${esc2(bg)}"/>`);
      parts.push(`<text x="${pad}" y="${pad + 13}" style="font-family:${esc2(font)};font-size:13px;font-weight:600;fill:${esc2(fg)}">${esc2(this._titleEl.textContent)}</text>`);
      if (statsH) parts.push(`<text x="${pad}" y="${pad + titleH + 10}" style="font-family:${esc2(font)};font-size:11px;fill:${esc2(fg)};opacity:.85">${esc2(this._statsEl.textContent)}</text>`);
      if (legend) {
        let x = pad;
        const y = pad + titleH + statsH + 12;
        for (const item of legend.querySelectorAll('.oep-leg-it')) {
          const sw = item.querySelector('.oep-sw');
          const color = sw ? getComputedStyle(sw).backgroundColor : 'none';
          const label = item.textContent.trim();
          parts.push(`<rect x="${x}" y="${y - 8}" width="10" height="10" fill="${esc2(color)}"/>`);
          parts.push(`<text x="${x + 14}" y="${y}" style="font-family:${esc2(font)};font-size:10px;fill:${esc2(fg)}">${esc2(label)}</text>`);
          x += 14 + label.length * 5.6 + 10;
        }
      }
      parts.push(`<g transform="translate(${pad},${top})">${new XMLSerializer().serializeToString(clone)}</g>`);
      return {
        width: W + 2 * pad, height: H + top + pad,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 2 * pad}" height="${H + top + pad}" ` +
             `viewBox="0 0 ${W + 2 * pad} ${H + top + pad}">${parts.join('')}</svg>`
      };
    }

    /**
     * Export the whole panel - title, stats, legend and chart - as a PNG.
     *
     * Resolves with the Blob. Unless `download` is false, it also saves the file, which is
     * what the toolbar button does.
     *
     * @param {{scale?:number, filename?:string, download?:boolean}} [opts]
     *   `scale` defaults to the device pixel ratio, so the image is not soft on a retina
     *   screen. `filename` defaults to the track title.
     * @returns {Promise<Blob>}
     */
    exportPNG(opts) {
      const o = opts || {};
      const built = this._exportSvg();
      if (!built) return Promise.reject(new Error('ol-elevation-profile: nothing to export'));
      const scale = o.scale || (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const cv = document.createElement('canvas');
            cv.width = Math.round(built.width * scale);
            cv.height = Math.round(built.height * scale);
            const ctx = cv.getContext('2d');
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);
            cv.toBlob((blob) => {
              if (!blob) { reject(new Error('ol-elevation-profile: PNG encoding failed')); return; }
              if (o.download !== false) this._save(blob, o.filename);
              resolve(blob);
            }, 'image/png');
          } catch (e) { reject(e); }
        };
        img.onerror = () => reject(new Error('ol-elevation-profile: SVG could not be rasterised'));
        // Encoded as a data URL rather than a blob: URL - a blob: source taints the canvas
        // in some browsers, and toBlob would then throw a security error.
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(built.svg);
      });
    }

    /** @private */
    _save(blob, filename) {
      const name = filename || `${(this._titleEl.textContent || 'profile').replace(/[\\/:*?"<>|]+/g, '-').trim()}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ---------- zoom A/B ----------------------------------------------
    _arm(which) { this._armed = (this._armed === which) ? null : which; this._updateZoomButtons(); if (this._focus) this._render(); }
    /**
     * Pose la borne armée à l'abscisse [x0], puis arme l'autre tant qu'elle manque.
     *
     * Poser A n'a d'intérêt que pour poser B ensuite : enchaîner d'un clic sur l'autre
     * évite l'aller-retour par la barre d'outils entre les deux. Les deux bornes réunies,
     * le recadrage part et rien ne reste armé.
     */
    _placeBound(x0) {
      if (!this._armed || this._cropDepth >= this._cropMax) return;
      const autre = this._armed === 'A' ? 'B' : 'A';
      if (this._armed === 'A') this._zoomA = x0; else this._zoomB = x0;
      const complet = this._zoomA != null && this._zoomB != null;
      this._armed = complet ? null : autre;
      this._updateZoomButtons();
      if (complet) this._pushCrop(this._zoomA, this._zoomB); else this._render();
    }
    _updateZoomButtons() {
      const o = this.options, has = !!this._feature;
      const show = !!o.zoom && has;
      const png = !!o.exportPng && has;
      // The toolbar carries both: it stays visible as long as either has something to show.
      this._toolbar.style.display = (show || png) ? '' : 'none';
      this._btnPng.style.display = png ? '' : 'none';
      const deep = this._cropDepth, peutDescendre = deep < this._cropMax;
      this._btnA.style.display = show && peutDescendre ? '' : 'none';
      this._btnB.style.display = show && peutDescendre ? '' : 'none';
      // Au premier niveau, revenir et tout voir sont le même geste : seul "tout voir"
      // paraît, ce qui laisse le niveau unique (zoomLevels: 1) exactement tel qu'il était.
      this._btnBack.style.display = show && deep > 1 ? '' : 'none';
      this._btnAll.style.display = show && deep > 0 ? '' : 'none';
      this._btnA.classList.toggle('armed', this._armed === 'A');
      this._btnB.classList.toggle('armed', this._armed === 'B');
    }
    /**
     * Recadre sur le sommet de la pile : échantillons, statistiques, origine des abscisses.
     *
     * Les bornes empilées sont gardées en abscisse de la trace **entière**, jamais dans le
     * repère du niveau courant : sinon chaque cran se lirait dans celui du précédent et
     * l'erreur de rebasage se composerait de niveau en niveau. Rend les coordonnées
     * cartographiques du niveau, dont le cadrage a besoin.
     */
    _applyCrops() {
      if (!this._crops.length) {
        this._off = 0; this._samples = this._fullSamples; this._stats = this._fullStats;
        return null;
      }
      const { a, b } = this._crops[this._crops.length - 1];
      const raw = this._fullSamples.filter((p) => p.x >= a && p.x <= b);
      if (raw.length < 2) { this._crops.pop(); return this._applyCrops(); }
      const off = raw[0].x, tOff = raw[0].t != null ? raw[0].t : 0;
      this._off = off;
      this._samples = raw.map((p) => ({ x: p.x - off, z: p.z, coord: p.coord, slope: p.slope, t: (p.t != null ? p.t - tOff : null) }));
      this._stats = this._statsOf(this._samples, false);
      return raw.map((p) => p.coord);
    }

    /** Cadre la carte sur un niveau, ou sur la trace entière si [coords] est nul. */
    _fitMap(coords) {
      const map = this.getMap(); if (!map) return null;
      let ext = null;
      if (coords && coords.length) ext = boundingExtent(coords);
      else if (this._feature) ext = this._feature.getGeometry().getExtent();
      if (!ext) return null;
      const view = map.getView();
      let res = null;
      try { res = view.getResolutionForExtent(ext, map.getSize()); } catch (e) { res = null; }
      view.fit(ext, { padding: [40, 40, 40, 40], duration: 400 });
      return res;
    }

    /** Empile un niveau. [a0] et [b0] sont lus dans le repère du niveau courant. */
    _pushCrop(a0, b0) {
      this._zoomA = null; this._zoomB = null; this._armed = null;
      if (this._cropDepth >= this._cropMax) { this._updateZoomButtons(); this._render(); return; }
      const a = this._off + Math.min(a0, b0), b = this._off + Math.max(a0, b0);
      let n = 0;
      for (let k = 0; k < this._fullSamples.length; k++) {
        const px = this._fullSamples[k].x; if (px >= a && px <= b) n++;
      }
      if (n < 2) { this._updateZoomButtons(); this._render(); return; }
      this._crops.push({ a, b, fitRes: null });
      const coords = this._applyCrops();
      this._updateZoomButtons(); this._render();
      const cur = this._crops[this._crops.length - 1];
      if (cur) cur.fitRes = this._fitMap(coords);
    }

    /**
     * Recadre sur A..B déjà posés. Conservé : c'était le point d'entrée du niveau unique,
     * et le supprimer casserait ce qui l'appelle sans rien apporter.
     */
    _applyZoom() {
      if (this._zoomA == null || this._zoomB == null) return;
      this._pushCrop(this._zoomA, this._zoomB);
    }

    /** Remonte d'un niveau. */
    _popCrop() {
      if (!this._crops.length) return;
      this._crops.pop();
      this._zoomA = null; this._zoomB = null; this._armed = null;
      const coords = this._applyCrops();
      this._updateZoomButtons(); if (!this._collapsed) this._render();
      this._fitMap(coords);
    }

    /** Vide la pile d'un coup, quel que soit le nombre de niveaux. */
    _exitZoom() {
      this._crops.length = 0;
      this._zoomA = null; this._zoomB = null; this._armed = null;
      this._applyCrops();
      this._updateZoomButtons(); if (!this._collapsed) this._render();
      this._fitMap(null);
    }

    /**
     * Point of the profiled outline closest to a map coordinate.
     *
     * A polygon's own `getClosestPoint` answers for its **surface**: with the cursor inside
     * the ring it returns the cursor itself, so the marker would follow the pointer across
     * the whole shape instead of sliding along the outline. Lines keep the geometry's own
     * answer, which is exact rather than limited to the decimated samples.
     */
    _closestOnProfile(coordinate) {
      const g = this._feature && this._feature.getGeometry();
      if (!g) return null;
      if (!/Polygon/.test(g.getType())) return g.getClosestPoint(coordinate);
      const hit = this._projectOn(this._fullSamples, coordinate);
      return hit ? hit.coord : null;
    }

    /**
     * Projeté d'une coordonnée sur la ligne brisée [data] : le point, et son abscisse
     * curviligne dans le repère de [data].
     *
     * Retenir l'échantillon le plus proche ferait sauter le marqueur de sommet en sommet,
     * l'écart entre deux points de trace étant souvent bien plus grand que le pas du
     * pointeur. La projection sur les segments donne le point réellement visé.
     */
    _projectOn(data, coord) {
      if (!data || !data.length) return null;
      if (data.length === 1) return { x: data[0].x, coord: data[0].coord.slice(0, 2) };
      let best = null, bd = Infinity;
      for (let i = 1; i < data.length; i++) {
        const a = data[i - 1].coord, b = data[i].coord;
        const abx = b[0] - a[0], aby = b[1] - a[1], len2 = abx * abx + aby * aby;
        // Segment dégénéré (deux points confondus) : le projeté est le point lui-même.
        let r = len2 > 0 ? ((coord[0] - a[0]) * abx + (coord[1] - a[1]) * aby) / len2 : 0;
        r = r < 0 ? 0 : (r > 1 ? 1 : r);
        const px = a[0] + abx * r, py = a[1] + aby * r;
        const dx = px - coord[0], dy = py - coord[1], dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = { x: data[i - 1].x + (data[i].x - data[i - 1].x) * r, coord: [px, py] }; }
      }
      return best;
    }

    // ---------- focus -------------------------------------------------
    _tooltipText(d) {
      const o = this.options, parts = [];
      o.tooltipItems.forEach((it) => {
        if (it === 'distance') parts.push(fmtDistance(d.x, o.units));
        else if (it === 'elevation') parts.push(fmtElevation(d.z, o.units));
        else if (it === 'slope') parts.push(fmtSlope(d.slope || 0));
        else if (it === 'time') { if (d.t != null) parts.push(this._fmtDuration(d.t)); }
      });
      return parts.join(' · ');
    }
    _setFocus(d) {
      if (!this._focus) return;
      const x = this._x, y = this._y;
      this._focus.style('display', null);
      this._focus.select('.oep-focus-line').attr('x1', x(d.x)).attr('x2', x(d.x));
      this._focus.select('.oep-focus-dot').attr('cx', x(d.x)).attr('cy', y(d.z));
      let yLbl = y(d.z) - 16; if (yLbl < 12) yLbl = y(d.z) + 22;
      const t = this._focus.select('.oep-focus-txt').attr('x', x(d.x)).attr('y', yLbl).text(this._tooltipText(d));
      const bb = t.node().getBBox();
      this._focus.select('.oep-focus-bg').attr('x', bb.x - 4).attr('y', bb.y - 2).attr('width', bb.width + 8).attr('height', bb.height + 4);
      if (x(d.x) + bb.width / 2 > this._dims.innerW) t.attr('text-anchor', 'end');
      else if (x(d.x) - bb.width / 2 < 0) t.attr('text-anchor', 'start');
      else t.attr('text-anchor', 'middle');
    }
    /**
     * Point du profil à une abscisse quelconque, interpolé entre les deux échantillons qui
     * l'encadrent.
     *
     * Se caler sur l'échantillon le plus proche ferait avancer le curseur de sommet en
     * sommet : sur un tracé peu dense, ou décimé par `maxPoints`, le saut est franc et le
     * survol perd sa continuité. Les échantillons sont les points *mesurés*, non les seules
     * positions que le curseur ait le droit d'occuper.
     *
     * La pente n'est pas interpolée : `_addSlope` la pose sur le segment qui précède chaque
     * échantillon, elle est donc constante sur ce segment et vaut celle de son extrémité.
     * Le temps l'est, mais seulement si les deux bornes en portent un.
     */
    _sampleAt(x0) {
      const data = this._samples;
      if (!data || !data.length) return null;
      if (data.length === 1) return data[0];
      const xa = data[0].x, xb = data[data.length - 1].x;
      const xc = Math.max(xa, Math.min(xb, x0));
      const i = Math.min(Math.max(bisectX(data, xc, 1), 1), data.length - 1);
      const d0 = data[i - 1], d1 = data[i];
      const span = d1.x - d0.x, r = span > 0 ? (xc - d0.x) / span : 0;
      const lerp = (a, b) => a + (b - a) * r;
      return {
        x: xc,
        z: lerp(d0.z, d1.z),
        coord: [lerp(d0.coord[0], d1.coord[0]), lerp(d0.coord[1], d1.coord[1])],
        slope: d1.slope,
        t: (d0.t != null && d1.t != null) ? lerp(d0.t, d1.t) : null
      };
    }
    /** Suit une coordonnée de la carte, projetée sur le tracé courant. */
    _focusByCoord(coord) {
      const hit = this._projectOn(this._samples, coord); if (!hit) return;
      const d = this._sampleAt(hit.x); if (!d) return;
      this._setFocus(d); if (this._marker) this._marker.setPosition(d.coord);
    }
    _clearFocus() { if (this._focus) this._focus.style('display', 'none'); if (this._marker) this._marker.setPosition(undefined); }
    _clear() {
      this._body.innerHTML = '';
      this._legendEl.innerHTML = ''; this._legendEl.style.display = 'none';
      this._titleEl.textContent = this.options.labels.empty; this._titleEl.removeAttribute('title');
      this._statsEl.innerHTML = ''; this._statsEl.removeAttribute('title');
      this._crops = []; this._off = 0; this._demLoading = false; this._updateZoomButtons();
      this._clearFocus();
      this.element.style.display = 'none';
      this._adjustAttribution();
    }
  }

  /**
   * Register a custom theme.
   * @param {string} name
   * @param {{area:string,line:string,axis:string,text:string,focus:string}} colors
   */
  ElevationProfile.addTheme = (name, colors) => { THEMES[name] = colors; };
  ElevationProfile.THEMES = THEMES;
  /** Known keyless terrain-tile sources, keyed by `dem.source` name. */
  ElevationProfile.DEM_PRESETS = DEM_PRESETS;
  ElevationProfile.DemSampler = DemSampler;
  ElevationProfile.POSITIONS = POSITIONS;
  // Stamped at build time from package.json - see rollup.config.mjs, which fails the build
  // if this placeholder ever stops matching. Read from the source rather than the bundle,
  // it says just that: a development copy, of no released version.
  ElevationProfile.version = '0.0.0-dev';

export default ElevationProfile;
