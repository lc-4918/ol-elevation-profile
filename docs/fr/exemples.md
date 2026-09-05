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
                                    //   | { track: { url: '/profils/{id}.json' } }

  // Apparence
  theme: 'steelblue',               // steelblue | lime | purple | slate | graphite | amber | {area,line,axis,text,focus}
  color: null,                      // null (thème) | 'auto' (couleur trace) | couleur CSS
  trackLayer: null,                 // ol/layer/Vector, pour color:'auto'
  transparency: false,              // false | true | 0..1 (alpha)
  transparencyLevel: 0.45,          // alpha quand transparency === true
  grid: true,
  xTicks: null,                     // null = auto | nombre
  yTicks: null,                     // null = auto | nombre
  verticalScale: 'auto',            // 'auto' = remplit la hauteur | nombre = mètres par centimètre
                                    //   | { exaggeration: 6 } = rapport vertical/horizontal fixe

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
  showWithoutElevation: true,       // aucun Z par aucune voie : panneau + message
  followMap: true,
  marker: true,
  collapsable: true,
  collapsed: false,
  exportPng: false,                 // bouton d'export du panneau en PNG
  zoom: false,                      // boutons de recadrage A/B
  zoomLevels: 3,                    // recadrages imbriqués autorisés (1 = niveau unique)
  ignoreStops: true,                // temps en mouvement (ignore les arrêts)
  stopSpeed: 0.5,                   // seuil d'arrêt en m/s

  // Contenu
  tooltipItems: ['distance', 'elevation'],                  // + 'slope', 'time'
  headerItems: ['distance', 'ascent', 'descent', 'minmax'], // + 'min','max','duration' ou {property,...}
  titleProperty: 'name',            // ou une liste, essayée dans l'ordre
  titleLink: null,                  // un nom, ou une liste : la première vraie URL gagne
  lang: 'en',                       // 'en' | 'fr' | 'es'
  labels: {}                        // surcharges clé à clé, par-dessus lang
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
// Clic A, puis clic sur un point du profil : B s'arme tout seul, le clic suivant
// sur le profil le pose. La carte et le profil se recadrent sur A..B (A remis à 0).
// "Tout voir" ou dézoom pour sortir.
```

### Recadrages imbriqués

Un recadrage peut être recadré à son tour : c'est ainsi qu'on descend jusqu'à un col dans
une étape d'un long parcours. `zoomLevels` en fixe la profondeur, `1` rendant le niveau
unique d'autrefois.

```js
const p = new OlElevationProfile({ zoom: true, zoomLevels: 3 })
// A/B de nouveau dans un recadrage : il s'imbrique au lieu de le remplacer.
// "Retour" (dès le deuxième niveau) défait un cran ; "Tout voir" vide la pile.
// Dézoomer la carte ne quitte que le niveau courant, pas toute la pile.
```

## Échelle verticale comparable

En `'auto'`, le profil remplit la hauteur : la même pente de 2 % paraît plate sur une trace
et raide sur la suivante. Un nombre fixe les mètres par centimètre physique, et deux profils
deviennent comparables.

```js
const p = new OlElevationProfile({ verticalScale: 50 })   // 50 m par centimètre
// La valeur est un plancher : une trace trop raide pour tenir élargit l'échelle plutôt
// que de déborder du cadre. Aucune mention de l'échelle n'est portée sur le graphe.
p.setOptions({ verticalScale: 'auto' })                   // retour au remplissage de la hauteur
```

## Pentes comparables : un rapport tenu, une échelle recalculée à chaque trace

Un nombre fixe rend les **amplitudes** comparables, pas les pentes : l'axe horizontal
s'étire sur toute la trace, si bien qu'une même pente de 5 % est dessinée trois fois plus
raide sur une boucle de 3 km que sur une traversée de 30. Une exagération **tient** au contraire le
rapport entre les deux axes, et ce sont les mètres par centimètre que le contrôle recalcule
pour chaque trace qu'on lui donne. Le nombre est l'invariant : c'est pourquoi c'est un
nombre et non `'auto'`, qui n'aurait plus rien à tenir. `verticalScale: 'auto'` est
justement le cas où le rapport dérive librement.

| `verticalScale` | tenu | varie | comparable d'une trace à l'autre |
|---|---|---|---|
| `'auto'` | la hauteur, remplie | l'échelle **et** le rapport | rien |
| `50` | 50 m/cm | le rapport | les **amplitudes** |
| `{ exaggeration: 6 }` | le rapport, ×6 | l'échelle | les **pentes** |

Le rapport que chaque mode produit réellement, sur les quatre mêmes traces :

| `verticalScale` | 2,5 km | 10,3 km | 23,4 km | 123 km |
|---|---|---|---|---|
| `'auto'` | ×3,18 | ×10,73 | ×7,66 | ×12,84 |
| `50` | ×1,73 | ×7,14 | ×8,80 | ×15,61 |
| `{ exaggeration: 6 }` | ×3,58 | ×6,00 | ×6,00 | ×6,00 |

Sous les deux premiers, une pente de 5 % est dessinée quatre à neuf fois plus plate sur une
trace que sur une autre, et l'œil n'a aucun moyen de le savoir. Seule la troisième ligne
tient — là où le plancher le permet.


**On la pose une fois, à la construction. Il n'y a rien à recalculer par trace :**

```js
const profile = new OlElevationProfile({ verticalScale: { exaggeration: 6 } })
map.addControl(profile)

profile.setFeature(petiteBoucle)   // 2,5 km  -> l'échelle se resserre
profile.setFeature(grandeTraversee) // 123 km -> l'échelle s'élargit, le rapport tient
```

Une application qui calcule un nombre elle-même doit le refaire à chaque sélection, et se
trompe encore sur un recadrage :

```js
// À éviter : c'est ce que { exaggeration } fait déjà, moins les cas qu'il traite juste
profile.setOptions({ verticalScale: metresParCm(trace.km) })   // à chaque clic
```

Ce que le même `{ exaggeration: 6 }` produit sur un panneau de 1160 × 300, sans un seul
appel de l'application :

| trace | mètres par centimètre | obtenu |
|---|---|---|
| 2,5 km, 150 m d'amplitude | 24,2 | ×3,58 |
| 10,3 km | 59,5 | ×6,00 |
| 23,4 km | 135,2 | ×6,00 |
| 123,2 km, 1 800 m d'amplitude | 711,7 | ×6,00 |

L'échelle varie d'un facteur trente ; le rapport tient. Deux choses que l'application
n'aurait pas pu faire du dehors : la largeur du graphe n'est connue qu'une fois les marges
et la disposition du panneau résolues, et un recadrage A/B change la distance affichée sans
changer la trace.

La première ligne est le **plancher** qui joue : 150 m d'amplitude dans 6,6 cm de hauteur
exigent au moins 24,2 m/cm, là où ×6 n'en demanderait que 14,5. Plutôt que de déborder du
cadre, l'échelle s'élargit et le rapport retombe. Rien sur le graphe ne le dit, l'échelle
étant une propriété de l'affichage et non de la trace — cela se relit :

```js
profile._vScale           // mètres par centimètre réellement appliqués ; nul en 'auto',
                          //   qui ne demande aucune échelle absolue
profile._vExaggeration    // rapport réellement obtenu, dans tous les modes : sous 6 dès
                          //   que le plancher a joué, et dérivant par trace en 'auto'
```

Le facteur se choisit d'après le terrain plutôt qu'au goût : 4 à 6 conviennent à un relief
vallonné, 8 à 10 rendent lisible une voie verte, 2 à 3 empêchent la haute montagne de
ressembler à une scie.

## Langue

L'anglais par défaut ; le français et l'espagnol sont livrés avec la librairie, et `labels` couvre tout le reste.

```js
new OlElevationProfile({ lang: 'fr' })
profile.setOptions({ lang: 'es' })                    // bascule tout, boutons compris

// Une clé qu'on préfère formuler soi-même : elle survit à un changement de langue.
new OlElevationProfile({ lang: 'fr', labels: { empty: 'Choisissez un itinéraire' } })
```

## Tracés sans altitude

Le contrôle traite le cas lui-même : un tracé qui se retrouve sans Z par aucune voie
affiche le panneau, son titre, et un message à la place du graphe — plutôt qu'une ligne
plate au niveau zéro.

```js
new OlElevationProfile({ showWithoutElevation: true })              // le défaut
new OlElevationProfile({ showWithoutElevation: false })             // masquer le panneau
new OlElevationProfile({ labels: { noElevation: 'Relevé à venir' } })
```

`featureHasZ` reste là pour décider d'autre chose — une pastille dans une liste, un filtre :

```js
if (!OlElevationProfile.featureHasZ(feature)) {
  // ce tracé ne porte pas d'altimétrie propre
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

// 10. Un profil que votre application a calculé en amont, servi par trace. La seule
//     source qui répond avec la trace ENTIÈRE : `[[lon,lat,z],…]` remplace la
//     géométrie, si bien qu'un profil décimé à l'ingestion est accepté tel quel.
new OlElevationProfile({
  dem: { track: { url: '/profils/{id}.json' } }          // {id} lu sur l'entité
});
new OlElevationProfile({
  dem: { track: { url: (f) => `/api/traces/${f.getId()}/profil`,
                  parse: (json) => json.altimetrie.points } }
});

// 11. Tout le reste : vous récupérez les altitudes, le contrôle garde la politique
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

