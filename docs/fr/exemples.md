# Exemples

La démo permet de tester toutes les options : [ouvrir la démo](https://lc-4918.github.io/ol-elevation-profile/demo/).

## Constructeur complet (toutes les options)

Toutes les options avec leur valeur par défaut :

```js
const profile = new OlElevationProfile({
  // Placement & taille
  immersion: 'docked',              // 'docked' | 'floating'
  position: 'bottom',               // top | bottom | left | right | top-left | top-right | bottom-left | bottom-right
  width: 520,                       // px (plafonné à la carte) | 'auto' | '100%' | 'full'
  height: 180,                      // px
  margins: { unit: 'px', top: 20, right: 24, bottom: 30, left: 48 },
  responsive: true,                 // adapte largeur/placement (mobile inclus)
  mobileBreakpoint: 640,            // px ; en dessous -> mode mobile

  // Unités & données
  units: 'meters',                  // 'meters' | 'imperial'
  dataProjection: null,             // null = projection de la vue | 'EPSG:4326' | Projection
  maxPoints: 2000,                  // décimation rendu/interaction (0 = aucune)
  smoothing: 0,                     // fenêtre de lissage de l'altitude, en mètres
  dem: 'terrarium',                 // tuiles AWS | true | null = désactivé | { url, encoding, zoom, maxTiles }

  // Apparence
  theme: 'steelblue',               // steelblue | lime | purple | slate | graphite | amber | {area,line,axis,text,focus}
  color: null,                      // null (thème) | 'auto' (couleur trace) | couleur CSS
  trackLayer: null,                 // ol/layer/Vector, pour color:'auto'
  transparency: false,              // false | true | 0..1 (alpha)
  transparencyLevel: 0.45,          // alpha quand transparency === true
  grid: true,
  xTicks: null,                     // null = auto | nombre
  yTicks: null,                     // null = auto | nombre

  // Pente
  slope: false,
  slopeClassSize: 2.5,              // % par classe
  maxClasses: 8,                    // classes max (couleurs + légende)
  slopeColors: null,                // null = rampe bleu->rouge | string[]
  slopeSeparators: true,
  slopeLegend: true,

  // Comportement
  show: 'click',                    // 'click' | 'mouseover'
  hideOnMapClick: true,
  followMap: true,
  marker: true,
  collapsable: true,
  collapsed: false,
  zoom: false,                      // boutons de recadrage A/B
  ignoreStops: true,                // temps en mouvement (ignore les arrêts)
  stopSpeed: 0.5,                   // seuil d'arrêt en m/s

  // Contenu
  tooltipItems: ['distance', 'elevation'],                  // + 'slope', 'time'
  headerItems: ['distance', 'ascent', 'descent', 'minmax'], // + 'min','max','duration' ou {property,...}
  titleProperty: 'name',
  titleLink: null,                  // propriété contenant une URL
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


## Pleine largeur de carte

```js
new OlElevationProfile({ width: 'auto' }) // suit la largeur de la carte
```

## Coloration par pente avec pente dans l'infobulle

```js
new OlElevationProfile({
  slope: true,
  tooltipItems: ['distance', 'elevation', 'slope']
})
```

## Graphe à la couleur de la trace

```js
new OlElevationProfile({ color: 'auto', trackLayer: vectorLayer })
```

## Recadrage A/B

```js
const p = new OlElevationProfile({ zoom: true })
// Clic A, clic sur un point du profil, clic B, clic sur un autre point :
// la carte et le profil se recadrent sur A..B (A remis à 0). « Tout voir » ou dézoom pour sortir.
```

## Détecter les tracés sans altitude

```js
if (!OlElevationProfile.featureHasZ(feature)) {
  // avertir que ce tracé n'a pas d'altimétrie
}
```

## Compléter un tracé sans altitude

```js
const profile = new OlElevationProfile();               // tuiles AWS par défaut, sans clé

// Facultatif : savoir si le remplissage a réussi (c'est tout ou rien).
profile.on('demload', (e) => console.log(e.ok, e.zoom, e.tiles));

// N'importe quel jeu de tuiles XYZ en encodage terrarium ou mapbox convient :
new OlElevationProfile({
  dem: { url: 'https://example.org/mnt/{z}/{x}/{y}.png', encoding: 'mapbox', maxZoom: 13 }
});
```
