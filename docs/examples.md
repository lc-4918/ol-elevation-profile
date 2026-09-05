# Examples

The live demo lets you toggle every option: [open the demo](https://lc-4918.github.io/ol-elevation-profile/demo/).

## Full constructor (every option)

Every option shown with its default value:

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
  smoothing: 0,                     // elevation smoothing window, in meters
  dem: 'terrarium',                 // terrain model filling a track with no Z; null = off
                                    //   'terrarium' | 'ign' | (lonlats) => number[]
                                    //   | { url: '.../{z}/{x}/{y}.png', encoding: 'terrarium' }
                                    //   | { wms: { url, layers } }
                                    //   | { olSource }        // TileImage or GeoTIFF
                                    //   | { featureInfo: { url, layers, property } }
                                    //   | { track: { url: '/profils/{id}.json' } }

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
  showWithoutElevation: true,       // no Z by any route: panel + message
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


## Full map width

```js
new OlElevationProfile({ width: 'auto' }) // follows the map width
```

## Slope colouring with a tooltip that shows gradient

```js
new OlElevationProfile({
  slope: true,
  tooltipItems: ['distance', 'elevation', 'slope']
})
```

## Match the chart to the track colour

```js
new OlElevationProfile({ color: 'auto', trackLayer: vectorLayer })
```

## A/B crop

```js
const p = new OlElevationProfile({ zoom: true })
// Click A, then a point on the chart: B arms itself, so the next click on the chart
// places it. The map and the profile crop to A..B (A reset to 0).
// "Show all" or zoom out to exit.
```

### Nested crops

A crop can itself be cropped, which is how you reach a col inside a stage inside a long
route. `zoomLevels` sets how deep, `1` restoring the former single level.

```js
const p = new OlElevationProfile({ zoom: true, zoomLevels: 3 })
// A/B again inside a crop: it nests instead of replacing.
// "Back" (from the second level) undoes one crop; "Show all" empties the stack.
// Zooming the map out leaves the innermost level only, not the whole stack.
```

## Comparable vertical scale

`'auto'` fills the height, so the same 2 % ramp looks flat on one track and steep on the
next. A number fixes the metres per physical centimetre, and two profiles become
comparable.

```js
const p = new OlElevationProfile({ verticalScale: 50 })   // 50 m per centimetre
// The value is a floor: a track too steep to fit widens the scale rather than
// spilling out of the frame. Nothing on the chart announces the scale.
p.setOptions({ verticalScale: 'auto' })                   // back to filling the height
```

## Comparable slopes: a held ratio, a scale recomputed per track

A fixed number makes **ranges** comparable, not slopes: the horizontal axis stretches over
the whole track, so the same 5 % ramp is drawn three times steeper on a 3 km loop than on a
30 km traverse. An exaggeration **holds** the ratio between the axes instead, and it is the metres per
centimetre that the control recomputes for every track it is given. The number is the
invariant, which is why it is a number and not `'auto'`: there would be nothing left to
hold. `verticalScale: 'auto'` already is the case where the ratio drifts freely.

| `verticalScale` | held | varies | comparable across tracks |
|---|---|---|---|
| `'auto'` | the height, filled | scale **and** ratio | nothing |
| `50` | 50 m/cm | the ratio | **ranges** |
| `{ exaggeration: 6 }` | the ratio, x6 | the scale | **slopes** |

The ratio each mode actually produces, on the same four tracks:

| `verticalScale` | 2.5 km | 10.3 km | 23.4 km | 123 km |
|---|---|---|---|---|
| `'auto'` | x3.18 | x10.73 | x7.66 | x12.84 |
| `50` | x1.73 | x7.14 | x8.80 | x15.61 |
| `{ exaggeration: 6 }` | x3.58 | x6.00 | x6.00 | x6.00 |

Under the first two, a 5 % ramp is drawn four to nine times flatter on one track than on
another, and the eye has no way of knowing. Only the third line holds — where the floor
lets it.


**Set it once, at construction. There is nothing to recompute per track:**

```js
const profile = new OlElevationProfile({ verticalScale: { exaggeration: 6 } })
map.addControl(profile)

profile.setFeature(shortLoop)      // 2.5 km  -> the scale narrows
profile.setFeature(longTraverse)   // 123 km  -> the scale widens, the ratio holds
```

An application that computes a number itself has to redo it on every selection, and it
still gets it wrong on a crop:

```js
// Don't: this is what { exaggeration } already does, minus the cases it gets right
profile.setOptions({ verticalScale: metresPerCm(track.km) })   // on every click
```

What the same `{ exaggeration: 6 }` produces on a 1160x300 panel, without a single call
from the application:

| track | metres per centimetre | obtained |
|---|---|---|
| 2.5 km, 150 m of range | 24.2 | x3.58 |
| 10.3 km | 59.5 | x6.00 |
| 23.4 km | 135.2 | x6.00 |
| 123.2 km, 1800 m of range | 711.7 | x6.00 |

The scale spans a factor of thirty; the ratio holds. Two things the application could not
have done from outside: the chart width is only known once the margins and the panel's own
layout are resolved, and an A/B crop changes the displayed distance without changing the
track.

The first row is the **floor** at work: 150 m of range in 6.6 cm of height needs at least
24.2 m/cm, where x6 would ask for 14.5. Rather than spill out of the frame, the scale
widens and the ratio drops. Nothing on the chart says so, the scale being a property of the
display rather than of the track — read it back instead:

```js
profile._vScale           // metres per centimetre actually applied; null under 'auto',
                          //   which requests no absolute scale
profile._vExaggeration    // ratio actually obtained, in every mode: below 6 whenever the
                          //   floor has played, and drifting per track under 'auto'
```

Pick the factor from the terrain rather than from taste: 4 to 6 suits rolling country, 8 to
10 makes a gentle greenway legible, 2 to 3 keeps high mountains from looking like a saw.

## Language

English by default; French and Spanish ship with the library, and `labels` covers anything else.

```js
new OlElevationProfile({ lang: 'es' })
profile.setOptions({ lang: 'fr' })                    // switches everything, buttons included

// A key you would rather word yourself: it survives a later language change.
new OlElevationProfile({ lang: 'fr', labels: { empty: 'Choisissez un itinéraire' } })
```

## Tracks without elevation

The control handles the case itself: a track that ends up with no Z by any route shows the
panel with its title and a message where the chart would be, rather than a flat line at zero.

```js
new OlElevationProfile({ showWithoutElevation: true })              // the default
new OlElevationProfile({ showWithoutElevation: false })             // hide the panel instead
new OlElevationProfile({ labels: { noElevation: 'Survey pending' } })
```

`featureHasZ` is still there to decide something else — a badge in a list, a filter:

```js
if (!OlElevationProfile.featureHasZ(feature)) {
  // this track carries no altimetry of its own
}
```

## Terrain model: every source

`dem` fills a track that carries no Z. It is on by default (`'terrarium'`), inert on a track that already has its own elevations, and `null` turns it off entirely.

```js
// 1. Default: AWS Terrain Tiles, worldwide, no key, no quota
new OlElevationProfile();

// 2. Off: the control never touches the network
new OlElevationProfile({ dem: null });

// 3. IGN Géoplateforme, France and overseas, metre-accurate, no key either.
//    A point API: 200 points per request, one request per second.
new OlElevationProfile({ dem: 'ign' });
new OlElevationProfile({ dem: { source: 'ign', apiKey: 'only-if-your-endpoint-demands-one' } });

// 4. Any XYZ tile set, terrarium or mapbox encoding
new OlElevationProfile({
  dem: { url: 'https://tiles.example.org/dem/{z}/{x}/{y}.png',
         encoding: 'mapbox', maxZoom: 13, maxTiles: 48 }
});

// 5. Your own encoding: return null where a pixel holds no measurement
new OlElevationProfile({
  dem: { url: 'https://tiles.example.org/dem/{z}/{x}/{y}.png',
         encoding: (r, g, b, a) => (a === 0 ? null : r * 256 + g - 32768) }
});

// 6. WMS tiles, one GetMap per tile of the same grid
new OlElevationProfile({
  dem: { wms: { url: 'https://gs.example.org/geoserver/wms', layers: 'ws:dem',
                params: { VERSION: '1.1.1' } } }        // CRS becomes SRS on its own
});

// 7. A source the map already holds: OpenLayers builds the URLs
new OlElevationProfile({ dem: { olSource: demLayer.getSource() } });

// 8. A GeoTIFF: COG over HTTP, or a WCS GetCoverage. Values, not colours.
import GeoTIFF from 'ol/source/GeoTIFF.js';
new OlElevationProfile({
  dem: { olSource: new GeoTIFF({ sources: [{ url: 'https://example.org/dem.tif' }],
                                 normalize: false }), band: 0 }
});

// 9. A greyscale coverage reachable only as an image: one request per point, no interpolation
new OlElevationProfile({
  dem: { featureInfo: { url: 'https://gs.example.org/geoserver/wms', layers: 'ws:dem',
                        property: 'GRAY_INDEX' }, concurrency: 8 }
});

// 10. A profile your application computed beforehand, served per track. The only
//     source that answers with the WHOLE track: `[[lon,lat,z],…]` replaces the
//     geometry, so a profile decimated at ingestion is accepted as it is.
new OlElevationProfile({
  dem: { track: { url: '/profils/{id}.json' } }          // {id} read off the feature
});
new OlElevationProfile({
  dem: { track: { url: (f) => `/api/tracks/${f.getId()}/profile`,
                  parse: (json) => json.elevation.points } }
});

// 11. Anything else: you fetch the elevations, the control keeps the policy
new OlElevationProfile({
  dem: async (lonlats) => {
    const r = await fetch('/api/elevations', { method: 'POST', body: JSON.stringify(lonlats) });
    return (await r.json()).elevations;     // one per point, same order
  }
});
```

Whatever the source, a fill is all or nothing, and `demload` reports the outcome:

```js
profile.on('demload', (e) => {
  if (!e.ok) console.warn('no elevation for this track');
  else console.log(`filled from ${e.tiles} tiles at zoom ${e.zoom}`);   // zoom null, tiles 0 if not tiled
});
```

See [GeoServer, in practice](/guide/features#geoserver-in-practice) for which of routes 6, 8 and 9 to pick, and the CORS setting they all need.

## Export the profile as a PNG

```js
const profile = new OlElevationProfile({ exportPng: true });   // adds the toolbar button

await profile.exportPNG();                                     // saves the file
await profile.exportPNG({ scale: 3, filename: 'stage-7.png' });
const blob = await profile.exportPNG({ download: false });      // Blob only, nothing saved
```

The image covers the whole panel: title, stats, legend and chart. The position indicator is left out.

