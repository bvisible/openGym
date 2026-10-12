# Consignes à suivre (traduction des étapes d'exercices) — remplace NN par le numéro de ton lot

Tu traduis des consignes d'exercices de musculation, de l'anglais vers le français de Suisse romande, pour le carnet d'entraînement d'un club de fitness.

Dossier de travail <D> : <the folder translation-batches.mjs wrote into>

ENTRÉE : <D>/steps-batch-NN.jsonl — une ligne par exercice : {"id": "...", "name": "<nom français affiché de l'exercice>", "en": ["étape 1", "étape 2", ...]}.
SORTIE : <D>/steps-answers-NN.json : UN SEUL objet JSON {"<id>": ["étape 1 en français", "étape 2 en français", ...], ...} avec TOUS les exercices du lot, rien d'autre dans le fichier.
Marche à suivre, sans détour : (1) un seul Read du lot ; (2) tu traduis tout ; (3) un seul appel Write pour le fichier de sortie ; (4) une seule vérification : python3 -c "import json; d=json.load(open('<D>/steps-answers-NN.json')); print(len(d))" (corrige le fichier seulement si un exercice manque ou si le JSON est invalide). Pas d'autre lecture inutile.

RÈGLES
- Autant de phrases que l'original, dans le même ordre : ne fusionne pas, ne coupe pas, n'ajoute rien, ne retire rien.
- Vouvoiement, à l'impératif : « Tenez-vous debout… », « Saisissez la barre… », « Poussez… ». Jamais « tu / ton / ta / tes ».
- Le sens, pas le mot à mot : un français naturel de salle de sport, sans calque. Durées : « 20 à 30 secondes ».
- Le champ `name` est le nom de l'exercice tel qu'il s'affiche : emploie les mêmes mots que lui pour l'engin et le mouvement (s'il dit « au câble », écris « câble » ; s'il dit « à la poulie », écris « poulie » ; s'il dit « ballon de stabilité », écris « ballon de stabilité » ; s'il dit « à la smith », « la Smith »).
- Apostrophe droite ' (jamais ’), pas de balises, pas de markdown, pas de guillemets inutiles. Chiffres, angles, durées et unités inchangés. Marques et noms propres inchangés (Smith, BOSU, TRX, kettlebell).
- Tu ne modifies aucun autre fichier.

VOCABULAIRE DU CLUB (à suivre)
Muscles : abs → abdominaux ; quads → quadriceps ; hamstrings → ischio-jambiers ; glutes → fessiers ; calves → mollets ; lats → grands dorsaux ; traps → trapèzes ; rear delts → deltoïdes postérieurs ; delts / shoulders → épaules ; pecs / chest → pectoraux ; forearms → avant-bras ; lower back → lombaires ; upper back → haut du dos ; core → sangle abdominale / tronc ; hip flexors → fléchisseurs de hanche.
Matériel : dumbbell → haltère ; barbell → barre ; EZ bar → barre EZ ; trap/hex bar → barre hexagonale ; band / resistance band → élastique ; machine → machine ; bench → banc ; pull-up bar → barre de traction ; medicine ball → médecine-ball ; suspension trainer / TRX → sangles de suspension ; sled → traîneau ; sandbag → sac de sable ; foam roller → rouleau ; weight plate → disque ; rope → corde ; mat → tapis.
Mouvements et prises : deadlift → soulevé de terre ; press → développé ; row → rowing ou tirage ; lunge → fente ; plank → gainage ; push-up → pompe ; pull-up / chin-up → traction ; shrug → haussement d'épaules ; raise → élévation ; fly → écarté ; pulldown → tirage vertical ; curl, squat, dip, hip thrust, crunch, burpee restent tels quels ; overhand grip → prise en pronation ; underhand grip → prise en supination ; neutral grip → prise neutre ; shoulder-width → largeur des épaules ; hip-width → largeur des hanches ; rep → répétition ; set → série ; "squeeze" → contractez ; "brace your core" → gainez votre sangle abdominale.
Si un mot te fait vraiment douter, tu peux chercher dans <D>/steps-reference.tsv (anglais TAB français, déjà traduit) avec grep -i, au plus 3 recherches.

Termine ta réponse par une seule ligne : ok N  (N = nombre d'exercices écrits).
