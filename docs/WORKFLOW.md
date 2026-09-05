# Workflow CI/CD : ol-elevation-profile

Ce document explique comment la bibliothèque est vérifiée, publiée sur
[npmjs](https://www.npmjs.com/package/ol-elevation-profile) et distribuée en GitHub Release.

## 1. Vue d'ensemble

Deux workflows cohabitent dans [`.github/workflows/`](../.github/workflows/) :

| Fichier | Déclencheur | Effet |
|---|---|---|
| [`build-release.yml`](../.github/workflows/build-release.yml) | tout `push` | build de vérification, ou publication si c'est un tag |
| [`deploy.yml`](../.github/workflows/deploy.yml) | `push` sur `main` | site VitePress + démo sur GitHub Pages |

`build-release.yml` a deux comportements distincts selon ce qui est poussé :

- **Un push sur une branche** : `npm test` + `npm run build`, le `dist/` produit reste
  disponible en **artifact** de l'exécution.
- **Un push d'un tag `vX.Y.Z`** : publication du paquet sur **npmjs** (avec provenance),
  puis création d'une **GitHub Release** portant le tarball publié et les bundles.

npmjs reste le canal principal : c'est lui qu'interrogent `npm install`, unpkg et jsDelivr.
La GitHub Release en est le double : elle fige le tarball exact qui a été publié et donne
les notes de version.

## 2. Workflow Build

**Déclenchement :** tout `git push` sur une branche (`refs/heads/**`).

**Ce qu'il fait :**
1. Checkout du code.
2. Setup Node.js 24, cache npm.
3. `npm ci` : installation stricte depuis `package-lock.json`.
4. `npm run build` : rollup produit ESM + UMD + minifié, puis la CSS est copiée.
5. `npm test` : le smoke test jsdom de [`test/smoke.cjs`](../test/smoke.cjs).
6. Upload de `dist/` comme **artifact** de l'exécution.

L'ordre build puis test n'est pas interchangeable : le smoke test charge le bundle produit
dans `dist/`, pas les sources.

**Où trouver le build :** onglet **Actions**, l'exécution du commit, section **Artifacts**,
`ol-elevation-profile-dist-<sha>.zip`.

**Utilité :** vérifier qu'une branche compile et passe les tests avant de la merger, et
récupérer un bundle utilisable sans publier de version.

## 3. Workflow Release

**Déclenchement :** push d'un tag Git au format `vX.Y.Z` (ex. `v0.7.0`).

**Prérequis :** dans **Settings > Secrets and variables > Actions** du dépôt :

| Secret | Contenu | Obligatoire |
|---|---|---|
| `NPM_TOKEN` | jeton npmjs de type **Automation** (contourne la 2FA) | oui |
| `RELEASE_PAT` | PAT fin, portée `Contents: read and write` sur ce dépôt | non |

`RELEASE_PAT` ne sert qu'à l'affichage : sans lui, la Release est créée par
`github-actions[bot]`, qui apparaît alors comme auteur. L'auteur d'une release ne peut pas
être changé après coup (l'API ne l'expose pas en écriture), il faut donc le fixer à la
création.

Un jeton **Automation** est nécessaire pour `NPM_TOKEN` : un jeton *Publish* classique
déclenche la 2FA, que la CI ne peut pas satisfaire.

**Processus complet :**
1. Checkout complet (`fetch-depth: 0`) au commit du tag.
2. Setup Node.js 24 avec `registry-url` npmjs : c'est cette option qui écrit le `.npmrc`
   d'authentification que `npm publish` lira.
3. **Vérification du contrat de version** (voir [section 5](#5-le-contrat-de-version)).
4. `npm ci`, `npm run build`, `npm test`.
5. `npm pack` : le tarball exact destiné à npmjs, mis de côté.
6. `npm publish --provenance` sur npmjs.
7. Création de la **GitHub Release** portant le nom du tag, avec notes générées
   automatiquement, le tarball et les quatre fichiers de `dist/` en pièces jointes.

**L'ordre compte :** npm d'abord, la Release ensuite. Si la publication échoue, aucune
Release ne vient annoncer une version absente du registre.

**Où trouver le résultat :** la page
[npmjs du paquet](https://www.npmjs.com/package/ol-elevation-profile) et la page
**Releases** du dépôt.

## 4. Comment publier une version

1. Préparer le code : commits finaux mergés sur `main`, build vert sur la branche.
2. Bumper la version : `npm version` écrit `package.json`, `package-lock.json`, crée le
   commit **et** le tag `vX.Y.Z` d'un coup :
   ```bash
   npm version minor        # ou patch / major / 0.7.0
   ```
3. Pousser le commit **puis** le tag :
   ```bash
   git push
   git push origin v0.7.0
   ```
4. Le workflow se déclenche (job **Publish to npm & create GitHub Release**).
5. Suivre l'exécution dans l'onglet **Actions** jusqu'à completion.
6. Vérifier que `npm view ol-elevation-profile version` renvoie bien la nouvelle version.

Pousser le commit avant le tag n'est pas cosmétique : si le tag arrive seul, le job tourne
sur un commit que `main` ne contient pas encore, et les notes de version référencent un
historique incomplet.

## 5. Le contrat de version

**npm publie ce que dit `package.json`, pas ce que dit le tag.** Les deux doivent rester
d'accord, et l'étape *Check version contract* le vérifie avant tout travail :

| Vérification | Ce qu'elle empêche |
|---|---|
| `package.json` == tag sans le `v` | taguer `v0.7.0` en oubliant le bump republierait 0.6.0 |
| la version n'est pas déjà sur npmjs | un `403 Forbidden` illisible trois minutes plus tard |

La seconde vérification mérite une insistance : **une version publiée sur npm est
définitive.** `npm unpublish` n'est autorisé que dans les 72 heures et interdit ensuite de
réutiliser ce numéro. Il n'y a pas de reprise possible : la seule sortie est de passer à la
version suivante.

Si l'étape échoue, rien n'a été publié : corriger `package.json`, supprimer le tag fautif
(`git tag -d v0.7.0 && git push origin :v0.7.0`) et recommencer.

## 6. Provenance npm

`npm publish --provenance` signe le paquet via l'OIDC de l'exécution, d'où la permission
`id-token: write` sur le job. npmjs affiche alors le badge **"Built and signed on GitHub
Actions"** et publie une attestation Sigstore liant le tarball à ce dépôt et à ce commit.

Conséquences pratiques :

- Le champ `repository.url` de `package.json` doit désigner ce dépôt, sinon npm refuse
  l'attestation.
- La publication n'est vérifiable que **depuis la CI**. Un `npm publish` manuel depuis un
  poste produit un paquet valide mais sans provenance : la chaîne de badges se troue sur
  cette version. C'est une raison de plus de ne jamais publier à la main.

## 7. Le site et la démo

`deploy.yml` est indépendant du cycle de release : il se déclenche à chaque push sur `main`
et republie le site VitePress, la démo et une copie de `dist/` sur GitHub Pages. Une
correction de documentation est donc en ligne sans qu'il faille taguer quoi que ce soit ;
et, symétriquement, une release ne rafraîchit le site que si elle s'accompagne d'un commit
sur `main` (ce que fait `npm version`).

Ce document est exclu du site public via `srcExclude` dans
[`docs/.vitepress/config.mjs`](.vitepress/config.mjs) : il s'adresse au mainteneur, pas aux
utilisateurs de la bibliothèque.

## 8. Bonnes pratiques

- **Versioning** : respecter `vMAJOR.MINOR.PATCH`
  ([Semantic Versioning](https://semver.org/lang/fr/)). Les `peerDependencies` `ol` et `d3`
  rendent les breaking changes visibles : un changement d'API publique est un `major`.
- **Toujours passer par `npm version`** plutôt que d'éditer `package.json` à la main :
  le tag et le fichier ne peuvent alors pas diverger.
- **Tester avant de tagger** : s'assurer que le build de branche est vert.
- **Changelog** : les notes générées listent les commits ; garder des messages clairs
  facilite leur lecture.
- **Ne jamais publier à la main** : `npm publish` depuis un poste court-circuite les tests,
  la provenance et la Release GitHub.
- **Secrets** : `NPM_TOKEN` et `RELEASE_PAT` ne vivent que dans les secrets GitHub, jamais
  dans le dépôt ni dans un `.npmrc` commité.
