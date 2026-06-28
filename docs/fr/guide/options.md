# Options

Toutes les options se passent au constructeur et la plupart se modifient à l'exécution via `setOptions(patch)`. Ci-dessous, chaque option est décrite avec **son rôle** et **sa valeur par défaut et sa signification**.

## Placement & taille

**`immersion`** — stratégie de placement du panneau. `'docked'` ancre le panneau à un bord de la carte ; `'floating'` est un panneau libre (partiel). Défaut : `'docked'`.

**`position`** — où le panneau est ancré : `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'`. Défaut : `'bottom'` (bande pleine largeur en bas).

**`width`** — largeur du panneau. Un nombre est en pixels, automatiquement plafonné à la largeur de la carte ; `'auto'`, `'100%'` ou `'full'` couvrent toute la largeur de la carte. Défaut : `520` (px).

**`height`** — hauteur du panneau en pixels. Défaut : `180`.

**`margins`** — marges internes du graphe, sous la forme `{ unit, top, right, bottom, left }`. `unit` vaut `'px'`, `'em'` ou `'rem'`. Défaut : `{ unit:'px', top:20, right:24, bottom:30, left:48 }` (plus de place à gauche pour l'axe d'altitude).

**`responsive`** — si `true`, la largeur et le placement s'adaptent à la taille de la carte, y compris le passage en mode mobile. Si `false`, les valeurs fixes sont conservées. Défaut : `true`.

**`mobileBreakpoint`** — largeur de carte (px) au-dessous de laquelle le mode mobile s'applique (100 % de largeur, placement forcé `top`/`bottom`). Défaut : `640`.

## Unités & données

**`units`** — système de mesure : `'meters'` (km / m) ou `'imperial'` (mi / ft). Défaut : `'meters'`.

**`dataProjection`** — projection des coordonnées du feature. `null` signifie « projection de la vue » ; sinon un code comme `'EPSG:4326'` ou un `ol/proj/Projection`. Défaut : `null`.

**`maxPoints`** — plafonne le nombre de points dessinés et utilisés pour l'interaction (la géométrie est décimée au-delà). Les statistiques utilisent toujours les données complètes. `0` désactive la décimation. Défaut : `2000`.

**`smoothing`** — lissage de l'altitude par moyenne glissante sur une distance en **mètres** (`0` = aucun). Étant métrique, il est indépendant de la densité de points GPS et adoucit le profil comme la pente. Défaut : `0`.

## Apparence

**`theme`** — thème de couleurs. Un nom intégré (`'steelblue'`, `'lime'`, `'purple'`, `'slate'`, `'graphite'`, `'amber'`) ou un objet de couleurs `{ area, line, axis, text, focus }`. Défaut : `'steelblue'`.

**`color`** — force la couleur du graphe. `null` garde le thème ; `'auto'` prend la couleur de la trace (nécessite `trackLayer`), remplit l'aire et assombrit la ligne ; une couleur CSS impose cette couleur. Défaut : `null`.

**`trackLayer`** — la couche vecteur dont le style fournit la couleur du trait quand `color: 'auto'`. Défaut : `null`.

**`transparency`** — transparence du fond. `false` = opaque ; `true` = utilise `transparencyLevel` ; un nombre `0..1` fixe directement l'alpha (`0` = totalement transparent). Défaut : `false`.

**`transparencyLevel`** — l'alpha appliqué quand `transparency === true` (`0..1`). Défaut : `0.45`.

**`grid`** — lignes de grille horizontales, dessinées avec la couleur des axes à faible opacité. Défaut : `true`.

**`xTicks`** — nombre de graduations de l'axe X ; `null` laisse la librairie choisir selon la largeur. Défaut : `null`.

**`yTicks`** — nombre de graduations de l'axe Y ; `null` laisse la librairie choisir selon la hauteur. Défaut : `null`.

## Pente

**`slope`** — si `true`, le profil est découpé en portions contiguës colorées par classe de pente. Défaut : `false`.

**`slopeClassSize`** — largeur d'une classe de pente, en **pourcent**. Défaut : `2.5`.

**`maxClasses`** — nombre maximal de classes (couleurs + légende). Les pentes plus fortes se replient dans la dernière classe, affichée `≥ X %`. Défaut : `8`.

**`slopeColors`** — `null` utilise la rampe intégrée bleu→rouge (cyan/vert, jaune pur au milieu). Sinon un tableau de couleurs CSS, interpolé sur les classes présentes. Défaut : `null`.

**`slopeSeparators`** — trace un séparateur vertical à chaque changement de classe. Défaut : `true`.

**`slopeLegend`** — affiche la légende des couleurs sous le titre. Défaut : `true`.

## Comportement

**`show`** — comment un tracé de la carte déclenche son profil : `'click'` ou `'mouseover'`. Défaut : `'click'`.

**`hideOnMapClick`** — un clic sur la carte vide masque tout le contrôle. Défaut : `true`.

**`followMap`** — déplacer le pointeur sur la carte déplace l'indicateur sur le graphe. Défaut : `true`.

**`marker`** — affiche l'indicateur de position (rond) sur la carte au fil du graphe. Défaut : `true`.

**`collapsable`** — affiche le bouton réduire/agrandir ; réduit, le contrôle se limite au titre + bouton. Défaut : `true`.

**`collapsed`** — état réduit initial. Défaut : `false`.

**`zoom`** — affiche les boutons de recadrage A/B, qui recadrent carte et profil sur un sous-intervalle (A remis à 0). Défaut : `false`.

**`ignoreStops`** — au calcul du temps, exclut les segments à l'arrêt pour que la durée soit le **temps en mouvement**. `false` donne le temps réel écoulé. Défaut : `true`.

**`stopSpeed`** — seuil de vitesse en **m/s** (≈ 1,8 km/h) sous lequel un segment compte comme un arrêt. Défaut : `0.5`.

## Contenu (entête, infobulle, titre)

**`tooltipItems`** — contenu de l'infobulle de survol, parmi `'distance'`, `'elevation'`, `'slope'`, `'time'` (temps écoulé au point, si le tracé porte le temps). Défaut : `['distance','elevation']`.

**`headerItems`** — contenu de la ligne d'entête. Jetons : `'distance'`, `'ascent'`, `'descent'`, `'min'`, `'max'`, `'minmax'`, `'duration'` (durée totale). Une entrée peut aussi être un objet tirant une propriété du feature : `{ property, label?, asLink?, linkText? }` (`asLink` rend une URL sous forme de lien). Défaut : `['distance','ascent','descent','minmax']`.

**`titleProperty`** — la propriété du feature utilisée comme titre. Défaut : `'name'`.

**`titleLink`** — une propriété contenant une URL ; si présente, le titre devient un lien cliquable. Défaut : `null`.

**`labels`** — tous les textes affichés, surchargeables individuellement. Clés et défauts : `distance` `'Distance'`, `elevation` `'Altitude'`, `slope` `'Pente'`, `ascent` `'D+'`, `descent` `'D-'`, `empty` `'Cliquez un tracé'` (titre par défaut), `time` `'Temps'`, `duration` `'Durée'`, `durationUnits` `{ s:'sec', m:'min', h:'h', d:'j' }` (abréviations d'unités), `zoomStart` `'Définir le début (A)'`, `zoomEnd` `'Définir la fin (B)'`, `zoomAll` `'Tout voir'`.

```js
// Exemple : libellés anglais
new OlElevationProfile({
  labels: {
    elevation: 'Elevation', slope: 'Slope', empty: 'Click a track',
    duration: 'Duration', durationUnits: { s: 'sec', m: 'min', h: 'h', d: 'd' },
    zoomStart: 'Set start (A)', zoomEnd: 'Set end (B)', zoomAll: 'Show all'
  }
})
```

## Constructeur complet (toutes les options)

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
    zoomStart: 'Définir le début (A)', zoomEnd: 'Définir la fin (B)', zoomAll: 'Tout voir'
  }
})
map.addControl(profile)
```

## Méthodes

**`setFeature(feature)`** — affiche le profil pour un feature OpenLayers (LineString/MultiLineString, idéalement 3D). Une valeur fausse masque le contrôle. Renvoie `this`.

```js
const f = new ol.format.GeoJSON().readFeatures(geojson, {
  featureProjection: map.getView().getProjection()
})[0]
profile.setFeature(f)
```

**`clear()`** — masque le profil et oublie le feature courant. Renvoie `this`.

```js
profile.clear()
```

**`setTheme(name | object)`** — change le thème de couleurs et redessine.

```js
profile.setTheme('amber')
profile.setTheme({ area: '#1f6fb2', line: '#0d3c61', axis: '#345', text: '#123', focus: '#e0532a' })
```

**`setColor(color | null)`** — change la couleur du graphe : une couleur CSS, `'auto'` (couleur de la trace), ou `null` pour revenir au thème.

```js
profile.setColor('#e0532a')
profile.setColor('auto')   // nécessite trackLayer
profile.setColor(null)     // retour au thème
```

**`setOptions(patch)`** — met à jour une ou plusieurs options à l'exécution et redessine. Renvoie `this`.

```js
profile.setOptions({ slope: true, smoothing: 60, tooltipItems: ['distance', 'elevation', 'slope', 'time'] })
```

**`toggleCollapsed(force?)`** — réduit ou agrandit. Passez `true`/`false` pour forcer un état.

```js
profile.toggleCollapsed()      // bascule
profile.toggleCollapsed(true)  // force réduit
```

**`getStats()`** — renvoie les statistiques courantes : `{ distance, duration, ascent, descent, min, max, maxAbsSlope, points }`. `duration` vaut `null` quand le tracé n'a pas de temps.

```js
const { distance, ascent, duration } = profile.getStats()
console.log(distance, ascent, duration)
```

### Membres statiques

**`OlElevationProfile.addTheme(name, colors)`** — enregistre un thème personnalisé utilisable par `theme`/`setTheme`.

```js
OlElevationProfile.addTheme('ocean', { area: '#0aa', line: '#066', axis: '#055', text: '#022', focus: '#f60' })
new OlElevationProfile({ theme: 'ocean' })
```

**`OlElevationProfile.featureHasZ(feature)`** — `true` si le feature a au moins une coordonnée Z (altitude).

```js
if (!OlElevationProfile.featureHasZ(f)) console.warn('Pas d\u2019altimétrie sur ce tracé')
```

**`OlElevationProfile.featureHasTime(feature)`** — `true` si le feature porte une donnée temporelle par point.

```js
if (OlElevationProfile.featureHasTime(f)) profile.setOptions({ headerItems: ['distance', 'duration'] })
```

**`OlElevationProfile.version`** — la chaîne de version de la librairie.

```js
console.log(OlElevationProfile.version)
```
