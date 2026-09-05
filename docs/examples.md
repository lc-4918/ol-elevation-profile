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
  titleProperty: 'name',
  titleLink: null,                  // feature property holding a URL
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

## Language

English by default; French and Spanish ship with the library, and `labels` covers anything else.

```js
new OlElevationProfile({ lang: 'es' })
profile.setOptions({ lang: 'fr' })                    // switches everything, buttons included

// A key you would rather word yourself: it survives a later language change.
new OlElevationProfile({ lang: 'fr', labels: { empty: 'Choisissez un itinéraire' } })
```

## Detect tracks without elevation

```js
if (!OlElevationProfile.featureHasZ(feature)) {
  // warn the user this track has no altimetry
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

// 10. Anything else: you fetch the elevations, the control keeps the policy
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

