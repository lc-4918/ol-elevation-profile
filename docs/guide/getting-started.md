# Getting started

`ol-elevation-profile` is an OpenLayers control that draws a synchronized elevation profile for a track whose geometry carries elevation (`[lon, lat, z]`). A track **without** Z is filled from a terrain model — keyless AWS terrain tiles, **on by default**, so the control fetches them on its own; `dem: null` turns that off. It needs **OpenLayers** and **d3** to be present — it never bundles them.

## Compatibility

OpenLayers **6 → 10.9.0** · d3 **≥ 7**.

## Install

### Script tags (UMD)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@10.9.0/ol.css">
<script src="https://cdn.jsdelivr.net/npm/ol@10.9.0/dist/ol.js"></script>
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
  color: 'auto',           // chart uses the track colour
  trackLayer: vectorLayer, // layer to read that colour from
  tooltipItems: ['distance', 'elevation', 'slope'],
  titleLink: 'link'        // make the title a link from a feature property
})
map.addControl(profile)

const feats = new ol.format.GeoJSON().readFeatures(geojson, {
  dataProjection: 'EPSG:4326',
  featureProjection: map.getView().getProjection()
})
vectorSource.addFeatures(feats)
profile.setFeature(feats[0]) // or let a click on the track select it
```

Click a track (or hover, with `show: 'mouseover'`), move over the map or the chart, and click empty map to hide.

## Supported formats

The control only consumes OpenLayers `Feature`s, so **any format OpenLayers can read works** — GeoJSON, GPX, KML, etc. Read GPX or KML exactly the same way:

```js
const feats = new ol.format.GPX().readFeatures(text, {
  featureProjection: map.getView().getProjection()
})
profile.setFeature(feats.find(f => /LineString|Polygon/.test(f.getGeometry().getType())))
```

Elevation comes from 3D coordinates; time comes from `coordTimes`, `coordinateProperties.times`, or a 4th `M` coordinate (e.g. GPX `<time>`), when present.

> For a constructor with **every option** defined, see [Options](./options) or [Examples](../examples).
