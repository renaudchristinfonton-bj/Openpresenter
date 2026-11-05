# 08 — Éditeur de scène WYSIWYG

> **Exigences couvertes :** EF-09, EF-10, ENF-42, principes P5 et P7
> **Modules repris :** `openpresenter2/src/components/SceneEditor.mjs` (688 lignes),
> `openpresenter2/src/core/engine.mjs` (moteur à calques), `openpresenter2/src/core/themes.mjs`
> **Maquette :** MAQ-05 (Éditeur de scène)

---

## 8.1 Le besoin, formulé exactement

> *« concernant les affichages de textes, de bibles, ou de chants, je veux des interfaces
> éditables où je peux moi-même, pour chaque type de sortie plein écran ou bas centré,
> créer mes visuels de fond et les mettre en bas, puis mon texte dessus de façon
> intelligente au point où, si j'ai par exemple un évènement Saint-Valentin à l'église, je
> puisse créer un fond avec l'image que je veux, adapter les références de bible et le
> contenu des versets, disposer de sa taille, de son style, justifié, centré, à droite, à
> gauche, en haut, en bas — très ouvert à l'édition. »*

Trois conséquences contractuelles :

| # | Conséquence | Exigence |
|---|---|---|
| 1 | L'éditeur doit être accessible **pour chaque couple (sortie, type de contenu)** | EF-09.1 |
| 2 | Le fond doit être une **image libre**, positionnable, avec le texte **par-dessus** | EF-09.9 → EF-09.14 |
| 3 | Le texte doit couvrir **les 4 alignements horizontaux + 3 verticaux**, la taille, le style | EF-09.15 → EF-09.22 |

---

## 8.2 Principe architectural : un seul moteur

**ENF-42** — Le **même** objet scène et la **même** fonction `render()` produisent :
- l'aperçu du contrôleur ;
- le canevas de l'éditeur ;
- la page de sortie OBS/vMix ;
- la vue scène.

Aucune de ces quatre vues ne possède son propre code de rendu. C'est la condition pour
que « ce que je vois dans l'éditeur soit ce qui sort à l'écran » (test A-10).

```
                    ┌──────────────────────┐
   scène JSON  ───▶ │  Engine.render()     │ ───▶  DOM identique
                    └──────────────────────┘
                     ▲        ▲        ▲        ▲
                     │        │        │        │
                 Contrôleur Éditeur  Sortie   Vue scène
                                        OBS
```

---

## 8.3 Schéma normatif d'une scène

```jsonc
{
  "id": "scn_bible_bottom_sval",
  "rev": 17,
  "name": "Bas centré — Saint-Valentin",
  "kind": "bible",
  "preset": "bottom",
  "transparent": true,
  "bgColor": "rgba(0,0,0,0)",
  "accentColor": "#e8698f",
  "textColor": "#ffffff",
  "shapeRadius": 14,

  "splitMode": "auto",
  "splitBy": "words",
  "maxWordsPerScreen": 25,
  "maxCharsPerScreen": 165,
  "maxLinesPerScreen": 3,
  "minWordsPerPart": 3,
  "balanceParts": true,

  "transitionIn": "slide-up",
  "transitionOut": "fade",
  "transitionDurationMs": 250,

  "showPartsHint": true,
  "safeArea": 0,

  "layers": [ /* voir 8.4 */ ]
}
```

| Champ | Règle |
|---|---|
| `kind` | immuable après création : une scène appartient à un type de contenu |
| `preset` | modifiable ; ne réécrit **pas** les calques existants |
| `transparent` | si `true`, le calque de fond est ignoré sauf `forceVisible` |
| `splitMode` `auto` | active le découpage (voir `09-bible.md` § 9.5) |
| `transitionIn/Out` | `none` `fade` `zoom` `slide-up` `slide-down` `slide-left` `slide-right` `wipe` `blur` |
| `transitionDurationMs` | 80 → 2000 |
| `safeArea` | `0` `5` `10` — pourcentage de marge affiché en repères |

---

## 8.4 Les calques

### 8.4.1 Propriétés communes à tous les calques

```jsonc
{
  "id": "lyr_9f2c…",
  "type": "text",
  "name": "Verset",
  "visible": true,
  "locked": false,
  "opacity": 1,
  "x": 53, "y": 88,          // centre du calque, en % du canevas 1920×1080
  "w": 69, "h": 15,           // taille en % ; h peut être null = automatique
  "rotate": 0,                // degrés, -180 → 180
  "zIndex": null,             // null = ordre de la liste
  "blendMode": "normal",      // normal | multiply | screen | overlay
  "shadow": { "enabled": false, "color": "#000000", "opacity": .5,
              "blur": 12, "offsetX": 0, "offsetY": 4 }
}
```

**EF-09.2** — Le système de coordonnées est **unique** : `x`/`y` = centre en pourcentage,
`w`/`h` = taille en pourcentage. Aucun calque n'a son propre système.
**EF-09.3** — `x` et `y` sont bornés à `[-w/2 + 1 ; 100 + w/2 - 1]` : un calque ne peut
jamais disparaître entièrement du canevas.
**EF-09.4** — `w` et `h` sont bornés à `[2 ; 300]` (%), ce qui autorise un débordement
volontaire (fond plus grand que le canevas).

### 8.4.2 Calque `background`

```jsonc
{
  "type": "background",
  "name": "Fond",
  "x": 50, "y": 50, "w": 100, "h": 100,
  "forceVisible": false,
  "source": {
    "kind": "image",              // image | video | gradient | color
    "assetId": "as_7d1f…",        // pour image / video
    "fit": "cover",               // contain | cover | stretch
    "position": "center center",  // ou "50% 30%"
    "offsetX": 0, "offsetY": 0,   // décalage fin en %
    "scale": 100,                 // zoom en %
    "blur": 0,                    // 0 → 40 px
    "brightness": 100,            // 20 → 200 %
    "contrast": 100,
    "saturate": 100,
    "grayscale": 0,               // 0 → 100 %
    "tint": "#1a0a12",            // teinte superposée
    "tintOpacity": .35,           // 0 → 1
    "loop": true,                 // video
    "startAtMs": 0,               // video
    "muted": true,                // video
    "playbackRate": 1,            // video, 0.25 → 4
    "color1": "#05060a",          // gradient
    "color2": "#19131a",          // gradient
    "gradientType": "linear",     // linear | radial
    "gradientAngle": 135,         // linear, degrés
    "repeat": false,              // image : mosaïque
    "color": "#090b12"            // color
  }
}
```

| ID | Exigence |
|---|---|
| EF-09.5 | Un fond image est **copié dans `assets/backgrounds/`** à l'import (P4) |
| EF-09.6 | **Teinte + opacité** sont obligatoirement disponibles : c'est ce qui garantit la lisibilité du texte par-dessus (P7) |
| EF-09.7 | `blur`, `brightness`, `contrast`, `saturate`, `grayscale` sont appliqués en CSS `filter` |
| EF-09.8 | Un fond vidéo est **muet par défaut** et en boucle |
| EF-09.9 | En sortie transparente, le calque de fond est **ignoré** sauf si `forceVisible: true` |
| EF-09.10 | Le fond accepte aussi un **média de la bibliothèque** choisi à la volée pour la diffusion en cours (liaison `bind: "backgroundMedia"`) |

### 8.4.3 Calque `overlay` (panneau / forme)

```jsonc
{
  "type": "overlay",
  "name": "Bandeau",
  "x": 50, "y": 85, "w": 82, "h": 25,
  "shape": "rect",              // rect | rounded | ellipse | line
  "bg": "rgba(8,10,16,.92)",
  "radius": 14,
  "border": { "width": 7, "color": "#f5b942",
              "sides": ["left"], "style": "solid" },
  "cornerRadiusPerCorner": null  // ou [tl, tr, br, bl]
}
```

| ID | Exigence |
|---|---|
| EF-09.11 | `border.sides` accepte toute combinaison de `top` `right` `bottom` `left` (vide = les quatre) |
| EF-09.12 | `border.style` ∈ `solid` `dashed` `dotted` `double` |
| EF-09.13 | Les rayons par coin sont réglables individuellement |
| EF-09.14 | `shape: "line"` ignore le fond et ne trace que la bordure |

### 8.4.4 Calque `text` ⭐

```jsonc
{
  "type": "text",
  "name": "Verset",
  "x": 53, "y": 88, "w": 69, "h": 15,
  "bind": "verse",
  "customText": "",
  "style": {
    "fontFamily": "Merriweather",
    "fontSize": 40,
    "weight": 600,
    "color": "#ffffff",

    "align": "justify",            // left | center | right | justify
    "verticalAlign": "bottom",     // top | center | bottom
    "textCase": "none",            // none | uppercase | lowercase | capitalize | smallcaps

    "letterSpacing": 0,            // px
    "wordSpacing": 0,              // px
    "lineHeight": 1.35,
    "paragraphSpacing": 0,         // px entre paragraphes

    "italic": false,
    "bold": false,
    "underline": false,
    "strike": false,

    "stroke": { "enabled": false, "color": "#000000", "width": 2 },
    "shadow": 4,
    "padding": 0,
    "bg": null,
    "radius": 999
  },
  "autoFit": { "enabled": true, "min": 16, "max": 120, "scaleDown": true, "scaleUp": false }
}
```

#### Liaisons (`bind`)

| `bind` | Contenu injecté | Disponible pour |
|---|---|---|
| `custom` | `customText` saisi | tous les `kind` |
| `ref` | référence du verset (`Jean 3:16`) | bible |
| `badge` | abréviation de la version (`LSG`) | bible |
| `verse` | texte du verset / de la partie courante | bible |
| `title` | titre du chant, de l'annonce | songs, announcements |
| `section` | nom de la section (`Refrain`) | songs |
| `lyrics` | texte de la section / de la partie courante | songs |
| `announcement` | corps de l'annonce | announcements, lowerthird |
| `timer` | valeur du minuteur (`09:42`) | timer |
| `image` | image liée (logo, visuel) | tous |
| `media` | média sélectionné | media |
| `clock` | horloge locale (`18:04`) | tous |
| `planLabel` | libellé du cue courant du plan | plan |

**EF-09.15** — Un calque texte est **soit libre, soit lié** ; le passage de l'un à l'autre
se fait par le sélecteur `bind` sans perdre le style.
**EF-09.16** — Une liaison sans contenu disponible n'affiche **rien** (jamais le mot
`undefined`, jamais un texte d'exemple à l'antenne).

#### Alignements — l'exigence explicite

| ID | Exigence |
|---|---|
| EF-09.17 | **Horizontal** : `left` · `center` · `right` · **`justify`** — les quatre sont disponibles pour tout calque texte |
| EF-09.18 | **Vertical** : `top` · `center` · `bottom` — les trois sont disponibles pour tout calque texte |
| EF-09.19 | Les deux sont combinables librement (9 combinaisons) |
| EF-09.20 | `justify` utilise `text-align: justify` + `text-align-last` réglable (`auto` · `left` · `center`) pour que la dernière ligne ne soit pas étirée |
| EF-09.21 | L'alignement horizontal pilote aussi l'alignement des **blocs** dans le calque (flex `align-items`) |
| EF-09.22 | Les 9 combinaisons sont accessibles par une **grille 3×3** dans l'inspecteur, pas par deux listes déroulantes |

```
  Position du texte dans son calque
  ┌───┬───┬───┐
  │ ↖ │ ↑ │ ↗ │     Haut · Gauche / Centre / Droite
  ├───┼───┼───┤
  │ ← │ ● │ → │     Milieu · Gauche / Centre / Droite
  ├───┼───┼───┤
  │ ↙ │ ↓ │ ↘ │     Bas · Gauche / Centre / Droite
  └───┴───┴───┘
```

#### Autres propriétés typographiques

| ID | Exigence |
|---|---|
| EF-09.23 | **Contour de texte** (`stroke`) réglable en couleur et épaisseur — indispensable sur fond clair |
| EF-09.24 | **Ombre** paramétrable : couleur, opacité, flou, décalage X, décalage Y (pas seulement une intensité) |
| EF-09.25 | `textCase` inclut **petites capitales** (simulation par `<span>` à taille réduite si la police n'a pas de vraie petite capitale) |
| EF-09.26 | Interlignage, espacement des lettres **et** des mots sont réglables séparément |
| EF-09.27 | Espacement **entre paragraphes** distinct de l'interlignage |
| EF-09.28 | La liste des polices contient **les polices vendues** en premier, puis les polices système détectées, avec un avertissement de portabilité pour ces dernières |

**⚠ ERREUR** — police système utilisée dans une scène :
```
TXT: La police « Impact » n'est pas incluse dans le projet.
     Le rendu peut différer sur un autre ordinateur.
     [C] Choisir une police incluse      [G] Garder quand même
```

#### Auto-ajustement

| ID | Règle |
|---|---|
| EF-09.29 | L'auto-ajustement réduit la taille jusqu'à `autoFit.min` pour que le texte tienne |
| EF-09.30 | Le facteur de réduction est borné à **0,35** : en dessous, on découpe le texte au lieu de le réduire |
| EF-09.31 | `scaleUp: true` autorise l'agrandissement jusqu'à `autoFit.max` pour les textes courts |
| EF-09.32 | L'auto-ajustement est **désactivable** par calque |
| EF-09.33 | Le calcul se fait après application du `rotate`, pour ne pas fausser les mesures |

### 8.4.5 Calque `image`

```jsonc
{
  "type": "image",
  "name": "Logo",
  "x": 12, "y": 50, "w": 18, "h": 42,
  "bind": "image",            // null | "image" | "media" | "backgroundMedia"
  "assetId": "as_4b2e…",      // si bind = null
  "fit": "contain",           // contain | cover | stretch
  "radius": 0,
  "radiusPerCorner": null,
  "crop": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
  "flipH": false, "flipV": false
}
```

**EF-09.34** — Un calque `image` accepte une **vidéo** si l'asset lié est une vidéo
(lecture, boucle, muet, point d'entrée, vitesse).
**EF-09.35** — Sans contenu, l'éditeur affiche un emplacement vide `＋ <nom>` ; **la sortie
n'affiche rien** (jamais le placeholder).

### 8.4.6 Calque `group`

**EF-09.36** — Un groupe contient des calques enfants ; `x`/`y`/`w`/`h`/`rotate`/`opacity`
du groupe s'appliquent à l'ensemble.
**EF-09.37** — Déplacer un groupe déplace ses enfants ; les enfants restent éditables
individuellement en double-cliquant.
**EF-09.38** — La profondeur de groupe est limitée à **3 niveaux**.

---

## 8.5 Manipulation sur le canevas

| Interaction | Effet |
|---|---|
| Clic sur un calque | sélection |
| `Maj + clic` | sélection multiple |
| Glisser | déplacement, avec aimants |
| Poignées `nw ne sw se` | redimensionnement proportionnel |
| Poignées `n s e w` | redimensionnement sur un axe |
| `Maj` pendant redimensionnement | contraint les proportions |
| `Alt` pendant redimensionnement | depuis le centre |
| Poignée de rotation (au-dessus du calque) | rotation libre, cran de 15° avec `Maj` |
| Double-clic sur un texte | édition du texte libre en place |
| `Suppr` | supprimer |
| `Ctrl/Cmd + D` | dupliquer (décalé de 2 %) |
| `Ctrl/Cmd + C` / `V` | copier / coller |
| `Ctrl/Cmd + Z` / `Maj + Z` | annuler / rétablir |
| Flèches | déplacer de 1 % |
| `Maj + flèches` | déplacer de 0,1 % |
| `Ctrl + flèches` | redimensionner de 1 % |
| `[` / `]` | descendre / monter d'un niveau |
| `Ctrl + [` / `Ctrl + ]` | arrière-plan / premier plan |
| `L` | verrouiller / déverrouiller |
| `H` | masquer / afficher |
| `G` | grouper · `Maj + G` dégrouper |
| `Ctrl + A` | tout sélectionner |
| `Échap` | désélectionner |

### 8.5.1 Aimants et repères

| ID | Règle |
|---|---|
| EF-09.39 | Aimants sur les bords du canevas (0 %, 100 %), le centre (50 %) et les tiers (33,3 % / 66,7 %) |
| EF-09.40 | Aimants entre calques : bords et centres alignés |
| EF-09.41 | Seuil d'aimantation : **0,8 %** du canevas ; `Ctrl` pendant le drag les désactive |
| EF-09.42 | Les lignes d'aimantation sont affichées en `#f5b942` pendant le drag |
| EF-09.43 | Boutons « Aligner » : gauche, centre horizontal, droite, haut, centre vertical, bas |
| EF-09.44 | Boutons « Distribuer » : horizontalement, verticalement (≥ 3 calques) |
| EF-09.45 | Repères de **zone de sécurité** à 5 % et 10 %, affichables, non imprimables à l'antenne |
| EF-09.46 | Grille optionnelle de 5 %, avec accrochage |

### 8.5.2 Historique

**EF-09.47** — Annuler/rétablir illimité **dans la session**, avec un minimum garanti de
80 états.
**EF-09.48** — Un point d'historique est créé après chaque geste **terminé** (fin de drag,
fin de saisie), pas à chaque pixel.
**EF-09.49** — Fermer l'éditeur avec des modifications non enregistrées demande :
```
TXT: Modifications non enregistrées.
     [E] Enregistrer      [N] Ne pas enregistrer      [C] Continuer l'édition
```

---

## 8.6 Interface de l'éditeur

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  SCÈNE · Bible · Sortie « Bas centré — Stream »              [Enregistrer] [✕] │
├────────────┬──────────────────────────────────────────────┬───────────────────┤
│ PRESETS    │                                              │  INSPECTEUR       │
│  Cinéma    │        ┌────────────────────────────┐        │  ─────────────    │
│  Galerie   │        │                            │        │  Scène            │
│ ●Bas centré│        │   ┌────────────────────┐   │        │   Nom    […]      │
│  Bas droite│        │   │   Jean 3:16   LSG  │   │        │   Thème  [S-Val▾] │
│  Lower 3rd │        │   │                    │   │        │   Fond   […]      │
│            │        │   │  Car Dieu a tant   │   │        │   Découp [25 mots]│
│ CALQUES    │        │   │  aimé le monde…    │   │        │   Trans. [glisser]│
│  ▸ Fond    │        │   └────────────────────┘   │        │                   │
│  ▸ Bandeau │        │                            │        │  Calque « Verset »│
│  ● Verset  │        └────────────────────────────┘        │   Liaison [verse▾]│
│  ▸ Référence│       1920 × 1080 · 62 %                    │   Police [Merr▾]  │
│  ▸ Version │                                             │   Taille [40   ]  │
│            │   [↶][↷]  [⌗] [⊞]  [🔍−][🔍+] [1:1]         │   ┌───┬───┬───┐   │
│ [+ Calque] │                                             │   │↖ │↑ │↗ │   │
│  Texte     │                                             │   ├───┼───┼───┤   │
│  Panneau   │                                             │   │← │● │→ │   │
│  Image     │                                             │   ├───┼───┼───┤   │
│  Groupe    │                                             │   │↙ │↓ │↘ │   │
│            │                                             │   └───┴───┴───┘   │
│ LOOKS      │                                             │   Gras I Souligné │
│  Sobre     │                                             │   Couleur [■]     │
│  Festif    │                                             │   Contour [ ]     │
│  ★S-Val    │                                             │   Ombre   [4   ]  │
│  [Enreg.]  │                                             │   Auto-aj [✓]     │
└────────────┴──────────────────────────────────────────────┴───────────────────┘
```

| ID | Exigence |
|---|---|
| EF-09.50 | L'éditeur s'ouvre **depuis n'importe quelle sortie** pour **n'importe quel type de contenu** |
| EF-09.51 | L'aperçu utilise un **contenu d'exemple réaliste** : un verset long pour la Bible, un couplet pour les chants, jamais `Lorem ipsum` |
| EF-09.52 | Un sélecteur permet de changer le contenu d'exemple (verset court / long / très long) |
| EF-09.53 | Le canevas affiche ses dimensions et son facteur de zoom |
| EF-09.54 | Zoom : 25 % → 400 %, avec un mode `1:1` (pixel réel) |
| EF-09.55 | Le panneau « Calques » permet : réordonner, renommer, verrouiller, masquer, sélectionner |
| EF-09.56 | Les modifications s'appliquent **en direct** sur la sortie si elle est ouverte (EF-09.6 du CDC) |

---

## 8.7 Thèmes et looks (EF-10)

### 8.7.1 Thème

Un **thème** est un jeu de couleurs et de rayons appliqué à une scène. Les 11 thèmes de
V2 sont conservés : `cinema` `warm` `modern` `minimal` `neon` `sobre` `festif` `careme`
`noel` `aube` `mission`.

**EF-10.1** — Appliquer un thème modifie : couleurs de fond, accent, couleur du texte,
rayons, et les couleurs des calques **selon leur liaison** (reprend `applyThemeToScene()`).
**EF-10.2** — Un thème **ne modifie jamais** la géométrie (`x`/`y`/`w`/`h`) ni les polices.
**EF-10.3** — L'utilisateur peut créer ses propres thèmes (nom + 6 valeurs).

### 8.7.2 Look

Un **look** est un **jeu de scènes nommé**, couvrant plusieurs types de contenu.

```jsonc
{
  "id": "look_saint_valentin",
  "rev": 3,
  "name": "Saint-Valentin",
  "description": "Fond rouge, références en haut, versets justifiés en bas",
  "createdAt": "2026-10-18T20:11:00.000Z",
  "themeId": "custom_rose",
  "scenes": {
    "bible":         { "sceneId": "scn_bible_bottom_sval",  "embed": { /* copie */ } },
    "songs":         { "sceneId": "scn_songs_bottom_sval",  "embed": { /* copie */ } },
    "announcements": { "sceneId": "scn_ann_full_sval",      "embed": { /* copie */ } }
  },
  "backgroundAssetId": "as_coeur_rose…"
}
```

**EF-10.4** — Un look **embarque une copie** des scènes (`embed`) : modifier la scène
d'origine ne modifie pas le look.
**EF-10.5** — Appliquer un look à une sortie remplace les scènes des types couverts, avec
confirmation listant ce qui sera remplacé.
**EF-10.6** — « **Appliquer Bible + Chants** » en une action (repris de V2).
**EF-10.7** — Un look peut être appliqué à **plusieurs sorties** en une fois.
**EF-10.8** — Les looks sont exportables/importables en JSON autonome, **avec** leur fond.
**EF-10.9** — L'éditeur de looks reprend les concepts de V1 : couleurs (fond + opacité,
accent, texte), police, coins du cadre, **photo de fond enregistrée dans le look**, flou,
et **géométrie par disposition** (plein écran, 80 %, bas centré, bas droite, lower third).
**EF-10.10** — Un look règle **Bible et Chants séparément**, avec une case « Lié » pour
tout régler identiquement (repris de V1).
**EF-10.11** — Un look est **partagé par référence** entre profils, avec une action
« Détacher » pour en faire une copie indépendante (décision D-07).

---

## 8.8 Cas d'usage de référence — Évènement Saint-Valentin

Ce scénario doit être réalisable **exactement** comme décrit (test A-10b).

| Étape | Action | Résultat attendu |
|---|---|---|
| 1 | Sorties → « Bas centré — Stream » → Scènes → Bible → **Modifier** | l'éditeur s'ouvre sur la scène Bible de cette sortie |
| 2 | Sélectionner le calque `Fond` → Source → **Image** → importer `coeurs-rouges.jpg` | l'image est copiée dans `assets/backgrounds/`, affichée en `cover` |
| 3 | Régler Teinte `#2a0511`, opacité de teinte `0,45`, flou `0`, luminosité `90 %` | le fond reste lisible pour du texte blanc |
| 4 | Sélectionner le calque `Référence` (liaison `ref`) → grille **haut · centre** | la référence se place en haut du calque |
| 5 | Police `Cinzel`, taille `26`, couleur `#ffb3c6`, petites capitales, espacement `2 px` | style appliqué |
| 6 | Sélectionner le calque `Verset` (liaison `verse`) → grille **bas · centre** | le texte se cale en bas |
| 7 | Alignement **justifié**, `text-align-last: center`, taille `40`, interlignage `1,45` | le verset est justifié, dernière ligne centrée |
| 8 | Scène → Découpage → `auto`, `words`, **25 mots** max | les versets longs sont découpés |
| 9 | Scène → Transition d'entrée → `slide-up`, 300 ms | animation enregistrée |
| 10 | **Enregistrer** sous le nom `Bas centré — Saint-Valentin` | la scène est créée dans `scenes/` |
| 11 | Looks → **Enregistrer comme look** → `Saint-Valentin` | le look embarque une copie de la scène |
| 12 | Diffuser `1 Corinthiens 13:4-7` | 4 parties navigables, fond et références lisibles |
| 13 | L'année suivante : dupliquer l'événement, appliquer le look | tout est déjà en place |

---

## 8.9 Portabilité du rendu

| ID | Règle |
|---|---|
| EF-09.57 | **Toutes** les polices utilisées par défaut sont **vendues dans le dépôt** (`vendor/fonts/`) : Bebas Neue, Cinzel, EB Garamond, Inter, JetBrains Mono, Lora, Merriweather, Montserrat, Oswald, Playfair Display, Poppins, Rajdhani |
| EF-09.58 | Aucune scène par défaut ne référence une police système (risque R-09) |
| EF-09.59 | Le rendu ne dépend d'**aucune** fonctionnalité non supportée par le CEF d'OBS 28 |
| EF-09.60 | Les `filter` CSS sont testés sur le CEF ; en cas de divergence, un repli est documenté |

---

## 8.10 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-10** | Créer une scène dans l'éditeur, comparer avec `/o/out_bottom?kind=bible` | rendu pixel-identique |
| **A-10b** | Rejouer les 13 étapes du § 8.8 | chaque étape produit le résultat décrit |
| **A-10c** | Les 9 combinaisons d'alignement | le texte se place correctement dans les 9 cas |
| **A-10d** | `justify` sur 3 lignes | les 2 premières lignes justifiées, la dernière centrée |
| **A-10e** | Fond image + teinte 45 % + texte blanc | contraste mesuré ≥ 4,5:1 |
| **A-10f** | Enregistrer un look, modifier la scène d'origine, réappliquer le look | le look n'a pas changé |
| **A-10g** | Déplacer un calque jusqu'au bord | il reste partiellement visible (EF-09.3) |
| **A-10h** | Annuler 80 fois | les 80 états sont restaurés |
