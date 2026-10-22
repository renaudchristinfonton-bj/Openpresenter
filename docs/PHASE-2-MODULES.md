# Phase 2 — les modules du studio unique

**Tranche :** médias (EF-16), minuteurs (EF-18), habillages (EF-19), et le routage
des calques qui les rend utilisables sans casser le direct.
**Commit de référence :** celui qui porte `app/src/core/overlay.mjs`.
**Décadrage demandé par l'utilisateur :** « retrouve l'interface que j'avais en V1,
mais **moins d'écrans**, et **vérifie chaque fonction** ».

---

## 1. Decision tenue

La V1 (`servergestionobs/`) répartissait la régie sur **14 fichiers HTML** : un écran
par outil, chacun avec son style, ses raccourcis et son état. Le nouveau socle garde
**les fonctions** de ces écrans, mais **un seul écran** les sert : `app/web/studio.html`,
six modules derrière six onglets.

| Module | Touche | Contenu |
|---|---|---|
| Bible | `Alt+1` | recherche au clavier, découpage en peu de mots, navigation aux flèches |
| Chants | `Alt+2` | bibliothèque, conducteur, arrangements |
| Annonces | `Alt+3` | texte court à poser sur n'importe quelle sortie |
| **Médias** | **`Alt+4`** | images et vidéos du projet, import par glisser-déposer |
| **Habillage** | **`Alt+5`** | bandeau nom + fonction, en surimpression |
| **Minuteur** | **`Alt+6`** | compte à rebours et chronomètre de l'événement |

Changer de module ne coupe jamais ce qui est à l'antenne (EF-06.7) : les six modules
partagent la même liste de sorties cochées et le même écran d'aperçu.

---

## 2. Ce qui a été livré dans cette tranche

### 2.1 Médias (EF-16)

| Exigence | Livraison | Preuve |
|---|---|---|
| EF-16.1 types non supportés refusés avec message | `importStream` refuse et renvoie un message lisible, jamais une pile d'appels | `app/tests/assets.test.mjs` |
| EF-16.3 import par bouton, glisser-déposer, sélection multiple | `#mediaPick` (multi) et dépôt d'un fichier n'importe où dans le studio : un média part dans le module Médias, pas dans l'import texte | `wireExtraModules`, gestionnaire `drop` |
| EF-16.4 copie dans le dossier du projet | `assets/media/…`, le projet reste transportable | `app/tests/assets.test.mjs` |
| EF-16.8 doublon signalé et réutilisé | empreinte `sha256`, aucun second fichier écrit | idem |
| EF-16.9 miniature | miniature demandée à l'import, affichée dans la grille (`/api/assets/<sha>/thumb`) | idem |
| Bibliothèque filtrée | `GET /api/media` ne renvoie **que** ce qui est affichable (images, vidéos, PDF), recherche sans accents ni casse | `app/tests/modules.test.mjs` |
| Une scène sert toute la bibliothèque | `mediaScene()` : le calque image porte `assetSource: 'content'`, l'identifiant du média vient du contenu diffusé | `app/tests/modules.test.mjs` |
| EF-16.18 à EF-16.20 vidéo | la sortie lit `<video autoplay muted loop>`, l'éditeur la montre avec ses contrôles ; le cadre (entier / remplir / étirer) se règle au studio et suit le média | idem |

### 2.2 Habillage (EF-19)

| Exigence | Livraison |
|---|---|
| EF-19.1 nom + fonction | deux champs, deux calques liés (`title`, `announcement`) dans `lowerThirdScene()` |
| EF-19.3 disparition automatique ou manuelle | durée en secondes (`0` = reste jusqu'à « Couper »), minuteur côté studio, bouton « Couper » |
| EF-19.4 indépendance des autres contenus | voir § 3 : le calque ne se pose jamais sur une sortie occupée par un contenu principal |
| EF-19.6 bandeaux réutilisables et nommés | enregistrés dans `library/lowerthirds/` (un fichier par bandeau, révisions gérées) — plus de cache navigateur |
| EF-19.7 positionnement éditable | un habillage **est** une scène : il s'ouvre et se modifie dans `scene.html` |
| EF-19.8 rendu transparent | `transparent: true` sur la scène et sur la sortie dédiée, pour le keying OBS/vMix |
| EF-19.9 les dispositions sont des scènes | `lowerThirdScene()` livrée et câblée dès qu'une sortie accepte ce type |

### 2.3 Minuteur (EF-18)

| Exigence | Livraison |
|---|---|
| EF-18.1 deux natures | compte à rebours **et** chronomètre, bouton de bascule |
| EF-18.2 démarrer, pause, réinitialiser | `Espace` pour (re)prendre, `Retour arrière` pour réinitialiser, rappels 5/10/15/20/30 min en un clic |
| EF-18.3 seuils configurables | « Alerte (min) » et « Rouge (min) », transmis dans le message diffusé |
| EF-18.6 coupe indépendante | `POST /api/live/clear` accepte désormais `kind` : couper le minuteur laisse le verset affiché |
| EF-18.7 format | `mm:ss` sous l'heure, `h:mm:ss` au-delà |
| EF-18.8 survit à un rechargement | l'état est écrit dans `session-state.json` (`timer`), relu au démarrage ; `PUT /api/session` **fusionne** au lieu d'écraser |
| EF-18.9 couleurs des seuils | le blanc passe à l'orange puis au rouge, avec clignotement doux (`prefers-reduced-motion` respecté) |
| Le décompte continue sans ce poste | **la sortie calcule le temps elle-même** à partir de `endsAt` : fermer le studio ou perdre la connexion ne fige pas l'écran |

---

## 3. La règle qui rend le direct fiable : le routage des calques

Une sortie ne porte **qu'un seul contenu** à l'antenne. Envoyer un habillage sur
« Plein écran — Salle » éteindrait donc le verset en cours. La règle, écrite une
seule fois dans `app/src/core/overlay.mjs` (partagée par le studio, le serveur et les
tests), est la suivante :

1. s'il existe une sortie **dédiée** aux calques (transparente, qui ne reçoit ni Bible
   ni chants), le calque part là, que le régisseur l'ait cochée ou non ;
2. sinon, une sortie cochée qui accepte ce type **et ne porte rien d'essentiel** ;
3. sinon, n'importe quelle sortie libre qui l'accepte — et le studio le dit ;
4. si toutes les candidates sont occupées par un contenu principal, le studio **crée
   la sortie dédiée** (avec sa scène, donc modifiable), en une seule écriture, et le
   message l'annonce :

   > `Sortie « Habillage » créée : le calque s'y pose sans éteindre le contenu en cours.`

`live.clear()` accepte un `kind` : la coupe d'un calque ne vide pas la sortie, elle ne
concerne que le contenu demandé (`cleared` / `kept` dans la réponse, pour que le studio
affiche exactement ce qui s'est passé).

---

## 4. Vue par vue : où est passée la V1

| Écran V1 | Aujourd'hui | État |
|---|---|---|
| `bible_control_display_pro.html` | module Bible du studio + `/o/<sortie>` | livré, y compris la saisie lettres → `Entrée` → chiffres |
| `lyrics_control_display_pro.html` | module Chants (conducteur, arrangements, étapes) | livré |
| `media_control_display_pro.html` | module Médias | livré (file d'attente et PDF multi-pages : à faire) |
| `obs_lower_third_ultimate_studio.html` | module Habillage | livré (logo : à faire) |
| `timer-control-updated.html` / `timer-display-updated.html` | module Minuteur + sortie qui calcule le temps | livré |
| `looks_editor.html` | `/scene.html` (scènes + looks) | livré |
| `studio_unifie.html` | `/studio.html`, six modules au lieu de quatre | livré |
| `index.html` (Command Center) | `/` (accueil : sorties, antenne, événements, profils) | livré |
| `mur_previews.html` | cartes d'aperçu de l'accueil, un seul écran | livré |
| `cue_list.html` | `/plan.html` (Espace, flèches, `Échap`) | livré |
| `vue_pasteur.html` | — | **pas encore porté** (EF-24) |
| `pasteur_control.html` | — | **pas encore porté** (EF-25) |
| `stage_display.html` | — | **pas encore porté** (EF-24) |

---

## 5. Vérifications

- `npm test` : **279 / 279** tests, 24 fichiers (dont `app/tests/modules.test.mjs`, 16 tests sur cette tranche).
- `npm run schema:check` et `npm run trace:check` : conformes.
- Audit fonction par fonction sur le serveur en cours d'exécution : **71 routes et pages** testées (socle, pages, Bible, chants, annonces, recherche, diffusion, scènes, profils, événements, médias) — 70 conformes, 1 attente de test à corriger dans le script d'audit : `POST /api/events/:id/occurrences` renvoie bien `400 Cet événement n'est pas récurrent.` sur un événement ponctuel, et `201` avec trois occurrences-created quand la récurrence est hebdomadaire (vérifié séparément).
- Parcours réel derrière le proxy d'aperçu : six pages en `200`, WebSocket en `101`, `POST /api/live/show` et `/api/live/clear` acceptés, adresse IP du réseau local toujours en `401` sans jeton.
- Vérification du routage des calques sur le projet de démonstration : verset sur la salle, minuteur sur la sortie `Habillage`, puis `clear {kind:'timer'}` → le verset reste à l'antenne, seul le bandeau se vide.

---

## 6. Dettes assumées à cette étape

1. **File d'attente des médias** (EF-16.28 → 16.30) et lecture **PDF page à page** (EF-16.22 → 16.27) : la bibliothèque, l'import et l'affichage fonctionnent, l'enchaînement automatique non.
2. **Synchronisation vidéo multi-sorties à 120 ms** (EF-16.18, EF-16.19) et pause depuis le studio (EF-16.20) : chaque sortie lit indépendamment ; le recalage n'est pas implémenté.
3. **Logo d'habillage** (EF-19.5) et animations d'entrée/sortie réglées par bandeau (EF-19.2) : la scène le permet déjà, le module ne l'expose pas encore.
4. **File de décomptes** (EF-18.5) : un seul minuteur à la fois ; les rappels 5/10/15/20/30 min couvrent l'usage courant.
5. Vue scène, télécommande et écran de scène (EF-24, EF-25) : les trois écrans V1 correspondants restent à porter, voir `docs/spec/15-scene-et-telecommande.md`.
6. Les trois modules ajoutés n'ont pas encore de **glisser-déposer** sur la scène : tout se règle par les champs du module puis dans l'éditeur de scène.
