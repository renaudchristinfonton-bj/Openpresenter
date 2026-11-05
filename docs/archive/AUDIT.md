# Audit OpenPresenter — viser le niveau "professionnel"

**Date :** 2026-08-14
**Objet :** audit complet de l'existant + étude du fonctionnement de ProPresenter pour identifier comment aller plus loin, en particulier sur **la facilité d'utilisation, de configuration et d'installation**, même pour un débutant ("novice").

---

## Sommaire

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Audit technique de l'existant](#2-audit-technique-de-lexistant)
3. [Comment fonctionne ProPresenter (workflow pro)](#3-comment-fonctionne-propresenter-workflow-pro)
4. [Écarts & forces : comparaison côte à côte](#4-écarts--forces--comparaison-côte-à-côte)
5. [Le vrai verrou : l'expérience débutant](#5-le-vrai-verrou--lexpérience-débutant)
6. [Plan d'action recommandé (priorisé)](#6-plan-daction-recommandé-priorisé)
7. [Décisions à trancher](#7-décisions-à-trancher)

---

## 1. Résumé exécutif

OpenPresenter est **techniquement déjà très solide** : 4 outils spécialisés (Bible, Paroles, Médias, Lower Third), rendu professionnel avec anti-débordement automatique, sorties OBS multi-modes, synchronisation réseau par WebSocket sans dépendance, file de déroulement, sauvegardes, et un command center. Le **fond manque peu** : ce qui sépare un outil "très bon" d'un outil "de niveau ProPresenter" **n'est plus une fonctionnalité de rendu, c'est l'expérience de bout en bout** — depuis l'installation jusqu'au déroulé d'un culte complet, en passant par la configuration.

ProPresenter gagne depuis 20 ans non pas sur une fonction unique, mais parce que **le workflow d'un service du dimanche est intégré au cœur du produit** : les chants sont des "arrangements" réordonnables en direct, les sorties multiples (public / scène / stream) sont natives, les "Looks" changent tout l'habillage d'un clic, et surtout **l'installation pour un bénévole** est pensée dès la première minute.

> **Thèse de l'audit :** pour viser le niveau professionnel, il faut moins ajouter de fonctions de rendu que **reconstruire l'expérience "débutant"** : installation en 2 clics, assistant de configuration, sorties multiples faciles (stage display / stream / public), un vrai flux "ordre de service" et des modèles prêts à l'emploi.

---

## 2. Audit technique de l'existant

### 2.1 Architecture (points forts)
- **Zéro dépendance npm** : le serveur (`sync-relay-server.js`) tourne en Node pur. Un point énorme pour l'installation novice.
- **Relais WebSocket + BroadcastChannel** : contrôleur et affichage OBS parlent en temps réel, localement ET sur le réseau, sans config OBS.
- **4 outils autonomes + Studio Unifié + Mur de sorties** : bonne granularité, chaque outil a son contrôleur et son mode OBS (`?obs=true`).
- **Module partagés** (`js/remote-channel.js`, `js/obs-links.js`, `js/ui.js`, `store.js`, `js/qrcode.js`) : le refactor a éliminé la duplication.
- **Sauvegardes globales** (`/api/export`, `/api/import`) et données centralisées sur disque (`data/`).
- **Générateur QR autonome** : accès mobile sans internet.

### 2.2 Faiblesses techniques / points de friction

| # | Constat | Impact novice | Sévérité |
|---|---------|---------------|----------|
| F1 | L'installation exige d'**installer Node.js à la main** puis de lancer un script `.bat`/`.command` dans un terminal | Très élevé — c'est le premier obstacle | 🔴 |
| F2 | La configuration OBS (Canvas, Sources Navigateur) reste **semi-manuelle** : le bouton "Installer OBS" crée les sources, mais il faut activer obs-websocket, régler le Canvas, vérifier | Élevé | 🔴 |
| F3 | Pas de **sorties multiples natives** (public / scène "stage display" / stream) pensées comme dans ProPresenter : on a des modes OBS, mais pas un concept "Screen/Output" | Moyen | 🟠 |
| F4 | Les **"Looks"** (habillages globaux : "culte", "annonces", "sermon") n'existent pas — chaque outil a ses réglages séparés | Moyen | 🟠 |
| F5 | **Pas de modèle prêt à l'emploi** pour démarrer (aucun chant d'exemple, aucune Bible pré-chargée automatiquement, aucun lower third de démo visible) | Moyen | 🟠 |
| F6 | La documentation est **répartie** (README.md, ROADMAP.md, AUDIT.md, LISEZ-MOI.md) et en partie obsolète (l'ancien "FreePresenter", le nom des fichiers) | Élevé pour l'orientation | 🟠 |
| F7 | Pas d'**assistant de premier lancement** ("Bienvenue, configurons ensemble") | Élevé | 🟠 |
| F8 | Aucun **mode hors-ligne simplifié / package autonome** (un seul dossier exécutable) | Élevé pour les non-techniciens | 🟠 |
| F9 | L'accès mobile (cue list) existe mais pas de **stage display** (écran pour la scène avec paroles suivantes) | Moyen | 🟡 |

### 2.3 Points de vigilance techniques
- **Sécurité** : le serveur n'a pas d'authentification ; c'est noté dans le code ("ne l'exposez pas sur Internet"). Pour un usage pro en local c'est acceptable, mais à documenter clairement.
- **CDN** : le Command Center est maintenant 100% autonome (QR local), mais les outils chargent encore **Tailwind + polices Google depuis CDN**. **Hors-ligne, l'interface contrôleur casse.** C'est un point majeur pour la fiabilité "en salle".
- **obs-websocket** : implémentation faite à la main (protocole v5). Robuste mais non testée contre une vraie instance OBS ici.

---

## 3. Comment fonctionne ProPresenter (workflow pro)

Recherches effectuées (sources : guides, Renewed Vision, communautés). Voici le **modèle mental** de ProPresenter, que je recommande d'inspirer :

### 3.1 Le modèle "Presentation / Slide / Arrangement"
- Une **Presentation** = un document (un chant, un sermon, une série d'annonces).
- Un chant n'est **pas** une liste de slides figées : c'est un **arrangement** (Verse 1, Chorus, Verse 2, Bridge…) dont **l'ordre peut être reconstruit en direct** pendant le culte (le leader répète un pont, saute un couplet…).
- Chaque slide **hérite d'un thème (Look/Theme)** : police, fond, safe-area. Un bénévole change l'habillage global sans toucher au contenu.

### 3.2 Les sorties multiples (le différenciateur)
ProPresenter envoie **différentes choses à différentes sorties en même temps** :
- **Audience** (grand écran) : paroles plein écran sur fond animé.
- **Stage Display / Confidence Monitor** (écran face à la scène) : paroles actuelles + **prochaines** paroles + chrono + notes.
- **Stream / Live** : souvent des lower thirds sur la caméra (keying alpha).
- **Lobby** : comptes à rebours.

C'est le cœur de "Pourquoi on choisit ProPresenter" : **un opérateur pilote tout depuis une machine**, chaque écran ayant son propre look.

### 3.3 Les "Looks" & "Macros" (changement d'ambiance en un clic)
- Un **Look** = un habillage complet (fond, position du texte, animations) appliqué à une sortie.
- Exemples vus : Look "Lyrics", "Scripture", "Announcements", "Sermon Notes".
- Une **Macro** = une séquence d'actions (ex. au début du culte : Look "Lyrics" + lancement du fond de louange ; aux annonces : Look "Announcements" + slideshow).

### 3.4 Intégration planning (Planning Center / SongSelect)
- L'**ordre de service** préparé par le directeur de culte (Planning Center) s'importe **d'un clic** dans ProPresenter → la file de déroulement est prête.
- Les chants s'importent depuis SongSelect/PraiseCharts avec paroles + accords + métadonnées CCLI.
- Bénéfice : l'équipe **planifie dans un seul outil**, le reste en découle. Moins de saisie manuelle, moins d'erreurs.

### 3.5 L'expérience débutant (ce que nous pouvons répliquer)
- **Modèles et exemples** fournis d'office (fond animé, lower third de démo, chant exemple).
- **Assistant de configuration** guidé (nombre d'écrans, résolution, sorties).
- **Stage display** qui "change tout" selon les guides — coût faible, impact fort.
- Interface pensée "par défaut correct" (le texte ne déborde jamais, tout est centré).

---

## 4. Écarts & forces : comparaison côte à côte

| Capacité | ProPresenter | OpenPresenter | Écart |
|----------|--------------|---------------|-------|
| Paroles plein écran + fond animé | ✅ | ✅ (fond image/vidéo) | Combler : boucle vidéo de fond prête |
| Arrangement réordonnable en direct | ✅ | ⚠️ sections de chant, mais pas de "réordonner en direct" | Moyen |
| Sorties multiples (public/scène/stream) | ✅ natif | ⚠️ modes OBS via lockMode, mais pas de "stage display" | **Important** |
| Stage display (paroles suivantes + chrono) | ✅ | ❌ | **À ajouter** |
| Looks / habillage global par clic | ✅ | ⚠️ réglages par outil | Important |
| Intégration planning (order de service) | ✅ PCO | ⚠️ cue list manuelle | Moyen |
| Bible multi-traductions | ✅ 125 traductions | ✅ import XML (5 dispo) | Bien |
| Lower thirds animés | ✅ | ✅ très bon (animations, logo) | Bien |
| Alpha key / sortie transparente | ✅ | ❌ | Avancé |
| Installation novice | ⚠️ payant/complexe | ⚠️ exige Node.js manuel | **À améliorer** |
| Hors-ligne complet | ✅ | ⚠️ dépend encore du CDN pour l'UI | **À corriger** |

---

## 5. Le vrai verrou : l'expérience débutant

Pour un **novice** (bénévole qui n'a jamais touché à un terminal ni à OBS), le parcours idéal est :

```
1. TÉLÉCHARGER  →  un dossier ou un .exe unique ("tout est dedans")
2. LANCER       →  double-clic, ça tourne, ça ouvre le navigateur tout seul
3. ASSISTANT    →  "Bonjour ! Combien d'écrans ? Quelle résolution ?"
4. MODÈLES      →  des chants, versets, fonds et titres de démo déjà en place
5. OBS          →  bouton "Créer les scènes OBS" (déjà fait)
6. SCÈNE        →  un écran "scène" (stage display) pour les musiciens
7. DÉROULÉ      →  la file de déroulement prête pour le service
```

L'audit technique (section 2) montre que les **points 5 et 7 existent déjà**, mais que les **points 1, 2, 3, 4 et 6** manquent ou sont trop manuels. Ce sont eux qui font le niveau "pro/débutant-friendly".

---

## 6. Plan d'action recommandé (priorisé)

Priorisation par **impact pour un novice / effort** :

### Priorité haute — rend l'outil utilisable par un débutant en 10 minutes

**P1. Emballage autonome (supprime l'installation Node.js manuelle)**
- Fournir un **installeur par plateforme** : un seul fichier `.exe` (Windows) / `.app` (Mac) / binaire Linux qui embarque Node.js et lance le serveur + ouvre le navigateur.
- Le plus simple sans lourdeur : **des scripts qui téléchargent/attachent Node portable**, ou un `nexe`/`pkg` pour empaqueter le serveur. Le serveur n'a **aucune dépendance**, donc un binaire autonome est très réalisable.
- Au lancement : **ouvrir automatiquement le navigateur** sur `http://localhost:8787/`.

**P2. Supprimer toute dépendance CDN (hors-ligne garanti)**
- Remplacer **Tailwind CDN** et **polices Google** par des ressources locales (fichiers CSS/polices embarqués) dans les 4 outils.
- C'est le seul risque de "l'outil casse en salle sans internet". Priorité technique élevée.

**P3. Assistant de premier lancement**
- Au premier démarrage (une petite bannière/config stockée), guider :
  1. Choisir le nombre de sorties (1 public / + scène / + stream) ;
  2. Définir la résolution (1920×1080 par défaut) ;
  3. Proposer de lancer "Installer OBS" et "Télécharger des Bibles de démo" ;
  4. Lien vers un modèle de démo.
- Implémentable dans le Command Center (stocké dans `data/` ou localStorage).

**P4. Stage display (écran scène)**
- Ajouter une **sortie "scène"** : une page `stage_display.html?obs=true` qui affiche, pour l'outil Paroles (et Bible), les **paroles actuelles + les prochaines**, avec un chrono, à destination d'un écran face à la scène.
- C'est "l'élément qui change tout" selon les guides ProPresenter, et coût d'implémentation modéré (réutilise le canal de diffusion).

### Priorité moyenne — fiabilise et rend "pro"

**P5. Looks / habillage global par clic**
- Un sélecteur global "Look" (Culte / Annonces / Sermon) dans le Studio Unifié qui applique un jeu de réglages prédéfini (couleur, police, mode d'affichage) à tous les outils d'un coup.
- Implémentation : un objet JSON de presets "Look" + application sur chaque outil.

**P6. Modèles & contenus de démo fournis**
- Livrer par défaut : 1-2 chants d'exemple, 1 lower third de démo, 1 fond vidéo (ou instructions), Bibles pré-chargées (déjà dans `BIBLES/`).
- Vérifier au premier lancement et proposer "Charger les exemples".

**P7. Documentation unifiée**
- Fusionner en une seule **DOCUMENTATION.md** (ou `guide/`) : installation, configuration OBS, sorties, FAQ débutant, dépannage. Retirer les docs obsolètes (LISEZ-MOI qui parle de "3 outils" et de l'ancien nom).

**P8. Connexion OBS fiabilisée**
- Tester le bouton "Installer OBS" contre une vraie instance obs-websocket ; ajouter un état "OBS connecté/non connecté" visible, et une aide pas-à-pas si la connexion échoue.

### Priorité avancée — différenciateurs pro

**P9. Sortie transparente / alpha-key (pour stream)**
- Un mode de sortie où le texte est rendu sur fond vert ou alpha pour être incrusté par un mélangeur (ATEM) au-dessus de la caméra. C'est le gros différenciateur ProPresenter.

**P10. Import d'ordre de service (Planning Center / format standard)**
- Import d'un JSON/CSV d'ordre de service → génère la cue list automatiquement. S'adapte aux églises qui planifient ailleurs.

**P11. Accords & transposition (paroles)**
- Saisie d'accords au-dessus des paroles + transposition (comme VideoPsalm/ProPresenter). Utile pour les musiciens sur le stage display.

---

## 7. Décisions à trancher

Pour avancer efficacement, voici les choix à faire :

1. **Emballage (P1)** : on vise quoi en premier ?
   - (a) Scripts "portable Node" (simple, multiplateforme) ;
   - (b) Binaire autonome unique par plateforme (`pkg`/`nexe`) ;
   - (c) Laisser Node.js manuel et documenter (plus simple, moins "pro").

2. **Hors-ligne (P2)** : priorité haute à embarquer Tailwind + polices en local ? (recommandé : oui)

3. **Stage display (P4)** : on l'ajoute ? C'est le gain "scène" le plus visible. (recommandé : oui)

4. **Looks (P5)** : utile ou on garde la simplicité actuelle ?

5. **Modèles de démo (P6)** : on fournit quels contenus par défaut ?

---

*Document d'audit établi sur l'état du dépôt au 2026-08-14. Les recommandations sont des pistes ; leur implémentation est à valider selon les priorités du projet.*
