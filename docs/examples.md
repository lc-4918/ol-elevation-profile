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
  smoothing: 0,                     // elevation smoothing window, in metres
  dem: 'terrarium',                 // AWS tiles | true | null = off | { url, encoding, zoom, maxTiles }

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
// Click A, click a point on the chart, click B, click another point:
// the map and the profile crop to A..B (A reset to 0). "Show all" or zoom out to exit.
```

## Detect tracks without elevation

```js
if (!OlElevationProfile.featureHasZ(feature)) {
  // warn the user this track has no altimetry
}
```

## Fill a track that has no elevation

```js
const profile = new OlElevationProfile();               // AWS Terrain Tiles by default, no API key

// Optional: know whether the fill succeeded (it is all-or-nothing).
profile.on('demload', (e) => console.log(e.ok, e.zoom, e.tiles));

// Any XYZ tile set in terrarium or mapbox encoding works instead:
new OlElevationProfile({
  dem: { url: 'https://example.org/dem/{z}/{x}/{y}.png', encoding: 'mapbox', maxZoom: 13 }
});
```
