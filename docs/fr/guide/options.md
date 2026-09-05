# Options

Toutes les options se passent au constructeur et la plupart se modifient à l'exécution via `setOptions(patch)`. Ci-dessous, chaque option est décrite avec **son rôle** et **sa valeur par défaut et sa signification**.

## Placement & taille

**`immersion`** : stratégie de placement du panneau. `'docked'` ancre le panneau à un bord de la carte ; `'floating'` est un panneau libre (partiel). Défaut : `'docked'`.

**`position`** : où le panneau est ancré : `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'`. Défaut : `'bottom'` (bande pleine largeur en bas).

**`width`** : largeur du panneau. Un nombre est en pixels, automatiquement plafonné à la largeur de la carte ; `'auto'`, `'100%'` ou `'full'` couvrent toute la largeur de la carte. Défaut : `520` (px).

**`height`** : hauteur du panneau en pixels. Défaut : `180`.

**`margins`** : marges internes du graphe, sous la forme `{ unit, top, right, bottom, left }`. `unit` vaut `'px'`, `'em'` ou `'rem'`. Défaut : `{ unit:'px', top:20, right:24, bottom:30, left:48 }` (plus de place à gauche pour l'axe d'altitude).

**`responsive`** : si `true`, la largeur et le placement s'adaptent à la taille de la carte, y compris le passage en mode mobile. Si `false`, les valeurs fixes sont conservées. Défaut : `true`.

**`mobileBreakpoint`** : largeur de carte (px) au-dessous de laquelle le mode mobile s'applique (100 % de largeur, placement forcé `top`/`bottom`). Défaut : `640`.

## Unités & données

**`units`** : système de mesure : `'meters'` (km / m) ou `'imperial'` (mi / ft). Défaut : `'meters'`.

**`dataProjection`** : projection des coordonnées du feature. `null` signifie "projection de la vue" ; sinon un code comme `'EPSG:4326'` ou un `ol/proj/Projection`. Défaut : `null`.

**`maxPoints`** : plafonne le nombre de points dessinés et utilisés pour l'interaction (la géométrie est décimée au-delà). Les statistiques utilisent toujours les données complètes. `0` désactive la décimation. Défaut : `2000`.

**`dem`** : complète les altitudes manquantes depuis un modèle numérique de terrain quand le feature n'a pas de Z. Inerte sur un tracé qui porte déjà son Z : les altitudes présentes dans le fichier ne sont jamais écrasées. Défaut : `'terrarium'`. `null` le désactive et garde le contrôle entièrement hors réseau.

Raccourcis : `true` ou `'terrarium'` (AWS Terrain Tiles), `'ign'` (Géoplateforme IGN), ou une fonction `(lonlats, ctx) => number[] | Promise<number[]>`. Sinon un objet, dont les clés choisissent **une** source :

| Clé | Source |
|---|---|
| `source` | `'terrarium'` (défaut) ou `'ign'` |
| `url` | gabarit XYZ, `{z}` `{x}` `{y}` |
| `wms` | `{ url, layers, params, projection }` : tuiles WMS, un `GetMap` par tuile |
| `olSource` | n'importe quelle `ol/source/TileImage` (XYZ, TileWMS, ...) ou `ol/source/GeoTIFF` |
| `featureInfo` | `{ url, layers, queryLayers, property, resolution, params, projection }` : WMS GetFeatureInfo, une requête par point |
| `track` | `{ url, coords, parse, fetchOptions }` : un profil que votre application a calculé en amont et sert par trace |
| `sample` | `(lonlats, ctx) => number[] | Promise<number[]>` : vous les récupérez vous-même |

Clés communes, quelle que soit la source :

| Clé | Défaut | Sens |
|---|---|---|
| `encoding` | `'terrarium'` | `'terrarium'`, `'mapbox'`, ou `(r, g, b, a) => mètres`. Ignoré par `featureInfo`, `sample` et GeoTIFF, qui portent des valeurs et non des couleurs. Rendre `null` là où un pixel n'a pas de mesure. |
| `zoom` | `'auto'` | Zoom des tuiles, ou le niveau le plus fin tenant dans `maxTiles` |
| `maxZoom` | `14` | Plafond pour `zoom: 'auto'` |
| `maxTiles` | `32` | Budget de tuiles par tracé. C'est le découpage qui s'élargit quand la trace s'allonge, non le modèle qui se dégrade |
| `tileSize` | `256` | Côté d'une tuile, en pixels |
| `concurrency` | `6` | Tuiles, ou requêtes GetFeatureInfo, en vol simultanément |
| `band` | `0` | Bande lue dans un GeoTIFF multi-bandes |

Clés propres à une source :

| Clé | Source | Défaut | Sens |
|---|---|---|---|
| `apiKey` | `'ign'` | aucune | Ajoutée en paramètre de requête. **Inutile** sur le point d'accès public |
| `apiKeyParam` | `'ign'` | `'apikey'` | Nom de ce paramètre |
| `batch` | `'ign'` | `200` | Points par requête. Au-delà l'URL prend un 414 |
| `minInterval` | `'ign'` | `1100` | Millisecondes entre deux appels ; le service annonce 1 req/s |
| `resource` | `'ign'` | `'ign_rge_alti_wld'` | Couverture interrogée |
| `layers` | `wms`, `featureInfo` | - | Nom de la couche. Obligatoire |
| `queryLayers` | `featureInfo` | `layers` | Couches interrogées, si différentes des couches dessinées |
| `property` | `featureInfo` | premier nombre | Nom de la propriété de bande (`GRAY_INDEX` sur GeoServer). Obligatoire dès que la couche porte plus d'une bande |
| `resolution` | `featureInfo` | `1` | Demi-côté, en mètres, de la boîte autour du point |
| `params` | `wms`, `featureInfo` | - | Paramètres WMS supplémentaires, fusionnés par-dessus les défauts. Passer `VERSION` à 1.1.1 bascule seul `CRS` en `SRS` |
| `projection` | `wms`, `featureInfo` | `'EPSG:3857'` | Système de référence des requêtes |
| `url` | `track` | - | Gabarit lu sur l'entité, un `{propriete}` par emplacement, ou `(feature) => string`. Une propriété absente n'envoie aucune requête. Obligatoire |
| `coords` | `track` | `'coords'` | Propriété de la réponse JSON qui porte les données. Ignorée si la réponse est elle-même un tableau |
| `parse` | `track` | aucun | `(json, feature) => données`, pour reformer n'importe quelle réponse |
| `fetchOptions` | `track` | aucun | Transmis tel quel à `fetch` (identifiants, en-têtes...) |

Un remplissage est **tout ou rien** : un seul point non résolu l'abandonne, et le profil reste ce qu'il aurait été sans. L'événement `demload` en rend compte, `{ ok, zoom, tiles }`, avec `zoom: null` et `tiles: 0` pour une source non tuilée. Voir [Modèle de terrain](/fr/guide/fonctions#modele-de-terrain).

`track` est la seule source qui n'échantillonne pas un modèle aux points de la trace, et elle accepte deux formes de réponse, qui ne veulent pas dire la même chose. `[[lon, lat, z], …]` porte **sa propre géométrie** et remplace celle de l'entité : un profil décimé à l'ingestion est accepté tel quel. Les horodatages de l'entité sont alors abandonnés, puisqu'ils ne correspondent plus à rien. Un simple `[z, …]` garde l'ancien sens : une valeur par point de la géométrie, et la longueur doit correspondre exactement. Dans les deux cas l'entité de la carte n'est jamais modifiée.

**`smoothing`** : lissage de l'altitude. L'altitude de chaque point est remplacée par la moyenne des altitudes rencontrées sur **une demi-fenêtre de part et d'autre, le long du tracé**. La valeur est une distance en **mètres de tracé**, non un nombre de points : `smoothing: 100` moyenne sur 100 m que l'enregistrement porte un point par seconde ou un point tous les dix mètres. Défaut : `0` (altitudes brutes).

À quoi cela sert : une altitude enregistrée oscille de quelques mètres d'un point au suivant, baromètre ou satellites confondus. Dessinées telles quelles, ces oscillations transforment une route plate en ligne hérissée et chacune compte pour une montée suivie d'une descente, si bien que le **D+ enfle** : une sortie plate peut annoncer des centaines de mètres de dénivelé qu'elle n'a jamais eus. La pente en souffre pareillement, sautant d'une valeur absurde à l'autre sur quelques mètres.

Ce que cela coûte : le lissage abaisse le D+ et rabote les accidents réels les plus courts. Une fenêtre assez large pour effacer le bruit arrondit aussi un col : 200 m de tracé à travers un passage lui ôtent un mètre ou deux de sommet. Il n'y a pas de valeur neutre, seulement un compromis qu'on choisit en connaissance de cause.

Le lissage porte sur les **échantillons**, non sur le dessin : `getStats()`, le D+/D-, les min/max et les classes de pente le suivent tous. La géométrie sur la carte n'est pas touchée, seules les altitudes qu'on en lit le sont, et un remplissage depuis un MNT est lissé comme n'importe quelle autre source.

| Valeur | À quoi elle sert |
|---|---|
| `0` | Brut. Toute mesure conservée, bruit compris |
| `20`-`50` | Dompte le tremblement GPS ordinaire, laisse le relief où il est |
| `100`-`200` | Une silhouette lisible pour un long parcours, au prix des petits accidents |
| au-delà | On remodèle le terrain plutôt qu'on ne le lit |

```js
new OlElevationProfile({ smoothing: 60 })   // moyenne sur ±30 m de tracé
```

## Apparence

**`theme`** : thème de couleurs. Un nom intégré (`'steelblue'`, `'lime'`, `'purple'`, `'slate'`, `'graphite'`, `'amber'`) ou un objet de couleurs `{ area, line, axis, text, focus }`. Défaut : `'steelblue'`.

**`color`** : force la couleur du graphe. `null` garde le thème ; `'auto'` prend la couleur de la trace (nécessite `trackLayer`), remplit l'aire et assombrit la ligne ; une couleur CSS impose cette couleur. Défaut : `null`.

**`trackLayer`** : la couche vecteur dont le style fournit la couleur du trait quand `color: 'auto'`. Défaut : `null`.

**`transparency`** : transparence du fond. `false` = opaque ; `true` = utilise `transparencyLevel` ; un nombre `0..1` fixe directement l'alpha (`0` = totalement transparent). Défaut : `false`.

**`transparencyLevel`** : l'alpha appliqué quand `transparency === true` (`0..1`). Défaut : `0.45`.

**`grid`** : lignes de grille horizontales, dessinées avec la couleur des axes à faible opacité. Défaut : `true`.

**`xTicks`** : nombre de graduations de l'axe X ; `null` laisse la librairie choisir selon la largeur. Défaut : `null`.

**`yTicks`** : nombre de graduations de l'axe Y ; `null` laisse la librairie choisir selon la hauteur. Défaut : `null`.

**`verticalScale`** : en `'auto'`, le profil remplit la hauteur. C'est lisible, mais l'échelle change d'une trace à l'autre, si bien qu'une pente de 2 % y prend l'allure d'un mur et que deux profils ne se comparent pas. Un **nombre** fixe les mètres couverts par centimètre physique, mesuré à l'écran plutôt que déduit des 96 ppp nominaux, ce qui suit le zoom du navigateur. **`{ exaggeration: n }`** fixe au contraire le rapport entre l'échelle verticale et l'horizontale, le contrôle en déduisant les mètres par centimètre trace par trace. Défaut : `'auto'`.

Un nombre rend les **amplitudes** comparables, pas les pentes. L'axe horizontal s'étire toujours sur toute la trace, si bien qu'une même pente de 5 % est dessinée trois fois plus raide sur une boucle de 3 km que sur une traversée de 30. `{ exaggeration }` fixe au contraire le rapport entre les deux axes, et ce sont les **pentes** qui deviennent comparables : la pente lue sur le graphe est la pente réelle, multipliée par le même facteur d'une trace à l'autre. Le contrôle recalcule les mètres par centimètre pour chaque trace, et de nouveau pour chaque recadrage A/B, à partir de la distance réellement affichée et de la largeur du graphe une fois les marges retirées — ce qui explique qu'on ne puisse pas le faire depuis l'extérieur.

L'une comme l'autre forme est un **plancher, non un carcan** : une trace dont l'amplitude dépasse ce que la hauteur peut montrer déborderait du cadre, ce qui est pire que de perdre la comparabilité. L'échelle s'élargit alors pour la contenir, sans rien en dire : aucune mention n'est portée sur le graphe, l'échelle étant une propriété de l'affichage et non de la trace. La valeur réellement appliquée est relisible dans `_vScale`, nul en `'auto'` qui ne demande aucune échelle absolue. Le rapport réellement obtenu est relisible dans `_vExaggeration`, dans **tous** les modes : inférieur à celui demandé dès que le plancher a joué, et dérivant d'une trace à l'autre en `'auto'` — ce qui est précisément la raison pour laquelle `'auto'` ne rend deux profils comparables en rien.

```js
new OlElevationProfile({ verticalScale: 50 })                  // 50 m par centimètre
new OlElevationProfile({ verticalScale: { exaggeration: 6 } }) // vertical dilaté 6 fois
```

Posée à la construction, une exagération n'appelle rien d'autre : voir [Pentes comparables](/fr/exemples#pentes-comparables-un-rapport-tenu-une-echelle-recalculee-a-chaque-trace) pour ce qu'elle produit trace par trace, et pour le choix du facteur.

## Pente

**`slope`** : si `true`, le profil est découpé en portions contiguës colorées par classe de pente. Défaut : `false`.

**`slopeClassSize`** : largeur d'une classe de pente, en **pourcent**. Défaut : `2.5`.

**`maxClasses`** : nombre maximal de classes (couleurs + légende). Les pentes plus fortes se replient dans la dernière classe, affichée `≥ X %`. Défaut : `8`.

**`slopeColors`** : `null` utilise la rampe intégrée du bleu au rouge (cyan/vert, jaune pur au milieu). Sinon un tableau de couleurs CSS, interpolé sur les classes présentes. Défaut : `null`.

**`slopeSeparators`** : trace un séparateur vertical à chaque changement de classe. Défaut : `true`.

**`slopeLegend`** : affiche la légende des couleurs sous le titre. Défaut : `true`.

## Comportement

**`show`** : comment un tracé de la carte déclenche son profil : `'click'` ou `'mouseover'`. Défaut : `'click'`.

**`hideOnMapClick`** : un clic sur la carte vide masque tout le contrôle. Défaut : `true`.

**`showWithoutElevation`** : que faire d'une trace qui se retrouve sans aucune altitude — ni dans sa géométrie, ni par le modèle de terrain, parce que `dem` vaut `null` ou parce que le remplissage a échoué. `true` affiche le panneau avec le titre de la trace, ce que la géométrie seule sait encore en dire (sa longueur), et le message `noElevation` à la place du graphe. `false` masque purement le panneau. Défaut : `true`.

Dans les deux cas **aucun graphe n'est dessiné**. Les points sans Z comptent pour zéro, si bien que la ligne s'aplatirait au niveau de la mer sous un `D+ 0 m` — non pas un chiffre manquant mais un chiffre faux, et c'est la raison même pour laquelle un remplissage par MNT est tout ou rien.

```js
new OlElevationProfile({ dem: null, showWithoutElevation: false })  // muet plutôt
```

**`followMap`** : déplacer le pointeur sur la carte déplace l'indicateur sur le graphe. Défaut : `true`.

**`marker`** : affiche l'indicateur de position (rond) sur la carte au fil du graphe. Défaut : `true`.

**`collapsable`** : affiche le bouton réduire/agrandir ; réduit, le contrôle se limite au titre + bouton. Défaut : `true`.

**`collapsed`** : état réduit initial. Défaut : `false`.

**`exportPng`** : ajoute un bouton dans la barre d'outils, à droite des boutons de zoom, qui enregistre tout le panneau en PNG : titre, statistiques, légende et graphique. Défaut : `false`. Voir [Export PNG](/fr/guide/fonctions#export-png) et la méthode `exportPNG()`.

**`zoom`** : affiche les boutons de recadrage A/B, qui recadrent carte et profil sur un sous-intervalle (A remis à 0). Défaut : `false`.

Poser une borne **arme l'autre** : clic sur A, clic sur le profil, clic de nouveau sur le profil, la seconde borne n'exige aucun retour par la barre d'outils. L'un ou l'autre bouton peut ouvrir la paire, et l'ordre dans lequel A et B sont posés est indifférent.

**`zoomLevels`** : nombre de recadrages **imbriqués** autorisés : un recadrage peut être recadré à son tour, jusqu'à cette profondeur. `1` rend le niveau unique, comportement d'avant cette option. Défaut : `3`.

Un bouton **retour** paraît à partir du deuxième niveau et défait un recadrage ; **tout voir** vide la pile quelle que soit la profondeur. Dézoomer la carte au-delà de l'emprise d'un niveau ne quitte que ce niveau, au lieu de lâcher toute la pile. Les bornes sont gardées en abscisse de la trace **entière**, jamais dans le repère du niveau où elles ont été posées : l'imbrication n'introduit donc aucune dérive.

**`ignoreStops`** : au calcul du temps, exclut les segments à l'arrêt pour que la durée soit le **temps en mouvement**. `false` donne le temps réel écoulé. Défaut : `true`.

**`stopSpeed`** : seuil de vitesse en **m/s** (≈ 1,8 km/h) sous lequel un segment compte comme un arrêt. Défaut : `0.5`.

## Contenu (entête, infobulle, titre)

**`tooltipItems`** : contenu de l'infobulle de survol, parmi `'distance'`, `'elevation'`, `'slope'`, `'time'` (temps écoulé au point, si le tracé porte le temps). Défaut : `['distance','elevation']`.

**`headerItems`** : contenu de la ligne d'entête. Jetons : `'distance'`, `'ascent'`, `'descent'`, `'min'`, `'max'`, `'minmax'`, `'duration'` (durée totale). Une entrée peut aussi être un objet tirant une propriété du feature : `{ property, label?, asLink?, linkText? }` (`asLink` rend une URL sous forme de lien). Défaut : `['distance','ascent','descent','minmax']`.

**`titleProperty`** : la propriété du feature utilisée comme titre, ou une **liste** de propriétés essayées dans l'ordre — la première qui porte une valeur gagne, une valeur vide étant enjambée. Un feature qui ne répond à aucune retombe sur le libellé `untitled`, traduit. Défaut : `'name'`.

**`titleLink`** : une propriété contenant une URL — le titre devient alors un lien cliquable — ou une **liste** de propriétés essayées dans l'ordre. Seule une valeur qui est réellement une URL compte : une propriété qui porte autre chose est enjambée plutôt que rendue en lien mort. Défaut : `null`, qui ne met jamais de lien — on ne demande pas à un jeu de données d'expliquer que sa colonne `url` n'est pas celle qu'on montre au lecteur.

```js
new OlElevationProfile({ titleProperty: ['parcours', 'name'], titleLink: 'fiche' })
new OlElevationProfile({ titleLink: ['link', 'url'] })     // selon ce que porte le jeu
```

**`lang`** : langue des libellés livrés : `'en'` (défaut), `'fr'`, `'es'`. Un code inconnu retombe sur l'anglais plutôt que de laisser des clés vides. Chaque jeu est complet : une traduction à trous ferait cohabiter deux langues dans le même panneau.

::: warning Depuis la 1.x
Les libellés étaient français, sans moyen d'en demander d'autres. L'anglais est désormais le défaut, ajoutez `lang: 'fr'` pour retrouver le panneau tel qu'il était.
:::

```js
new OlElevationProfile({ lang: 'fr' })
profile.setOptions({ lang: 'es' })     // bascule tous les libellés, boutons compris
```

**`labels`** : surcharges clé à clé, appliquées **par-dessus** `lang`, pour une formulation qu'on préfère choisir soi-même ou une langue non livrée. Seules les clés passées changent. Elles **survivent à un changement de langue** : une clé corrigée le reste, le reste suit le nouveau jeu. Défaut : `{}`.

Les clés, avec leurs valeurs françaises (`lang: 'fr'`) : `distance` `'Distance'`, `elevation` `'Altitude'`, `slope` `'Pente'`, `ascent` `'D+'`, `descent` `'D-'` (notation des cartes, identique dans toutes les langues), `empty` `'Cliquez un tracé'` (titre par défaut), `untitled` `'Profil'` (titre d'un feature sans propriété de nom), `noElevation` `'Aucune altimétrie'` (affiché à la place du graphe, voir `showWithoutElevation`), `time` `'Temps'`, `duration` `'Durée'`, `durationUnits` `{ s:'sec', m:'min', h:'h', d:'j' }` (abréviations d'unités), `zoomStart` `'Définir le début (A)'`, `zoomEnd` `'Définir la fin (B)'`, `zoomAll` `'Tout voir'`, `zoomBack` `'Revenir au niveau précédent'` (retour d'un niveau imbriqué), `exportPng` `'Exporter en PNG'` (bouton d'export), `collapse` `'Réduire le profil'` et `expand` `'Agrandir le profil'` (le bouton de repli, selon ce que le clic fera), `loading` `'Chargement du profil altimétrique'` (nom accessible du spinner de chargement du MNT).

```js
// L'italien, par exemple : une langue non livrée
new OlElevationProfile({
  labels: {
    elevation: 'Altitudine', slope: 'Pendenza', empty: 'Clicca un percorso',
    duration: 'Durata', durationUnits: { s: 'sec', m: 'min', h: 'h', d: 'g' },
    zoomStart: 'Imposta inizio (A)', zoomEnd: 'Imposta fine (B)', zoomAll: 'Mostra tutto',
    zoomBack: 'Torna al livello precedente',
    exportPng: 'Esporta in PNG',
    collapse: 'Riduci il profilo', expand: 'Espandi il profilo',
    loading: 'Caricamento del profilo altimetrico'
  }
})

// Ou un seul mot par-dessus une langue livrée
new OlElevationProfile({ lang: 'fr', labels: { empty: 'Choisissez un itinéraire' } })
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
  dem: 'terrarium',                 // MNT complétant un tracé sans Z ; null = désactivé
                                    //   'terrarium' | 'ign' | (lonlats) => number[]
                                    //   | { url: '.../{z}/{x}/{y}.png', encoding: 'terrarium' }
                                    //   | { wms: { url, layers } }
                                    //   | { olSource }        // TileImage ou GeoTIFF
                                    //   | { featureInfo: { url, layers, property } }
                                    //   | { track: { url: '/profils/{id}.json' } }
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
  showWithoutElevation: true,        // aucun Z par aucune voie : panneau + message, ou masqué
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

## Méthodes

**`setFeature(feature)`** : affiche le profil pour un feature OpenLayers (feature 2D ou 3D) : `LineString`, `MultiLineString`, ou un `Polygon` / `MultiPolygon`, parcouru le long de son **anneau extérieur** (les trous sont ignorés ; le profil revient à son point de départ, donc le D+ égale le D-, voir [Types de géométrie](/fr/guide/fonctions#types-de-geometrie)). Une valeur fausse masque le contrôle. Renvoie `this`.

```js
const f = new ol.format.GeoJSON().readFeatures(geojson, {
  featureProjection: map.getView().getProjection()
})[0]
profile.setFeature(f)
```

**`clear()`** : masque le profil et oublie le feature courant. Renvoie `this`.

```js
profile.clear()
```

**`setTheme(name | object)`** : change le thème de couleurs et redessine.

```js
profile.setTheme('amber')
profile.setTheme({ area: '#1f6fb2', line: '#0d3c61', axis: '#345', text: '#123', focus: '#e0532a' })
```

**`setColor(color | null)`** : change la couleur du graphe : une couleur CSS, `'auto'` (couleur de la trace), ou `null` pour revenir au thème.

```js
profile.setColor('#e0532a')
profile.setColor('auto')   // nécessite trackLayer
profile.setColor(null)     // retour au thème
```

**`setOptions(patch)`** : met à jour une ou plusieurs options à l'exécution et redessine. Renvoie `this`.

```js
profile.setOptions({ slope: true, smoothing: 60, tooltipItems: ['distance', 'elevation', 'slope', 'time'] })
```

**`toggleCollapsed(force?)`** : réduit ou agrandit. Passez `true`/`false` pour forcer un état.

```js
profile.toggleCollapsed()      // bascule
profile.toggleCollapsed(true)  // force réduit
```

**`exportPNG(opts)`** : exporte le panneau en PNG et résout avec le `Blob`. `opts.scale` vaut par défaut le rapport de pixels de l'écran, `opts.filename` le titre du tracé, et `opts.download: false` rend le Blob sans enregistrer de fichier. Fonctionne que `exportPng` affiche le bouton ou non. Rejette s'il n'y a aucun profil dessiné.

**`getStats()`** : renvoie les statistiques courantes : `{ distance, duration, ascent, descent, min, max, maxAbsSlope, points }`. `duration` vaut `null` quand le tracé n'a pas de temps.

```js
const { distance, ascent, duration } = profile.getStats()
console.log(distance, ascent, duration)
```

### Membres statiques

**`OlElevationProfile.addTheme(name, colors)`** : enregistre un thème personnalisé utilisable par `theme`/`setTheme`.

```js
OlElevationProfile.addTheme('ocean', { area: '#0aa', line: '#066', axis: '#055', text: '#022', focus: '#f60' })
new OlElevationProfile({ theme: 'ocean' })
```

**`OlElevationProfile.featureHasZ(feature)`** : `true` si le feature a au moins une coordonnée Z (altitude).

```js
if (!OlElevationProfile.featureHasZ(f)) console.warn('Pas d\u2019altimétrie sur ce tracé')
```

**`OlElevationProfile.featureHasTime(feature)`** : `true` si le feature porte une donnée temporelle par point.

```js
if (OlElevationProfile.featureHasTime(f)) profile.setOptions({ headerItems: ['distance', 'duration'] })
```

**`OlElevationProfile.version`** : la chaîne de version de la librairie.

```js
console.log(OlElevationProfile.version)
```
