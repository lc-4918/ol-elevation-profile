# Démarrage

`ol-elevation-profile` est un contrôle OpenLayers qui dessine un profil altimétrique synchronisé pour un tracé dont la géométrie porte l'altitude (`[lon, lat, z]`). Un tracé **sans** Z est complété depuis un modèle numérique de terrain : des tuiles AWS sans clé, **actives par défaut**, que le contrôle va donc chercher de lui-même. `dem: null` le désactive. Il a besoin d'**OpenLayers** et de **d3** déjà présents ; il ne les embarque jamais.

## Compatibilité

OpenLayers **6 à 10.10.0** · d3 **≥ 7**.

## Installation

### Balises script (UMD)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@10.10.0/ol.css">
<script src="https://cdn.jsdelivr.net/npm/ol@10.10.0/dist/ol.js"></script>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>

<link rel="stylesheet" href="ol-elevation-profile.css">
<script src="ol-elevation-profile.js"></script>
<!-- expose window.OlElevationProfile -->
```

### npm / bundler (ESM)

```bash
npm i ol-elevation-profile
# ol et d3 sont des peer dependencies que vous installez vous-même
```

```js
import OlElevationProfile from 'ol-elevation-profile'
import 'ol-elevation-profile/css'
```

## Utilisation

```js
const profile = new OlElevationProfile({
  position: 'bottom',
  theme: 'steelblue',
  color: 'auto',           // le graphe prend la couleur de la trace
  trackLayer: vectorLayer, // couche d'où lire cette couleur
  tooltipItems: ['distance', 'elevation', 'slope'],
  titleLink: 'link'        // titre cliquable d'après une propriété du feature
})
map.addControl(profile)

const feats = new ol.format.GeoJSON().readFeatures(geojson, {
  dataProjection: 'EPSG:4326',
  featureProjection: map.getView().getProjection()
})
vectorSource.addFeatures(feats)
profile.setFeature(feats[0]) // ou laisser le clic sur le tracé sélectionner
```

Cliquez un tracé (ou survolez, avec `show: 'mouseover'`), déplacez-vous sur la carte ou le profil, cliquez dans le vide pour masquer.

## Formats supportés

Le contrôle ne consomme que des `Feature` OpenLayers : **tout format lisible par OpenLayers fonctionne**, GeoJSON, GPX, KML, etc. On lit du GPX ou du KML exactement pareil :

```js
const feats = new ol.format.GPX().readFeatures(text, {
  featureProjection: map.getView().getProjection()
})
profile.setFeature(feats.find(f => /LineString|Polygon/.test(f.getGeometry().getType())))
```

L'altitude vient des coordonnées 3D ; le temps vient de `coordTimes`, `coordinateProperties.times`, ou d'une 4ᵉ coordonnée `M` (ex. `<time>` GPX), si présent.

> Pour un constructeur avec **toutes les options** définies, voir [Options](./options) ou [Exemples](../exemples).
