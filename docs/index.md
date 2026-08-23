---
layout: home
hero:
  name: ol-elevation-profile
  text: Elevation profiles for OpenLayers
  tagline: A synchronized, themeable elevation profile control rendered with d3 — reading elevation straight from your 3D GPX/GeoJSON, and from keyless terrain tiles when they carry none.
  image:
    src: /screenshot-profile.png
    alt: Elevation profile coloured by slope class
  actions:
    - theme: brand
      text: Getting started
      link: /guide/getting-started
    - theme: alt
      text: Live demo
      link: https://lc-4918.github.io/ol-elevation-profile/demo/
features:
  - title: Reads Z from the geometry
    details: Distance, ascent/descent and min/max come straight from your 3D track. A track without Z is filled from keyless terrain tiles, on by default.
  - title: Map ↔ chart sync
    details: Hover the map or the chart and a marker stays in sync on both.
  - title: Slope classes
    details: Colour the profile by gradient classes from blue (flat) to red (steep), with a legend.
  - title: Responsive & mobile
    details: Full-width docked bar on phones, eight anchors on desktop.
  - title: Zoom A↔B
    details: Crop both the map and the profile to a sub-range, with A reset to 0.
  - title: Themeable
    details: Six built-in themes, custom colours, transparency, and a track-colour mode.
---
