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

```bash
git fetch upstream
git checkout -b rebase-<date> upstream/main     # partir de LEUR code
# réappliquer nos modifications PAR-DESSUS, fichier par fichier :
#   - repartir de LEUR version quand le fichier a bougé (App.jsx, exercises.js, Workout.jsx…)
#   - garder LEURS ajouts (Umami, initBackButton, SECONDARY_ADDITIONS, notifications locales)
#   - ne recopier notre ancienne version que pour ce qui est 100 % à nous (api.js, push.js, opengym/)
npm --prefix frontend ci && npm --prefix frontend test && npm --prefix frontend run build
git branch -f version-15 rebase-<date> && git push --force-with-lease origin version-15
```

**Toujours pousser une branche filet avant** (`neoffice-pre-<amont>-rebase`).

> Ne PAS faire `git merge upstream/main` : nos deux bases n'ont pas la même origine
> historique, et un merge produit des conflits sur des fichiers qui n'ont rien en commun.
> On réapplique, on ne fusionne pas.

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
