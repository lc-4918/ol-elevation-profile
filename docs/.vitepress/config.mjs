import { defineConfig } from 'vitepress'

const DEMO = 'https://lc-4918.github.io/ol-elevation-profile/demo/'

export default defineConfig({
  base: '/ol-elevation-profile/',
  title: 'ol-elevation-profile',
  description: 'Synchronized elevation profile control for OpenLayers, rendered with d3.',
  cleanUrls: true,
  // Doc de maintenance, pas une page du site public.
  srcExclude: ['WORKFLOW.md'],
  lastUpdated: true,
  themeConfig: {
    socialLinks: [{ icon: 'github', link: 'https://github.com/lc-4918/ol-elevation-profile' }],
    search: { provider: 'local' }
  },
  locales: {
    root: {
      label: 'English', lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/getting-started' },
          { text: 'Options', link: '/guide/options' },
          { text: 'Examples', link: '/examples' },
          { text: 'Demo', link: DEMO }
        ],
        sidebar: [
          { text: 'Guide', items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Options', link: '/guide/options' },
            { text: 'Slope, terrain, export & attributions', link: '/guide/features' }
          ]},
          { text: 'Examples', link: '/examples' }
        ]
      }
    },
    fr: {
      label: 'Français', lang: 'fr', link: '/fr/',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/fr/guide/getting-started' },
          { text: 'Options', link: '/fr/guide/options' },
          { text: 'Exemples', link: '/fr/exemples' },
          { text: 'Démo', link: DEMO }
        ],
        sidebar: [
          { text: 'Guide', items: [
            { text: 'Démarrage', link: '/fr/guide/getting-started' },
            { text: 'Options', link: '/fr/guide/options' },
            { text: 'Pente, terrain, export & attributions', link: '/fr/guide/fonctions' }
          ]},
          { text: 'Exemples', link: '/fr/exemples' }
        ]
      }
    }
  }
})
