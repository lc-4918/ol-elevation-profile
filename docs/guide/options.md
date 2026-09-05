# Options

Every option can be passed to the constructor and most can be changed at runtime with `setOptions(patch)`. Below, each option is described with **what it does** and **its default value and meaning**.

## Layout & size

**`immersion`**: panel placement strategy. `'docked'` anchors the panel to a map edge; `'floating'` is a free-floating panel (partial). Default: `'docked'`.

**`position`**: where the panel is anchored on the map: `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'`. Default: `'bottom'` (full-width strip along the bottom).

**`width`**: panel width. A number is pixels, automatically capped to the map width; `'auto'`, `'100%'` or `'full'` make it span the whole map width. Default: `520` (px).

**`height`**: panel height in pixels. Default: `180`.

**`margins`**: inner chart margins, as `{ unit, top, right, bottom, left }`. `unit` is `'px'`, `'em'` or `'rem'`. Default: `{ unit:'px', top:20, right:24, bottom:30, left:48 }` (extra left room for the elevation axis).

**`responsive`**: when `true`, the width and placement adapt to the map size, including switching to mobile mode. When `false`, fixed values are kept. Default: `true`.

**`mobileBreakpoint`**: map width (px) at or below which mobile mode applies (100% width, placement forced to `top`/`bottom`). Default: `640`.

## Units & data

**`units`**: measurement system: `'meters'` (km / m) or `'imperial'` (mi / ft). Default: `'meters'`.

**`dataProjection`**: projection of the feature coordinates. `null` means the map view projection is used; otherwise pass a code such as `'EPSG:4326'` or an `ol/proj/Projection`. Default: `null`.

**`maxPoints`**: caps how many points are drawn and used for interaction (the geometry is decimated above this). Statistics always use the full data. `0` disables decimation. Default: `2000`.

**`dem`**: fill missing elevations from a terrain model when the feature has no Z. Inert on a track that already carries its own Z: elevations present in the file are never overwritten. Default: `'terrarium'`. `null` disables it and keeps the control off the network entirely.

Shorthands: `true` or `'terrarium'` (AWS Terrain Tiles), `'ign'` (IGN Géoplateforme), or a function `(lonlats, ctx) => number[] | Promise<number[]>`. Otherwise an object, whose keys select **one** source:

| Key | Source |
|---|---|
| `source` | `'terrarium'` (default) or `'ign'` |
| `url` | XYZ template, `{z}` `{x}` `{y}` |
| `wms` | `{ url, layers, params, projection }`: WMS tiles, one `GetMap` per tile |
| `olSource` | any `ol/source/TileImage` (XYZ, TileWMS, ...) or `ol/source/GeoTIFF` |
| `featureInfo` | `{ url, layers, queryLayers, property, resolution, params, projection }`: WMS GetFeatureInfo, one request per point |
| `track` | `{ url, coords, parse, fetchOptions }`: a profile your application computed beforehand and serves per track |
| `sample` | `(lonlats, ctx) => number[] | Promise<number[]>`: you fetch them yourself |

Common keys, whatever the source:

| Key | Default | Meaning |
|---|---|---|
| `encoding` | `'terrarium'` | `'terrarium'`, `'mapbox'`, or `(r, g, b, a) => metres`. Ignored by `featureInfo`, `sample` and GeoTIFF, which carry values rather than colours. Return `null` where a pixel holds no measurement. |
| `zoom` | `'auto'` | Tile zoom, or the finest level fitting within `maxTiles` |
| `maxZoom` | `14` | Ceiling for `zoom: 'auto'` |
| `maxTiles` | `32` | Tile budget per track. It is the tiling that widens as the track grows, not the model that degrades |
| `tileSize` | `256` | Tile side, in pixels |
| `concurrency` | `6` | Tiles, or GetFeatureInfo requests, in flight at once |
| `band` | `0` | Band read from a multi-band GeoTIFF |

Source-specific keys:

| Key | Source | Default | Meaning |
|---|---|---|---|
| `apiKey` | `'ign'` | none | Appended as a query parameter. **Not needed** on the public endpoint |
| `apiKeyParam` | `'ign'` | `'apikey'` | Name of that parameter |
| `batch` | `'ign'` | `200` | Points per request. Beyond that the URL takes a 414 |
| `minInterval` | `'ign'` | `1100` | Milliseconds between calls; the service announces 1 req/s |
| `resource` | `'ign'` | `'ign_rge_alti_wld'` | Coverage queried |
| `layers` | `wms`, `featureInfo` | - | Layer name. Required |
| `queryLayers` | `featureInfo` | `layers` | Queried layers, when they differ from the drawn ones |
| `property` | `featureInfo` | first number | Band property name (`GRAY_INDEX` on GeoServer). Required as soon as the layer carries more than one band |
| `resolution` | `featureInfo` | `1` | Half-size, in metres, of the box around the point |
| `params` | `wms`, `featureInfo` | - | Extra WMS parameters, merged over the defaults. Changing `VERSION` to 1.1.1 switches `CRS` to `SRS` on its own |
| `projection` | `wms`, `featureInfo` | `'EPSG:3857'` | Reference system of the requests |
| `url` | `track` | - | Template read off the feature, `{property}` per placeholder, or `(feature) => string`. A missing property sends no request. Required |
| `coords` | `track` | `'coords'` | Property of the JSON answer holding the data. Ignored when the answer is an array itself |
| `parse` | `track` | none | `(json, feature) => data`, to reshape any answer |
| `fetchOptions` | `track` | none | Passed straight to `fetch` (credentials, headers, ...) |

A fill is **all or nothing**: one unresolved point abandons it, and the profile stays as it would have been without. The `demload` event reports the outcome, `{ ok, zoom, tiles }`, with `zoom: null` and `tiles: 0` for a source that is not tiled. See [Terrain model](/guide/features#terrain-model).

`track` is the one source that does not sample a model at the track's own points, and it accepts two shapes of answer, which do not mean the same thing. `[[lon, lat, z], …]` carries **its own geometry** and replaces the feature's, so a profile decimated at ingestion is accepted as it is; time data on the feature is then dropped, since its timestamps no longer line up with anything. A plain `[z, …]` keeps the old meaning: one value per point of the geometry, and the length must match exactly. Either way the feature on the map is never modified.

**`smoothing`**: elevation smoothing. Each point's elevation is replaced by the average of the elevations found within **half the window on either side, along the track**. The value is a distance in **metres of track**, not a number of points: `smoothing: 100` averages over 100 m whether the recording holds a point every second or every ten metres. Default: `0` (raw elevations).

Why bother: a recorded elevation wobbles by a few metres from one point to the next, barometer or satellites alike. Drawn as they come, those wobbles turn a flat road into a hairy line, and each of them counts as a climb followed by a descent, so **D+ inflates**: a flat outing can report hundreds of metres of ascent it never had. Slope suffers the same way, swinging between absurd values over a few metres of track.

What it costs: smoothing lowers D+ and shaves genuine short features. A window wide enough to erase the noise also rounds off a col: 200 m of track through a pass takes a metre or two off its summit. There is no neutral value, only a trade you make knowingly.

It applies to the **samples**, not to the drawing: `getStats()`, D+/D-, min/max and the slope classes all follow it. The geometry on the map is untouched: only the elevations read from it, and the terrain-model fill is smoothed like any other source.

| Value | What it is for |
|---|---|
| `0` | Raw. Every measurement kept, noise included |
| `20`-`50` | Tames ordinary GPS jitter, leaves the relief where it is |
| `100`-`200` | A legible silhouette for a long route, at the price of the small features |
| beyond | You are reshaping the terrain rather than reading it |

```js
new OlElevationProfile({ smoothing: 60 })   // average over ±30 m of track
```

## Appearance

**`theme`**: colour theme. A built-in name (`'steelblue'`, `'lime'`, `'purple'`, `'slate'`, `'graphite'`, `'amber'`) or a colours object `{ area, line, axis, text, focus }`. Default: `'steelblue'`.

**`color`**: overrides the chart colour. `null` keeps the theme; `'auto'` uses the track's own colour (requires `trackLayer`), filling the area and darkening the line; any CSS colour string forces that colour. Default: `null`.

**`trackLayer`**: the vector layer whose style provides the stroke colour when `color: 'auto'`. Default: `null`.

**`transparency`**: background transparency. `false` is opaque; `true` uses `transparencyLevel`; a number `0..1` sets the alpha directly (`0` = fully transparent). Default: `false`.

**`transparencyLevel`**: the alpha applied when `transparency === true` (`0..1`). Default: `0.45`.

**`grid`**: horizontal grid lines drawn with the axis colour at low opacity. Default: `true`.

**`xTicks`**: number of X-axis ticks; `null` lets the library choose from the width. Default: `null`.

**`yTicks`**: number of Y-axis ticks; `null` lets the library choose from the height. Default: `null`.

**`verticalScale`**: `'auto'` makes the profile fill the height, which is legible, but the scale changes from one track to the next, so a 2 % ramp looks like a wall and two profiles cannot be compared. A **number** fixes the metres covered per physical centimetre, measured on the screen rather than deduced from the nominal 96 dpi, so it follows browser zoom. **`{ exaggeration: n }`** fixes the ratio between the vertical and horizontal scales instead, the control deriving the metres per centimetre per track. Default: `'auto'`.

A number makes **ranges** comparable, not slopes. The horizontal axis always stretches over the whole track, so the same 5 % ramp is drawn three times steeper on a 3 km loop than on a 30 km traverse. `{ exaggeration }` fixes the ratio between the two axes instead, and it is **slopes** that become comparable: the gradient read off the chart is the real one, multiplied by the same factor on every track. The control recomputes the metres per centimetre for each track, and again for each A/B crop, from the distance actually displayed and the chart width once the margins are off — which is why it cannot be done from outside.

Either form is a **floor, not a cage**: a track whose range exceeds what the height can show would spill out of the frame, which is worse than losing comparability. The scale then widens to contain it, silently: nothing is drawn on the chart to announce the scale, which is a property of the display rather than of the track. The value actually applied is read back from `_vScale`, `null` under `'auto'` which requests no absolute scale. The ratio actually obtained is read back from `_vExaggeration`, in **every** mode: below the one asked for whenever the floor has played, and drifting from one track to the next under `'auto'` — which is exactly why `'auto'` makes no two profiles comparable.

```js
new OlElevationProfile({ verticalScale: 50 })                  // 50 m per centimetre
new OlElevationProfile({ verticalScale: { exaggeration: 6 } }) // vertical stretched 6x
```

Set at construction, an exaggeration needs nothing further: see [Comparable slopes](/examples#comparable-slopes-a-held-ratio-a-scale-recomputed-per-track) for what it produces track by track, and for choosing the factor.

## Slope

**`slope`**: when `true`, the profile is split into contiguous portions coloured by slope class. Default: `false`.

**`slopeClassSize`**: width of one slope class, in **percent**. Default: `2.5`.

**`maxClasses`**: maximum number of slope classes (colours + legend). Steeper slopes fold into the last class, shown as `≥ X %`. Default: `8`.

**`slopeColors`**: `null` uses the built-in blue-to-red ramp (cyan/green, pure yellow in the middle). Otherwise an array of CSS colours, interpolated across the classes present. Default: `null`.

**`slopeSeparators`**: draw a vertical separator at each slope-class change. Default: `true`.

**`slopeLegend`**: show the colour legend under the title. Default: `true`.

## Behaviour

**`show`**: how a track on the map triggers its profile: `'click'` or `'mouseover'`. Default: `'click'`.

**`hideOnMapClick`**: a click on the empty map hides the whole control. Default: `true`.

**`showWithoutElevation`**: what to do with a track that ends up with no elevation at all — none in its geometry, and none the terrain model could supply either, because `dem` is `null` or because the fill failed. `true` shows the panel with the track's title, whatever the geometry alone can still say (its length), and the `noElevation` message where the chart would be. `false` hides the panel outright. Default: `true`.

Either way **no chart is drawn**. Points with no Z count as zero, so the line would sit flat at sea level under a `D+ 0 m` — not a missing figure but a wrong one, and the same reason a terrain-model fill is all or nothing.

```js
new OlElevationProfile({ dem: null, showWithoutElevation: false })  // silent instead
```

**`followMap`**: moving the pointer over the map moves the indicator on the chart. Default: `true`.

**`marker`**: show the position marker (dot) on the map as you move along the chart. Default: `true`.

**`collapsable`**: show the collapse/expand button; collapsed, the control shrinks to title + button. Default: `true`.

**`collapsed`**: initial collapsed state. Default: `false`.

**`exportPng`**: adds a toolbar button, to the right of the zoom buttons, saving the whole panel as a PNG: title, stats, legend and chart. Default: `false`. See [PNG export](/guide/features#png-export) and the `exportPNG()` method.

**`zoom`**: show the A/B crop buttons, which crop both map and profile to a sub-range (A reset to 0). Default: `false`.

Placing one bound **arms the other**: click A, click the chart, click the chart again, the second bound needs no trip back to the toolbar. Either button can start the pair, and the order in which A and B are placed does not matter.

**`zoomLevels`**: how many crops may be **nested**: a crop can itself be cropped, down to this depth. Set `1` for a single level, the behaviour before this option existed. Default: `3`.

A **back** button appears from the second level and undoes one crop; **show all** empties the stack whatever the depth. Zooming the map out beyond a level's own extent leaves that level only, instead of dropping the whole stack. Bounds are held in the abscissa of the *whole* track, never in the frame of the level they were picked in, so nesting adds no drift.

**`ignoreStops`**: when computing time, exclude stopped segments so the duration is **moving time**. `false` gives raw wall-clock time. Default: `true`.

**`stopSpeed`**: speed threshold in **m/s** (≈ 1.8 km/h) below which a segment counts as a stop. Default: `0.5`.

## Content (header, tooltip, title)

**`tooltipItems`**: what the hover tooltip shows, any of `'distance'`, `'elevation'`, `'slope'`, `'time'` (elapsed time at the cursor, if the track has time data). Default: `['distance','elevation']`.

**`headerItems`**: what the header line shows. String tokens: `'distance'`, `'ascent'`, `'descent'`, `'min'`, `'max'`, `'minmax'`, `'duration'` (total elapsed time). An entry can also be an object pulling a feature property: `{ property, label?, asLink?, linkText? }` (`asLink` renders a URL value as a link). Default: `['distance','ascent','descent','minmax']`.

**`titleProperty`**: the feature property used as the title, or a **list** of them tried in order — the first one holding a value wins, an empty one being stepped over. A feature answering to none of them falls back on the `untitled` label, which is localised. Default: `'name'`.

**`titleLink`**: a feature property holding a URL — the title then becomes a clickable link — or a **list** of them tried in order. Only a value that really is a URL counts: a property holding anything else is stepped over rather than rendered as a dead link. Default: `null`, which never links the title, a dataset not being asked to explain that its `url` column is not the one meant for the reader.

```js
new OlElevationProfile({ titleProperty: ['parcours', 'name'], titleLink: 'fiche' })
new OlElevationProfile({ titleLink: ['link', 'url'] })     // whichever the dataset uses
```

**`lang`**: language of the shipped labels: `'en'` (default), `'fr'`, `'es'`. An unknown code falls back to English rather than leaving keys empty. Each set is complete: a partial translation would put two languages in the same panel.

::: warning Coming from 1.x
The labels used to be French, with no way to ask for another language. English is now the default, add `lang: 'fr'` to keep the panel exactly as it was.
:::

```js
new OlElevationProfile({ lang: 'es' })
profile.setOptions({ lang: 'fr' })     // switches every label, buttons included
```

**`labels`**: per-key overrides applied on top of `lang`, for a wording you would rather choose yourself or a language that is not shipped. Only the keys you pass change. They **survive a language change**: a corrected key stays corrected, the rest follows the new set. Default: `{}`.

Keys, with their English values: `distance` `'Distance'`, `elevation` `'Elevation'`, `slope` `'Slope'`, `ascent` `'D+'`, `descent` `'D-'` (map notation, the same in every language), `empty` `'Click a track'` (placeholder title), `untitled` `'Profile'` (title of a feature with no name property), `noElevation` `'No elevation data'` (shown in place of the chart, see `showWithoutElevation`), `time` `'Time'`, `duration` `'Duration'`, `durationUnits` `{ s:'sec', m:'min', h:'h', d:'d' }` (time unit abbreviations), `zoomStart` `'Set start (A)'`, `zoomEnd` `'Set end (B)'`, `zoomAll` `'Show all'`, `zoomBack` `'Back one level'` (back one nested crop), `exportPng` `'Export as PNG'` (export button), `collapse` `'Collapse the profile'` and `expand` `'Expand the profile'` (the collapse button, whichever the click will do), `loading` `'Loading the elevation profile'` (accessible name of the terrain-model spinner).

```js
// Italian, say: a language that is not shipped
new OlElevationProfile({
  labels: {
    elevation: 'Altitudine', slope: 'Pendenza', empty: 'Clicca un percorso',
    duration: 'Durata', durationUnits: { s: 'sec', m: 'min', h: 'h', d: 'g' },
    zoomStart: 'Imposta inizio (A)', zoomEnd: 'Imposta fine (B)', zoomAll: 'Mostra tutto',
    zoomBack: 'Torna al livello precedente',
    exportPng: 'Esporta in PNG',
    collapse: 'Riduci il profilo', expand: 'Espandi il profilo',
    loading: 'Caricamento del profilo altimetrico'
  }
})

// Or one word on top of a shipped language
new OlElevationProfile({ lang: 'fr', labels: { empty: 'Choisissez un itinéraire' } })
```

## Full constructor (every option)

```js
const profile = new OlElevationProfile({
  // Layout & size
  immersion: 'docked',              // 'docked' | 'floating'
  position: 'bottom',               // top | bottom | left | right | top-left | top-right | bottom-left | bottom-right
  width: 520,                       // px (capped to map width) | 'auto' | '100%' | 'full'
  height: 180,                      // px
  margins: { unit: 'px', top: 20, right: 24, bottom: 30, left: 48 },
  responsive: true,                 // adapt width/placement (mobile included)
  mobileBreakpoint: 640,            // px; below -> mobile mode

  // Units & data
  units: 'meters',                  // 'meters' | 'imperial'
  dataProjection: null,             // null = view projection | 'EPSG:4326' | Projection
  maxPoints: 2000,                  // render/interaction decimation (0 = none)
  dem: 'terrarium',                 // terrain model filling a track with no Z; null = off
                                    //   'terrarium' | 'ign' | (lonlats) => number[]
                                    //   | { url: '.../{z}/{x}/{y}.png', encoding: 'terrarium' }
                                    //   | { wms: { url, layers } }
                                    //   | { olSource }        // TileImage or GeoTIFF
                                    //   | { featureInfo: { url, layers, property } }
                                    //   | { track: { url: '/profils/{id}.json' } }
  smoothing: 0,                     // elevation smoothing window, in metres

  // Appearance
  theme: 'steelblue',               // steelblue | lime | purple | slate | graphite | amber | {area,line,axis,text,focus}
  color: null,                      // null (theme) | 'auto' (track colour) | CSS colour
  trackLayer: null,                 // ol/layer/Vector, for color:'auto'
  transparency: false,              // false | true | 0..1 (alpha)
  transparencyLevel: 0.45,          // alpha when transparency === true
  grid: true,
  xTicks: null,                     // null = auto | number
  yTicks: null,                     // null = auto | number
  verticalScale: 'auto',            // 'auto' = fills the height | number = metres per centimetre
                                    //   | { exaggeration: 6 } = fixed vertical/horizontal ratio

  // Slope
  slope: false,
  slopeClassSize: 2.5,              // % per class
  maxClasses: 8,                    // max classes (colours + legend)
  slopeColors: null,                // null = blue->red ramp | string[]
  slopeSeparators: true,
  slopeLegend: true,

  // Behaviour
  show: 'click',                    // 'click' | 'mouseover'
  hideOnMapClick: true,
  showWithoutElevation: true,        // no Z by any route: panel + message, or hidden
  followMap: true,
  marker: true,
  collapsable: true,
  collapsed: false,
  exportPng: false,                 // toolbar button saving the panel as a PNG
  zoom: false,                      // A/B crop buttons
  zoomLevels: 3,                    // nested crops allowed (1 = single level)
  ignoreStops: true,                // moving time (ignore stops)
  stopSpeed: 0.5,                   // m/s stop threshold

  // Content
  tooltipItems: ['distance', 'elevation'],                  // + 'slope', 'time'
  headerItems: ['distance', 'ascent', 'descent', 'minmax'], // + 'min','max','duration' or {property,...}
  titleProperty: 'name',            // or a list, tried in order
  titleLink: null,                  // a name, or a list: the first real URL wins
  lang: 'en',                       // 'en' | 'fr' | 'es'
  labels: {}                        // per-key overrides, applied on top of lang
})
map.addControl(profile)
```

## Methods

**`setFeature(feature)`**: show the profile for an OpenLayers feature, ideally 3D: `LineString`, `MultiLineString`, or a `Polygon` / `MultiPolygon`, profiled along its **outer ring** (holes are ignored; the profile returns to its starting point, so D+ equals D-, see [Geometry types](/guide/features#geometry-types)). A falsy value hides the control. Returns `this`.

```js
const f = new ol.format.GeoJSON().readFeatures(geojson, {
  featureProjection: map.getView().getProjection()
})[0]
profile.setFeature(f)
```

**`clear()`**: hide the profile and forget the current feature. Returns `this`.

```js
profile.clear()
```

**`setTheme(name | object)`**: change the colour theme and re-render.

```js
profile.setTheme('amber')
profile.setTheme({ area: '#1f6fb2', line: '#0d3c61', axis: '#345', text: '#123', focus: '#e0532a' })
```

**`setColor(color | null)`**: change the chart colour: a CSS colour, `'auto'` (track colour), or `null` to fall back to the theme.

```js
profile.setColor('#e0532a')
profile.setColor('auto')   // needs trackLayer
profile.setColor(null)     // back to theme
```

**`setOptions(patch)`**: update one or more options at runtime and re-render. Returns `this`.

```js
profile.setOptions({ slope: true, smoothing: 60, tooltipItems: ['distance', 'elevation', 'slope', 'time'] })
```

**`toggleCollapsed(force?)`**: collapse or expand. Pass `true`/`false` to force a state.

```js
profile.toggleCollapsed()      // toggle
profile.toggleCollapsed(true)  // force collapsed
```

**`exportPNG(opts)`**: export the panel as a PNG and resolve with the `Blob`. `opts.scale` defaults to the device pixel ratio, `opts.filename` to the track title, and `opts.download: false` returns the Blob without saving the file. Works whether or not `exportPng` shows the button. Rejects when there is no profile drawn.

**`getStats()`**: return the current statistics: `{ distance, duration, ascent, descent, min, max, maxAbsSlope, points }`. `duration` is `null` when the track has no time data.

```js
const { distance, ascent, duration } = profile.getStats()
console.log(distance, ascent, duration)
```

### Static members

**`OlElevationProfile.addTheme(name, colors)`**: register a custom theme usable by `theme`/`setTheme`.

```js
OlElevationProfile.addTheme('ocean', { area: '#0aa', line: '#066', axis: '#055', text: '#022', focus: '#f60' })
new OlElevationProfile({ theme: 'ocean' })
```

**`OlElevationProfile.featureHasZ(feature)`**: `true` if the feature has any Z (elevation) coordinate.

```js
if (!OlElevationProfile.featureHasZ(f)) console.warn('No altimetry on this track')
```

**`OlElevationProfile.featureHasTime(feature)`**: `true` if the feature carries per-point time data.

```js
if (OlElevationProfile.featureHasTime(f)) profile.setOptions({ headerItems: ['distance', 'duration'] })
```

**`OlElevationProfile.version`**: the library version string.

```js
console.log(OlElevationProfile.version)
```
