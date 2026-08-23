# Pente, lissage, terrain & attributions

## Classes de pente

Avec `slope: true`, le profil est découpé en portions contiguës de même classe de pente (largeur `slopeClassSize`, en %), au plus `maxClasses` (défaut 8). Les couleurs vont du **bleu** (classe la plus plate) au **rouge** (la plus raide), via cyan/vert et un jaune pur, réparties sur les classes réellement présentes — pas étirées sur la pente max réelle. Un trait vertical sépare chaque changement de classe, et une légende s'affiche sous le titre.

```js
new OlElevationProfile({ slope: true, slopeClassSize: 2.5, maxClasses: 8 })
```

## Lissage

`smoothing` est une moyenne glissante sur des **mètres** de tracé (`0` = aucun). Comme l'unité est métrique, le résultat est indépendant de la densité de points GPS. Le lissage adoucit le profil **et** la pente.

```js
profile.setOptions({ smoothing: 60 }) // moyenne sur ±30 m
```

## Types de géométrie

`LineString` et `MultiLineString` sont parcourus tels quels. Un `Polygon` ou un `MultiPolygon` est parcouru le long de son **anneau extérieur** — les trous ne font pas partie du contour lui-même, ils sont donc ignorés. L'anneau étant fermé, le profil revient à son point de départ, si bien que le D+ et le D− sortent **égaux par construction** — sur une boucle, c'est précisément ce qu'on grimpe en en faisant le tour. La distance est le périmètre. Tout le reste — min/max, coloration par pente, recadrage A↔B, remplissage depuis un MNT — se comporte comme sur une ligne.

Les polygones sont sélectionnables sur la carte comme les lignes. Le survol accroche le marqueur au **contour** et non à la surface — le `getClosestPoint` d'un polygone répond pour son intérieur, où le curseur est son propre point le plus proche.

## Modèle de terrain

Une trace dessinée à la main, relevée depuis un fond de carte ou exportée par un outil qui ne garde pas la troisième dimension n'a **pas de Z** — donc pas de profil. Les altitudes manquantes sont alors lues dans un modèle numérique de terrain, et c'est **actif par défaut** :

```js
new OlElevationProfile()                       // AWS Terrain Tiles, sans clé
new OlElevationProfile({ dem: null })          // désactivé — le contrôle ne touche jamais au réseau
```

Rien ne se produit sur une trace qui porte déjà son Z : l'option y est inerte, et les altitudes présentes dans le fichier ne sont jamais écrasées. En revanche, une trace sans Z déclenche d'elle-même le chargement de tuiles, sans que l'application l'ait demandé — mettre `dem: null` si ce n'est pas souhaité.

### Pourquoi des tuiles plutôt qu'une API altimétrique

Les API altimétriques gratuites et sans clé se paient au point — 100 coordonnées par requête chez Open-Meteo, 200 chez la Géoplateforme IGN, qui plafonne par ailleurs à une requête par seconde. Une trace de 10 000 points, c'est 100 requêtes, ou 50 requêtes étalées sur 50 secondes.

Les tuiles altimétriques sont des images PNG qui portent l'altitude dans leurs canaux R/G/B. La même trace tient en **une poignée de tuiles**, mises en cache par le navigateur, sans clé, sans quota et sans limite de débit. Les lire coûte un `drawImage` et un `getImageData` — on est déjà dans une carte, charger des tuiles est ce qu'elle sait faire.

### Précision, et ce que l'option ne fait pas

La source par défaut se résout à 30 à 90 m selon la région. Confrontée au RGE ALTI de l'IGN (1 m) sur douze points de relief alpin escarpé, l'écart moyen est de **16 m**, le pire de 33 m. C'est l'ordre de grandeur qu'il faut pour une forme de profil et un D+ ; ce n'est pas un relevé.

L'altitude est **interpolée bilinéairement** entre les quatre pixels voisins, et non lue dans le pixel qui contient le point. Avancer de pixel en pixel ferait progresser le profil par marches, et chaque marche compterait comme une montée puis une descente dans le D+. L'interpolation ne crée pas de relief — elle rend la même surface, sans les marches de l'échantillonnage.

**Une trace se complète entièrement ou pas du tout.** S'il manque un seul point — une tuile qui ne se charge pas, un trou du modèle — le remplissage est abandonné et le profil reste celui qu'il aurait été sans lui. Un profil auquel il manque quelques points n'est pas un profil incomplet : ces points valent zéro, le tracé plonge au niveau de la mer et le D+ devient absurde.

Pendant le chargement des tuiles, la zone du graphe affiche un **spinner** plutôt que le profil à plat qu'elle dessinerait sinon, et les chiffres de l'entête sont retenus — un D+ de 0 m qui saute à 1 200 se lit plus mal qu'une absence de chiffre. Le spinner prend `--oep-area` : il porte donc la couleur du thème, ou celle de la trace en `color: 'auto'`.

Rien n'est signalé à l'utilisateur en cas d'échec : le remplissage est un supplément, pas un prérequis. L'événement `demload` permet à l'application de le savoir :

```js
profile.on('demload', (e) => console.log(e.ok, e.zoom, e.tiles));
```

### Une autre source

N'importe quel jeu de tuiles XYZ en encodage `terrarium` ou `mapbox` convient :

```js
new OlElevationProfile({
  dem: { url: 'https://example.org/mnt/{z}/{x}/{y}.png', encoding: 'mapbox', maxZoom: 13 }
})
```

`zoom` vaut `'auto'` par défaut : le niveau le plus fin dont le nombre de tuiles tient dans `maxTiles` (32). C'est le découpage qui s'élargit quand la trace s'allonge, non le modèle qui se dégrade — une trace de 10 km est lue au pas le plus fin disponible, une de 300 km à un pas plus grossier plutôt qu'en trois cents requêtes.

**L'attribution n'est pas automatique.** Le contrôle ne possède pas la carte. `OlElevationProfile.DEM_PRESETS.terrarium.attributions` porte la mention à reprendre dans votre propre source de fond de plan.

## Attributions

Quand le profil occupe le coin bas-droite (ou le bas en pleine largeur), les attributions OpenLayers sont automatiquement remontées **au-dessus** du profil, alignées à droite, avec un écart vertical égal à l'écart bord-de-carte ↔ bas-du-profil. Les autres placements ne touchent pas aux attributions.

## Temps

Si le tracé source porte une donnée temporelle — `coordTimes` (horodatages ISO, issus des `<time>` GPX), `coordinateProperties.times`, ou une 4ᵉ coordonnée `M` — deux éléments optionnels deviennent disponibles :

- ajoutez `'duration'` à `headerItems` pour afficher la **durée totale** dans la ligne de titre ;
- ajoutez `'time'` à `tooltipItems` pour afficher le **temps écoulé au point** survolé.

L'unité s'adapte à la valeur : `7 sec`, `26 min`, `1 h 48 min`, `2 j 3 h` (jours + heures). Par défaut le temps est le **temps en mouvement** : les segments à l'arrêt (vitesse sous `stopSpeed`, 0,5 m/s) sont exclus ; mettez `ignoreStops: false` pour le temps réel écoulé. Sous un recadrage A↔B, le temps est rebasé pour repartir de 0 à A. Utilisez `OlElevationProfile.featureHasTime(feature)` pour détecter si un tracé porte le temps.

```js
new OlElevationProfile({
  headerItems: ['distance', 'ascent', 'descent', 'minmax', 'duration'],
  tooltipItems: ['distance', 'elevation', 'time']
})
```
