# Pente, lissage & attributions

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
