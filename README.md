# OpenPresenter

**Suite gratuite et open-source de régie live** pour cultes, concerts et évènements — une alternative libre à des logiciels comme ProPresenter.

OpenPresenter réunit tous les outils de projection dont une régie a besoin (Bible, paroles de chants, médias, habillages/lower thirds) dans une interface unifiée, avec sortie directe vers **OBS Studio**. Tout fonctionne en local sur le réseau de la salle, via un petit serveur Node.js — aucun compte à créer, aucun abonnement, aucune dépendance à un service cloud.

> **Synthèse du 5 novembre 2026** — cette branche réunit la meilleure base du dépôt
> (la V3 de `arena/df2cc4c1-openpresenter`, 281 tests) et le **design FREESTREAM** :
> un thème commun à toutes les pages, une régie à trois colonnes (rail de modules,
> bibliothèque, moniteur d'aperçu, colonne « à l'antenne »), une **vue orateur** et un
> **mur des sorties**.
>
> | Écran | URL courte | À quoi il sert |
> |---|---|---|
> | Régie | `/regie` | tout piloter : Bible, chants, annonces, médias, habillage, minuteur |
> | Mur des sorties | `/mur` | voir toutes les sorties en direct, copier leurs liens OBS |
> | Vue orateur | `/orateur` | écran retour de scène : texte courant, suivant, horloge |
> | Accueil | `/` | profils, sorties, bibliothèque, événements |
>
> Les choix de fusion sont documentés dans **[`SYNTHESE.md`](SYNTHESE.md)**.

---

## Sommaire

- [Synthèse et choix de fusion](SYNTHESE.md)
- [Cahier des charges de la refonte](#cahier-des-charges-de-la-refonte)
- [Phase 0 : le socle est en place](#phase-0--le-socle-est-en-place)
- [Phase 1 : la Bible, de la frappe à l'écran](#phase-1--la-bible-de-la-frappe-à-lécran)
- [Pourquoi ce projet](#pourquoi-ce-projet)
- [Fonctionnalités](#fonctionnalités)
- [Portabilité (le dossier, c'est la régie)](#portabilité-le-dossier-cest-la-régie)
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
npm test                  # 291 contrôles — 0 échec
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

Les logiciels de régie live (type ProPresenter) sont souvent payants, parfois chers pour
une petite structure, et pas toujours disponibles sur toutes les plateformes. Beaucoup
d'équipes techniques bénévoles ont pourtant besoin d'un outil fiable pour :

- afficher des versets et des paroles de chants pendant un culte,
- projeter des images et des vidéos ;
- habiller un live avec des bandeaux (nom du prédicateur, annonces, minuteur) ;
- et tout envoyer proprement dans **OBS Studio**, pour le streaming comme pour l'écran
  de la salle.

OpenPresenter répond à ce besoin : gratuit, **100 % hors ligne**, sans compte ni
abonnement, dans un simple dossier qu'on peut copier sur une clé USB.

## Fonctionnalités

| Module | Ce qu'il fait |
|---|---|
| 📖 **Bible** | saisie au clavier (`j e Entrée 3 Espace 16 Entrée`), plusieurs versions importables (Beblia, Zefania, OSIS, USFX), découpage lisible automatique, navigation aux flèches, annotations et contraste automatique |
| 🎤 **Chants** | import ChordPro / OpenSong / texte, sections détectées, **conducteur** (couplet, refrain, pont), arrangements, ajout de refrain, saut de section |
| 🖼️ **Médias** | bibliothèque d'images et vidéos, cadrage `contain`/`cover`/`stretch`, un clic = à l'antenne |
| 📣 **Annonces** | annonces enregistrées dans le projet, diffusion plein écran en un clic |
| 🏷️ **Habillage** | bandeau nom + fonction, posé **sans éteindre** le verset affiché |
| ⏱️ **Minuteur** | compte à rebours ou compteur, alertes de couleur, affichage autonome (la sortie continue à décompter même régie fermée) |
| 🎨 **Scènes** | éditeur WYSIWYG : calques texte, images, formes, fonds ; les mêmes scènes servent à l'éditeur, à l'aperçu et aux sorties |
| 🗂️ **Plans & événements** | plan de déroulement (import texte / Planning Center), organisations, lieux, récurrences |
| 👤 **Profils** | configurer une fois (sorties + looks), appliquer en un clic ; export/import d'un profil |
| 🖥️ **Sorties multiples** | résolution libre, presets (plein, 80 %, bas centré, bas droite, lower third), filtre par type de contenu, URL stable par sortie |
| 🧩 **Mur & orateur** | `/mur` surveille toutes les sorties ; `/orateur` affiche texte courant + suivant + horloge sur l'écran de scène |
| 🔎 **Recherche unifiée** | `Ctrl+K` : chants, versets, médias, annonces, looks dans un seul champ |
| 💾 **Portabilité** | projet = dossier `project/` ; export/restauration ZIP ; migration de l'ancienne version incluse |

## Portabilité (le dossier, c'est la régie)

Tout le contenu vit dans **`project/`** à côté du serveur : bibliothèque (chants,
annonces, looks), assets (images, vidéos) dédupliqués par empreinte, scènes, sorties,
profils, organisations et événements, sessions.

- **Copier le dossier sur un autre PC** (clé USB, disque réseau) suffit : on relance,
  tout est là.
- **`/api/export`** produit une archive ZIP complète du projet, restaurable ailleurs.
- L'ancien format (V1) s'importe en une commande (`app/src/migration/v1.mjs`).

## Comment ça fonctionne

Un seul serveur Node.js, **sans aucune dépendance npm** :

1. **API REST** (`/api/…`) sur une arborescence de fichiers JSON — le disque est la
   source de vérité, jamais un cache mémoire.
2. **Relais WebSocket** écrit à la main : un canal par sortie (`op_out_<id>`), plus les
   canaux `op_studio`, `op_stage`, `op_project`. Le dernier état est rejoué à la
   reconnexion : rouvrir une sortie en plein culte ne l'éteint pas.
3. **Pages servies telles quelles** (`app/web/`) et **modules purs partagés**
   (`/shared/…`) : la logique testée côté Node est exactement celle qui tourne à l'écran.

Aucune ressource distante (pas de CDN, pas de police Google) : vérifié par test sur
chaque page.

## Installation

**Pré-requis :** [Node.js](https://nodejs.org/) 20 ou plus récent — rien d'autre.

| Situation | Action |
|---|---|
| Windows | double-clic sur **`OpenPresenter.bat`** |
| macOS | double-clic sur **`OpenPresenter.command`** |
| Linux | `./OpenPresenter.sh` |
| Ligne de commande | `node app/server.mjs` |

Le lanceur vérifie Node.js, trouve un port libre, démarre le serveur, attend qu'il
réponde, puis ouvre le navigateur. Les adresses affichées :

```
Sur ce PC        : http://localhost:8788/
Depuis le réseau : http://192.168.x.x:8788/   (jeton à 4 caractères)
```

Laissez la fenêtre du terminal ouverte tant que vous diffusez.

### Aperçu / démonstration derrière un proxy

Sur une machine de la salle, le serveur protège les écritures par un **jeton réseau**.
Dans un environnement d'aperçu (hébergeur, proxy, iframe), les requêtes arrivent d'une
adresse non locale et ne peuvent pas porter ce jeton :

```bash
OPENPRESENTER_PREVIEW=1 HOST=0.0.0.0 PORT=8790 node app/server.mjs
```

Seul l'hôte du proxy (`*.e2b.app`, `localhost`, `127.0.0.1`) est dispensé de jeton ; une
adresse IP du réseau local reste protégée. Le mode est **inactif par défaut**.

## Utilisation

### Les écrans

| Écran | URL | Rôle |
|---|---|---|
| Accueil | `/` | profils, cartes des sorties avec aperçu en direct, bibliothèque, événements |
| **Régie** | `/regie` (ou `/studio.html`) | rail des 6 modules, bibliothèque, aperçu central, colonne « à l'antenne » |
| Mur des sorties | `/mur` | toutes les sorties côte à côte, URL copiable, état d'antenne |
| Vue orateur | `/orateur` | écran retour de scène : texte courant, suivant, horloge, minuteur |
| Scènes | `/scene.html` | éditeur WYSIWYG des scènes et des looks |
| Plan | `/plan.html` | conduite du déroulé (Espace, flèches, Échap) |
| Événements | `/events.html` | organisations, lieux, récurrences |
| Sortie | `/o/<id>` | la page à mettre dans OBS (une par sortie) |
| Diagnostic | `/socle.html` | intégrité du projet, journal, export |

### Ajouter les sorties dans OBS

Pour chaque sortie, ajoutez une **Source Navigateur** avec l'URL `/o/<id>` (le mur des
sorties les copie pour vous). Réglez la largeur/hauteur de la source sur la résolution
déclarée pour la sortie (1920×1080 par défaut), cochez « Arrêter la source lorsqu'elle
n'est pas visible » **décoché** pour garder la synchro.

### Clavier

| Touche | Effet |
|---|---|
| `Alt+1` … `Alt+6` | Bible, Chants, Annonces, Médias, Habillage, Minuteur |
| `Ctrl/Cmd+K` | recherche unifiée |
| `Entrée` | diffuser l'élément courant |
| `Échap` | couper (sortie visée, jamais tout le culte d'un coup) |
| `←` `→` | élément précédent / suivant |

### Piloter depuis un autre PC

Ouvrez l'adresse « Depuis le réseau » avec le jeton affiché au démarrage
(`http://192.168.1.42:8788/?t=XXXX`). Tout ce qui est déclenché depuis ce poste part en
direct dans OBS sur le poste principal.

## Bibles au format XML

L'import accepte les formats **Beblia, Zefania, OSIS et USFX** (détection automatique,
prévisualisation avant écriture). Une source pratique :
[Beblia/Holy-Bible-XML-Format](https://github.com/Beblia/Holy-Bible-XML-Format).

## Structure du projet

```
OpenPresenter/
├── OpenPresenter.bat / .command / .sh   # lanceurs (Windows / macOS / Linux)
├── app/
│   ├── server.mjs                       # API REST + WebSocket (node:http, zéro dépendance)
│   ├── launcher/launch.mjs              # vérifications, port, ouverture du navigateur
│   ├── src/core/                        # projet, assets, scènes, rendu, profils, plans, bible, chants
│   └── web/                             # accueil, régie, scènes, plan, événements, mur, orateur, sortie
│       ├── theme.css                    # thème commun (design FREESTREAM)
│       └── session.js                   # jeton réseau propagé (fetch, WebSocket, liens)
├── app/tests/                           # 291 contrôles (npm test)
├── project/                             # VOS données (hors dépôt) — portable, exportable
├── docs/spec/                           # 29 chapitres de spécification
├── docs/maquettes/                      # maquettes de référence
├── SYNTHESE.md                          # comparaison des branches et choix de fusion
└── CAHIER-DES-CHARGES.md                # document maître de la refonte
```

## Licence

Projet distribué librement — voir le fichier `LICENSE` du dépôt pour les conditions exactes (à ajouter selon le choix de licence retenu par l'auteur, par exemple MIT pour un usage et une modification libres).

## Auteur & contact

Projet créé et maintenu par **Renaud Christin FONTON**.

- 📧 Email : [renaudchristinfonton@gmail.com](mailto:renaudchristinfonton@gmail.com)
- 🌐 Site : [renaudfonton.netlify.app](https://renaudfonton.netlify.app)

Suggestions, retours ou questions sont les bienvenus.
