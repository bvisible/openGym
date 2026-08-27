# openGym — fork Neoffice

Carnet d'entraînement PWA, servi par Frappe sous `/gym`. Ce dépôt est un **fork**,
pas un produit à nous : la moitié du travail consiste à rester mergeable.

## ⚠️ L'amont est sur GitLab, pas sur GitHub

| | |
|---|---|
| **Amont réel** | `https://gitlab.com/DuarteSantos8/opengym` — remote `upstream` |
| Miroir identique | `https://gitea.com/DuarteSantos/openGym` (même arbre, mêmes SHA) |
| Notre fork | `https://github.com/bvisible/openGym`, branche **`version-15`** (défaut) |
| ⛔ **Piège** | `github.com/arvids-unavailable/openGym` est une **copie sans historique** — aucun ancêtre commun, dernier commit « asd », figée. Et le dépôt que son README cite (`DuarteSantos8/openGym` sur GitHub) **n'existe plus**. Notre fork en est parti par erreur ; rebasé sur GitLab le 2026-08-24, 50 commits d'écart rattrapés. |

**Ne jamais repartir d'un dépôt GitHub pour cette app.** Le README amont dit
lui-même « Source on GitLab » et ses badges de pipeline pointent là.

```bash
git fetch upstream          # gitlab.com/DuarteSantos8/opengym
git log --oneline HEAD..upstream/main
```

## Ce que le fork change, et pourquoi

Tout est marqué **`//// Neoffice`** avec sa raison (règle projet). `grep -rn "//// Neoffice"`
donne la carte complète de la divergence. Les quatre familles :

| Famille | Fichiers | Raison |
|---|---|---|
| **Auth** | `lib/api.js`, suppression de `views/Login.jsx` et `views/Admin.jsx` | L'amont a son propre serveur Node avec annuaire maison, passkeys et cookie signé. Chez nous la **session Frappe EST l'authentification** : même origine, `/gym` renvoie déjà l'anonyme vers `/login`. |
| **Endpoints** | `lib/api.js` | `neoffice_gym.api.state.get/put` au lieu de l'API Node. En-tête CSRF ajouté, `{message:…}` déballé. |
| **Push** | `lib/push.js`, `store/useUI.js` | Pas de relais push : `frappe/push_notification` parle au relais Frappe Cloud, que nos instances n'ont pas. `pushSupported()` rend `false` — Settings masque alors toute la section, donc **aucun interrupteur qui ne fait rien**. Les notifications **locales** de l'amont (`maybeRestNotification`) sont conservées : elles couvrent le cas pour lequel le push existait. |
| **Build** | `vite.config.js`, `.gitignore`, `opengym/` | Coquille d'app Frappe (`hooks.py`, `www/gym_sw.js`), build **commité** dans `opengym/public/frontend` — la flotte ne recompile jamais une SPA sur une instance. |

### Ce qu'on ne touche PAS

- **`frontend/src/instr/fr.js`** — 7 710 consignes d'exercice, traduites et **vouvoyées**.
  L'amont ne le modifie jamais : à chaque merge, le prendre tel quel de notre côté.
- **Le plugin Umami** de `vite.config.js` — conservé tel quel. Il ne s'injecte que si
  `VITE_UMAMI_SRC` **et** `VITE_UMAMI_ID` sont posés, donc un build Neoffice reste sans télémétrie.
- **Les tests** — 346 sur 22 fichiers. Ils doivent passer avant tout push.

## Le média n'est pas dans le dépôt

`opengym/public/media/` est **gitignoré** (1 324 jpg + 1 324 gif, ~500 Mo). L'instance les
télécharge avec `scripts/fetch-media.sh`, comme le `docker compose up` de l'amont le fait.
Les fichiers sont nommés `<id>-<hash>.{jpg,gif}` et le dataset porte les deux noms.

⚠️ **La licence des visuels n'est pas celle du code.** Le code est AGPL-3.0 ; les images
viennent d'un jeu de données tiers dont la licence interdit la revente et la
redistribution. C'est la raison du `.gitignore`, pas la taille.

## Procédure de merge amont

Depuis le rebase du 2026-08-24, **les deux historiques ont un ancêtre commun** —
`git merge-base version-15 upstream/main` rend un vrai commit présent des deux
côtés. Un merge est donc devenu la bonne méthode, et la réapplication manuelle
n'a plus lieu d'être.

```bash
git fetch upstream                                   # gitlab.com/DuarteSantos8/opengym
git branch -f neoffice-pre-upstream-<date> version-15 && git push origin neoffice-pre-upstream-<date>
git merge upstream/main                              # ← oui, un merge
# résoudre : garder LEUR code, réappliquer NOS `//// Neoffice` par-dessus
npm --prefix frontend ci && npm --prefix frontend test && npm --prefix frontend run build
git add -A && git commit && git push origin version-15
```

**Toujours pousser la branche filet AVANT** (`neoffice-pre-upstream-<date>`).

> **Historique de cette section.** Elle a longtemps dit « ne PAS faire
> `git merge` : nos deux bases n'ont pas la même origine historique ». C'était
> exact **avant** le rebase du 2026-08-24, quand le fork était parti d'une copie
> GitHub sans historique. Le rebase a reconnecté les deux arbres ; le merge du
> 2026-08-27 (50 commits amont) a coûté **37 blocs de conflit sur 24 fichiers**,
> tous résolus. Vérifier avant d'agir :
> `git merge-base --is-ancestor $(git merge-base version-15 upstream/main) upstream/main`.

### Ce que la résolution demande, à chaque fois

- **`lib/api.js`** — 100 % à nous (session Frappe). Prendre NOTRE version, et
  ne réintégrer de l'amont que ce qui n'est pas de l'authentification.
- **`vite.config.js`, `.gitignore`, `opengym/`** — notre coquille Frappe :
  garder les nôtres, y ajouter leurs nouveautés.
- **`locales/*.js`** — leurs nouvelles chaînes + nos surcharges. Les deux, jamais
  l'un à la place de l'autre.
- **`instr/fr.js`** — NOTRE version, toujours (7 710 consignes vouvoyées).
- Partout ailleurs : **leur code**, avec nos `////` réappliqués par-dessus.

> L'amont a son propre `CLAUDE.md`, qui décrit SON projet (docker, api, mcp,
> website). Il est écrasé par celui-ci à chaque merge — le lire avec
> `git show upstream/main:CLAUDE.md` quand on a besoin de leur carte.

## Le service worker vit à la racine, pas sous /gym/

`opengym/www/gym_sw.js` est servi depuis `/gym_sw.js` et enregistré avec
`{scope: '/gym'}`. Trois tentatives ont échoué avant :

- `/assets/opengym/…` → la portée exclut la page.
- `/gym/sw.js` → la portée devient `/gym/`, qui **exclut `/gym` nu** ; forcer `/gym/` crée une boucle de redirection.

Et le cache doit être cloné **synchronement** : `res.clone()` appelé dans un `.then()` après
consommation du corps lève un `TypeError` silencieux et le cache reste vide.

## Le plugin métier est ailleurs

Ce dépôt est **public** (AGPL). Tout ce qui est notre savoir-faire — coachs, programmes,
prescriptions, abonnements, DocTypes — vit dans **`bvisible/neoffice_gym`**, privé.
Ce fork ne contient que le carnet et sa coquille Frappe.
