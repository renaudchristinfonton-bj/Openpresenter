# 07 — Sorties et matrice de liens

> **Exigences couvertes :** EF-07, EF-08, ENF-13, ENF-20, principes P6
> **Module repris :** `openpresenter2/src/core/output-registry.mjs`,
> `openpresenter2/src/core/viewport.mjs`, `openpresenter2/obs/output.html`
> **Maquette :** MAQ-06 (Sorties et matrice de liens)

---

## 7.1 Les deux concepts

| Concept | Définition |
|---|---|
| **Sortie** | Une destination d'affichage. Possède un `id` stable, un nom, une résolution, un cadrage, un jeu de scènes et un filtre de contenu. Se consomme via **une URL**. |
| **Lien** | L'URL d'une sortie, éventuellement restreinte à un **type de contenu**. C'est ce que l'on colle dans OBS ou vMix. |

> Le besoin exprimé : *« deux sorties personnalisables, une sortie bas centré qui sera sur
> les scènes OBS/vMix qui doivent aller en ligne, et une sortie plein écran qui sort tout
> de façon plein écran. Mais à part ça, pour chaque type de sortie, je veux un lien
> d'affichage aussi, comme pour la bible, si j'ai des scènes avec des overlays qui doivent
> prendre juste la bible, ou juste les médias. »*

Deux niveaux sont donc nécessaires, et **les deux** sont spécifiés ici :
1. la **sortie** (EF-07) ;
2. la **matrice sortie × type de contenu** (EF-08).

---

## 7.2 EF-07 — Sorties

### 7.2.1 Sorties créées par défaut

À la création d'un projet, **exactement deux** sorties existent :

| `id` | Nom | Preset | Résolution | Cadrage | Transparent |
|---|---|---|---|---|---|
| `out_full` | **Plein écran — Salle** | `full` | 1920×1080 | `contain` | non |
| `out_bottom` | **Bas centré — Stream** | `bottom` | 1920×1080 | `contain` | **oui** |

**EF-07.1** — Ces deux sorties ne peuvent pas être supprimées tant qu'il en existe moins
de trois ; au-delà, elles redeviennent supprimables comme les autres.
**EF-07.2** — Un profil peut redéfinir entièrement la liste des sorties (voir
`13-profils.md`).

### 7.2.2 Presets de disposition

| Preset | Nom affiché | Usage |
|---|---|---|
| `full` | Plein écran | projecteur de salle, écran géant |
| `screen80` | 80 % écran | plein écran avec marge, fond visible autour |
| `bottom` | Bas centré | bandeau sur un stream |
| `bottom-right` | Bas droite | bandeau latéral |
| `lowerthird` | Lower third | bandeau de nom sur caméra |
| `custom` | Personnalisé | géométrie entièrement libre |

**EF-07.3** — Le preset ne sert qu'à **initialiser** les scènes créées pour cette sortie.
Une fois créées, les scènes sont indépendantes : changer le preset ne modifie pas les
scènes existantes (une confirmation est demandée si l'utilisateur le souhaite).

### 7.2.3 Propriétés d'une sortie

| Propriété | Type | Plage / valeurs | Défaut |
|---|---|---|---|
| `id` | chaîne | `[\w.-]{1,100}`, **stable à vie** (INV-5) | `out_<uuid>` |
| `name` | chaîne | 1 → 48 caractères, unique (insensible à la casse) | — |
| `preset` | enum | voir 7.2.2 | `full` |
| `width` | entier | 320 → 8192 | 1920 |
| `height` | entier | 180 → 8192 | 1080 |
| `fit` | enum | `contain` · `cover` · `stretch` | `contain` |
| `transparent` | booléen | — | selon le preset |
| `enabled` | booléen | — | `true` |
| `targetByDefault` | booléen | cochée par défaut lors d'une diffusion | `true` |
| `receives` | objet | voir 7.3.2 | tout à `true` |
| `scenesByKind` | objet | `kind → sceneId` | scènes par défaut |
| `notes` | chaîne | 0 → 500 caractères, non affichée à l'antenne | `""` |

**EF-07.4** — Limite : **32 sorties** par projet. Au-delà :
```
TXT: Maximum : 32 sorties.
```
**EF-07.5** — Un projet conserve **toujours au moins une sortie** activée :
```
TXT: OpenPresenter doit conserver au moins une sortie active.
```

### 7.2.4 Opérations

| Action | Raccourci | Comportement |
|---|---|---|
| Créer | — | ouvre le formulaire avec le preset choisi |
| Renommer | `F2` sur la sortie | `id` inchangé → **les liens OBS restent valides** |
| Dupliquer | — | nom `« X (copie) »`, `« X (copie 2) »`… ; nouveau `id` |
| Supprimer | `Suppr` | confirmation nommant la sortie ; les scènes orphelines sont proposées au nettoyage |
| Désactiver | — | la sortie disparaît des cibles de diffusion mais **conserve** sa configuration |
| Modifier les scènes | — | ouvre l'éditeur de scène pour le type de contenu choisi |
| Copier le lien | — | copie l'URL complète dans le presse-papiers |

**EF-07.6** — Renommer une sortie **ne casse jamais** un lien déjà collé dans OBS.
**EF-07.7** — Supprimer une sortie affiche :
```
TXT: Supprimer la sortie « Bas centré — Stream » ?

     Les scènes associées (6) seront conservées et pourront être
     réaffectées à une autre sortie.

     Les sources OBS pointant sur cette sortie afficheront une page vide.

     [S] Supprimer      [A] Annuler
```

### 7.2.5 Canevas normalisé et cadrage

**EF-07.8** — Toutes les scènes sont conçues sur un canevas **1920×1080**, quelle que
soit la résolution de la sortie. Les coordonnées sont en pourcentage de ce canevas.
**EF-07.9** — Le passage à la résolution réelle utilise `computeViewport()` :

| `fit` | Comportement |
|---|---|
| `contain` | échelle uniforme, tout le canevas visible, bandes éventuelles |
| `cover` | échelle uniforme, le canevas remplit tout, débordement rogné |
| `stretch` | échelle indépendante en X et Y (déformation) |

**EF-07.10** — Le transforme utilise `transform-origin: top left` avec des offsets
explicites (correctif CEF déjà présent dans `viewport.mjs`).
**EF-07.11** — Les viewport CSS **valides** sont toujours respectés tels quels, y compris
en haute densité de pixels (un CEF qui déclare 960×540 pour une source 1920×1080 n'est
**pas** promu en pixels physiques).
**EF-07.12** — `&debug=1` sur l'URL affiche un panneau :
```
CEF viewport: 1920×1080 CSS px · DPR 1
OBS URL: 1920×1080
Applied: 1920×1080 · scale 1.000×1.000 · offset 0.0,0.0
```

### 7.2.6 Interface « Sorties »

```
┌─────────────────────────────────────────────────────────────────────┐
│  SORTIES                                            [+ Créer une sortie]│
├──────────────────────┬──────────────────────────────────────────────┤
│  ● Plein écran Salle │  Nom        [Plein écran — Salle        ]    │
│  ● Bas centré Stream │  Disposition [Plein écran ▾]                 │
│  ○ Lower third Int.  │  Résolution  [1920] × [1080]   [16:9 ▾]      │
│                      │  Cadrage     (•) Contenant ( ) Couvrant      │
│                      │              ( ) Étiré                       │
│                      │  Transparent [✓] fond transparent (keying)   │
│                      │  Activée     [✓]                             │
│                      │  Cible par défaut [✓]                        │
│                      │                                              │
│                      │  Reçoit :  Bible ✓  Chants ✓  Médias ✓       │
│                      │            Annonces ✓  Habillage ✓  Minuteur ✓│
│                      │                                              │
│                      │  Scènes :  Bible      [Bas centré — S-Val ▾] │
│                      │            Chants     [Bas centré standard ▾]│
│                      │            Médias     [Média transparent ▾]  │
│                      │            Annonces   [—]                    │
│                      │            Habillage  [Lower third ICC ▾]    │
│                      │            Minuteur   [—]                    │
│                      │                                              │
│                      │  Notes      [Source navigateur OBS « … »  ]  │
│                      │                                              │
│                      │  [Aperçu en direct]  [Modifier les scènes…]   │
│                      │  [Dupliquer]  [Supprimer]                    │
└──────────────────────┴──────────────────────────────────────────────┘
```

**EF-07.13** — Chaque sortie affiche une **pastille d'état** : verte si une page de sortie
est connectée, grise sinon.
**EF-07.14** — L'aperçu en direct utilise exactement `render()` avec l'état courant de
diffusion (ENF-42).

---

## 7.3 EF-08 — Matrice de liens « sortie × type de contenu » ⭐

### 7.3.1 Format d'URL normatif

```
http://<hote>:<port>/o/<outputId>[?kind=<kind>][&fit=<fit>][&res=<W>x<H>][&debug=1][&t=<lanToken>]
```

| Paramètre | Valeurs | Défaut | Rôle |
|---|---|---|---|
| `<outputId>` | `id` stable de la sortie | obligatoire | choisit la sortie |
| `kind` | `bible` `songs` `media` `announcements` `lowerthird` `timer` `plan` | *(absent = tout)* | restreint au type de contenu |
| `fit` | `contain` `cover` `stretch` | valeur de la sortie | surcharge locale du cadrage |
| `res` | `<320-8192>x<180-8192>` | 1920x1080 | résolution déclarée par OBS |
| `debug` | `1` | — | panneau de diagnostic viewport |
| `t` | code d'accès LAN | — | requis si `lanTokenEnabled` et accès distant |

**EF-08.1** — Le chemin court `/o/<outputId>` est préféré à `/obs/output.html?scene=` pour
la lisibilité des liens collés dans OBS. L'ancienne forme reste acceptée (compatibilité).
**EF-08.2** — Un `outputId` inconnu affiche une page explicite, jamais un écran noir muet :
```
TXT: Sortie introuvable

     L'identifiant « out_xyz » n'existe pas dans ce projet.
     Il a peut-être été supprimé, ou ce lien provient d'un autre projet.

     Sorties disponibles :
       • Plein écran — Salle      http://localhost:8788/o/out_full
       • Bas centré — Stream      http://localhost:8788/o/out_bottom
```
**EF-08.3** — Un `kind` inconnu est **ignoré** (comportement « tout »), avec un
avertissement dans le journal.

### 7.3.2 Le filtre `receives`

Chaque sortie déclare les types de contenu qu'elle accepte :

```jsonc
"receives": {
  "bible": true, "songs": true, "media": false,
  "announcements": true, "lowerthird": true, "timer": false, "plan": true
}
```

| ID | Règle |
|---|---|
| EF-08.4 | Un type désactivé n'est **jamais** diffusé sur cette sortie, y compris via son URL directe `?kind=media` |
| EF-08.5 | Une URL `?kind=media` sur une sortie où `media: false` affiche : `TXT: Cette sortie ne reçoit pas les médias.` sur fond transparent |
| EF-08.6 | Les cases désactivées **grisent** la cellule correspondante dans la matrice (7.3.4) au lieu de la masquer, pour que l'utilisateur comprenne pourquoi |
| EF-08.7 | Une diffusion vers une sortie qui ne reçoit pas ce contenu est **ignorée silencieusement** pour cette sortie, avec un toast : `TXT: « Bas centré » ne reçoit pas les médias — sortie ignorée.` |
| EF-08.8 | `plan` contrôle la réception des cues de type `note` (repères non diffusés) |

### 7.3.3 Ce que chaque lien affiche

| Lien | Contenu reçu | Cas d'usage OBS |
|---|---|---|
| `/o/out_full` | tout ce que la sortie accepte | projecteur de salle |
| `/o/out_full?kind=bible` | **uniquement** les versets | scène « VERSETS PLEIN ECRAN » |
| `/o/out_full?kind=media` | **uniquement** les médias | scène « VISUELS » |
| `/o/out_bottom?kind=bible` | versets en bandeau | overlay stream |
| `/o/out_bottom?kind=songs` | paroles en bandeau | overlay stream louange |
| `/o/out_lt?kind=lowerthird` | habillages uniquement | keying noms d'intervenants |
| `/o/out_full?kind=timer` | compte à rebours | écran d'attente avant direct |
| `/o/out_full?kind=plan` | repères du plan | écran de conduite |

**EF-08.9** — Un lien avec `kind` n'affiche **rien** tant qu'aucun contenu de ce type
n'est diffusé : fond transparent si `transparent: true`, couleur de fond de la scène sinon.
**EF-08.10** — Diffuser un contenu d'un autre type **n'efface pas** ce lien : il continue
d'afficher le dernier contenu de son type. Un bouton « Couper ce lien » existe dans la
matrice pour le vider explicitement.

### 7.3.4 La matrice affichée dans l'interface

```
┌────────────────────────────────────────────────────────────────────────────┐
│  LIENS POUR OBS / vMix                                    [Installer dans OBS]│
├────────────────────┬────────┬────────┬────────┬────────┬────────┬──────────┤
│  SORTIE            │ Bible  │ Chants │ Médias │ Annonc │ Habill │ Minuteur │
├────────────────────┼────────┼────────┼────────┼────────┼────────┼──────────┤
│ Plein écran Salle  │  ⧉ 📱 │  ⧉ 📱 │  ⧉ 📱 │  ⧉ 📱 │  ⧉ 📱 │   ⧉ 📱  │
│ Bas centré Stream  │  ⧉ 📱 │  ⧉ 📱 │  ░░░░  │  ⧉ 📱 │  ⧉ 📱 │   ░░░░  │
│ Lower third Intro  │  ░░░░  │  ░░░░  │  ░░░░  │  ░░░░  │  ⧉ 📱 │   ░░░░  │
├────────────────────┴────────┴────────┴────────┴────────┴────────┴──────────┤
│  ⧉ copier le lien     📱 QR code     ░ non autorisé par cette sortie        │
│  Chaque source OBS doit être réglée sur la résolution indiquée.             │
└────────────────────────────────────────────────────────────────────────────┘
```

| ID | Exigence |
|---|---|
| EF-08.11 | Une ligne par sortie, une colonne par type de contenu |
| EF-08.12 | Chaque cellule : copier l'URL, afficher le QR code, ouvrir dans un onglet, couper ce lien |
| EF-08.13 | Sous chaque cellule, la **résolution à régler dans OBS** est rappelée |
| EF-08.14 | Un bouton « Tout copier » produit un bloc de texte prêt à coller dans un document de régie |
| EF-08.15 | Les liens sont **stables** : `id` inchangé après renommage (EF-07.6) |

### 7.3.5 Bloc « Tout copier » — format exact

```
OpenPresenter — liens OBS
Projet : ICC Pahou          Généré le 21/10/2026 à 18:04

PLEIN ECRAN SALLE  (1920×1080)
  Tout          http://192.168.1.42:8788/o/out_full
  Bible         http://192.168.1.42:8788/o/out_full?kind=bible
  Chants        http://192.168.1.42:8788/o/out_full?kind=songs
  Médias        http://192.168.1.42:8788/o/out_full?kind=media
  Annonces      http://192.168.1.42:8788/o/out_full?kind=announcements
  Habillage     http://192.168.1.42:8788/o/out_full?kind=lowerthird
  Minuteur      http://192.168.1.42:8788/o/out_full?kind=timer

BAS CENTRE STREAM  (1920×1080, transparent)
  Tout          http://192.168.1.42:8788/o/out_bottom
  Bible         http://192.168.1.42:8788/o/out_bottom?kind=bible
  Chants        http://192.168.1.42:8788/o/out_bottom?kind=songs
  Annonces      http://192.168.1.42:8788/o/out_bottom?kind=announcements
  Habillage     http://192.168.1.42:8788/o/out_bottom?kind=lowerthird
  (Médias et Minuteur : non autorisés sur cette sortie)
```

---

## 7.4 Intégration OBS (EF-08.5)

Reprend le travail déjà fait en V1 (`sync-relay-server.js`, protocole obs-websocket v5
implémenté à la main, authentification SHA-256, zéro dépendance).

### 7.4.1 Assistant « Installer dans OBS »

```
┌──────────────────────────────────────────────────────┐
│  Installer les sources dans OBS                      │
│                                                      │
│  Adresse       [ws://localhost:4455            ]     │
│  Mot de passe  [••••••••                       ]     │
│                                                      │
│  OBS → Outils → Paramètres du serveur WebSocket      │
│  → Activer le serveur WebSocket → Afficher           │
│                                                      │
│  Sera créé :                                         │
│    Sources navigateur (12)                           │
│      PLEIN ECRAN — Tout                    1920×1080 │
│      PLEIN ECRAN — Bible                   1920×1080 │
│      …                                               │
│    Scènes (3)                                        │
│      PRESENTATION PLEIN ECRAN                        │
│      PRESENTATION BAS CENTRE                         │
│      HABILLAGES                                      │
│                                                      │
│  [✓] Ne pas modifier les éléments existants          │
│                                                      │
│  [I] Installer        [A] Annuler                    │
└──────────────────────────────────────────────────────┘
```

| ID | Exigence |
|---|---|
| EF-08.16 | Les sources déjà présentes (même nom) ne sont **pas** modifiées par défaut |
| EF-08.17 | Un journal d'avancement en direct liste chaque création |
| EF-08.18 | En cas d'échec de connexion : `TXT: Impossible de joindre OBS à ws://localhost:4455. Vérifiez que le serveur WebSocket est activé dans Outils → Paramètres du serveur WebSocket.` |
| EF-08.19 | Le mot de passe n'est **jamais** écrit dans `project/` : il reste en mémoire pour la session |
| EF-08.20 | Un bouton « Tester la connexion » précède l'installation |
| EF-08.21 | L'installation OBS est **entièrement optionnelle** : coller les liens à la main fonctionne toujours |

### 7.4.2 Réglages OBS recommandés (texte affiché)

```
TXT: Dans OBS, pour chaque source navigateur :
     1. Propriétés → Largeur / Hauteur = la résolution indiquée
     2. Décochez « Contrôler l'audio via OBS »
     3. Cochez « Rafraîchir le navigateur lorsque la scène devient active »
     4. Pour les sorties transparentes, laissez le fond par défaut
        (la page fournit déjà la transparence)
```

---

## 7.5 Intégration vMix (EF-08.6) — décision D-06 : liste d'URLs d'abord

**EF-08.22** — Un onglet **« vMix »** affiche les mêmes liens avec les instructions :
```
TXT: Dans vMix :
     1. Add Input → Browser
     2. URL : collez le lien souhaité
     3. Width / Height : la résolution indiquée
     4. Pour un overlay, activez l'alpha dans les propriétés de l'entrée
```
**EF-08.23** — Un bouton « Copier pour vMix » produit le bloc du § 7.3.5.
**EF-08.24** — La génération d'un fichier de scène `.vmix` est **reportée** (D-06) : le
format n'est pas documenté publiquement de façon stable.

---

## 7.6 Diffusion et exclusion mutuelle

Reprend `js/live-mutex.js` de V1 (14 tests unitaires existants).

| ID | Règle |
|---|---|
| EF-07.15 | Diffuser un **verset** masque les chants, médias et annonces sur les sorties concernées |
| EF-07.16 | Diffuser un **chant** masque les versets, médias et annonces |
| EF-07.17 | Diffuser un **média** masque les versets et les chants |
| EF-07.18 | Les **habillages** et **minuteurs** sont des calques indépendants : ils ne masquent rien et ne sont pas masqués |
| EF-07.19 | Un outil ne se masque **jamais** lui-même (pas de clignotement) |
| EF-07.20 | Une diffusion redondante (même contenu, même sortie) **relance l'animation** sans masquer/démasquer |
| EF-07.21 | « Tout couper » vide toutes les sorties en < 100 ms |

### 7.6.1 Cibles de diffusion

```
  Diffuser vers :  [✓] Plein écran Salle   [✓] Bas centré Stream
                   [ ] Lower third Intro
                                    [Diffuser]  [Aperçu]  [Couper]
```

**EF-07.22** — Les cases pré-cochées suivent `targetByDefault`.
**EF-07.23** — La sélection des cibles est **mémorisée** pour la session.
**EF-07.24** — Une sortie dont `receives` exclut le contenu en cours est **grisée** avec
l'infobulle explicative.

---

## 7.7 Résilience

| ID | Règle |
|---|---|
| ENF-20 | La déconnexion d'une sortie n'affecte **aucune** autre sortie |
| EF-07.25 | Une page de sortie qui se reconnecte **resynchronise** immédiatement l'état courant (pas d'écran vide persistant) |
| EF-07.26 | Le relais conserve le dernier état pendant **60 s** après déconnexion d'une sortie |
| EF-07.27 | Un média introuvable affiche un placeholder : `TXT: Média indisponible` sur fond neutre, sans figer la sortie |
| EF-07.28 | La pastille d'état de la sortie (7.2.6) reflète la connexion en moins de 2 s |

---

## 7.8 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-09** | Sortie avec `media: false` + ouverture de `?kind=media` | aucun média affiché, message explicite |
| **A-09b** | Diffuser un média vers 2 sorties dont une l'exclut | la sortie filtrée reste vide, toast affiché |
| **A-09c** | Renommer une sortie puis recharger le lien OBS précédent | le lien fonctionne toujours |
| **A-09d** | Supprimer une sortie puis ouvrir son ancien lien | page « Sortie introuvable » avec la liste des sorties |
| **A-09e** | Déconnecter une sortie pendant la diffusion | les autres continuent ; reconnexion → resynchronisation |
| **A-10** | Comparer le rendu éditeur et le rendu `/o/out_bottom?kind=bible` | pixel-identique |
| **A-09f** | 33ᵉ sortie | refus avec `TXT: Maximum : 32 sorties.` |
