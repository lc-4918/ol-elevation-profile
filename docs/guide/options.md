# Options

Every option can be passed to the constructor and most can be changed at runtime with `setOptions(patch)`. Below, each option is described with **what it does** and **its default value and meaning**.

## Layout & size

**`immersion`** — panel placement strategy. `'docked'` anchors the panel to a map edge; `'floating'` is a free-floating panel (partial). Default: `'docked'`.

**`position`** — where the panel is anchored on the map: `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'`. Default: `'bottom'` (full-width strip along the bottom).

**`width`** — panel width. A number is pixels, automatically capped to the map width; `'auto'`, `'100%'` or `'full'` make it span the whole map width. Default: `520` (px).

**`height`** — panel height in pixels. Default: `180`.

**`margins`** — inner chart margins, as `{ unit, top, right, bottom, left }`. `unit` is `'px'`, `'em'` or `'rem'`. Default: `{ unit:'px', top:20, right:24, bottom:30, left:48 }` (extra left room for the elevation axis).

**`responsive`** — when `true`, the width and placement adapt to the map size, including switching to mobile mode. When `false`, fixed values are kept. Default: `true`.

**`mobileBreakpoint`** — map width (px) at or below which mobile mode applies (100% width, placement forced to `top`/`bottom`). Default: `640`.

## Units & data

**`units`** — measurement system: `'meters'` (km / m) or `'imperial'` (mi / ft). Default: `'meters'`.

**`dataProjection`** — projection of the feature coordinates. `null` means the map view projection is used; otherwise pass a code such as `'EPSG:4326'` or an `ol/proj/Projection`. Default: `null`.

**`maxPoints`** — caps how many points are drawn and used for interaction (the geometry is decimated above this). Statistics always use the full data. `0` disables decimation. Default: `2000`.

**`dem`** — fill missing elevations from a terrain model when the feature has no Z. `'terrarium'` (default) or `true` = [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), keyless; **`null` disables it** and keeps the control entirely offline; or an object `{ url, encoding, zoom, maxZoom, maxTiles, tileSize, concurrency }`. Being on by default, a track without Z makes the control fetch tiles on its own — and brings an attribution obligation with it. See [Terrain model](/guide/features#terrain-model). Default: `'terrarium'`.

**`smoothing`** — elevation smoothing as a sliding-window average over a distance in **metres** (`0` = none). Being metric, it is independent of GPS point density and softens both the profile and the slope. Default: `0`.

## Appearance

**`theme`** — colour theme. A built-in name (`'steelblue'`, `'lime'`, `'purple'`, `'slate'`, `'graphite'`, `'amber'`) or a colours object `{ area, line, axis, text, focus }`. Default: `'steelblue'`.

**`color`** — overrides the chart colour. `null` keeps the theme; `'auto'` uses the track's own colour (requires `trackLayer`), filling the area and darkening the line; any CSS colour string forces that colour. Default: `null`.

**`trackLayer`** — the vector layer whose style provides the stroke colour when `color: 'auto'`. Default: `null`.

**`transparency`** — background transparency. `false` is opaque; `true` uses `transparencyLevel`; a number `0..1` sets the alpha directly (`0` = fully transparent). Default: `false`.

**`transparencyLevel`** — the alpha applied when `transparency === true` (`0..1`). Default: `0.45`.

**`grid`** — horizontal grid lines drawn with the axis colour at low opacity. Default: `true`.

**`xTicks`** — number of X-axis ticks; `null` lets the library choose from the width. Default: `null`.

**`yTicks`** — number of Y-axis ticks; `null` lets the library choose from the height. Default: `null`.

## Slope

**`slope`** — when `true`, the profile is split into contiguous portions coloured by slope class. Default: `false`.

**`slopeClassSize`** — width of one slope class, in **percent**. Default: `2.5`.

**`maxClasses`** — maximum number of slope classes (colours + legend). Steeper slopes fold into the last class, shown as `≥ X %`. Default: `8`.

**`slopeColors`** — `null` uses the built-in blue→red ramp (cyan/green, pure yellow in the middle). Otherwise an array of CSS colours, interpolated across the classes present. Default: `null`.

**`slopeSeparators`** — draw a vertical separator at each slope-class change. Default: `true`.

**`slopeLegend`** — show the colour legend under the title. Default: `true`.

## Behaviour

**`show`** — how a track on the map triggers its profile: `'click'` or `'mouseover'`. Default: `'click'`.

**`hideOnMapClick`** — a click on the empty map hides the whole control. Default: `true`.

**`followMap`** — moving the pointer over the map moves the indicator on the chart. Default: `true`.

**`marker`** — show the position marker (dot) on the map as you move along the chart. Default: `true`.

**`collapsable`** — show the collapse/expand button; collapsed, the control shrinks to title + button. Default: `true`.

**`collapsed`** — initial collapsed state. Default: `false`.

**`zoom`** — show the A/B crop buttons, which crop both map and profile to a sub-range (A reset to 0). Default: `false`.

**`ignoreStops`** — when computing time, exclude stopped segments so the duration is **moving time**. `false` gives raw wall-clock time. Default: `true`.

**`stopSpeed`** — speed threshold in **m/s** (≈ 1.8 km/h) below which a segment counts as a stop. Default: `0.5`.

## Content (header, tooltip, title)

**`tooltipItems`** — what the hover tooltip shows, any of `'distance'`, `'elevation'`, `'slope'`, `'time'` (elapsed time at the cursor, if the track has time data). Default: `['distance','elevation']`.

**`headerItems`** — what the header line shows. String tokens: `'distance'`, `'ascent'`, `'descent'`, `'min'`, `'max'`, `'minmax'`, `'duration'` (total elapsed time). An entry can also be an object pulling a feature property: `{ property, label?, asLink?, linkText? }` (`asLink` renders a URL value as a link). Default: `['distance','ascent','descent','minmax']`.

**`titleProperty`** — the feature property used as the title. Default: `'name'`.

**`titleLink`** — a feature property holding a URL; when present, the title becomes a clickable link. Default: `null`.

**`labels`** — all user-facing strings, overridable individually. Keys and defaults: `distance` `'Distance'`, `elevation` `'Altitude'`, `slope` `'Pente'`, `ascent` `'D+'`, `descent` `'D-'`, `empty` `'Cliquez un tracé'` (placeholder title), `time` `'Temps'`, `duration` `'Durée'`, `durationUnits` `{ s:'sec', m:'min', h:'h', d:'j' }` (time unit abbreviations), `zoomStart` `'Définir le début (A)'`, `zoomEnd` `'Définir la fin (B)'`, `zoomAll` `'Tout voir'`, `loading` `'Chargement du profil altimétrique'` (accessible name of the terrain-model spinner).

```js
// Example: English labels
new OlElevationProfile({
  labels: {
    elevation: 'Elevation', slope: 'Slope', empty: 'Click a track',
    duration: 'Duration', durationUnits: { s: 'sec', m: 'min', h: 'h', d: 'd' },
    zoomStart: 'Set start (A)', zoomEnd: 'Set end (B)', zoomAll: 'Show all'
  }
})
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
  dem: 'terrarium',                 // AWS tiles | true | null = off | { url, encoding, zoom, maxTiles }
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
  zoom: false,                      // A/B crop buttons
  ignoreStops: true,                // moving time (ignore stops)
  stopSpeed: 0.5,                   // m/s stop threshold

  // Content
  tooltipItems: ['distance', 'elevation'],                  // + 'slope', 'time'
  headerItems: ['distance', 'ascent', 'descent', 'minmax'], // + 'min','max','duration' or {property,...}
  titleProperty: 'name',
  titleLink: null,                  // feature property holding a URL
  labels: {
    distance: 'Distance', elevation: 'Altitude', slope: 'Pente',
    ascent: 'D+', descent: 'D-', empty: 'Cliquez un tracé',
    time: 'Temps', duration: 'Durée',
    durationUnits: { s: 'sec', m: 'min', h: 'h', d: 'j' },
    zoomStart: 'Définir le début (A)', zoomEnd: 'Définir la fin (B)', zoomAll: 'Tout voir',
    loading: 'Chargement du profil altimétrique'
  }
})
map.addControl(profile)
```

## Methods

**`setFeature(feature)`** — show the profile for an OpenLayers feature, ideally 3D: `LineString`, `MultiLineString`, or a `Polygon` / `MultiPolygon`, profiled along its **outer ring** (holes are ignored; the profile returns to its starting point, so D+ equals D− — see [Geometry types](/guide/features#geometry-types)). A falsy value hides the control. Returns `this`.

```js
const f = new ol.format.GeoJSON().readFeatures(geojson, {
  featureProjection: map.getView().getProjection()
})[0]
profile.setFeature(f)
```

**`clear()`** — hide the profile and forget the current feature. Returns `this`.

```js
profile.clear()
```

**`setTheme(name | object)`** — change the colour theme and re-render.

```js
profile.setTheme('amber')
profile.setTheme({ area: '#1f6fb2', line: '#0d3c61', axis: '#345', text: '#123', focus: '#e0532a' })
```

**`setColor(color | null)`** — change the chart colour: a CSS colour, `'auto'` (track colour), or `null` to fall back to the theme.

```js
profile.setColor('#e0532a')
profile.setColor('auto')   // needs trackLayer
profile.setColor(null)     // back to theme
```

**`setOptions(patch)`** — update one or more options at runtime and re-render. Returns `this`.

```js
profile.setOptions({ slope: true, smoothing: 60, tooltipItems: ['distance', 'elevation', 'slope', 'time'] })
```

**`toggleCollapsed(force?)`** — collapse or expand. Pass `true`/`false` to force a state.

```js
profile.toggleCollapsed()      // toggle
profile.toggleCollapsed(true)  // force collapsed
```

**`getStats()`** — return the current statistics: `{ distance, duration, ascent, descent, min, max, maxAbsSlope, points }`. `duration` is `null` when the track has no time data.

```js
const { distance, ascent, duration } = profile.getStats()
console.log(distance, ascent, duration)
```

### Static members

**`OlElevationProfile.addTheme(name, colors)`** — register a custom theme usable by `theme`/`setTheme`.

```js
OlElevationProfile.addTheme('ocean', { area: '#0aa', line: '#066', axis: '#055', text: '#022', focus: '#f60' })
new OlElevationProfile({ theme: 'ocean' })
```

**`OlElevationProfile.featureHasZ(feature)`** — `true` if the feature has any Z (elevation) coordinate.

```js
if (!OlElevationProfile.featureHasZ(f)) console.warn('No altimetry on this track')
```

**`OlElevationProfile.featureHasTime(feature)`** — `true` if the feature carries per-point time data.

```js
if (OlElevationProfile.featureHasTime(f)) profile.setOptions({ headerItems: ['distance', 'duration'] })
```

**`OlElevationProfile.version`** — the library version string.

```js
console.log(OlElevationProfile.version)
```
