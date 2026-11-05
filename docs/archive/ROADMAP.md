# OpenPresenter — Feuille de route (Facilité d'usage)

> **Note audit** : voir `AUDIT.md` (audit complet + étude de ProPresenter) et `AUDIT_STREAMING.md` (comparatif face aux meilleurs logiciels de streaming/régie). Les prochaines priorités y sont détaillées : Stage display, hors-ligne total, binaire autonome, Looks/Macros, sortie alpha.



> **État de la feuille de route** (mis à jour automatiquement au fil des livraisons) :
>
> ✅ **Phase 0 livrée** — Axe B (Command Center) + Axe A (données centralisées, infra + intégration Lower Third, Bible et Paroles).
>
> ✅ **Phase 1 livrée** — Axe C (installation OBS en 1 clic via obs-websocket) + Axe D (découverte réseau : beacon UDP, endpoint /api/info, code QR).
>
> ✅ **Phase 3 livrée** — Axe G (file de déroulement / cue list) + Axe F (contrôleur mobile via la cue list responsive) via `cue_list.html`.
>
> ✅ **Phase 2 livrée** — Axe E (refactor : modules partagés `js/remote-channel.js`, `js/obs-links.js`, `js/ui.js` — suppression des copies dupliquées dans les 4 outils).
>
> ✅ **Phase 4 livrée** — Axe H (sauvegardes/export globaux : boutons Sauvegarder tout / Restaurer + endpoints `/api/export` et `/api/import`).
>
> **🏁 Toutes les phases du plan sont livrées.**

---

## Progression détaillée

### ✅ Fait — Axe B : Command Center
- `servergestionobs/index.html` : page d'accueil servie sur `/` par le serveur relais, avec :
  - cartes cliquables des 6 outils + bouton « Copier lien OBS » par outil ;
  - adresses d'accès (« Sur ce PC » / « Depuis le réseau ») affichées et copiables en 1 clic (injectées par le serveur) ;
  - assistant de démarrage en 3 étapes ;
- `sync-relay-server.js` : la route `/` sert `index.html` en y injectant les adresses réseau.

### ✅ Fait — Axe A : données centralisées (fondation)
- `sync-relay-server.js` : routes REST `GET`/`PUT /data/<namespace>/<cle>.json` écrivant dans le dossier `data/` (git-ignoré) ;
- `servergestionobs/store.js` (`window.OpenStore`) : écrit toujours en local (filet de secours) + synchronise en arrière-plan vers le serveur ; `pullIfLocalEmpty()` pour rapatrier les données si le stockage local d'un nouveau PC est vide ;
- intégré dans :
  - **Lower Third** : présets (`lt/presets`) ;
  - **Bible** : favoris (`bible/favs`), position (`bible/position`), réglages (`bible/displaySettings`) ;
  - **Paroles** : réglages (`lyrics/displaySettings`), dernier chant (`lyrics/lastSongId`).
- `store.js` est inclus dans les 4 outils (Bible, Paroles, Médias, Lower Third) pour de futures extensions.

### ✅ Fait — Axe C : installation OBS en 1 clic
- Bouton **« 🎬 Installer les scènes OBS »** dans le Command Center.
- Pilote OBS via **obs-websocket v5** en **WebSocket natif** (JSON-RPC, op 1 = Identify avec authentification SHA-256, op 6 = Request) — aucune dépendance à installer.
- Crée automatiquement : les 6 **Sources Navigateur** (BIBLE PLEIN ECRAN, BIBLE BAS CENTRE, PAROLES PLEIN ECRAN, PAROLES BAS CENTRE, MEDIAS + PRESENTATIONS, TITRES) à 1920×1080, et les scènes **PRESENTATION PLEIN ECRAN**, **PRESENTATION BAS CENTRE**, **TITRES** — en évitant les doublons.
- Demande port + mot de passe obs-websocket et affiche un journal d'avancement en direct.

### ✅ Fait — Axe D : découverte réseau
- **Beacon UDP** : le serveur diffuse périodiquement sa présence sur le réseau local (port 8788) et les autres serveurs OpenPresenter se détectent mutuellement (affichés dans le terminal).
- **Endpoint `/api/info`** : renvoie les adresses réseau en JSON (pour d'éventuels outils).
- **Code QR** sur le Command Center : scannez-le depuis un téléphone connecté au même réseau pour ouvrir OpenPresenter en mobile.

### ✅ Fait — Axes G + F : file de déroulement & contrôleur mobile
- **`cue_list.html`** : une page **responsive et optimisée tactile** (utilisable sur téléphone/tablette = contrôleur mobile) pour enchaîner l'ordre de service.
- Elle charge les 4 outils en **iframes cachées** et réutilise leurs fonctions de diffusion (`triggerDisplay`, `activateItem`, `applyPreset`+`cmdPlay`, `clearOBS`).
- **Types de cues** : verset biblique, section de chant, média, lower third (présentateur), écran noir/couper.
- **Éditeur** : les listes déroulantes (livres/chapitres/versets, chants/sections, médias, présets) sont alimentées **automatiquement** depuis les outils chargés.
- **Pilotage en une touche** : gros bouton vert **Avancer** (ou `Espace` / `→`), bouton rejouer, bouton couper tout ; panneau « En cours / Suivant » ; navigation au clavier.
- **Persistance** : la file est enregistrée en local **et** synchronisée via OpenStore (axe A) — elle vous suit d'un PC à l'autre.
- Ajoutée au **Command Center** (carte « File de déroulement »).

### ✅ Fait — Axe E : refactor des modules partagés
- Création de **`js/remote-channel.js`** (classe `RemoteChannel` + `updateSyncBadge`), **`js/obs-links.js`** (`initObsLinksPanel`, `copyToClipboard`, `fallbackCopyToClipboard`) et **`js/ui.js`** (`safeParseLocal`, `rgbaToHexAndOpacity`, `hexToRgba`).
- **Suppression des copies dupliquées** à l'intérieur des 4 outils (Bible, Paroles, Médias, Lower Third), qui chargent désormais les modules partagés.
- Bénéfices : une seule source de vérité, moins de risque d'incohérence, futures évolutions plus sûres.
- Nota : `hexToRgba`/`rgbaToHexAndOpacity` de Bible & Paroles sont identiques et centralisés ; le Lower Third garde son propre `hexToRgba` (sémantique d'opacité différente). L'anti-débordement (`autoFitDisplay`) reste par outil car il diffère par sélecteur.

### ✅ Fait — Axe H : sauvegardes & export globaux
- **Command Center** : bouton **« ⬇️ Sauvegarder tout »** qui regroupe dans un seul fichier JSON :
  - les données centralisées serveur (axe A),
  - les clés `localStorage` (favoris, réglages, présents, file de déroulement, groupes),
  - les bibliothèques **IndexedDB** (versions Bible, chants, médias — avec les blobs image/vidéo encodés).
- Bouton **« ⬆️ Restaurer une sauvegarde »** : réimporte le fichier (localStorage + serveur via `/api/import` + IndexedDB).
- Endpoints serveur **`GET /api/export`** et **`POST /api/import`** pour les données centralisées.

---



Ce document propose un plan d'évolution priorisé pour rendre OpenPresenter encore
plus simple à installer, à prendre en main et à utiliser au quotidien. Chaque axe
indique **pourquoi** c'est utile, **où** intervenir dans le code existant, et
**comment** l'implémenter.

> **Principe directeur** : l'outil est déjà très complet. L'enjeu n'est plus
> d'ajouter des fonctions, mais de **réduire la friction** — moins de copier-coller
> d'URL, moins de réglages à refaire sur chaque PC, moins d'étapes avant le premier
> culte réussi.

---

## Résumé des axes (par gain / effort)

| # | Axe | Gain | Effort | Phase |
|---|-----|------|--------|-------|
| A | Données centralisées sur le serveur (favoris, chants, médias suivent l'utilisateur) | ⭐⭐⭐⭐⭐ | Moyen | 0 |
| B | Page d'accueil / "Command Center" + assistant de démarrage | ⭐⭐⭐⭐ | Faible | 0 |
| C | Ajout des scènes & sources OBS en 1 clic (obs-websocket) | ⭐⭐⭐⭐⭐ | Moyen | 1 |
| D | Découverte automatique sur le réseau (mDNS / adresse stable) | ⭐⭐⭐⭐ | Faible | 1 |
| E | Factoriser le code partagé (5 copies de RemoteChannel → 1 module) | ⭐⭐⭐⭐ (maintenance) | Moyen | 2 |
| F | Contrôleur mobile / tablette simplifié | ⭐⭐⭐⭐ | Moyen | 3 |
| G | "Cue list" / file de déroulement du culte | ⭐⭐⭐⭐⭐ | Moyen | 3 |
| H | Sauvegarde / export global + auto-save | ⭐⭐⭐⭐ | Faible | 4 |

---

## Phase 0 — Gains rapides (faible effort, impact immédiat)

### A. Données centralisées sur le serveur (vos réglages vous suivent)

**Problème.** Les favoris Bible, les chants, les médias, les designs de lower
third et les groupes sont stockés **par navigateur** (`localStorage` /
`IndexedDB`). Dès qu'on change de PC, qu'on vide le cache d'OBS, ou qu'on ouvre
l'outil depuis un autre poste du réseau, on repart de zéro.

**Solution.** Faire de `sync-relay-server.js` une **vraie petite API de données**,
avec un dossier `data/` sur disque, et faire "téléverser" chaque outil vers elle
en plus du stockage local (qui reste un filet de secours hors-ligne).

**Implémentation.**
1. Dans `servergestionobs/sync-relay-server.js`, ajouter 2 routes REST :
   - `GET  /data/:namespace/:key` → lit `data/<namespace>/<key>.json` sur disque ;
   - `PUT  /data/:namespace/:key` → écrit ce fichier (avec `fs.mkdirSync` récursif).
2. Créer un petit module `store.js` (système "déconnectable") :
   ```js
   // store.js — sauvegarde localement (localStorage/IndexedDB) puis, si le
   // serveur relais est joignable, synchronise en arrière-plan vers /data/...
   const Store = {
       async get(ns, key, fallback) { /* IndexedDB d'abord, puis GET serveur */ },
       async set(ns, key, value) { /* écriture locale + PUT serveur */ },
   };
   ```
3. Brancher ce module sur les points d'écriture existants :
   - Bible : `saveFavorites()`, `addVersion()`, `savePosition()` ;
   - Paroles : `idbPutSong()`, `idbPutMedia()`, `saveDisplaySettingsJSON()` ;
   - Médias : `idbPutItem()` ;
   - Lower Third : `saveDesign()` / `localStorage.setItem('lt_presets', …)`.

**Bénéfice.** La bibliothèque et les réglages "voyagent" avec l'utilisateur sur
tous les PC du réseau — sans aucun compte ni abonnement, en gardant la philosophie
du projet.

---

### B. Page d'accueil / "Command Center" + assistant de démarrage

**Problème.** La page d'accueil actuelle (`/`) est une liste brute de liens. Un
nouvel arrivant ne sait pas par où commencer.

**Solution.** Remplacer la réponse HTML du serveur par un vrai tableau de bord :
- grosses cartes cliquables pour les 4 outils + le Studio Unifié + le Mur de sorties ;
- l'**adresse réseau** (`http://192.168.x.x:8787/`) affichée en gros avec un bouton
  « Copier » ;
- un **assistant de démarrage en 3 étapes** (« 1. Lancez le serveur · 2. Ouvrez le
  Studio · 3. Ajoutez les Sources OBS »), qui reste masquable une fois compris ;
- un lien direct vers `ROADMAP` / l'aide.

**Implémentation.** Le plus propre : créer `servergestionobs/index.html`, et faire
rediriger la route `/` de `sync-relay-server.js` vers ce fichier (au lieu de la
page générée en dur). La carte réseau est déjà calculée par `getLocalIPs()`.

---

### (Optionnel) Raccourcis clavier harmonisés

La navigation diapositives (← →) existe déjà dans les Médias. Harmoniser sur
tous les outils : `Espace` = afficher/rejouer, `Échap` = couper, `1-9` = sélection
rapide section/verset, `F` = plein écran contrôleur.

---

## Phase 1 — Installation & découverte plus simples

### C. Ajout des scènes & sources OBS en un clic

**Problème.** Aujourd'hui il faut **copier-coller manuellement** chaque URL comme
Source Navigateur dans OBS, régler la résolution, créer les scènes. C'est l'étape
la plus frustrante pour un bénévole.

**Solution.** Brancher un **script "Installer OBS"** qui pilote OBS via le plugin
**obs-websocket** (gratuit, standard) pour **créer automatiquement** les scènes et
les sources navigateur à partir d'un modèle — exactement ce que décrit déjà
`iccpahou.json` (BIBLE BAS CENTRE, PAROLES PLEIN ECRAN, TITRES, MEDIAS…).

**Implémentation.**
1. Ajouter dans `package.json` une vraie dépendance (ex. `obs-websocket-js`) — ou
   garder zéro-dépendance et parler au protocole WebSocket obs-websocket à la main
   (le serveur sait déjà parser les frames WS !).
2. Créer un bouton « 🎬 Installer dans OBS » sur la page d'accueil (et dans le
   Studio Unifié) qui :
   - demande l'adresse OBS (`ws://localhost:4455`) + mot de passe (champ déjà
     pré-rempli) ;
   - crée les scènes et Sources Navigateur en reproduisant le gabarit `iccpahou.json`,
     avec les bonnes URL `?obs=true&lockMode=…` et la bonne résolution (1920×1080).
3. Proposer aussi un **export** d'un fichier de scène OBS à importer (l'actuel
   `iccpahou.json` peut devenir le point de départ).

**Bénéfice.** On passe de ~20 clics de configuration à **1 bouton**.

---

### D. Découverte automatique sur le réseau

**Problème.** Retenir/taper une IP (`192.168.x.x:8787`) à la main, c'est source
d'erreurs.

**Solution.**
1. **Nom stable** : servir sur un nom local type `http://openpresenter.local:8787`
   (via Zeroconf/mDNS, ou au moins en l'affichant dans le terminal).
2. **UDP beacon** : le serveur peut diffuser un message de présence sur le réseau
   (broadcast UDP) ; un petit écouteur sur la page d'accueil (ou un outil de
   découverte) liste automatiquement les serveurs OpenPresenter trouvés.

**Implémentation.** Dans `sync-relay-server.js`, ajouter un socket UDP qui envoie
`{ type:'openpresenter', port:8787, host:'<ip>' }` toutes les ~3 s. Côté client,
un écouteur mDNS n'est pas trivial en pur JS — commencer donc par **1)** le nom
stable (gain immédiat) et garder 2) en option.

---

## Phase 2 — Consistance & maintenabilité (refactor)

### E. Factoriser le code partagé en modules communs

**Problème.** La classe `RemoteChannel` est copiée **à l'identique dans 5 fichiers**
(Bible, Paroles, Médias, Lower Third, et en partie le Studio). Idem pour
`initObsLinksPanel`, `copyToClipboard`, `updateSyncBadge`, `autoFitDisplay`, les
panneaux de personnalisation, etc. Chaque évolution doit être reportée 5 fois —
risque d'incohérence et frein à toute nouvelle fonctionnalité.

**Solution.** Extraire ces briques dans des fichiers JS partagés servis par le même
serveur :
- `js/remote-channel.js` (BroadcastChannel + WebSocket + sérialisation Blob) ;
- `js/store.js` (axe A) ;
- `js/obs-links.js` (liens généraux + à mode fixe + copie) ;
- `js/autofit.js` (anti-débordement texte) ;
- `js/ui.js` (toasts, modal maison, panneau de personnalisation).

Chaque page `.html` les charge via `<script src="js/..."></script>` et n'embarque
plus que sa logique métier propre.

**Bénéfice.** Une seule source de vérité : les correctifs et les nouvelles
fonctions (mobile, cue list…) se propagent partout sans effort. C'est **la
condition** pour rendre les phases 3-4 sûres à livrer.

---

## Phase 3 — Piloter plus simplement en direct

### F. Contrôleur mobile / tablette simplifié

**Problème.** Le Studio Unifié est une interface riche, pensées pour un écran
d'ordinateur. Sur une tablette posée près du musicien, c'est trop chargé.

**Solution.** Une page `remote_mobile.html` minimaliste :
- gros boutons tactiles pour la **file de déroulement** (axe G) ;
- affiche/rejoue/coupe pour chaque outil (réutilise les fonctions exposées, comme
  le fait déjà `studio_unifie.html` via `callToolFn`) ;
- pleine largeur, optimisée tactile, PWA (icône installable sur le téléphone).

**Implémentation.** Réutiliser exactement le mécanisme `callToolFn` de
`studio_unifie.html`, mais avec une interface dédiée + une file de déroulement.

### G. "Cue list" / file de déroulement du culte

**Problème.** Pendant un culte, la régie enchaîne chants, versets, médias et
annonces en suivant un ordre du service. Aujourd'hui il faut naviguer dans chaque
outil séparément.

**Solution.** Une **file d'ordre de service** : une liste séquentielle de "cues"
(chant + section, verset biblique, média, lower third, vide "écran noir").
- La régie **avance d'une cue à l'autre avec une touche** (flèche ou pied à
  pédale / Stream Deck) ;
- chaque cue déclenche l'outil concerné via le canal déjà existant ;
- le "next" est toujours visible pour anticiper.

**Implémentation.**
1. Stockage de la liste dans `Store` (axe A) — format simple :
   ```js
   cues: [ { kind:'bible', ref:'Jean 3:16' },
           { kind:'lyrics', songId:'…', sectionId:'…' },
           { kind:'media', itemId:'…', slide:3 },
           { kind:'lt', presetName:'Annonce' } ]
   ```
2. Un composant "File de déroulement" dans le Studio Unifié (et dans
   `remote_mobile.html`) qui appelle les fonctions déjà exposées par les iframes
   (`displaySelectedVerses`, `triggerDisplay`, `resendCurrent`, `cmdPlay`…).
3. Raccourci global pour avancer/reculer.

**Bénéfice.** C'est probablement l'ajout qui change **le plus** le quotidien d'une
régie de culte : un seul clic par élément, plus de recherche dans les listes.

---

### (Complément) Mode "Répétition / écran régie"
Un 2ᵉ écran pour le présentateur : texte de la cue en cours + chrono + prochaine
cue, sans le panneau de contrôle. Réutilise le canal de diffusion (page en
`?stage=true`).

---

## Phase 4 — Sauvegardes & partage

### H. Export / import global + sauvegarde automatique

**Problème.** Les données sont éparpillées dans 4 stockages locaux ; aucun moyen
de sauvegarder "tout le système" d'un coup ni de le transférer sur un autre
ordinateur.

**Solution.**
- Un bouton **« Sauvegarder tout »** sur la page d'accueil qui télécharge **un seul
  fichier** (JSON ou zip) contenant : versions Bible + favoris, chants, médias,
  groupes, designs lower third, file de déroulement, réglages.
- Un bouton **« Restaurer »** inversement.
- Option **auto-save** : avec l'axe A (serveur), écrire périodiquement un instantané
  horodaté dans `data/backups/`.

**Implémentation.** Agrégation via `Store.getAll()` (axe A) + réhydratation dans
chaque `init`. Puisque l'axe A aura déjà centralisé les données, l'export devient
quasi gratuit (un simple `JSON.stringify` de `data/`).

---

## Ordre de priorité conseillé

Pour **maximiser le confort d'usage** avec un effort raisonnable, je suggère :

1. **A (données centralisées)** puis **B (Command Center)** — tout de suite, faible
   risque, gain quotidien immédiat.
2. **C (installation OBS en 1 clic)** — l'étape la plus redoutée par les bénévoles.
3. **E (refactor modules)** avant d'attaquer le reste : ça sécurise tout ce qui suit.
4. **G (cue list) + F (mobile)** — le gros du confort en direct.
5. **D (découverte réseau) + H (sauvegardes)** — finitions.

---

## Points à trancher ensemble

- **Portée** : préférez-vous commencer par le confort *installation* (C/B/D) ou par
  le confort *usage quotidien* (A/G/F) ?
- **obs-websocket** : ok pour ajouter une dépendance npm (obs-websocket-js) pour
  l'installation automatique OBS, ou on garde le "zéro dépendance" du projet ?
- **Rétro-compatibilité** : les stockages locaux actuels (localStorage/IndexedDB)
  doivent rester fonctionnels en mode hors-ligne — on est d'accord pour garder
  localStorage en filet de secours ?
