# OpenPresenter

**Suite gratuite et open-source de régie live** pour cultes, concerts et évènements — une alternative libre à des logiciels comme ProPresenter.

OpenPresenter réunit tous les outils de projection dont une régie a besoin (Bible, paroles de chants, médias, habillages/lower thirds) dans une interface unifiée, avec sortie directe vers **OBS Studio**. Tout fonctionne en local sur le réseau de la salle, via un petit serveur Node.js — aucun compte à créer, aucun abonnement, aucune dépendance à un service cloud.

## Sommaire

- [Cahier des charges de la refonte](#cahier-des-charges-de-la-refonte)
- [Phase 0 : le socle est en place](#phase-0--le-socle-est-en-place)
- [Phase 1 : la Bible, de la frappe à l'écran](#phase-1--la-bible-de-la-frappe-à-lécran)
- [Pourquoi ce projet](#pourquoi-ce-projet)
- [Fonctionnalités](#fonctionnalités)
- [Comment ça fonctionne](#comment-ça-fonctionne)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Bibles au format XML](#bibles-au-format-xml)
- [Structure du projet](#structure-du-projet)
- [Licence](#licence)
- [Auteur & contact](#auteur--contact)

---

## Cahier des charges de la refonte

La refonte 2026 est spécifiée de bout en bout avant d'être codée. Le document maître est
**[`CAHIER-DES-CHARGES.md`](CAHIER-DES-CHARGES.md)** : 30 exigences fonctionnelles,
21 exigences non fonctionnelles, 613 identifiants d'exigence, 115 tests d'acceptation,
18 cas d'utilisation et les décisions d'architecture tranchées.

| Où | Quoi |
|---|---|
| [`docs/spec/`](docs/spec/) | 29 chapitres : contrat écran par écran, module par module, schémas JSON, textes d'interface, traçabilité |
| [`docs/maquettes/`](docs/maquettes/) | 14 captures de référence — ouvrir `index.html`, aucun réseau requis |
| [`docs/ETAT-DES-LIEUX-2026-10.md`](docs/ETAT-DES-LIEUX-2026-10.md) | audit vérifié du dépôt : 3 branches, V1/V2, ce qui marche, ce qui manque |

La spécification est **terminée**. L'implémentation avance par phases
([`docs/spec/21-plan-livraison.md`](docs/spec/21-plan-livraison.md)) ; la **phase 0** est livrée.

---

## Phase 0 : le socle est en place

Le socle tourne réellement : dossier `project/` = projet transportable, écriture atomique,
assets dédupliqués par empreinte, export/restauration ZIP, migration du dump V1,
serveur local sans aucune dépendance npm, lanceur universel qui ouvre le navigateur.

```bash
./OpenPresenter.sh        # macOS : ./OpenPresenter.command   Windows : OpenPresenter.bat
npm test                  # 138 tests — 0 échec
npm run schema:check      # 16 schémas de l'annexe 24, validés sur un projet réel
npm run trace:check       # cohérence du cahier des charges, T1 → T16
```

| Où | Quoi |
|---|---|
| [`docs/PHASE-0-SOCLE.md`](docs/PHASE-0-SOCLE.md) | ce qui fonctionne, comment le lancer, tests de recette couverts, dettes assumées |
| `app/server.mjs` | API REST + WebSocket sur `node:http`, sans dépendance |
| `app/src/core/` | écriture atomique, projet, assets, objets métier, export, journal, validateur |
| `app/src/migration/v1.mjs` | migration idempotente de `openpresenter-sauvegarde-2026-08-09.json` |
| `app/tests/` | A-01→A-05, A-13→A-13e, A-18→A-18k, lanceur, validateur |

---

## Phase 1 : la Bible, de la frappe à l'écran

La première tranche verticale est en place : **taper une référence au clavier et la voir
s'afficher**, découpée en morceaux lisibles, avec navigation aux flèches — sur deux sorties
(OBS/EQ, vMix, projecteur).

```
j e Entrée 3 Espace 1 6 Entrée   →   Jean 3:16   →   2 parties   →   sortie
```

| Où | Quoi |
|---|---|
| [`docs/PHASE-1-BIBLE.md`](docs/PHASE-1-BIBLE.md) | parcours complet, tests A-06→A-09 couverts, ce qui reste |
| `app/src/core/bible/reference.mjs` | machine à états LIVRE → CHAPITRE → VERSET, références collées, messages |
| `app/src/core/split.mjs` | découpage lisible normatif (25 mots, ponctuation, équilibrage) |
| `app/src/core/bible/navigation.mjs` | navigation plate, touches du § 9.4.2, clicker USB |
| `app/web/studio.html` | studio : champ unique, parties, aperçu, choix des sorties |
| `app/web/output.html` | page de sortie `/o/<id>?kind=bible` — plein écran ou bandeau |
| `app/src/core/live.mjs` | état d'antenne, filtre `receives`, reprise après reconnexion |

Les modules purs sont servis **tels quels** au navigateur (`/shared/…`) : la logique testée
côté Node est exactement celle qui tourne à l'écran.

### Scènes : un seul rendu pour l'éditeur et la sortie

Une scène est un fichier JSON (`project/scenes/…`) fait de calques positionnés en
pourcentage d'un canevas 1920×1080. `renderScene()` produit le HTML, `SCENE_CSS` la feuille
de style : l'aperçu du studio, l'éditeur `/scene.html` et la page `/o/<id>` utilisent
**exactement** le même code, donc la même image.

| Où | Quoi |
|---|---|
| [`docs/PHASE-1-SCENE.md`](docs/PHASE-1-SCENE.md) | moteur, contrats, tests A-10→A-10h, ce qui reste |
| [`docs/PHASE-1-CHANTS.md`](docs/PHASE-1-CHANTS.md) | import ChordPro/OpenSong, conducteur, raccourcis, tests EF-15 |
| `app/src/core/scene.mjs` | modèle, presets, bornes de géométrie, opérations de calques |
| `app/src/core/render/engine.mjs` | `renderScene()`, `mountScene()`, `SCENE_CSS` |
| `app/web/scene.html` | éditeur WYSIWYG (glisser, redimensionner, historique, contraste) |
| `app/src/core/songs/*.mjs` | import et conducteur des chants, partagés serveur/navigateur |

### Accueil, studio unifié et recherche

Le studio réunit désormais Bible, chants et annonces derrière un seul champ de recherche
(`Ctrl/Cmd+K`), avec un accueil qui montre l'état des sorties en direct.

| Où | Quoi |
|---|---|
| [`docs/PHASE-1-ACCUEIL.md`](docs/PHASE-1-ACCUEIL.md) | accueil (EF-05), studio (EF-06), recherche unifiée, annonces (EF-17), looks (EF-10), import de Bible (EF-11) |
| `app/web/accueil.html` | accueil : état d'antenne, cartes d'aperçu WYSIWYG, « Tout couper », accès au studio |
| `app/web/scene.html` | éditeur de scène + looks réutilisables |
| `app/src/core/bible/formats.mjs` | détection Beblia / Zefania / OSIS / USFX, sans dépendance |
| `app/src/core/bible/importer.mjs` | import avec prévisualisation, copie de la source, index de versets |

### Un seul écran pour toute la régie

Le studio réunit six modules sur le même écran : Bible, Chants, Annonces, Médias,
Habillage, Minuteur. On change de module à la souris ou au clavier (`Alt+1` … `Alt+6`),
le contenu déjà à l'antenne n'est jamais coupé par ce changement.

| Où | Quoi |
|---|---|
| [`docs/PHASE-2-MODULES.md`](docs/PHASE-2-MODULES.md) | médias (EF-16), minuteur (EF-18), habillage (EF-19), routage des calques, vérification fonction par fonction |
| `app/web/studio.html` | les six modules, la liste des sorties et le cut général |
| `app/src/core/overlay.mjs` | où poser un calque sans éteindre le contenu principal |
| `app/src/core/preview.mjs` | accès en prévisualisation derrière un proxy (`OPENPRESENTER_PREVIEW=1`) |

### Profils, événements et plan de déroulement

Trois profils prêts à l'emploi (église, conférence, stream) s'appliquent en une action ;
les organisations, lieux et événements se gèrent sur une page dédiée, et le déroulé se
conduit à une touche.

| Où | Quoi |
|---|---|
| [`docs/PHASE-2-ORGANISATION.md`](docs/PHASE-2-ORGANISATION.md) | profils (EF-20), organisations (EF-21), événements (EF-22), plan (EF-23) |
| `app/src/core/profiles.mjs` | profils livrés, looks, application atomique, capture, export/import |
| `app/src/core/events.mjs` | organisations, lieux, récurrence, historique |
| `app/src/core/plan.mjs` | import texte/Planning Center, impression, position de lecture |
| `app/web/events.html` | organisations, lieux et événements |
| `app/web/plan.html` | conduite du déroulé (Espace, flèches, Échap) |

---

## Pourquoi ce projet

Les logiciels de régie live pour l'église ou l'évènementiel (type ProPresenter) sont souvent payants, parfois chers à l'échelle d'une petite structure, et pas toujours disponibles ou maintenus sur toutes les plateformes. Beaucoup d'équipes techniques bénévoles (églises, associations, petites salles) n'ont ni le budget ni le besoin d'une licence commerciale complète, mais ont quand même besoin d'un outil fiable pour :

- afficher des versets bibliques et des paroles de chants pendant un culte,
- projeter des images, vidéos, PDF ou présentations PowerPoint,
- habiller un live ou un stream avec des titres et bandeaux animés,
- tout ça en le diffusant proprement dans OBS Studio, pour du streaming, de l'enregistrement ou de la régie salle.

OpenPresenter est né de ce besoin concret : un outil gratuit, qui tourne partout où Node.js est installé, sans hébergement ni service tiers, et qui reste simple à faire évoluer.

## Fonctionnalités

- 📖 **Bible** — recherche par livre/chapitre/verset, import de Bibles au format XML, plusieurs styles d'affichage OBS (plein écran, bas centré, bas droite, 80% écran, ruban défilant)
- 🎤 **Paroles de chants** — collez un chant et il est automatiquement découpé en sections (couplet/refrain) à partir des lignes vides, tout en conservant la mise en forme d'origine ligne par ligne
- 🖼️ **Médias** — bibliothèque d'images, vidéos, PDF et PowerPoint, organisée par groupes, avec import multiple et cadrage automatique (une image qui n'est pas en 1920×1080 s'affiche à sa taille, sans être déformée ni rognée)
- 🏷️ **Lower Thirds** — bandeaux de titre/sous-titre personnalisables (couleurs, polices, formes, animations d'entrée/sortie, logo), avec positionnement au glisser-déposer
- 🖥️ **Studio Unifié** — les 4 outils dans une seule fenêtre avec un volet de navigation, plus des boutons globaux pour couper ou relancer instantanément la diffusion de chacun, sans changer d'onglet
- 🧩 **Mur de Sorties** — aperçu en direct des 4 sorties OBS réunies sur une seule page, pour surveiller ce qui est à l'antenne en un coup d'œil
- 🔗 **Sorties OBS multiples par mode** — en plus du lien qui suit le style choisi en direct, des liens à mode fixe pour afficher le même contenu différemment sur plusieurs scènes OBS (ex. plein écran en régie, bas centré en scène caméra)
- 🌐 **Pilotage à distance** — le contrôleur peut être ouvert depuis n'importe quel navigateur (pas seulement dans un dock OBS), y compris depuis un autre PC du même réseau

## Portabilité (dossier = tout)

OpenPresenter est **entièrement portable** : tout votre contenu — versions Bible, chants, médias (avec leurs images/vidéos), présets de titres, favoris, réglages, file de déroulement, groupes — est sauvegardé **dans le dossier du projet** (dossier `servergestionobs/data/`), pas dans le navigateur.

**Conséquence :** vous pouvez **copier le dossier sur un autre PC** (clé USB, disque réseau) et continuer exactement où vous vous étiez arrêté, sans rien reconfigurer ni réimporter. Il suffit de relancer le serveur (double-clic sur `demarrer-windows.bat` ou `demarrer-mac-linux.command`).

Au premier lancement sur une nouvelle machine, les outils **restaurent automatiquement** leur contenu depuis ce dossier.

## Comment ça fonctionne

OpenPresenter n'a pas de backend complexe : c'est un ensemble de pages HTML/JS autonomes, servies et reliées entre elles par un **petit serveur relais** (`sync-relay-server.js`), qui tourne avec Node.js pur (aucune dépendance à installer).

Ce serveur remplit deux rôles :

1. **Serveur de fichiers** : il sert les pages de l'outil en HTTP (`http://localhost:8787/...`), pour qu'elles puissent être ouvertes dans un navigateur classique ou dans OBS.
2. **Relais de synchronisation** : chaque outil a un contrôleur (l'interface de pilotage) et un affichage (la page à ajouter dans OBS comme Source Navigateur). Le serveur relaie en WebSocket tout ce qui se passe entre les deux, en plus de la synchronisation locale par `BroadcastChannel`. Résultat : le contrôleur peut être ouvert n'importe où sur le réseau — un autre onglet, un autre navigateur, un autre PC — et piloter l'affichage dans OBS en temps réel.

Rien ne transite par internet : tout reste sur le réseau local (Wi-Fi/Ethernet) de la salle.

## Installation

**Pré-requis :** [Node.js](https://nodejs.org/) (version LTS), aucune autre dépendance à installer.

1. Téléchargez ou clonez ce dépôt.
2. Gardez tous les fichiers du projet dans un même dossier.
3. Lancez le serveur :
   - **Windows** : double-cliquez sur `demarrer-windows.bat`
   - **Mac/Linux** : double-cliquez sur `demarrer-mac-linux.command` (ou `./demarrer-mac-linux.command` dans un terminal)

Le script vérifie automatiquement que Node.js est bien installé, que le port n'est pas déjà utilisé, et vous guide en cas de problème. Une fois lancé, il affiche l'adresse à utiliser :

```
Sur ce PC        : http://localhost:8787/
Depuis le réseau : http://192.168.x.x:8787/
```

Laissez cette fenêtre de terminal ouverte tant que vous diffusez.

### Aperçu / démonstration derrière un proxy

Sur une machine de la salle, le serveur protège les écritures par un **jeton réseau** :
un poste du Wi-Fi doit présenter `?t=<jeton>`. Dans un environnement d'aperçu (hébergeur,
proxy, iframe), les requêtes arrivent d'une adresse non locale et ne peuvent pas porter ce
jeton. Démarrez alors le serveur avec :

```bash
OPENPRESENTER_PREVIEW=1 HOST=0.0.0.0 PORT=8790 node app/server.mjs
```

Seul l'hôte du proxy (`*.e2b.app`, `localhost`, `127.0.0.1`) est dispensé de jeton ; une
adresse IP du réseau local reste protégée. Le mode est **inactif par défaut** et l'écran de
démarrage l'annonce (`Aperçu : accès proxy *.e2b.app sans jeton`).

## Utilisation

### Ouvrir les outils

Depuis un navigateur, ouvrez :

- `http://localhost:8787/studio_unifie.html` — l'interface tout-en-un recommandée (navigation entre les 4 outils + contrôles globaux)
- ou individuellement : `bible_control_display_pro.html`, `lyrics_control_display_pro.html`, `media_control_display_pro.html`, `obs_lower_third_ultimate_studio.html`
- `http://localhost:8787/mur_previews.html` — pour surveiller les 4 sorties en direct sur un seul écran

### Ajouter les sources dans OBS

Dans OBS, ajoutez une **Source Navigateur** par outil, avec l'URL affichée dans le panneau "Sortie Directe (OBS)" de chaque contrôleur (en général l'adresse suivie de `?obs=true`, ou `?obs=1` pour le Lower Third). Réglez la largeur/hauteur de la source sur la même résolution que votre Canvas OBS (Paramètres → Vidéo → Résolution de base), pour que le positionnement corresponde exactement à l'écran de sortie.

### Piloter depuis un autre PC

Sur un second PC connecté au même réseau, ouvrez l'adresse "Depuis le réseau" affichée au démarrage du serveur (ex. `http://192.168.1.42:8787/studio_unifie.html`). Tout ce qui est déclenché depuis ce PC s'affiche en direct dans OBS sur le PC principal.

## Bibles au format XML

L'outil Bible s'appuie sur des fichiers Bible au format XML. Une bonne source pour en télécharger dans plusieurs langues et versions :

👉 **https://github.com/Beblia/Holy-Bible-XML-Format**

Téléchargez le fichier XML de votre choix, puis importez-le directement depuis l'interface de l'outil Bible.

## Structure du projet

```
FreePresenter/
├── studio_unifie.html                   # Interface tout-en-un (recommandée)
├── mur_previews.html                    # Aperçu des 4 sorties réunies
├── bible_control_display_pro.html       # Outil Bible (contrôleur + affichage)
├── lyrics_control_display_pro.html      # Outil Paroles de chants
├── media_control_display_pro.html       # Outil Médias (images/vidéos/PDF/PPTX)
├── obs_lower_third_ultimate_studio.html # Outil Lower Third
├── sync-relay-server.js                 # Serveur relais (fichiers + synchro réseau)
├── package.json
├── demarrer-windows.bat                 # Démarrage Windows (avec vérifications)
├── demarrer-mac-linux.command           # Démarrage Mac/Linux (avec vérifications)
└── LISEZ-MOI.md                         # Notice d'utilisation détaillée (FR)
```

## Licence

Projet distribué librement — voir le fichier `LICENSE` du dépôt pour les conditions exactes (à ajouter selon le choix de licence retenu par l'auteur, par exemple MIT pour un usage et une modification libres).

## Auteur & contact

Projet créé et maintenu par **Renaud Christin FONTON**.

- 📧 Email : [renaudchristinfonton@gmail.com](mailto:renaudchristinfonton@gmail.com)
- 🌐 Site : [renaudfonton.netlify.app](https://renaudfonton.netlify.app)

Suggestions, retours ou questions sont les bienvenus.
