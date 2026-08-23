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
  dem: 'terrarium',                 // MNT complétant un tracé sans Z ; null = désactivé
                                    //   'terrarium' | 'ign' | (lonlats) => number[]
                                    //   | { url: '.../{z}/{x}/{y}.png', encoding: 'terrarium' }
                                    //   | { wms: { url, layers } }
                                    //   | { olSource }        // TileImage ou GeoTIFF
                                    //   | { featureInfo: { url, layers, property } }

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
  exportPng: false,                 // bouton d'export du panneau en PNG
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
    exportPng: 'Exporter en PNG',
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

## Modèle de terrain : toutes les sources

`dem` complète un tracé sans Z. Actif par défaut (`'terrarium'`), inerte sur un tracé qui porte déjà ses altitudes, et `null` le désactive entièrement.

```js
// 1. Défaut : AWS Terrain Tiles, mondial, sans clé, sans quota
new OlElevationProfile();

// 2. Désactivé : le contrôle ne touche jamais au réseau
new OlElevationProfile({ dem: null });

// 3. Géoplateforme IGN, France et outre-mer, au mètre, sans clé non plus.
//    API de points : 200 points par requête, une requête par seconde.
new OlElevationProfile({ dem: 'ign' });
new OlElevationProfile({ dem: { source: 'ign', apiKey: 'seulement-si-votre-acces-en-exige-une' } });

// 4. N'importe quel jeu XYZ, encodage terrarium ou mapbox
new OlElevationProfile({
  dem: { url: 'https://tuiles.example.org/mnt/{z}/{x}/{y}.png',
         encoding: 'mapbox', maxZoom: 13, maxTiles: 48 }
});

// 5. Votre propre encodage : rendre null là où le pixel n'a pas de mesure
new OlElevationProfile({
  dem: { url: 'https://tuiles.example.org/mnt/{z}/{x}/{y}.png',
         encoding: (r, g, b, a) => (a === 0 ? null : r * 256 + g - 32768) }
});

// 6. Tuiles WMS, un GetMap par tuile de la même grille
new OlElevationProfile({
  dem: { wms: { url: 'https://gs.example.org/geoserver/wms', layers: 'ws:mnt',
                params: { VERSION: '1.1.1' } } }        // CRS bascule seul en SRS
});

// 7. Une source que la carte porte déjà : OpenLayers construit les URL
new OlElevationProfile({ dem: { olSource: coucheMnt.getSource() } });

// 8. Un GeoTIFF : COG en HTTP, ou un GetCoverage WCS. Des valeurs, pas des couleurs.
import GeoTIFF from 'ol/source/GeoTIFF.js';
new OlElevationProfile({
  dem: { olSource: new GeoTIFF({ sources: [{ url: 'https://example.org/mnt.tif' }],
                                 normalize: false }), band: 0 }
});

// 9. Une couverture en niveaux de gris accessible seulement en image :
//    une requête par point, sans interpolation
new OlElevationProfile({
  dem: { featureInfo: { url: 'https://gs.example.org/geoserver/wms', layers: 'ws:mnt',
                        property: 'GRAY_INDEX' }, concurrency: 8 }
});

// 10. Tout le reste : vous récupérez les altitudes, le contrôle garde la politique
new OlElevationProfile({
  dem: async (lonlats) => {
    const r = await fetch('/api/altitudes', { method: 'POST', body: JSON.stringify(lonlats) });
    return (await r.json()).elevations;     // une par point, dans le même ordre
  }
});
```

Quelle que soit la source, un remplissage est tout ou rien, et `demload` en rend compte :

```js
profile.on('demload', (e) => {
  if (!e.ok) console.warn('pas d\'altimétrie pour ce tracé');
  else console.log(`rempli depuis ${e.tiles} tuiles au zoom ${e.zoom}`);   // zoom null, tiles 0 si non tuilé
});
```

Voir [GeoServer, en pratique](/fr/guide/fonctions#geoserver-en-pratique) pour choisir entre les voies 6, 8 et 9, et le réglage CORS qu'elles exigent toutes.

## Exporter le profil en PNG

```js
const profile = new OlElevationProfile({ exportPng: true });   // ajoute le bouton dans la barre

await profile.exportPNG();                                     // enregistre le fichier
await profile.exportPNG({ scale: 3, filename: 'etape-7.png' });
const blob = await profile.exportPNG({ download: false });      // seulement le Blob
```

L'image reprend tout le panneau : titre, statistiques, légende et graphique. L'indicateur de position n'y figure pas.

