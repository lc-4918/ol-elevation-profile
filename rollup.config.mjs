// Rollup build: ESM + UMD (+ minified). OpenLayers and d3 stay external (peer deps).
import terser from '@rollup/plugin-terser';

const input = 'src/ol-elevation-profile.js';
const name = 'OlElevationProfile';
const banner = '/*! ol-elevation-profile | MIT License | https://github.com/lc-4918/ol-elevation-profile */';

// Map bare module ids to the OpenLayers full-build globals for the UMD bundle.
const globals = {
  'ol/control/Control.js': 'ol.control.Control',
  'ol/Overlay.js': 'ol.Overlay',
  'ol/Observable.js': 'ol.Observable',
  'ol/proj.js': 'ol.proj',
  'ol/sphere.js': 'ol.sphere',
  'ol/extent.js': 'ol.extent',
  d3: 'd3',
};
const external = Object.keys(globals);

export default {
  input,
  external,
  output: [
    { file: 'dist/ol-elevation-profile.js', format: 'umd', name, globals, banner, exports: 'default' },
    { file: 'dist/ol-elevation-profile.min.js', format: 'umd', name, globals, banner, exports: 'default', plugins: [terser()] },
    { file: 'dist/ol-elevation-profile.esm.js', format: 'es', banner },
    { file: 'dist/ol-elevation-profile.esm.min.js', format: 'es', banner, plugins: [terser()] },
  ],
};
