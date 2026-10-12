# openGym — fork Neoffice

Carnet d'entraînement PWA, servi par Frappe sous `/gym`. Ce dépôt est un **fork**,
pas un produit à nous : la moitié du travail consiste à rester mergeable.

## L'amont : `github.com/DuarteSantos8/openGym`

| | |
|---|---|
| **Amont réel** | `https://github.com/DuarteSantos8/openGym` — remote `upstream`. Depuis 2026 c'est la maison du projet : son `CLAUDE.md` le dit, et `.github/workflows/mirror.yml` pousse `main` et les étiquettes `v*` vers GitLab. |
| Miroir | `https://gitlab.com/DuarteSantos8/opengym` (avance rapide seulement, produit l'APK et les images) |
| Notre fork | `https://github.com/bvisible/openGym`, branche **`version-15`** (défaut), **la seule** |
| ⛔ **Piège** | `github.com/arvids-unavailable/openGym` est une **copie sans historique** — aucun ancêtre commun, dernier commit « asd », figée. Notre fork en est parti par erreur ; rebasé sur l'amont le 2026-08-24. |

```bash
git fetch upstream --tags   # github.com/DuarteSantos8/openGym
git log --oneline HEAD..v1.3.10
```

## Ce que le fork change, et pourquoi

Tout est marqué **`//// Neoffice`** avec sa raison (règle projet). `grep -rn "//// Neoffice"`
donne la carte complète de la divergence. Les quatre familles :

| Famille | Fichiers | Raison |
|---|---|---|
| **Auth** | `lib/api.js`, suppression de `views/Login.jsx` et `views/Admin.jsx` | L'amont a son propre serveur Node avec annuaire maison, passkeys et cookie signé. Chez nous la **session Frappe EST l'authentification** : même origine, `/gym` renvoie déjà l'anonyme vers `/login`. |
| **Endpoints** | `lib/api.js` | `neoffice_gym.api.state.get/put` au lieu de l'API Node. En-tête CSRF ajouté, `{message:…}` déballé. |
| **Push** | `lib/push.js`, `store/useUI.js`, `opengym/www/gym_sw.js` | Le serveur du club envoie les notifications depuis le 07.10 (v1.3.10) : `neoffice_gym` `api/push.py` (abonnements, clé VAPID par instance, rappel du jour, rappel de séance manquée, test). `lib/push.js` parle à `/api/method/neoffice_gym.api.push.*` ; le jeton CSRF rejoint l'identifiant d'appareil dans le cache que lit le worker. L'alerte de fin de repos par push n'est **pas** envoyée (no-op nommé dans `useUI.js`) : le maintien d'écran et `maybeRestNotification` la couvrent. |
| **Build** | `vite.config.js`, `.gitignore`, `opengym/` | Coquille d'app Frappe (`hooks.py`, `www/gym_sw.js`), build **commité** dans `opengym/public/frontend` — la flotte ne recompile jamais une SPA sur une instance. |

### Ce que le club règle, et que le carnet applique

Un club décide de la densité de son carnet et de ses rappels dans `Gym Settings` (plugin privé) ; le carnet lit ces
choix dans `S.perms`, que le serveur écrit à chaque synchronisation. **Une clé absente veut dire « comme avant »** :
un serveur plus ancien que le carnet ne change rien.

| Sujet | Fichiers | Règle |
|---|---|---|
| **Niveau de détail** (Simple / Normal / Avancé) | `lib/level-visibility.js`, `sheets.jsx`, `views/Workout.jsx`, `views/FocusView.jsx`, `views/RoutineEdit.jsx` | Quatre contrôles montent au niveau Normal : le plan de séries (« Reps différentes par série »), « Par côté », le chargement des disques, la progression (règle de l'exercice et de la routine, routine de décharge). Au niveau Simple ils restent pour ce qui en porte déjà un (une règle écrite, une barre à soi) : on cache le CONTRÔLE, jamais la DONNÉE. |
| **Rappel de jour manqué** | `lib/nudge.js` (`nudgeFor(état, date, club)`, `clubNudgeOf`, `nudgeAllowed`), `lib/mobile.js`, `views/Settings.jsx`, `views/settings-pages.js` | Lit `S.perms.nudge = {enabled, after, once}`. d = jours PRÉVUS manqués d'affilée depuis la dernière séance, aujourd'hui compris (jour excusé : ni manqué ni rupture ; jour sans séance prévue : sauté ; une séance remet à zéro ; 28 jours de recul avec une règle du club, 14 sans). Éteint : jamais. Allumé et `once` : seulement quand d vaut `after`. Allumé sans `once` : d de `after` à `after + 2`. Clé absente : l'ancien rappel, d de 1 à 3. Les lignes de réglage du rappel disparaissent quand le club l'a éteint. **La règle jumelle est `neoffice_gym` `api/training_day.py::nudge_for` : les deux se tiennent alignées sur la même table de cas.** |
| **Progression par défaut** | `lib/progression.js` (`clubAutoProgression`, `policyFor(…, S)`), `views/RoutineEdit.jsx` | `S.perms.autoProgression === false` : « Pas de progression automatique » pour un exercice ou une routine sans règle à eux. Clé absente : progression linéaire, comme avant. |
| **Un réglage du club arrive sur un téléphone déjà synchronisé** | `lib/sync-merge.js` (`takeServerOwned`), `store/useStore.js` (`mergeInto`) | `perms`, `club` et `clubPicks` sont au serveur : à chaque tirage on prend sa copie. La fusion par `_ts` donne l'égalité à l'appareil, donc un réglage changé au club n'arrivait jamais sur un téléphone qui avait déjà tiré. **Côté serveur, la révision (`current_rev`) doit bouger quand `Gym Settings` change**, sinon le téléphone ne tire pas. |
| **Accueil** | `components/RecentWorkouts.jsx`, `lib/recent-workouts.js`, `views/Home.jsx` | « Derniers entraînements » : les trois dernières séances, chacune avec son bouton « Partager », et « Tout » vers l'historique, après la carte de la semaine. Sans plan : une ligne (« Bienvenue ! » et deux petits boutons) à la place de la grande carte ; une rotation vide est une ligne, non une carte. |
| **Partager une séance en un geste** | `sheets.jsx` (`WorkoutRow({ w, onClick, onShare })`, `shareWorkoutImageSheet`), `views/Stats.jsx`, `views/History.jsx` | Chaque ligne de séance (Accueil, Statistiques, Historique, jour du calendrier) a un bouton « Partager » qui ouvre la même feuille que « Partager en image » du détail. |
| **Choix du club dans le sélecteur d'exercice** | `sheets.jsx` (`exercisePicker`) | Les exercices choisis par le club passent en tête de la liste (partition stable), dans la liste entière et dans la recherche. |

⚠️ **Aucune de ces fonctions n'ajoute une chaîne à traduire** : elles reprennent des clés existantes, parce que
`npm run i18n` exige chaque clé dans les 18 langues. Une clé neuve se traduit dans les 18 (Haiku seulement).

### Ce qu'on ne touche PAS

- **`frontend/src/instr/fr.js`** et **`frontend/src/exercise-desc/fr.js`** — les consignes d'exercice (étapes) et
  leurs descriptions d'une ou deux phrases, en français et **vouvoyées**. L'amont n'a que l'anglais pour les
  descriptions et pour les étapes des exercices nés en v1.4 (4 308) : tout le reste est à nous. L'amont ne touche jamais
  `instr/fr.js` (à chaque merge, le prendre tel quel de notre côté) et n'a pas `exercise-desc/fr.js`. Ce que la nouvelle
  version ajoute se traduit après le merge : voir « Traduire le catalogue » plus bas.
- **Le plugin Umami** de `vite.config.js` — conservé tel quel. Il ne s'injecte que si
  `VITE_UMAMI_SRC` **et** `VITE_UMAMI_ID` sont posés, donc un build Neoffice reste sans télémétrie.
- **Les tests** — tous (`npm --prefix frontend test`) doivent passer avant tout push. Ils comprennent
  `scripts/check-undefined.mjs` (ESLint `no-undef` sur l'app et ses deux workers) : à la v1.3.10, une
  résolution de conflit a gardé la ligne d'amont qui lit `needsMobileOnboarding` sans celle qui le définit,
  et le carnet entier restait blanc ; ni le build ni les tests ne le voyaient. Après une fusion, ouvrir aussi
  `/gym` dans un vrai navigateur.
- **Les tests de l'amont** — un test qui parle d'une fonction que nous n'embarquons pas (appairage d'un
  téléphone, passkeys, mot de passe du serveur Node) est supprimé, et dit ici ; un test du store garde le
  protocole de l'amont grâce au double `frontend/src/store/upstream-api.double.js` (nos fonctions nommées
  de `lib/api.js` sur les chemins `/api/data` de l'amont). Supprimés à la v1.3.10 :
  `lib/api.pair-insecure.test.js` et `lib/api.pair-probe.test.js` (`pairRedeem` n'appaire rien chez nous) ;
  à la v1.4.1 : `lib/api.pair-http.test.js`, `lib/cf-access.test.js` (Cloudflare Access d'un téléphone appairé),
  `components/ServerSync.leave.test.jsx` (la feuille « quitter le serveur ») et deux blocs de `views/Workout.test.jsx`
  (le signal « parti » du battement de présence, retiré de `Workout.jsx`).

## Le média n'est ni dans le dépôt, ni dans son historique

Depuis la v1.4.0 l'amont porte ses visuels dans son propre dépôt : `catalogue/media/still/*.webp` et
`catalogue/media/clip/*.mp4`, 180 px, 190 Mo, © Gym visual. Chez nous `opengym/public/media/{still,clip}/` est
**gitignoré**, et **aucun commit de notre historique ne les porte** : l'import de l'amont les retire (voir plus
bas), parce qu'un fichier poussé dans un dépôt public n'en sort plus. L'instance les met en place avec
`scripts/fetch-media.sh` (clone partiel de l'étiquette amont, ces deux dossiers seulement), servis par Frappe
sur `/assets/opengym/media/still/` et `/clip/` (`lib/exercises.js`, `gym_sw.js`). Avant la v1.4.0 : `img/` et
`gif/` (1 324 jpg + gif), que le serveur du club sait encore lire.

⚠️ **La licence des visuels n'est pas celle du code.** Le code est AGPL-3.0 ; les visuels sont © Gym visual et
l'amont les tient sous licence pour lui (`catalogue/media/NOTICE.md`) : les servir aux membres d'un club qui
paie est un usage commercial que cette licence n'étend pas à nous sans accord. Décision de Jérémy du 11.10 :
« on regarde les licences après ». D'ici là le média n'est posé que sur osiris (développement et démonstration),
jamais commité, jamais sur une instance cliente.

## Procédure de merge amont

Depuis le rebase du 2026-08-24, **les deux historiques ont un ancêtre commun** —
`git merge-base version-15 v1.3.10` rend un vrai commit présent des deux
côtés. Un merge est donc la bonne méthode, et la réapplication manuelle
n'a plus lieu d'être. On fusionne **l'étiquette de la version** (`v1.3.10`), pas `main`.

**Depuis la v1.4.0, on ne fusionne PAS l'étiquette de l'amont telle quelle** : elle tire dans notre historique
public les 190 Mo de visuels sous licence, pour toujours (`~/GitHub/openGym` contient les étiquettes brutes,
avec le média : ne jamais en fusionner ni pousser depuis là). On réécrit d'abord la plage, sans ces deux
dossiers, avec `scripts/import-upstream-range.py`, puis on fusionne la référence ainsi produite :

```bash
git fetch upstream --tags                            # github.com/DuarteSantos8/openGym
# <ancienne> = l'étiquette déjà fusionnée ; --base-filtered = NOTRE copie d'elle : le 2e parent du dernier
# commit de fusion amont (pour la v1.4.1 : fb2dbbc5^2 = 17a2807e)
python3 scripts/import-upstream-range.py . v1.4.1 v1.5.0 refs/tags/up-v1.5.0-filtered --base-filtered 17a2807e
git merge --no-ff --no-commit up-v1.5.0-filtered     # ← un merge, sur version-15, dans un clone jetable
# résoudre : garder LEUR code, réappliquer NOS `//// Neoffice` par-dessus
npm --prefix frontend ci && npm --prefix frontend test && npm --prefix frontend run build
git commit && git tag -d up-v1.5.0-filtered          # la référence filtrée ne se pousse jamais (une étiquette, pas une branche)
```

Le script prouve ce qu'il fait : il refuse (et supprime la référence) si un seul objet de média reste
atteignable depuis les commits recréés. Il garde auteurs, dates et messages ; les signatures GPG ne
survivent pas à une réécriture (c'est pourquoi pas `git filter-repo`, qui change aussi le hash de la base).
Premier import filtré : v1.3.10 → v1.4.1, le 11.10 (note du coffre `Neoffice/Fitness-Coaching/84-…`).

**Pas de branche filet** (règle de la flotte : `version-15` seule, ni branche ni worktree) : l'état
d'avant la fusion est le premier parent du commit de fusion. Faire la fusion dans un clone jetable,
et ne pousser qu'une fois les tests verts.

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
- **`instr/fr.js`**, **`exercise-desc/fr.js`** — NOTRE version, toujours (consignes et descriptions vouvoyées, pour tout le
  catalogue). Après le merge, traduire ce que la nouvelle version ajoute (« Traduire le catalogue » ci-dessous) ;
  `lib/catalogue-coverage.neoffice.test.js` reste rouge tant qu'un exercice n'a pas ses deux textes en français.
- **`lib/workout-card.js`** — la carte de partage d'une séance est signée du nom du club (`model.brand`, lu dans
  `window.gym_boot.app_title` par `ShareWorkoutImage` de `sheets.jsx`), pas de « openGym » : à rejouer si l'amont réécrit la carte.
- **`exercise-names/*.js`** — ceux de l'amont, tels quels (générés par `scripts/catalogue/build.mjs`, « do not
  edit »). Nos 1 324 noms français, dans les mots d'une salle (« à la poulie »), sont dans `club-names/fr.js` et
  posés par-dessus au chargement (`lib/i18n.js` → `lib/club-names.js`, qui lève aussi la première lettre des noms
  générés, puisque `fr` est dans `CASED_NAME_LANGS`). Après chaque merge, régénérer la copie du serveur :
  `node scripts/export-club-names.mjs fr > ../neoffice_gym/neoffice_gym/data/exercise_names_fr.json` (à commiter
  là-bas) avant de relancer `import_exercise_library()`.
- **`locales/fr.js`** — notre mise en page et notre vouvoiement : les clés que nous avions réécrites gardent notre
  texte ; celles que l'amont a changées ou ajoutées (en tutoiement) sont réécrites au vouvoiement par Haiku
  (sous-agent `model: haiku`, lot de ~190 clés avec l'ancien texte en regard) ; les clés que l'amont a retirées
  partent aussi de notre pack (`check-locales` exige les mêmes clés partout). Une langue neuve de l'amont (v1.4 :
  `bn`) reçoit les chaînes de NOS écrans, traduites de la même façon. `npm --prefix frontend run i18n` le prouve.
- Partout ailleurs : **leur code**, avec nos `////` réappliqués par-dessus.

> L'amont a son propre `CLAUDE.md`, qui décrit SON projet (docker, api, mcp,
> website). Il est écrasé par celui-ci à chaque merge — le lire avec
> `git show upstream/main:CLAUDE.md` quand on a besoin de leur carte.

## Traduire le catalogue (consignes et descriptions)

L'amont livre les étapes et les descriptions des exercices en anglais, et ses étapes françaises pour une partie
seulement du catalogue ; à la v1.4.1 il a 5 632 exercices, nous en avions traduit 1 324. Un membre français ne doit pas
lire d'anglais au milieu d'une fiche : après chaque merge qui ajoute des exercices, on traduit l'écart.
**Haiku seulement** (sous-agents `model: haiku`, règle de la maison pour toute traduction).

```bash
cd frontend
node scripts/translation-batches.mjs fr /tmp/gym-translation   # écrit steps-batch-NN.jsonl (150 exercices), desc-batch-NN.jsonl (250),
                                                               # + les références de vocabulaire ; affiche ce qui manque
# un sous-agent Haiku par lot, avec scripts/translation-prompts/steps-fr.md ou desc-fr.md (NN = le numéro du lot)
node scripts/translation-merge.mjs fr /tmp/gym-translation     # contrôle (ids, nombre d'étapes, vide, tutoiement…), puis écrit
                                                               # instr/fr.js et exercise-desc/fr.js (jamais sur un échec dur)
npm test                                                       # dont lib/catalogue-coverage.neoffice.test.js
```

- **Des lots de 150 exercices pour les étapes, de 250 pour les descriptions** : au-delà, la réponse ne tient plus dans un
  seul message et l'agent la coupe en fragments qu'il doit réassembler (400 descriptions : 16 minutes et 266 000 jetons,
  contre 7 minutes pour 150 étapes).
- Chaque ligne d'un lot porte le **nom affiché** de l'exercice : le traducteur reprend le mot du nom pour l'engin (« au
  câble » ou « à la poulie »), pour que la fiche ne dise pas deux choses.
- Un défaut dans le nom d'amont (« au rouleau » pour un ballon de stabilité, vu en traduisant) se corrige dans
  `club-names/fr.js`, pas dans les étapes.
- Ne jamais coller un texte traduit à la main dans `instr/fr.js` : `translation-merge.mjs` garde l'ordre des clés de
  `instr/en.js` et normalise les apostrophes.

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
