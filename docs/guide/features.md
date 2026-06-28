# Slope, smoothing & attributions

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
