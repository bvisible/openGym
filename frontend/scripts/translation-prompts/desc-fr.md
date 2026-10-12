# Consignes à suivre (traduction des descriptions d'exercices) — remplace NN par le numéro de ton lot

Tu traduis des descriptions courtes d'exercices de musculation (une ou deux phrases), de l'anglais vers le français de Suisse romande, pour le carnet d'entraînement d'un club de fitness.

Dossier de travail <D> : <the folder translation-batches.mjs wrote into>

ENTRÉE : <D>/desc-batch-NN.jsonl — une ligne par exercice : {"id": "...", "name": "<nom français affiché de l'exercice>", "en": "<description en anglais>"}.
SORTIE : <D>/desc-answers-NN.json : UN SEUL objet JSON {"<id>": "<description en français>", ...} avec TOUS les exercices du lot, rien d'autre dans le fichier.
Marche à suivre, sans détour : (1) un seul Read du lot ; (2) tu traduis tout ; (3) un seul appel Write pour le fichier de sortie ; (4) une seule vérification : python3 -c "import json; d=json.load(open('<D>/desc-answers-NN.json')); print(len(d))" (corrige le fichier seulement si un exercice manque ou si le JSON est invalide). Pas d'autre lecture inutile.

RÈGLES
- Le même nombre de phrases que l'original (une ou deux), dans le même ordre. N'ajoute rien, ne retire rien.
- Le style de l'original : une description à la 3e personne (« Un relevé de mollets sur une jambe avec élastique, en montant sur la pointe du pied. Il sollicite les mollets. ») ; si l'original est à l'impératif, vouvoiement (« Tirez un élastique vers vous… »). Jamais « tu / ton / ta / tes ».
- Le sens, pas le mot à mot : un français naturel de salle de sport, sans calque. « trains / works / targets / hits » → « sollicite », « travaille », « cible ».
- Le champ `name` est le nom de l'exercice tel qu'il s'affiche : emploie les mêmes mots que lui pour l'engin et le mouvement (s'il dit « au câble », écris « câble » ; s'il dit « à la poulie », écris « poulie » ; s'il dit « ballon de stabilité », écris « ballon de stabilité »).
- Apostrophe droite ' (jamais ’), pas de balises, pas de markdown. Chiffres, angles et unités inchangés. Marques et noms propres inchangés (Smith, BOSU, TRX, kettlebell).
- Tu ne modifies aucun autre fichier.

VOCABULAIRE DU CLUB (à suivre)
Muscles : abs → abdominaux ; obliques → obliques ; quads → quadriceps ; hamstrings → ischio-jambiers ; glutes → fessiers ; calves → mollets ; lats → grands dorsaux ; traps → trapèzes ; rear delts → deltoïdes postérieurs ; front delts → deltoïdes antérieurs ; side delts → deltoïdes latéraux ; delts / shoulders → épaules ; pecs / chest → pectoraux ; forearms → avant-bras ; lower back → lombaires ; upper back → haut du dos ; core → sangle abdominale / tronc ; hip flexors → fléchisseurs de hanche ; adductors → adducteurs ; abductors → abducteurs ; spinal erectors → érecteurs du rachis ; rhomboids → rhomboïdes ; serratus → dentelé antérieur ; rotator cuff → coiffe des rotateurs ; neck → cou.
Matériel : dumbbell → haltère ; barbell → barre ; EZ bar → barre EZ ; trap/hex bar → barre hexagonale ; band / resistance band → élastique ; machine → machine ; bench → banc ; pull-up bar → barre de traction ; medicine ball → médecine-ball ; suspension trainer / TRX → sangles de suspension ; sled → traîneau ; sandbag → sac de sable ; foam roller → rouleau ; weight plate → disque ; rope → corde ; mat → tapis.
Mouvements et prises : deadlift → soulevé de terre ; press → développé ; row → rowing ou tirage ; lunge → fente ; plank → gainage ; push-up → pompe ; pull-up / chin-up → traction ; shrug → haussement d'épaules ; raise → élévation ; fly → écarté ; pulldown → tirage vertical ; curl, squat, dip, hip thrust, crunch, burpee restent tels quels ; overhand grip → prise en pronation ; underhand grip → prise en supination ; neutral grip → prise neutre ; rep → répétition ; set → série.
Si un mot te fait vraiment douter, tu peux chercher dans <D>/names-reference.tsv (nom anglais TAB nom français) avec grep -i, au plus 3 recherches.

Termine ta réponse par une seule ligne : ok N  (N = nombre de descriptions écrites).
