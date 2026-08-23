---
layout: home
hero:
  name: ol-elevation-profile
  text: Profils altimétriques pour OpenLayers
  tagline: Un contrôle de profil altimétrique synchronisé et thématisable, rendu avec d3, qui lit l'altitude directement dans vos GPX/GeoJSON 3D — et dans des tuiles de terrain sans clé quand ils n'en portent pas.
  image:
    src: /screenshot-profile.png
    alt: Profil altimétrique coloré par classe de pente
  actions:
    - theme: brand
      text: Démarrage
      link: /fr/guide/demarrage
    - theme: alt
      text: Démo en ligne
      link: https://lc-4918.github.io/ol-elevation-profile/demo/
features:
  - title: Lit le Z dans la géométrie
    details: Distance, D+/D- et min/max calculés directement depuis votre tracé 3D. Un tracé sans Z se complète depuis des tuiles de terrain sans clé, actif par défaut.
  - title: Synchro carte ↔ profil
    details: Survolez la carte ou le profil, un indicateur reste synchronisé sur les deux.
  - title: Classes de pente
    details: Coloration du profil par classes de pente, du bleu (plat) au rouge (raide), avec légende.
  - title: Responsive & mobile
    details: Barre pleine largeur sur mobile, huit ancrages sur desktop.
  - title: Zoom A↔B
    details: Recadre la carte et le profil sur un sous-intervalle, A remis à 0.
  - title: Thématisable
    details: Six thèmes intégrés, couleurs personnalisées, transparence, couleur de la trace.
---
