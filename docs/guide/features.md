# Slope, smoothing, terrain & attributions

## Slope classes

With `slope: true`, the profile is split into contiguous portions of the same slope class (width `slopeClassSize`, in %), capped at `maxClasses` (default 8). Colours run from **blue** (flattest class) to **red** (steepest), via cyan/green and a pure yellow, spread across the classes that are actually present — not stretched on the real maximum slope. A vertical separator marks each class change, and a legend appears under the title.

```js
new OlElevationProfile({ slope: true, slopeClassSize: 2.5, maxClasses: 8 })
```

## Smoothing

`smoothing` is a sliding-window average over **metres** of track (`0` = none). Because the unit is metric, the result is independent of GPS point density. Smoothing softens both the profile and the slope.

```js
profile.setOptions({ smoothing: 60 }) // average over ±30 m
```

## Geometry types

`LineString` and `MultiLineString` are profiled as they come. A `Polygon` or `MultiPolygon` is profiled along its **outer ring** — holes are not part of the outline itself, so they are ignored. The ring being closed, the profile returns to its starting point, so D+ and D− come out **equal by construction** — on a loop, that is exactly what one climbs going round it. Distance is the perimeter. Everything else — min/max, slope colouring, A↔B crop, terrain-model fill — behaves as on a line.

Polygons are selectable on the map like lines. Hovering snaps the marker to the **outline**, not to the surface — a polygon's own `getClosestPoint` answers for its interior, where the cursor is its own closest point.

## Terrain model

A track drawn by hand, traced over a basemap, or exported by a tool that drops the third dimension has **no Z** — and no profile. The missing elevations are read from a terrain model instead, and this is **on by default**:

```js
new OlElevationProfile()                       // AWS Terrain Tiles, no API key
new OlElevationProfile({ dem: null })          // off — the control never touches the network
```

Nothing happens for a track that already carries its own Z: the option is inert there, and elevations present in the file are never overwritten. But a track without Z makes the control fetch tiles on its own, without the application having asked — set `dem: null` if that is not wanted.

### Why tiles rather than an elevation API

The free keyless elevation APIs are billed per point — 100 coordinates per request for Open-Meteo, 200 for the IGN Géoplateforme, which caps its own rate at one request per second. A 10 000-point track is 100 requests, or 50 requests spread over 50 seconds.

Terrain tiles are PNG images carrying elevation in their R/G/B channels. The same track needs **a handful of tiles**, cached by the browser, with no key, no quota and no rate limit. Reading them is a `drawImage` and a `getImageData` away — we are already in a map, fetching tiles is what it does.

### Accuracy, and what the option does not do

The default source resolves to roughly 30–90 m depending on the region. Measured against the IGN RGE ALTI (1 m) on twelve points of steep alpine terrain, the mean deviation is **16 m**, the worst 33 m. That is the right order for a profile shape and a D+; it is not a survey.

Elevation is **interpolated bilinearly** between the four surrounding pixels, not read from the containing pixel. Stepping from pixel to pixel would make the profile advance in stairs, and every stair counts as a climb then a descent in the D+. The interpolation invents no relief — it renders the same surface without the sampling steps.

**A track is filled entirely or not at all.** If a single point cannot be sampled — a tile that fails to load, a gap in the model — the fill is abandoned and the profile stays what it would have been without it. A profile missing a few points is not an incomplete profile: those points count as zero, the line dives to sea level and the D+ becomes absurd.

While the tiles load, the chart area shows a **spinner** rather than the flat profile it would otherwise draw, and the header figures are held back — a D+ of 0 m jumping to 1 200 reads worse than no figure at all. The spinner takes `--oep-area`, so it wears the theme colour, or the track colour under `color: 'auto'`.

Nothing is reported to the user on failure; the fill is a supplement, not a prerequisite. Listen to `demload` if the application wants to know:

```js
profile.on('demload', (e) => console.log(e.ok, e.zoom, e.tiles));
```

### Another source

Any XYZ tile set in `terrarium` or `mapbox` encoding works:

```js
new OlElevationProfile({
  dem: { url: 'https://example.org/dem/{z}/{x}/{y}.png', encoding: 'mapbox', maxZoom: 13 }
})
```

`zoom` defaults to `'auto'`: the finest level whose tile count stays within `maxTiles` (32). It is the tiling that widens as the track grows, not the model that degrades — a 10 km track is read at the finest available step, a 300 km one at a coarser step rather than in three hundred requests.

**Attribution is not automatic.** The control does not own the map. `OlElevationProfile.DEM_PRESETS.terrarium.attributions` holds the string to carry in your own basemap source.

## Attributions

When the profile sits in the bottom-right corner (or full-width at the bottom), the OpenLayers attribution control is automatically lifted **above** the profile, right-aligned, with a vertical gap equal to the map-edge-to-profile-bottom gap. Other placements leave the attribution untouched.

## Time

If the source track carries time data — `coordTimes` (ISO timestamps, from GPX `<time>`), `coordinateProperties.times`, or a 4th `M` coordinate — two opt-in items become available:

- add `'duration'` to `headerItems` to show the **total elapsed time** in the title line;
- add `'time'` to `tooltipItems` to show the **elapsed time at the cursor** point.

The unit adapts to the value: `7 sec`, `26 min`, `1 h 48 min`, `2 j 3 h` (days + hours). By default the time is **moving time**: stopped segments (speed below `stopSpeed`, 0.5 m/s) are excluded; set `ignoreStops: false` for raw wall-clock time. Under an A↔B crop, the time is rebased so it restarts at 0 on A. Use `OlElevationProfile.featureHasTime(feature)` to detect whether a track has time data.

```js
new OlElevationProfile({
  headerItems: ['distance', 'ascent', 'descent', 'minmax', 'duration'],
  tooltipItems: ['distance', 'elevation', 'time']
})
```
