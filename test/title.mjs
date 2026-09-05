// The title and its link: which feature property each one reads.
//
// Both accept a single property name or a list tried in order, and the link's default is
// the pair every dataset seems to use - `link`, then `url`. A property holding something
// that is not a URL is stepped over: a dead link is worse than a plain title.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.Image = dom.window.Image;

const { fromLonLat } = await import('ol/proj.js');
const { default: Profile } = await import('../src/ol-elevation-profile.js');

let ok = true;
const check = (n, c) => { console.log((c ? 'OK  ' : 'NOK ') + n); if (!c) ok = false; };

const geom = {
  getType: () => 'LineString',
  getCoordinates: () => [[6.0, 45.0], [6.05, 45.02]].map((ll) => [...fromLonLat(ll), 600]),
  getClosestPoint: () => [0, 0], getExtent: () => [0, 0, 1, 1]
};
const titre = (opts, props) => {
  const p = new Profile(Object.assign({ dem: null }, opts));
  p.setFeature({ getGeometry: () => geom, get: (k) => props[k],
                 getProperties: () => props, getStyle: () => null });
  const el = p.element.querySelector('.oep-title');
  const a = el.querySelector('a');
  return { texte: el.textContent, href: a ? a.getAttribute('href') : null };
};

const URL1 = 'https://example.org/a', URL2 = 'https://example.org/b';

// ---- the title ------------------------------------------------------------
check('title: `name` by default', titre({}, { name: 'Col du Galibier' }).texte === 'Col du Galibier');
check('title: another property on request',
  titre({ titleProperty: 'parcours' }, { parcours: 'Boucle des lacs' }).texte === 'Boucle des lacs');
check('title: a list is tried in order',
  titre({ titleProperty: ['parcours', 'name'] }, { name: 'Col' }).texte === 'Col');
check('title: the first one holding a value wins',
  titre({ titleProperty: ['parcours', 'name'] }, { parcours: 'Boucle', name: 'Col' }).texte === 'Boucle');
check('title: an empty value is stepped over',
  titre({ titleProperty: ['parcours', 'name'] }, { parcours: '', name: 'Col' }).texte === 'Col');
check('title: no property at all falls back on the label',
  titre({ lang: 'fr' }, {}).texte === 'Profil');
check('title: that fallback is localised',
  titre({ lang: 'es' }, {}).texte === 'Perfil');

// ---- the link -------------------------------------------------------------
check('link: no link by default, whatever the feature carries',
  titre({}, { name: 'x', link: URL1, url: URL2 }).href === null);
check('link: a named property links',
  titre({ titleLink: 'fiche' }, { name: 'x', fiche: URL1 }).href === URL1);
check('link: a list is tried in order',
  titre({ titleLink: ['link', 'url'] }, { name: 'x', link: URL1, url: URL2 }).href === URL1);
check('link: a non-URL value is stepped over, not linked',
  titre({ titleLink: ['link', 'url'] }, { name: 'x', link: 'see the club website', url: URL2 }).href === URL2);
check('link: nothing linkable leaves a plain title',
  titre({ titleLink: ['link', 'url'] }, { name: 'x', link: 'n/a' }).href === null);
check('link: null never links', titre({ titleLink: null }, { name: 'x', url: URL1 }).href === null);
check('link: the title text is unchanged by the link',
  titre({ titleLink: 'url' }, { name: 'Col', url: URL1 }).texte === 'Col');

console.log(ok ? '\n>>> ALL TITLE TESTS PASS' : '\n>>> FAILURES');
process.exit(ok ? 0 : 1);
