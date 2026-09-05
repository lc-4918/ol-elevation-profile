# Pente, terrain, export & attributions

## Classes de pente

Avec `slope: true`, le profil est découpé en portions contiguës de même classe de pente (largeur `slopeClassSize`, en %), au plus `maxClasses` (défaut 8). Les couleurs vont du **bleu** (classe la plus plate) au **rouge** (la plus raide), via cyan/vert et un jaune pur, réparties sur les classes réellement présentes, pas étirées sur la pente max réelle. Un trait vertical sépare chaque changement de classe, et une légende s'affiche sous le titre.

```js
new OlElevationProfile({ slope: true, slopeClassSize: 2.5, maxClasses: 8 })
```

## Lissage

Une altitude enregistrée oscille de quelques mètres d'un point au suivant, baromètre ou satellites confondus. Dessinées telles quelles, ces oscillations transforment une route plate en ligne hérissée, et chacune compte pour une montée suivie d'une descente, si bien que le **D+ enfle** : une sortie plate peut annoncer des centaines de mètres de dénivelé qu'elle n'a jamais eus.

`smoothing` remplace l'altitude de chaque point par la moyenne des altitudes rencontrées sur **une demi-fenêtre de part et d'autre, le long du tracé**. Étant une distance en mètres de tracé et non un nombre de points, la même valeur se comporte pareillement sur un enregistrement à un point par seconde et sur un export tous les dix mètres. Elle porte sur les échantillons : `getStats()`, le D+/D-, les min/max et les classes de pente la suivent tous ; la géométrie sur la carte n'est pas touchée.

Le prix est symétrique : une fenêtre assez large pour effacer le bruit arrondit aussi un col. Comptez `20`-`50` pour dompter le tremblement ordinaire, `100`-`200` pour une silhouette lisible sur un long parcours ; au-delà, on remodèle le terrain plutôt qu'on ne le lit. Voir [`smoothing`](/fr/guide/options#unites-donnees) pour le compromis complet.

```js
profile.setOptions({ smoothing: 60 }) // moyenne sur ±30 m
```

## Types de géométrie

`LineString` et `MultiLineString` sont parcourus tels quels. Un `Polygon` ou un `MultiPolygon` est parcouru le long de son **anneau extérieur** ; les trous ne font pas partie du contour lui-même, ils sont donc ignorés. L'anneau étant fermé, le profil revient à son point de départ, si bien que le D+ et le D- sortent **égaux par construction**. Sur une boucle, c'est précisément ce qu'on grimpe en en faisant le tour. La distance est le périmètre, et tout le reste se comporte comme sur une ligne : min/max, coloration par pente, recadrage A/B, remplissage depuis un MNT.

Les polygones sont sélectionnables sur la carte comme les lignes. Le survol accroche le marqueur au **contour** et non à la surface : le `getClosestPoint` d'un polygone répond pour son intérieur, où le curseur est son propre point le plus proche.

## Curseur

Le curseur se déplace **en continu**, sur le profil comme sur la carte : entre deux échantillons, position, altitude et temps sont interpolés sur le segment, et une coordonnée de la carte y est projetée. Les échantillons sont les points *mesurés*, non les seules positions que le curseur ait le droit d'occuper : se caler sur le plus proche ferait avancer le marqueur de sommet en sommet, saut bien visible sur un tracé peu dense ou éclairci par `maxPoints`. La pente fait exception : propriété du segment, constante sur toute sa longueur, elle n'est pas interpolée.

## Modèle de terrain

Une trace dessinée à la main, relevée depuis un fond de carte ou exportée par un outil qui ne garde pas la troisième dimension n'a **pas de Z**, donc pas de profil. Les altitudes manquantes sont alors lues dans un modèle numérique de terrain, et c'est **actif par défaut** :

```js
new OlElevationProfile()                       // AWS Terrain Tiles, sans clé
new OlElevationProfile({ dem: null })          // désactivé : le contrôle ne touche jamais au réseau
```

Rien ne se produit sur une trace qui porte déjà son Z : l'option y est inerte, et les altitudes présentes dans le fichier ne sont jamais écrasées. En revanche, une trace sans Z déclenche d'elle-même le chargement de tuiles, sans que l'application l'ait demandé : mettre `dem: null` si ce n'est pas souhaité.

### Pourquoi des tuiles plutôt qu'une API altimétrique

Les API altimétriques gratuites et sans clé se paient au point : 100 coordonnées par requête chez Open-Meteo, 200 chez la Géoplateforme IGN, qui plafonne par ailleurs à une requête par seconde. Une trace de 10 000 points, c'est 100 requêtes, ou 50 requêtes étalées sur 50 secondes.

Les tuiles altimétriques sont des images PNG qui portent l'altitude dans leurs canaux R/G/B. La même trace tient en **une poignée de tuiles**, mises en cache par le navigateur, sans clé, sans quota et sans limite de débit. Les lire coûte un `drawImage` et un `getImageData` : on est déjà dans une carte, charger des tuiles est ce qu'elle sait faire.

### Précision, et ce que l'option ne fait pas

La source par défaut se résout à 30 à 90 m selon la région. Confrontée au RGE ALTI de l'IGN (1 m) sur douze points de relief alpin escarpé, l'écart moyen est de **16 m**, le pire de 33 m. C'est l'ordre de grandeur qu'il faut pour une forme de profil et un D+ ; ce n'est pas un relevé.

L'altitude est **interpolée bilinéairement** entre les quatre pixels voisins, et non lue dans le pixel qui contient le point. Avancer de pixel en pixel ferait progresser le profil par marches, et chaque marche compterait comme une montée puis une descente dans le D+. L'interpolation ne crée pas de relief : elle rend la même surface, sans les marches de l'échantillonnage.

**Une trace se complète entièrement ou pas du tout.** S'il manque un seul point (une tuile qui ne se charge pas, un trou du modèle), le remplissage est abandonné et le profil reste celui qu'il aurait été sans lui. Un profil auquel il manque quelques points n'est pas un profil incomplet : ces points valent zéro, le tracé plonge au niveau de la mer et le D+ devient absurde.

Pendant le chargement des tuiles, la zone du graphe affiche un **spinner** plutôt que le profil à plat qu'elle dessinerait sinon, et les chiffres de l'entête sont retenus : un D+ de 0 m qui saute à 1 200 se lit plus mal qu'une absence de chiffre. Le spinner prend `--oep-area` : il porte donc la couleur du thème, ou celle de la trace en `color: 'auto'`.

Rien n'est signalé à l'utilisateur en cas d'échec : le remplissage est un supplément, pas un prérequis. L'événement `demload` permet à l'application de le savoir :

```js
profile.on('demload', (e) => console.log(e.ok, e.zoom, e.tiles));
```

### Sources

D'où viennent les altitudes. Toutes passent ensuite par la même politique : séquencement, tout ou rien, spinner, `demload`.

| `dem` | Source |
|---|---|
| `'terrarium'` (défaut), `true` | AWS Terrain Tiles, sans clé |
| `'ign'` | Géoplateforme IGN RGE ALTI, France, au mètre, sans clé |
| `{ url: '.../{z}/{x}/{y}.png' }` | n'importe quel jeu **XYZ** |
| `{ wms: { url, layers, params } }` | tuiles **WMS**, un `GetMap` par tuile |
| `{ olSource }` | n'importe quelle **`ol/source/TileImage`** (XYZ, TileWMS, ...) ou **`ol/source/GeoTIFF`** |
| `{ featureInfo: { url, layers, property } }` | **WMS GetFeatureInfo**, une requête par point |
| une fonction, ou `{ sample }` | vous les récupérez vous-même |

```js
// Tuiles WMS dont la couche sert déjà du terrain-RGB (voir la section GeoServer)
new OlElevationProfile({ dem: { wms: { url: 'https://gs.example.org/wms', layers: 'mnt' } } })

// Réutiliser une source que la carte porte déjà : OpenLayers construit les URL
new OlElevationProfile({ dem: { olSource: coucheMnt.getSource() } })
```

`{ olSource }` est le plus sûr des choix tuiles : sous-domaines, paramètres et grille sont l'affaire d'OpenLayers, pas d'une seconde implémentation ici. Les requêtes WMS partent en 1.3.0 ; en changeant la version via `params`, le paramètre de système de référence bascule seul de `CRS` à `SRS`, ce qui fait la différence entre une requête servie et une requête rejetée.

### GeoTIFF

Une `ol/source/GeoTIFF` se passe dans `olSource` comme les autres. C'est une source **DataTile** et non une image tuilée : elle porte des valeurs réelles, dans sa propre projection et sa propre grille, si bien que rien ne passe par un décodeur de couleurs et qu'`encoding` est ignoré.

```js
import GeoTIFF from 'ol/source/GeoTIFF.js';

new OlElevationProfile({
  dem: {
    olSource: new GeoTIFF({ sources: [{ url: 'https://example.org/mnt.tif' }], normalize: false }),
    band: 0
  }
})
```

**`normalize: false` n'est pas facultatif.** Laissé à son défaut, OpenLayers ramène les valeurs entre 0 et 1 et le profil sort en fractions de rien. `band` choisit la bande sur une couverture multi-bandes ; la première sert par défaut.

Aucune dépendance n'est ajoutée pour autant : OpenLayers embarque déjà le décodeur GeoTIFF, et cette bibliothèque ne parle jamais qu'à la source. Un Cloud-Optimized GeoTIFF en HTTP et un `GetCoverage` WCS se lisent de la même façon, le second en pointant la source sur l'URL de la requête.

La grille d'un GeoTIFF n'est connue qu'une fois ses métadonnées lues : le remplissage attend donc que la source soit prête avant d'échantillonner. Les altitudes sont **interpolées bilinéairement** dans la grille propre de la couverture, exactement comme sur des tuiles. Aux bords, un point tombant à moins d'un demi-pixel du bord tient la valeur du pixel de bord plutôt que d'extrapoler hors données, et ne fait pas échouer le remplissage.

### GeoServer, en pratique

Trois voies, et elles ne se valent pas.

| Voie | Valeurs | Interpolées | Requêtes pour un tracé de 5 000 points |
|---|---|---|---|
| **WCS via `ol/source/GeoTIFF`** | exactes | oui | quelques requêtes Range |
| **Tuiles terrain-RGB pré-encodées** | quantifiées par l'encodage | oui | quelques tuiles |
| **WMS `GetFeatureInfo`** | exactes | **non** | 5 000 |

**Activer CORS d'abord, quelle que soit la voie.** Sans cela le navigateur bloque toutes les requêtes cross-origin, et la panne ressemble exactement à une couche absente. Dans `WEB-INF/web.xml`, décommenter le filtre `cross-origin` et son mapping ; les versions récentes de GeoServer exposent la même chose par variables d'environnement.

#### WCS, la voie à préférer

Publier le MNT comme entrepôt de couverture, activer WCS dans *Services*, et pointer une `ol/source/GeoTIFF` sur une requête `GetCoverage` :

```js
import GeoTIFF from 'ol/source/GeoTIFF.js';

const wcs = 'https://gs.example.org/geoserver/wcs' +
  '?service=WCS&version=2.0.1&request=GetCoverage' +
  '&coverageId=ws__mnt' +          // GeoServer écrit le deux-points en double souligné
  '&format=image/geotiff';

new OlElevationProfile({
  dem: { olSource: new GeoTIFF({ sources: [{ url: wcs }], normalize: false }), band: 0 }
})
```

`normalize: false` n'est pas facultatif : laissé à son défaut, OpenLayers ramène les valeurs entre 0 et 1.

**Un `GetCoverage` sans découpage rend la couverture entière.** C'est acceptable pour une vallée ou un département, lourd pour un MNT national. Pour un gros MNT, le publier en **Cloud-Optimized GeoTIFF** et pointer la source directement sur le `.tif` : `ol/source/GeoTIFF` émet alors des requêtes HTTP Range et ne lit que les tuiles nécessaires, à la résolution nécessaire.

#### GetFeatureInfo, quand la couverture n'est servie qu'en image

Aucune exigence de style, pas de WCS, mais une requête par point et pas d'interpolation :

```js
new OlElevationProfile({
  dem: {
    featureInfo: {
      url: 'https://gs.example.org/geoserver/ws/wms',
      layers: 'ws:mnt',
      property: 'GRAY_INDEX'      // nom donné par GeoServer à une couverture mono-bande
    },
    concurrency: 8
  }
})
```

Attention au volume : le remplissage échantillonne **toutes les coordonnées de la géométrie**, et non l'ensemble décimé par `maxPoints`. Un GPX de 10 000 points, ce sont 10 000 allers-retours. Simplifier la géométrie en amont si c'est la voie retenue.

#### Tuiles terrain-RGB

GeoServer ne produira pas d'encodage `terrarium` ni `mapbox` depuis un SLD : ces encodages répartissent l'altitude sur les trois canaux, ce qu'un `ColorMap` ne sait pas exprimer. Encoder les tuiles au préalable, avec [rio-rgbify](https://github.com/mapbox/rio-rgbify) ou équivalent, puis les servir en XYZ, via GeoWebCache ou autrement :

```js
new OlElevationProfile({
  dem: { url: 'https://gs.example.org/gwc/service/tms/1.0.0/ws:mnt@EPSG:3857@png/{z}/{x}/{y}.png',
         encoding: 'terrarium', maxZoom: 14 }
})
```

Si votre encodage diffère, `encoding` accepte une fonction :

```js
dem: { url: '...', encoding: (r, g, b, a) => (a === 0 ? null : (r * 65536 + g * 256 + b) / 100 - 10000) }
```

### Couvertures en niveaux de gris : GetFeatureInfo

Un MNT servi en niveaux de gris rendus ne se lit pas dans ses pixels : ce qu'un WMS renvoie a été étiré et quantifié par son style, le décoder reviendrait à décoder le rendu et non la couverture. `featureInfo` demande au serveur la valeur de la bande.

```js
new OlElevationProfile({
  dem: { featureInfo: { url: 'https://gs.example.org/wms', layers: 'mnt',
                        property: 'GRAY_INDEX', resolution: 1 }, concurrency: 6 }
})
```

**C'est lent, inévitablement.** Une requête par point : un tracé de mille points fait mille allers-retours là où une source tuilée en demande une poignée. À réserver aux cas où rien d'autre n'atteint la donnée, `concurrency` servant à rendre l'attente supportable. Sans `property`, le premier nombre fini de la réponse gagne, ce qui convient à une couverture mono-bande et devient faux dès que la couche en porte plusieurs.

### Décodage

`encoding` dit comment un pixel devient des mètres : `'terrarium'` (défaut), `'mapbox'`, ou une fonction.

```js
new OlElevationProfile({
  dem: { url: 'https://tuiles.example.org/{z}/{x}/{y}.png',
         encoding: (r, g, b, a) => (a === 0 ? null : r * 256 + g - 32768) }
})
```

Rendre `null` là où le pixel ne porte pas de mesure. C'est refusé, et non lu comme zéro mètre : le remplissage est abandonné plutôt que deviné.

### Autres sources : IGN, GeoServer, GeoTIFF

N'importe quel jeu de tuiles XYZ en encodage `terrarium` ou `mapbox` convient tel quel : y compris servi par **GeoServer** via GeoWebCache :

```js
new OlElevationProfile({
  dem: { url: 'https://gs.example.org/gwc/service/tms/1.0.0/mnt@EPSG:3857@png/{z}/{x}/{y}.png',
         encoding: 'terrarium', maxZoom: 13 }
})
```

La **Géoplateforme IGN** (France et outre-mer, RGE ALTI, au mètre) est intégrée. C'est une API de points et non des tuiles : 200 points par requête, cadencées à une par seconde, soit une cinquantaine d'appels pour un tracé de 10 000 points. En échange elle est quatre-vingt-dix fois plus fine que les modèles mondiaux. **Aucune clé n'est nécessaire** sur le point d'accès public ; `apiKey` existe pour un déploiement qui en exigerait une.

```js
new OlElevationProfile({ dem: 'ign' })
new OlElevationProfile({ dem: { source: 'ign', apiKey: '...' } })
```

Hors de sa couverture le service répond `-99999`, que le contrôle lit comme "pas de mesure", un tracé qui sort de France tombe donc sous la règle du tout ou rien et reste plat. Aucune frontière n'est codée ici : on demande, et le service dit lui-même où il ne sait pas.

### Fournir les altitudes soi-même

Pour tout le reste, une **couverture WCS GeoServer**, un **GeoTIFF**, une API maison, passer une fonction. Elle reçoit les points en `[lon, lat]` EPSG:4326 et rend une altitude par point, dans le même ordre :

```js
new OlElevationProfile({
  dem: async (lonlats) => {
    const res = await fetch('/api/altitudes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(lonlats)
    });
    return (await res.json()).elevations;      // même longueur, même ordre
  }
})
```

Un **GeoTIFF** demande un décodeur, et cette bibliothèque n'a pas de dépendance d'exécution à dépenser pour un décodeur que la plupart des utilisateurs ne chargeraient jamais. Apportez le vôtre : [geotiff.js](https://geotiffjs.github.io/) lit un fichier local ou un Cloud-Optimized GeoTIFF en HTTP, et un `GetCoverage` WCS rend exactement cela :

```js
import { fromUrl } from 'geotiff';

const mnt = await fromUrl('https://gs.example.org/geoserver/wcs?...&format=image/geotiff');
const img = await mnt.getImage();
const [ox, oy] = img.getOrigin(), [sx, sy] = img.getResolution();
const raster = (await img.readRasters())[0];
const w = img.getWidth();

new OlElevationProfile({
  dem: (lonlats) => lonlats.map(([lon, lat]) => {
    const c = (lon - ox) / sx, r = (lat - oy) / sy;         // interpoler, ne pas arrondir :
    const i = Math.floor(c), j = Math.floor(r);             // avancer de pixel en pixel fait
    const tx = c - i, ty = r - j;                           // progresser le profil par marches,
    const at = (a, b) => raster[b * w + a];                 // et chaque marche gonfle le D+
    const haut = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
    const bas = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
    return haut + (bas - haut) * ty;
  })
});
```

Seul le transport est délégué. Le contrôle garde le séquencement (un tracé sélectionné pendant le chargement d'un autre gagne toujours), la règle du tout ou rien, le spinner et l'événement `demload`. Rendre `null` pour un point, un tableau de mauvaise longueur, ou lever une exception veulent dire la même chose : le remplissage est abandonné et le profil reste ce qu'il était.

## Export PNG

`exportPng: true` ajoute un bouton dans la barre d'outils, à droite des boutons de zoom, qui enregistre le panneau en image. La méthode est publique également, que le bouton soit affiché ou non :

```js
const profile = new OlElevationProfile({ exportPng: true });

const blob = await profile.exportPNG();                        // enregistre le fichier
const blob2 = await profile.exportPNG({ download: false });     // seulement le Blob
await profile.exportPNG({ scale: 3, filename: 'etape-7.png' });
```

L'image reprend **tout le panneau** : titre, ligne de statistiques, légende de pente quand elle est affichée, et le graphique complet avec ses deux axes. `scale` vaut par défaut le rapport de pixels de l'écran, pour que le fichier ne soit pas flou sur un écran à haute densité.

**L'indicateur de position n'y figure pas.** Il marque l'endroit où se trouve le pointeur, ce qui ne veut plus rien dire une fois l'image enregistrée.

Le panneau est reconstruit en SVG plutôt que capturé. L'entête est du HTML et le graphique du SVG, et le seul moyen de mettre du HTML dans un SVG est un `foreignObject`, que les navigateurs ne rastérisent pas de façon fiable ; redessiner les deux lignes de texte en `<text>` fonctionne partout. Une conséquence mérite d'être connue : un SVG sérialisé n'emporte pas sa feuille de style, si bien que chaque propriété de peinture est figée en ligne au moment de l'export. Un thème personnalisé sort donc exactement tel qu'il s'affiche, mais une règle ajoutée depuis l'extérieur de la bibliothèque, visant le graphique depuis votre propre CSS, n'est reprise que si elle se résout en style calculé sur le nœud lui-même.

## Attributions

Quand le profil occupe le coin bas-droite (ou le bas en pleine largeur), les attributions OpenLayers sont automatiquement remontées **au-dessus** du profil, alignées à droite, avec un écart vertical égal à celui qui sépare le bord de la carte du bas du profil. Les autres placements ne touchent pas aux attributions.

## Temps

Si le tracé source porte une donnée temporelle : `coordTimes` (horodatages ISO, issus des `<time>` GPX), `coordinateProperties.times`, ou une 4ᵉ coordonnée `M` : deux éléments optionnels deviennent disponibles :

- ajoutez `'duration'` à `headerItems` pour afficher la **durée totale** dans la ligne de titre ;
- ajoutez `'time'` à `tooltipItems` pour afficher le **temps écoulé au point** survolé.

L'unité s'adapte à la valeur : `7 sec`, `26 min`, `1 h 48 min`, `2 j 3 h` (jours + heures). Par défaut le temps est le **temps en mouvement** : les segments à l'arrêt (vitesse sous `stopSpeed`, 0,5 m/s) sont exclus ; mettez `ignoreStops: false` pour le temps réel écoulé. Sous un recadrage A/B, le temps est rebasé pour repartir de 0 à A. Utilisez `OlElevationProfile.featureHasTime(feature)` pour détecter si un tracé porte le temps.

```js
new OlElevationProfile({
  headerItems: ['distance', 'ascent', 'descent', 'minmax', 'duration'],
  tooltipItems: ['distance', 'elevation', 'time']
})
```
