# Slope, terrain, export & attributions

## Slope classes

With `slope: true`, the profile is split into contiguous portions of the same slope class (width `slopeClassSize`, in %), capped at `maxClasses` (default 8). Colours run from **blue** (flattest class) to **red** (steepest), via cyan/green and a pure yellow, spread across the classes that are actually present, not stretched on the real maximum slope. A vertical separator marks each class change, and a legend appears under the title.

```js
new OlElevationProfile({ slope: true, slopeClassSize: 2.5, maxClasses: 8 })
```

## Smoothing

A recorded elevation wobbles by a few metres from one point to the next, barometer or satellites alike. Drawn as they come, those wobbles turn a flat road into a hairy line, and each of them counts as a climb followed by a descent, so **D+ inflates**: a flat outing can report hundreds of metres of ascent it never had.

`smoothing` replaces each point's elevation by the average of the elevations found within **half the window on either side, along the track**. Being a distance in metres of track rather than a number of points, the same value behaves the same on a one-point-per-second recording and on a ten-metre export. It applies to the samples, so `getStats()`, D+/D-, min/max and the slope classes all follow; the geometry on the map is untouched.

The price is symmetrical: a window wide enough to erase the noise also rounds off a col. Expect `20`-`50` to tame ordinary jitter, `100`-`200` for a legible long-route silhouette, and beyond that you are reshaping the terrain rather than reading it. See [`smoothing`](/guide/options#units-data) for the full trade-off.

```js
profile.setOptions({ smoothing: 60 }) // average over ±30 m
```

## Geometry types

`LineString` and `MultiLineString` are profiled as they come. A `Polygon` or `MultiPolygon` is profiled along its **outer ring**; holes are not part of the outline itself, so they are ignored. The ring being closed, the profile returns to its starting point, so D+ and D- come out **equal by construction**. On a loop, that is exactly what one climbs going round it. Distance is the perimeter, and everything else behaves as on a line: min/max, slope colouring, A/B crop, terrain-model fill.

Polygons are selectable on the map like lines. Hovering snaps the marker to the **outline**, not to the surface: a polygon's own `getClosestPoint` answers for its interior, where the cursor is its own closest point.

## Cursor

The cursor moves **continuously**, on the chart as on the map: between two samples, position, elevation and time are interpolated on the segment, and a map coordinate is projected onto it. Samples are the points that were measured, not the only places the cursor is allowed to stand: settling for the nearest one would walk the marker from vertex to vertex, a visible jump on a sparse track or one thinned by `maxPoints`. Slope is the exception: it is a property of the segment, constant along it, so it is not interpolated.

## Terrain model

A track drawn by hand, traced over a basemap, or exported by a tool that drops the third dimension has **no Z**, and therefore no profile. The missing elevations are read from a terrain model instead, and this is **on by default**:

```js
new OlElevationProfile()                       // AWS Terrain Tiles, no API key
new OlElevationProfile({ dem: null })          // off: the control never touches the network
```

Nothing happens for a track that already carries its own Z: the option is inert there, and elevations present in the file are never overwritten. But a track without Z makes the control fetch tiles on its own, without the application having asked: set `dem: null` if that is not wanted.

### Why tiles rather than an elevation API

The free keyless elevation APIs are billed per point: 100 coordinates per request for Open-Meteo, 200 for the IGN Géoplateforme, which caps its own rate at one request per second. A 10 000-point track is 100 requests, or 50 requests spread over 50 seconds.

Terrain tiles are PNG images carrying elevation in their R/G/B channels. The same track needs **a handful of tiles**, cached by the browser, with no key, no quota and no rate limit. Reading them is a `drawImage` and a `getImageData` away: we are already in a map, fetching tiles is what it does.

### Accuracy, and what the option does not do

The default source resolves to roughly 30-90 m depending on the region. Measured against the IGN RGE ALTI (1 m) on twelve points of steep alpine terrain, the mean deviation is **16 m**, the worst 33 m. That is the right order for a profile shape and a D+; it is not a survey.

Elevation is **interpolated bilinearly** between the four surrounding pixels, not read from the containing pixel. Stepping from pixel to pixel would make the profile advance in stairs, and every stair counts as a climb then a descent in the D+. The interpolation invents no relief: it renders the same surface without the sampling steps.

**A track is filled entirely or not at all.** If a single point cannot be sampled (a tile that fails to load, a gap in the model), the fill is abandoned and the profile stays what it would have been without it. A profile missing a few points is not an incomplete profile: those points count as zero, the line dives to sea level and the D+ becomes absurd.

While the tiles load, the chart area shows a **spinner** rather than the flat profile it would otherwise draw, and the header figures are held back: a D+ of 0 m jumping to 1 200 reads worse than no figure at all. The spinner takes `--oep-area`, so it wears the theme colour, or the track colour under `color: 'auto'`.

Nothing is reported to the user on failure; the fill is a supplement, not a prerequisite. Listen to `demload` if the application wants to know:

```js
profile.on('demload', (e) => console.log(e.ok, e.zoom, e.tiles));
```

### Sources

Where the elevations come from. All of them go through the same policy afterwards: sequencing, all or nothing, spinner, `demload`.

| `dem` | Source |
|---|---|
| `'terrarium'` (default), `true` | AWS Terrain Tiles, keyless |
| `'ign'` | IGN Geoplateforme RGE ALTI, France, metre-accurate, keyless |
| `{ url: '.../{z}/{x}/{y}.png' }` | any **XYZ** tile set |
| `{ wms: { url, layers, params } }` | **WMS** tiles, one `GetMap` per tile |
| `{ olSource }` | any **`ol/source/TileImage`** (XYZ, TileWMS, ...) or **`ol/source/GeoTIFF`** |
| `{ featureInfo: { url, layers, property } }` | **WMS GetFeatureInfo**, one request per point |
| a function, or `{ sample }` | you fetch them yourself |

```js
// WMS tiles whose layer already serves terrain-RGB (see the GeoServer section below)
new OlElevationProfile({ dem: { wms: { url: 'https://gs.example.org/wms', layers: 'dem' } } })

// Reuse a source the map already holds: OpenLayers builds the URLs, quirks included
new OlElevationProfile({ dem: { olSource: demLayer.getSource() } })
```

`{ olSource }` is usually the best of the tile options: subdomains, custom params and tile grid are OpenLayers' problem, not a second implementation here. WMS requests default to version 1.3.0; override it through `params` and the reference-system parameter switches from `CRS` to `SRS` on its own, which is the difference between a working request and a rejected one.

### GeoTIFF

An `ol/source/GeoTIFF` is passed through `olSource` like any other. It is a **DataTile** source rather than a tiled image: it carries real values in its own projection and its own tile grid, so nothing goes through a colour decoder and `encoding` is ignored.

```js
import GeoTIFF from 'ol/source/GeoTIFF.js';

new OlElevationProfile({
  dem: {
    olSource: new GeoTIFF({ sources: [{ url: 'https://example.org/dem.tif' }], normalize: false }),
    band: 0
  }
})
```

**`normalize: false` is not optional.** Left at its default, OpenLayers rescales the values to 0..1 and the profile comes out in fractions of nothing. `band` selects the band on a multi-band coverage; the first one is used otherwise.

No dependency is added by this: OpenLayers already carries the GeoTIFF decoder, and this library only ever talks to the source. A Cloud-Optimized GeoTIFF over HTTP and a WCS `GetCoverage` are both read the same way, the latter by pointing the source at the request URL.

The grid of a GeoTIFF is only known once its metadata has been read, so the fill waits for the source to be ready before sampling. Elevations are **interpolated bilinearly** in the coverage's own grid, exactly as on tiles. At the borders, a point falling within half a pixel of the edge holds the edge value rather than extrapolating past the data, and does not fail the fill.

### GeoServer, in practice

Three routes, and they are not equivalent.

| Route | Values | Interpolated | Requests for a 5 000-point track |
|---|---|---|---|
| **WCS via `ol/source/GeoTIFF`** | exact | yes | a handful of range requests |
| **Pre-encoded terrain-RGB tiles** | quantised by the encoding | yes | a handful of tiles |
| **WMS `GetFeatureInfo`** | exact | **no** | 5 000 |

**Enable CORS first, whichever route.** The browser blocks every cross-origin request otherwise, and the failure looks exactly like a missing layer. In `WEB-INF/web.xml`, uncomment the `cross-origin` filter and its mapping; recent GeoServer versions expose the same thing through environment variables.

#### WCS, the one to prefer

Publish the DEM as a coverage store, enable WCS in *Services*, and point an `ol/source/GeoTIFF` at a `GetCoverage` request:

```js
import GeoTIFF from 'ol/source/GeoTIFF.js';

const wcs = 'https://gs.example.org/geoserver/wcs' +
  '?service=WCS&version=2.0.1&request=GetCoverage' +
  '&coverageId=ws__dem' +          // GeoServer writes the colon as a double underscore
  '&format=image/geotiff';

new OlElevationProfile({
  dem: { olSource: new GeoTIFF({ sources: [{ url: wcs }], normalize: false }), band: 0 }
})
```

`normalize: false` is not optional: left at its default, OpenLayers rescales the values to 0..1.

**A `GetCoverage` without subsetting returns the whole coverage.** That is fine for a valley or a département, heavy for a national DEM. For a large one, publish it as a **Cloud-Optimized GeoTIFF** and point the source straight at the `.tif`: `ol/source/GeoTIFF` then issues HTTP range requests and reads only the tiles it needs, at the resolution it needs.

#### GetFeatureInfo, when the coverage is only served as an image

No styling requirement, no WCS, but one request per point and no interpolation:

```js
new OlElevationProfile({
  dem: {
    featureInfo: {
      url: 'https://gs.example.org/geoserver/ws/wms',
      layers: 'ws:dem',
      property: 'GRAY_INDEX'      // GeoServer's name for a single-band coverage
    },
    concurrency: 8
  }
})
```

Beware of the volume: the fill samples **every coordinate of the geometry**, not the decimated `maxPoints` set. A 10 000-point GPX means 10 000 round trips. Simplify the geometry upstream if that is the route you are taking.

#### Terrain-RGB tiles

GeoServer will not produce `terrarium` or `mapbox` encoding from an SLD: those pack the elevation across the three channels, which a `ColorMap` cannot express. Encode the tiles beforehand, with [rio-rgbify](https://github.com/mapbox/rio-rgbify) or an equivalent, then serve them as XYZ, through GeoWebCache or anything else:

```js
new OlElevationProfile({
  dem: { url: 'https://gs.example.org/gwc/service/tms/1.0.0/ws:dem@EPSG:3857@png/{z}/{x}/{y}.png',
         encoding: 'terrarium', maxZoom: 14 }
})
```

If your own encoding differs, `encoding` takes a function instead:

```js
dem: { url: '...', encoding: (r, g, b, a) => (a === 0 ? null : (r * 65536 + g * 256 + b) / 100 - 10000) }
```

### Greyscale coverages: GetFeatureInfo

A DEM served as a rendered greyscale cannot be read from its pixels: what a WMS returns has been stretched and quantised by its style, so decoding it would be decoding the rendering, not the coverage. `featureInfo` asks the server for the band value instead.

```js
new OlElevationProfile({
  dem: { featureInfo: { url: 'https://gs.example.org/wms', layers: 'mnt',
                        property: 'GRAY_INDEX', resolution: 1 }, concurrency: 6 }
})
```

**It is slow, unavoidably.** One request per point: a thousand-point track is a thousand round trips where a tile source needs a handful. Worth it only when nothing else reaches the data, and `concurrency` is what keeps it bearable. Without `property` the first finite number in the response wins, which is right for a single-band coverage and wrong as soon as the layer carries more.

### Decoding

`encoding` says how a pixel becomes metres: `'terrarium'` (default), `'mapbox'`, or a function.

```js
new OlElevationProfile({
  dem: { url: 'https://tiles.example.org/{z}/{x}/{y}.png',
         encoding: (r, g, b, a) => (a === 0 ? null : r * 256 + g - 32768) }
})
```

Return `null` where the pixel carries no measurement. It is refused, not read as zero metres, and the fill is abandoned rather than guessed.

### Other sources: IGN, GeoServer, GeoTIFF

Any XYZ tile set in `terrarium` or `mapbox` encoding works as a drop-in: including one served by **GeoServer** through GeoWebCache:

```js
new OlElevationProfile({
  dem: { url: 'https://gs.example.org/gwc/service/tms/1.0.0/dem@EPSG:3857@png/{z}/{x}/{y}.png',
         encoding: 'terrarium', maxZoom: 13 }
})
```

**IGN Géoplateforme** (France and overseas, RGE ALTI, metre-accurate) is built in. It is a point API rather than tiles: 200 points per request, paced at one request per second, so a 10 000-point track takes about fifty calls. In exchange it is ninety times finer than the world models. **No key is required** on the public endpoint; `apiKey` exists for a deployment that demands one.

```js
new OlElevationProfile({ dem: 'ign' })
new OlElevationProfile({ dem: { source: 'ign', apiKey: '...' } })
```

Outside its coverage the service answers `-99999`, which the control reads as "no measurement", so a track that leaves France fails the all-or-nothing rule and stays flat. Nothing here codes a border: one asks, and the service says where it does not know.

### Sourcing the elevations yourself

For anything else, a **GeoServer WCS coverage**, a **GeoTIFF**, an in-house API, pass a function. It receives the points as `[lon, lat]` in EPSG:4326 and returns one elevation per point, in the same order:

```js
new OlElevationProfile({
  dem: async (lonlats) => {
    const res = await fetch('/api/elevations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(lonlats)
    });
    return (await res.json()).elevations;      // same length, same order
  }
})
```

A **GeoTIFF** needs a decoder, and this library carries no runtime dependency to spend on one most users would never load. Bring your own: [geotiff.js](https://geotiffjs.github.io/) reads a local file or a Cloud-Optimized GeoTIFF over HTTP, and a WCS `GetCoverage` returns exactly that:

```js
import { fromUrl } from 'geotiff';

const dem = await fromUrl('https://gs.example.org/geoserver/wcs?...&format=image/geotiff');
const img = await dem.getImage();
const [ox,,, oy, sx, sy] = img.getGeoKeys ? img.getOrigin().concat(img.getResolution()) : [];
const raster = (await img.readRasters())[0];
const w = img.getWidth();

new OlElevationProfile({
  dem: (lonlats) => lonlats.map(([lon, lat]) => {
    const c = (lon - ox) / sx, r = (lat - oy) / sy;         // interpolate, do not round:
    const i = Math.floor(c), j = Math.floor(r);             // stepping pixel to pixel turns
    const tx = c - i, ty = r - j;                           // the profile into stairs, and
    const at = (a, b) => raster[b * w + a];                 // each stair inflates the D+
    const top = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
    const bot = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
    return top + (bot - top) * ty;
  })
});
```

Only the transport is delegated. The control keeps the sequencing (a track selected while another loads still wins), the all-or-nothing rule, the spinner and the `demload` event. Returning `null` for a point, an array of the wrong length, or throwing all mean the same thing: the fill is abandoned and the profile stays as it was.

## PNG export

`exportPng: true` adds a button to the toolbar, to the right of the zoom buttons, saving the panel as an image. The method is public too, whether the button is shown or not:

```js
const profile = new OlElevationProfile({ exportPng: true });

const blob = await profile.exportPNG();                       // saves the file
const blob2 = await profile.exportPNG({ download: false });    // just the Blob
await profile.exportPNG({ scale: 3, filename: 'stage-7.png' });
```

The image covers the **whole panel**: title, stats line, slope legend when it is shown, and the complete chart with both axes. `scale` defaults to the device pixel ratio, so the file is not soft on a high-density screen.

**The position indicator is left out.** It marks where the pointer happens to be, which means nothing once the image is saved.

The panel is rebuilt as an SVG rather than screenshotted. The header is HTML and the chart is SVG, and the only way to put HTML inside an SVG is a `foreignObject`, which browsers do not rasterise consistently; redrawing the two text lines as `<text>` works everywhere. One consequence is worth knowing: a serialized SVG carries no stylesheet, so every painting property is frozen inline on the way out. A custom theme is exported exactly as it is displayed, but a rule you add from outside the library, targeting the chart from your own CSS, is only picked up if it resolves to a computed style on the node itself.

## Attributions

When the profile sits in the bottom-right corner (or full-width at the bottom), the OpenLayers attribution control is automatically lifted **above** the profile, right-aligned, with a vertical gap equal to the map-edge-to-profile-bottom gap. Other placements leave the attribution untouched.

## Time

If the source track carries time data: `coordTimes` (ISO timestamps, from GPX `<time>`), `coordinateProperties.times`, or a 4th `M` coordinate: two opt-in items become available:

- add `'duration'` to `headerItems` to show the **total elapsed time** in the title line;
- add `'time'` to `tooltipItems` to show the **elapsed time at the cursor** point.

The unit adapts to the value: `7 sec`, `26 min`, `1 h 48 min`, `2 j 3 h` (days + hours). By default the time is **moving time**: stopped segments (speed below `stopSpeed`, 0.5 m/s) are excluded; set `ignoreStops: false` for raw wall-clock time. Under an A/B crop, the time is rebased so it restarts at 0 on A. Use `OlElevationProfile.featureHasTime(feature)` to detect whether a track has time data.

```js
new OlElevationProfile({
  headerItems: ['distance', 'ascent', 'descent', 'minmax', 'duration'],
  tooltipItems: ['distance', 'elevation', 'time']
})
```
