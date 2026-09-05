# ol-elevation-profile

<p>
  <a href="https://www.npmjs.com/package/ol-elevation-profile"><img src="https://img.shields.io/npm/v/ol-elevation-profile.svg" alt="npm version"></a>
  <a href="https://openlayers.org/"><img src="https://img.shields.io/badge/OpenLayers-6%20to%2010.10.0-1f6feb.svg" alt="OpenLayers 6 to 10.10.0"></a>
  <a href="https://d3js.org/"><img src="https://img.shields.io/badge/d3-%E2%89%A5%207-f9a03c.svg" alt="d3 >= 7"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT"></a>
</p>

A synchronized, themeable **elevation profile control for [OpenLayers](https://openlayers.org/)**, rendered with [d3](https://d3js.org/).

It reads elevation (**Z**) directly from a track's geometry (`[lon, lat, z]` GPX/GeoJSON): distance, ascent/descent and min/max are computed from the track itself, with no service involved. A track that carries **no** Z is filled from keyless [terrain tiles](#terrain-model), which is on by default; `dem: null` turns it off. Clicking (or hovering) a track shows its profile; a marker stays synchronized on both the map and the chart, and a click on the empty map hides it. The control is fully responsive (full-width docked bar on phones), supports slope-class colouring, metric smoothing, an A/B crop, six themes, transparency, and a track-colour mode.

## Screenshots

![Elevation profile coloured by slope class](./assets/screenshot-profile.png)

> Animated demos (hover sync, A/B crop, slope colouring) are best seen live, see the [demo](#demo). GIFs can be added under `assets/`.

## Installation

### Script tags (UMD)

The control expects `ol` and `d3` to be present as globals (provided by your map page):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@10.10.0/ol.css">
<script src="https://cdn.jsdelivr.net/npm/ol@10.10.0/dist/ol.js"></script>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>

<link rel="stylesheet" href="ol-elevation-profile.css">
<script src="ol-elevation-profile.js"></script>
<!-- exposes window.OlElevationProfile -->
```

### npm / bundler (ESM)

```bash
npm i ol-elevation-profile
# ol and d3 are peer dependencies you install yourself
```

```js
import OlElevationProfile from 'ol-elevation-profile'
import 'ol-elevation-profile/css'
```

## Usage

```js
const profile = new OlElevationProfile({
  position: 'bottom',
  theme: 'steelblue',
  units: 'meters',
  color: 'auto',                              // chart uses the track colour
  trackLayer: vectorLayer,                    // layer to read that colour from
  slope: true,                                // colour the profile by gradient class
  tooltipItems: ['distance', 'elevation', 'slope'],
  titleLink: 'link'                           // title becomes a link from a feature property
})
map.addControl(profile)

const feats = new ol.format.GeoJSON().readFeatures(geojson, {
  dataProjection: 'EPSG:4326',
  featureProjection: map.getView().getProjection()
})
vectorSource.addFeatures(feats)
profile.setFeature(feats[0])  // or let a click on the track select it
```

Any OpenLayers-readable format works (GeoJSON, GPX, KML, and so on): the control only consumes OL `Feature`s. Read GPX/KML with `ol.format.GPX` / `ol.format.KML` and pass the line feature to `setFeature`.

Full option reference: see the [documentation](#documentation).

## Features

### Slope classes

With `slope: true`, the profile is split into contiguous portions of the same slope class (width `slopeClassSize`, in %), capped at `maxClasses` (default 8). Colours run from **blue** (flattest class) to **red** (steepest), via cyan/green and a pure yellow, spread across the classes that are actually present (not stretched on the real maximum slope). A vertical separator marks each class change, and a legend appears under the title.

### Smoothing

A recorded elevation wobbles by a few metres from one point to the next, and each wobble counts as a climb followed by a descent, so **D+ inflates**, sometimes by hundreds of metres on a flat outing. `smoothing` replaces each elevation by the average of those found within half the window on either side, **along the track**: a distance in metres, not a number of points, so the same value behaves the same whatever the recording density. It applies to the samples, so D+/D-, min/max and the slope classes follow. The price is symmetrical: a window wide enough to erase the noise also rounds off a col.

### Languages

Labels ship in **English** (default), **French** and **Spanish**: `lang: 'fr'` switches the whole panel, buttons and accessible names included, and `profile.setOptions({ lang: 'es' })` does it at runtime. An unknown code falls back to English rather than leaving keys empty. `labels` still overrides any key on top of the chosen language, which is how you reach a language that is not shipped, and an override survives a later language change.

> **Coming from 1.x**: the shipped labels used to be French, with no way to ask for another language. English is now the default; add `lang: 'fr'` to keep the panel exactly as it was.

### Vertical scale

By default (`verticalScale: 'auto'`) the profile fills the height. That is legible, but the scale changes from one track to the next, so a 2 % ramp looks like a wall and two profiles cannot be compared. A **number** fixes the metres covered per physical centimetre, measured on screen rather than deduced from the nominal 96 dpi, so it follows the browser zoom.

The value is a **floor, not a cage**: a track whose range exceeds what the height can show would spill out of the frame, which is worse than losing comparability. The scale then widens to contain it, silently: nothing is drawn on the chart to announce the scale, which is a property of the display rather than of the track.

### Nested crops

With `zoom: true`, the A/B buttons crop map and profile to a sub-range. Placing one bound arms the other, so the pair is picked in two clicks on the chart rather than four trips to the toolbar. A crop can then be cropped in turn, which is how you reach a col inside a stage of a long route, down to `zoomLevels` deep (default 3; `1` restores the former single level). A **back** button appears from the second level and undoes one crop, while **show all** empties the stack whatever the depth; zooming the map out past a level's extent leaves that level only. Bounds are kept in the whole track's abscissa, never in the frame of the level they were picked in, so nesting introduces no drift.

### Terrain model

A track with **no Z** (drawn by hand, traced over a basemap, exported by a tool that drops the third dimension) would get no profile. The missing elevations are read from [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) instead, **by default**: PNG tiles carrying elevation in their R/G/B channels, **no API key, no quota, no rate limit**. A 10 000-point track costs a handful of tiles where a free elevation API would cost 100 requests. Pass `dem: null` to disable it and keep the control off the network.

Elevation is interpolated bilinearly between the four surrounding pixels: reading the containing pixel would make the profile advance in stairs, and every stair counts as a climb then a descent in the D+. A track is filled **entirely or not at all**: a profile missing a few points dives to sea level and its D+ becomes absurd. Tracks that already carry their own Z are untouched.

Accuracy is roughly 30 to 90 m depending on the region (mean 16 m from IGN's 1 m reference on steep alpine terrain). Any of these can be used instead:

| `dem` | Source |
|---|---|
| `'terrarium'` (default) | AWS Terrain Tiles, keyless, worldwide |
| `'ign'` | IGN Géoplateforme RGE ALTI, France, metre-accurate, keyless |
| `{ url: '.../{z}/{x}/{y}.png' }` | any XYZ tile set, `terrarium` or `mapbox` encoding, or your own decoder |
| `{ wms: { url, layers } }` | WMS tiles, one `GetMap` per tile |
| `{ olSource }` | any `ol/source/TileImage`, or **`ol/source/GeoTIFF`** for a COG or a WCS `GetCoverage` |
| `{ featureInfo: { url, layers } }` | GeoServer greyscale coverage, through WMS `GetFeatureInfo` |
| a function | you fetch the elevations yourself, from any API |

Every source but `featureInfo` is sampled with **bilinear interpolation** between the four surrounding pixels. See the [guide](https://lc-4918.github.io/ol-elevation-profile/guide/features#terrain-model).

### PNG export

`exportPng: true` adds a button to the toolbar, to the right of the zoom buttons, saving the **whole panel** as an image: title, stats line, slope legend and the complete chart with both axes. `profile.exportPNG()` does the same from code and resolves with the `Blob`; `{ download: false }` returns it without saving, `scale` defaults to the device pixel ratio.

The position indicator is left out: it marks where the pointer happens to be, which means nothing once the image is saved. The panel is rebuilt as an SVG rather than screenshotted, with every painting property frozen inline, since a serialized SVG carries no stylesheet.

### Attributions

When the profile occupies the bottom-right corner (or full-width at the bottom), the OpenLayers attribution control is automatically lifted **above** the profile, right-aligned, with a vertical gap equal to the map-edge-to-profile-bottom gap. Other placements leave the attribution untouched.

### Time

If the track carries time data (`coordTimes` ISO timestamps from GPX `<time>`, `coordinateProperties.times`, or a 4th `M` coordinate), add `'duration'` to `headerItems` for the **total elapsed time** in the title, and `'time'` to `tooltipItems` for the **elapsed time at the cursor**. The unit adapts: `7 sec`, `26 min`, `1 h 48 min`, `2 j 3 h`. By default this is **moving time** (stopped segments below `stopSpeed`, 0.5 m/s, are excluded); set `ignoreStops: false` for raw wall-clock time. Detect availability with `OlElevationProfile.featureHasTime(feature)`.

## Demo

Live, interactive [demo](https://lc-4918.github.io/ol-elevation-profile/demo/) (toggle every option)

## Documentation

[Full guide and API](https://lc-4918.github.io/ol-elevation-profile/) (English & French)

## License

[MIT](./LICENSE) © lc-4918
