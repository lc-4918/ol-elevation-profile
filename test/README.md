# Smoke test

```bash
npm install     # jsdom + d3 come from devDependencies
npm run build   # the test loads dist/, not the sources
npm test          # smoke.cjs (mocked ol) then ol-sources.mjs (real ol)
```

Runs offline, in jsdom, against the UMD bundle. Checks: show/hide around `setFeature`
and `clear`, `'auto'` colour read from the track style, title link, slope-class portions
and separators, adaptive duration format, moving time vs wall-clock time, A/B crop and
its reset, mobile mode, and terrain-model reading (bilinear interpolation across a tile
boundary, terrarium and mapbox decoding, all-or-nothing on a lost tile), the latter on
hand-made tiles, so no request is made.

`test/ol-sources.mjs` runs against a **real** OpenLayers, installed as a devDependency. It
covers what a mocked `ol` cannot reach: the DataTile path used by `ol/source/GeoTIFF`,
which has no URL, no Web Mercator and no 256 pixel tiles.
