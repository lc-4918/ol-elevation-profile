/**
 * Synchronized elevation profile control for OpenLayers, rendered with d3.
 *
 * Reads elevation (Z) directly from 3D line geometries (`[lon, lat, z]`),
 * so no external elevation service is queried. Clicking (or hovering) a track
 * shows its profile; a marker stays synchronized on both the map and the chart.
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
import { toLonLat } from 'ol/proj.js';
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

  const DEFAULTS = {
    immersion: 'docked',
    position: 'bottom',
    width: 520,                   // nombre (px, plafonné à la largeur de la carte) ou 'auto'/'100%'/'full' = largeur de la carte
    height: 180,
    margins: { unit: 'px', top: 20, right: 24, bottom: 30, left: 48 },
    units: 'meters',
    dataProjection: null,
    maxPoints: 2000,
    smoothing: 0,                 // lissage de l'altitude : fenêtre en MÈTRES (0 = aucun)
    theme: 'steelblue',
    color: null,                  // null=thème, 'auto'=couleur de la trace, ou couleur CSS
    trackLayer: null,
    transparency: false,          // false | true | nombre 0..1
    transparencyLevel: 0.45,
    grid: true,
    slope: false,
    slopeClassSize: 2.5,
    slopeColors: null,            // null = dégradé bleu->rouge (HSL) ; sinon tableau interpolé
    slopeSeparators: true,        // ligne verticale à chaque changement de classe
    slopeLegend: true,
    maxClasses: 8,                // nombre maximal de classes de pente (couleurs + légende)
    xTicks: null,
    yTicks: null,
    show: 'click',
    collapsable: true,
    collapsed: false,
    followMap: true,
    marker: true,
    hideOnMapClick: true,
    responsive: true,             // adapte la largeur/placement, mobile inclus
    mobileBreakpoint: 640,        // <= largeur écran -> mode mobile (100% largeur, top/bottom)
    zoom: false,                  // boutons début/fin pour recadrer carte + profil sur A..B
    ignoreStops: true,            // durée = temps en mouvement (ignore les arrêts)
    stopSpeed: 0.5,               // seuil d'arrêt en m/s (~1,8 km/h)
    tooltipItems: ['distance', 'elevation'],
    headerItems: ['distance', 'ascent', 'descent', 'minmax'],
    titleProperty: 'name',
    titleLink: null,
    labels: {
      distance: 'Distance', elevation: 'Altitude', slope: 'Pente',
      ascent: 'D+', descent: 'D-', empty: 'Cliquez un tracé',
      time: 'Temps', duration: 'Durée',
      durationUnits: { s: 'sec', m: 'min', h: 'h', d: 'j' },
      zoomStart: 'Définir le début (A)', zoomEnd: 'Définir la fin (B)', zoomAll: 'Tout voir'
    }
  };

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

  // Extrait un tableau plat de timestamps (ms epoch) aligné sur l'ordre plat des coordonnées,
  // depuis properties.coordTimes (ISO ou nombre), coordinateProperties.times, ou la 4e dimension (M).
  function extractTimes(feature, lines) {
    const props = (feature && feature.getProperties) ? feature.getProperties() : {};
    let raw = props.coordTimes;
    if (raw == null && props.coordinateProperties) raw = props.coordinateProperties.times || props.coordinateProperties.coordTimes;
    let flat = null;
    if (Array.isArray(raw)) flat = Array.isArray(raw[0]) ? raw.reduce((a, b) => a.concat(b), []) : raw.slice();
    if (!flat && lines) {                          // repli : 4e dimension M (layout XYZM)
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
  const ICON_ALL = '<svg viewBox="0 0 24 24"><path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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
   * @property {?string[]} [slopeColors=null] `null` = blue→red ramp; otherwise an interpolated color array.
   * @property {boolean} [slopeSeparators=true] Vertical separator at each slope-class change.
   * @property {boolean} [slopeLegend=true] Color legend under the title.
   * @property {number} [smoothing=0] Elevation smoothing window, in METERS (0 = none).
   * @property {?number} [xTicks=null] X axis ticks (null = auto from width).
   * @property {?number} [yTicks=null] Y axis ticks (null = auto from height).
   * @property {'click'|'mouseover'} [show='click'] How a track is selected on the map.
   * @property {boolean} [hideOnMapClick=true] Click on empty map hides the profile.
   * @property {boolean} [collapsable=true] Show the collapse/expand button.
   * @property {boolean} [collapsed=false] Initial collapsed state.
   * @property {boolean} [followMap=true] Hovering the map moves the chart indicator.
   * @property {boolean} [marker=true] Show the position marker on the map.
   * @property {boolean} [responsive=true] Adapt width/placement; mobile included.
   * @property {number} [mobileBreakpoint=640] Below this width: mobile mode (100% width, top/bottom only).
   * @property {boolean} [zoom=false] A/B buttons to crop map + profile to a sub-range.
   * @property {boolean} [ignoreStops=true] When computing time, ignore stopped segments (moving time).
   * @property {number} [stopSpeed=0.5] Speed threshold (m/s) below which a segment counts as a stop.
   * @property {Array<'distance'|'elevation'|'slope'|'time'>} [tooltipItems=['distance','elevation']] Tooltip content (`'time'` = elapsed time at the cursor, if the track has time data).
   * @property {Array<string|{property:string,label?:string,asLink?:boolean,linkText?:string}>} [headerItems] Header content (string tokens: distance, ascent, descent, min, max, minmax, `'duration'` = total elapsed time).
   * @property {string} [titleProperty='name'] Feature property used as the title.
   * @property {?string} [titleLink=null] Feature property holding a URL → clickable title.
   * @property {number} [maxPoints=2000] Decimation for render/interaction (stats use full data).
   * @property {?import('ol/proj/Projection').default|string} [dataProjection=null] Projection of the feature coordinates.
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
      const element = buildElement(o);
      super({ element, target: opts && opts.target });

      this.options = o;
      this.slopeColors = o.slopeColors || null;
      this._feature = null;
      this._fullSamples = null; this._fullStats = null;
      this._samples = null; this._stats = null;
      this._marker = null;
      this._collapsed = !!o.collapsed;
      this._cropMode = false; this._zoomA = null; this._zoomB = null; this._armed = null; this._fitRes = null;
      this._onResize = () => { if (this._feature && !this._collapsed) this._render(); };
      this._buildDom(element);
      element.style.display = 'none';
    }

    // ---------- util statique ----------------------------------------
    /**
     * Whether a feature has any Z (elevation) coordinate.
     * @param {import('ol/Feature').default} feature
     * @returns {boolean}
     */
    static featureHasZ(feature) {
      const g = feature && feature.getGeometry && feature.getGeometry();
      if (!g) return false;
      const coords = g.getType() === 'MultiLineString' ? g.getCoordinates() : [g.getCoordinates()];
      for (const seg of coords) for (const c of seg) if (c.length > 2 && isFinite(c[2])) return true;
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
      const lines = g.getType() === 'MultiLineString' ? g.getCoordinates() : [g.getCoordinates()];
      return !!extractTimes(feature, lines);
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
      this._btnAll = mkBtn('oep-all', ICON_ALL, o.labels.zoomAll, () => this._exitZoom());
      header.appendChild(this._toolbar);

      const btn = document.createElement('button');
      btn.className = 'oep-toggle'; btn.type = 'button';
      btn.setAttribute('aria-label', 'Réduire ou agrandir le profil');
      btn.innerHTML = this._collapsed ? ICON_EXPAND : ICON_COLLAPSE;
      btn.addEventListener('click', () => this.toggleCollapsed());
      header.appendChild(btn);
      this._toggleBtn = btn;

      this._legendEl = document.createElement('div'); this._legendEl.className = 'oep-legend'; this._legendEl.style.display = 'none';
      this._body = document.createElement('div'); this._body.className = 'oep-body';

      root.appendChild(header); root.appendChild(this._legendEl); root.appendChild(this._body);
      this._applyCollapsable();
      this._updateZoomButtons();
      if (this._collapsed) root.classList.add('oep-collapsed');
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
      if (!this._collapsed && this._feature) this._render();
      this._adjustAttribution();
    }

    // ---------- responsive -------------------------------------------
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

    // remonte les attributions OL au-dessus du profil quand celui-ci occupe le coin bas-droite
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
      const bottomGap = mapR.bottom - pR.bottom;                     // bord bas de carte <-> bas du profil
      const rightGap = mapR.right - pR.right;
      const atBottom = bottomGap < pR.height;                        // profil dans la bande basse
      const reachesRight = rightGap < 24;                            // atteint le coin bas-droite (attributions)
      if (atBottom && reachesRight) {
        attr.style.right = `${Math.max(0, Math.round(rightGap))}px`;
        attr.style.bottom = `${Math.round(pR.height + 2 * bottomGap)}px`;  // même écart au-dessus du profil
      }
    }

    // ---------- carte -------------------------------------------------
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
        const g = f.getGeometry(); return (g && /LineString/.test(g.getType())) ? f : undefined;
      });

      this._mapKeys = [];
      this._mapKeys.push(map.on(o.show === 'mouseover' ? 'pointermove' : 'click', (evt) => {
        const feature = lineAt(evt.pixel); if (feature && feature !== this._feature) this.setFeature(feature);
      }));
      if (o.hideOnMapClick) this._mapKeys.push(map.on('click', (evt) => { if (!lineAt(evt.pixel) && this._feature) this.clear(); }));
      if (o.followMap) this._mapKeys.push(map.on('pointermove', (evt) => {
        if (!this._feature || this._collapsed) return;
        const cp = this._feature.getGeometry().getClosestPoint(evt.coordinate);
        const px = map.getPixelFromCoordinate(cp); if (!px) return;
        if (Math.hypot(px[0] - evt.pixel[0], px[1] - evt.pixel[1]) < 14) this._focusByCoord(cp); else this._clearFocus();
      }));
      // sortie du zoom au dézoom de la carte
      this._mapKeys.push(map.on('moveend', () => {
        if (this._cropMode && this._fitRes && map.getView().getResolution() > this._fitRes * 1.25) this._exitZoom();
      }));
      this._mapKeys.push(map.on('change:size', this._onResize));
    }

    // ---------- API ---------------------------------------------------
    /**
     * Show the profile for the given feature (LineString/MultiLineString, ideally 3D).
     * Passing a falsy value hides the control.
     * @param {?import('ol/Feature').default} feature
     * @returns {this}
     */
    setFeature(feature) {
      this._feature = feature || null;
      this._cropMode = false; this._zoomA = null; this._zoomB = null; this._armed = null;
      if (!feature) { this._fullSamples = this._samples = null; this._clear(); return this; }
      this.element.style.display = '';
      this._compute();
      this._updateZoomButtons();
      if (!this._collapsed) this._render();
      return this;
    }
    /** Hide the profile and clear the current feature. @returns {this} */
    clear() { return this.setFeature(null); }
    /**
     * @returns {?{distance:number,ascent:number,descent:number,min:number,max:number,maxAbsSlope:number,points:number}}
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
      if (patch && 'zoom' in patch) this._updateZoomButtons();
      if (patch && typeof patch.width !== 'undefined' && typeof patch.width === 'number') this.options.width = patch.width;
      if (this._feature) { this._compute(); this._updateZoomButtons(); if (!this._collapsed) this._render(); }
      return this;
    }

    // ---------- calcul ------------------------------------------------
    _compute() {
      const o = this.options;
      const geom = this._feature.getGeometry();
      const lines = geom.getType() === 'MultiLineString' ? geom.getCoordinates() : [geom.getCoordinates()];
      const dataProj = o.dataProjection || (this.getMap() && this.getMap().getView().getProjection()) || 'EPSG:3857';

      const times = extractTimes(this._feature, lines);
      this._hasTime = !!times;
      const ignoreStops = o.ignoreStops !== false;                   // défaut : ignore les arrêts
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
            const dt = (ms - prevMs) / 1000;                          // s sur le segment
            if (dt > 0 && (!ignoreStops || (dseg / dt) >= stopSpeed)) tAcc += dt;
          }
          t = tAcc; prevMs = ms;
        }
        prev = ll;
        pts.push({ x: cum, z: (c.length > 2 && isFinite(c[2])) ? c[2] : 0, coord: c, t });
      }
      if (o.smoothing > 0) this._smooth(pts, o.smoothing);

      const samples = this._decimate(pts, o.maxPoints);
      this._addSlope(samples);
      this._fullSamples = samples;
      this._fullStats = this._statsOf(samples, true);
      this._samples = samples; this._stats = this._fullStats;
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
      return { distance, duration, ascent, descent, min: isFinite(zmin) ? zmin : 0, max: isFinite(zmax) ? zmax : 0, maxAbsSlope: maxAbs, points: samples.length };
    }
    _smooth(pts, meters) {
      if (!(meters > 0) || pts.length < 3) return;
      const half = meters / 2;                     // fenêtre = ±(meters/2) le long du tracé
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

    // ---------- pente : couleurs --------------------------------------
    _slopeScale() {
      const cs = this.options.slopeClassSize || 2.5;
      const maxClasses = this.options.maxClasses || 8;
      const realIdx = Math.max(1, Math.floor((this._stats.maxAbsSlope || 0) / cs));
      const maxIdx = Math.min(realIdx, maxClasses - 1);   // au plus `maxClasses` classes (défaut 8)
      const capped = realIdx > maxIdx;                    // des pentes dépassent la dernière classe
      let colorByIndex;
      if (this.slopeColors && this.slopeColors.length) {
        const interp = d3.interpolateRgbBasis(this.slopeColors);
        colorByIndex = (idx) => interp(maxIdx ? idx / maxIdx : 0);
      } else {
        // rampe à arrêts non uniformes : partie froide (bleu-vert, peu lisible) compressée,
        // jaune PUR au milieu, puis orange, rouge. classe 0 = bleu, classe max = rouge.
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

    // ---------- temps : format adaptatif ------------------------------
    // 7 sec · 26 min · 1 h 48 min · 2 j 3 h (jours + heures normalisés)
    _fmtDuration(sec) {
      if (sec == null || !isFinite(sec)) return '';
      const u = (this.options.labels && this.options.labels.durationUnits) || { s: 'sec', m: 'min', h: 'h', d: 'j' };
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

    // ---------- entête + légende --------------------------------------
    _renderHeader() {
      const o = this.options, s = this._stats, f = this._feature;
      const name = (f.get && f.get(o.titleProperty)) || 'Profil';
      const linkUrl = o.titleLink && f.get && f.get(o.titleLink);
      if (isUrl(linkUrl)) this._titleEl.innerHTML = `<a href="${esc(linkUrl)}" target="_blank" rel="noopener">${esc(name)}</a>`;
      else this._titleEl.textContent = name;
      this._titleEl.setAttribute('title', name);

      const html = [], text = [];
      o.headerItems.forEach((it) => {
        if (typeof it === 'string') {
          if (it === 'distance') { html.push(`<b>${fmtDistance(s.distance, o.units)}</b>`); text.push(fmtDistance(s.distance, o.units)); }
          else if (it === 'ascent') { html.push(`<span class="oep-up">${o.labels.ascent} ${fmtElevation(s.ascent, o.units)}</span>`); text.push(`${o.labels.ascent} ${fmtElevation(s.ascent, o.units)}`); }
          else if (it === 'descent') { html.push(`<span class="oep-down">${o.labels.descent} ${fmtElevation(s.descent, o.units)}</span>`); text.push(`${o.labels.descent} ${fmtElevation(s.descent, o.units)}`); }
          else if (it === 'min') { html.push(fmtElevation(s.min, o.units)); text.push(fmtElevation(s.min, o.units)); }
          else if (it === 'max') { html.push(fmtElevation(s.max, o.units)); text.push(fmtElevation(s.max, o.units)); }
          else if (it === 'minmax') { const v = `${fmtElevation(s.min, o.units)}–${fmtElevation(s.max, o.units)}`; html.push(v); text.push(v); }
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
      if (o.slope && o.slopeLegend) {
        const sc = this._slopeScale();
        for (let idx = 0; idx <= sc.maxIdx; idx++) {
          const color = sc.colorByIndex(idx);
          const label = (sc.capped && idx === sc.maxIdx) ? `≥ ${idx * sc.classSize} %` : `${idx * sc.classSize}–${(idx + 1) * sc.classSize} %`;
          const item = document.createElement('span'); item.className = 'oep-leg-it';
          item.innerHTML = `<i class="oep-sw" style="background:${color}"></i>${label}`;
          this._legendEl.appendChild(item);
        }
        this._legendEl.style.display = '';
      } else this._legendEl.style.display = 'none';
    }

    // ---------- rendu -------------------------------------------------
    _render() {
      const o = this.options, s = this._stats, data = this._samples;
      if (!data || !data.length) return;
      this._applyTheme();
      const mobile = this._applyPlacement();
      this._renderHeader();

      const m = o.margins, u = m.unit || 'px';
      const toPx = (v) => u === 'px' ? v : v * (parseFloat(getComputedStyle(this.element).fontSize) || 16);

      // largeur : 100% en mobile ; 'auto'/'100%'/'full' = largeur de la carte ; sinon nombre plafonné à la carte
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
      const y = d3.scaleLinear().domain([s.min - zpad, s.max + zpad]).range([innerH, 0]).nice();
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
          if (i > 1) seps.push(data[i - 1]);   // changement de classe = frontière
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

      // marqueurs A / B en cours de sélection
      if (o.zoom && !this._cropMode) {
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

      const bisect = d3.bisector((d) => d.x).left;
      const pick = (event) => { const mx = d3.pointer(event, g.node())[0]; return Math.max(0, Math.min(s.distance, x.invert(mx))); };
      const overlay = svg.append('rect').attr('class', 'oep-overlay').attr('x', ml).attr('y', mt).attr('width', innerW).attr('height', innerH);
      overlay.on('mousemove', (event) => {
        const x0 = pick(event); const idx = bisect(data, x0, 1);
        const d0 = data[idx - 1], d1 = data[idx] || d0; const d = (x0 - d0.x) > (d1.x - x0) ? d1 : d0;
        this._setFocus(d); if (this._marker) this._marker.setPosition(d.coord);
      }).on('mouseout', () => this._clearFocus());
      overlay.on('click', (event) => {
        if (!this._armed || this._cropMode) return;
        const x0 = pick(event);
        if (this._armed === 'A') this._zoomA = x0; else this._zoomB = x0;
        this._armed = null; this._updateZoomButtons();
        if (this._zoomA != null && this._zoomB != null) this._applyZoom(); else this._render();
      });
      if (this._armed) overlay.style('cursor', 'col-resize');
      this._adjustAttribution();
    }

    // ---------- zoom A/B ----------------------------------------------
    _arm(which) { this._armed = (this._armed === which) ? null : which; this._updateZoomButtons(); if (this._focus) this._render(); }
    _updateZoomButtons() {
      const show = !!this.options.zoom && !!this._feature;
      this._toolbar.style.display = show ? '' : 'none';
      const crop = this._cropMode;
      this._btnA.style.display = show && !crop ? '' : 'none';
      this._btnB.style.display = show && !crop ? '' : 'none';
      this._btnAll.style.display = show && crop ? '' : 'none';
      this._btnA.classList.toggle('armed', this._armed === 'A');
      this._btnB.classList.toggle('armed', this._armed === 'B');
    }
    _applyZoom() {
      const a = Math.min(this._zoomA, this._zoomB), b = Math.max(this._zoomA, this._zoomB);
      const raw = this._fullSamples.filter((p) => p.x >= a && p.x <= b);
      if (raw.length < 2) return;
      const off = raw[0].x;                       // A devient 0
      const tOff = raw[0].t != null ? raw[0].t : 0;
      const cropped = raw.map((p) => ({ x: p.x - off, z: p.z, coord: p.coord, slope: p.slope, t: (p.t != null ? p.t - tOff : null) }));
      const coords = raw.map((p) => p.coord);
      this._samples = cropped; this._stats = this._statsOf(cropped, false); this._cropMode = true;
      this._updateZoomButtons(); this._render();
      const map = this.getMap();
      if (map) {
        const ext = boundingExtent(coords);
        const view = map.getView();
        try { this._fitRes = view.getResolutionForExtent(ext, map.getSize()); } catch (e) { this._fitRes = null; }
        view.fit(ext, { padding: [40, 40, 40, 40], duration: 400 });
      }
    }
    _exitZoom() {
      this._cropMode = false; this._zoomA = null; this._zoomB = null; this._armed = null; this._fitRes = null;
      this._samples = this._fullSamples; this._stats = this._fullStats;
      this._updateZoomButtons(); if (!this._collapsed) this._render();
      const map = this.getMap();
      if (map && this._feature) map.getView().fit(this._feature.getGeometry().getExtent(), { padding: [40, 40, 40, 40], duration: 400 });
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
    _focusByCoord(coord) {
      const data = this._samples; if (!data) return;
      let best = null, bd = Infinity;
      for (const p of data) { const dx = p.coord[0] - coord[0], dy = p.coord[1] - coord[1]; const dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = p; } }
      if (best) { this._setFocus(best); if (this._marker) this._marker.setPosition(best.coord); }
    }
    _clearFocus() { if (this._focus) this._focus.style('display', 'none'); if (this._marker) this._marker.setPosition(undefined); }
    _clear() {
      this._body.innerHTML = '';
      this._legendEl.innerHTML = ''; this._legendEl.style.display = 'none';
      this._titleEl.textContent = this.options.labels.empty; this._titleEl.removeAttribute('title');
      this._statsEl.innerHTML = ''; this._statsEl.removeAttribute('title');
      this._cropMode = false; this._updateZoomButtons();
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
  ElevationProfile.POSITIONS = POSITIONS;
  ElevationProfile.version = '0.6.0';

export default ElevationProfile;
