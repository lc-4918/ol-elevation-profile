// Rollup build: ESM + UMD (+ minified). OpenLayers and d3 stay external (peer deps).
import { readFileSync } from 'node:fs';
import terser from '@rollup/plugin-terser';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const input = 'src/ol-elevation-profile.js';
const name = 'OlElevationProfile';
const banner = `/*! ol-elevation-profile ${version} | MIT License | https://github.com/lc-4918/ol-elevation-profile */`;

// The version lives in package.json and nowhere else. Keeping a second copy in the source
// meant editing it by hand at each release, which is exactly the kind of step one forgets:
// the published 2.0.1 still announced itself as 0.6.0. The placeholder is substituted here,
// and a build that can no longer find it fails rather than shipping a wrong number.
const JALON = "ElevationProfile.version = '0.0.0-dev';";
const stampVersion = {
  name: 'stamp-version',
  transform(code, id) {
    if (!id.endsWith('ol-elevation-profile.js')) return null;
    if (!code.includes(JALON)) {
      this.error(`version placeholder not found in ${id}: expected ${JALON}`);
    }
    return { code: code.replace(JALON, `ElevationProfile.version = '${version}';`), map: null };
  },
};

// Map bare module ids to the OpenLayers full-build globals for the UMD bundle.
const globals = {
  'ol/control/Control.js': 'ol.control.Control',
  'ol/Overlay.js': 'ol.Overlay',
  'ol/Observable.js': 'ol.Observable',
  'ol/TileState.js': 'ol.TileState',
  'ol/proj.js': 'ol.proj',
  'ol/sphere.js': 'ol.sphere',
  'ol/extent.js': 'ol.extent',
  d3: 'd3',
};
const external = Object.keys(globals);

export default {
  input,
  external,
  plugins: [stampVersion],
  output: [
    { file: 'dist/ol-elevation-profile.js', format: 'umd', name, globals, banner, exports: 'default' },
    { file: 'dist/ol-elevation-profile.min.js', format: 'umd', name, globals, banner, exports: 'default', plugins: [terser()] },
    { file: 'dist/ol-elevation-profile.esm.js', format: 'es', banner },
    { file: 'dist/ol-elevation-profile.esm.min.js', format: 'es', banner, plugins: [terser()] },
  ],
};
