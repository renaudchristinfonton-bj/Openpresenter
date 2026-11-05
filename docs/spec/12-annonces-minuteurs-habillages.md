# 12 — Annonces, minuteurs et habillages

> **Exigences couvertes :** EF-17, EF-18, EF-19
> **Repris de :** V1 `timer-control-updated.html`, `timer-display-updated.html`,
> `obs_lower_third_ultimate_studio.html` ; V2 `kind: announcements`, `kind: timer`,
> `kind: lowerthird`

---

## 12.1 Annonces (EF-17)

### 12.1.1 Modèle

```jsonc
{
  "id": "ann_bienvenue",
  "rev": 2,
  "title": "Bienvenue",
  "body": "Bienvenue à tous dans la maison de Dieu.\nLe culte commence à 8 h 30.",
  "imageAssetId": "as_9d2e…",
  "durationSec": null,          // null = reste affichée jusqu'à action manuelle
  "style": "default",           // style de scène associé
  "priority": "normal",         // normal | important | urgent
  "createdAt": "2026-10-20T10:00:00.000Z"
}
```

| ID | Exigence |
|---|---|
| EF-17.1 | Une annonce est un texte libre (titre + corps, 2 000 caractères max) avec **image optionnelle** |
| EF-17.2 | L'image est copiée dans `assets/media/` (P4) |
| EF-17.3 | `durationSec` permet un retrait automatique ; `null` = affichage jusqu'à action |
| EF-17.4 | Les annonces sont **réutilisables** d'un événement à l'autre |
| EF-17.5 | Le corps accepte les retours à la ligne et un balisage minimal (`**gras**`, `*italique*`) |
| EF-17.6 | Une annonce peut être ajoutée au plan de déroulement comme n'importe quel contenu |

### 12.1.2 Scènes d'annonce

Les lieux de l'image selon la disposition (repris de V2, `defaultScene('…', 'announcements')`) :

| Preset | Image | Texte |
|---|---|---|
| `full` | plein cadre, opacité 34 %, `cover` | centré par-dessus |
| `screen80` | plein cadre, opacité 28 % | dans le panneau 80 % |
| `bottom` | à gauche du bandeau (28 % de large) | à droite de l'image |
| `bottom-right` | à gauche du bandeau | à droite |
| `lowerthird` | petite vignette à droite | à gauche |

**EF-17.7** — Ces valeurs ne sont que des **défauts** : tout est éditable dans l'éditeur de
scène (P5).

---

## 12.2 Minuteurs (EF-18)

### 12.2.1 Modèle

```jsonc
{
  "id": "tmr_predication",
  "rev": 1,
  "name": "Prédication",
  "kind": "countdown",          // countdown | stopwatch
  "durationMs": 2100000,        // 35 min (countdown uniquement)
  "warnAtMs": 300000,           // orange à 5 min restantes
  "criticalAtMs": 60000,        // rouge à 1 min restante
  "style": "stage",             // stage | bandeau | plein écran
  "soundAtEnd": false,
  "messageAtEnd": "Temps écoulé"
}
```

| ID | Exigence |
|---|---|
| EF-18.1 | Deux natures : **compte à rebours** et **chronomètre** |
| EF-18.2 | Démarrage, pause/reprise, réinitialisation, ±1 min |
| EF-18.3 | Seuils d'alerte orange et rouge configurables |
| EF-18.4 | Le minuteur est visible sur la **vue scène** en permanence |
| EF-18.5 | Une **file de décomptes** permet d'enchaîner les items du culte |
| EF-18.6 | Le minuteur peut être coupé indépendamment (il ne masque rien, EF-07.18) |
| EF-18.7 | Format d'affichage `mm:ss` sous 1 h, `h:mm:ss` au-delà |
| EF-18.8 | Le minuteur survit à un rechargement de page (état dans `session-state.json`) |

### 12.2.2 Affichage

| Contexte | Rendu |
|---|---|
| Vue scène | gros chiffres, libellé au-dessus, barre de progression |
| Sortie plein écran | chiffres géants centrés |
| Sortie bandeau | `Prédication · 12:04` dans le lower third |

**EF-18.9** — Les couleurs suivent les seuils : blanc → orange (`warnAtMs`) → rouge
(`criticalAtMs`), avec un clignotement doux en zone rouge.

---

## 12.3 Habillages / lower thirds (EF-19)

### 12.3.1 Modèle

```jsonc
{
  "id": "lt_pasteur",
  "rev": 5,
  "name": "Intervenant",
  "title": "Pasteur Jean Dossou",
  "subtitle": "Prédicateur",
  "logoAssetId": "as_logo_icc…",
  "animationIn": "slide-left",    // slide-left | slide-right | slide-up | fade | zoom | none
  "animationOut": "slide-left",
  "animationMs": 400,
  "holdSec": null,                // null = reste jusqu'à action
  "layout": "classic"             // classic | bar | box | minimal
}
```

| ID | Exigence |
|---|---|
| EF-19.1 | Titre + sous-titre + logo optionnel |
| EF-19.2 | Animations d'entrée et de sortie indépendantes, durée réglable |
| EF-19.3 | Disparition automatique après `holdSec`, ou manuelle |
| EF-19.4 | Les habillages sont **indépendants** des autres contenus (EF-07.18) : ils peuvent coexister avec un verset |
| EF-19.5 | Le logo est copié dans `assets/logos/` (P4) |
| EF-19.6 | Les habillages sont **réutilisables** et nommés |
| EF-19.7 | Le positionnement est éditable au glisser-déposer (c'est une scène comme une autre) |
| EF-19.8 | Rendu transparent en sortie `transparent: true` pour le keying OBS/vMix |

### 12.3.2 Dispositions livrées

| `layout` | Aspect |
|---|---|
| `classic` | barre pleine largeur en bas, filet d'accent à gauche |
| `bar` | bandeau étroit, une seule ligne |
| `box` | panneau compact en bas à gauche |
| `minimal` | texte seul, sans fond, avec ombre portée |

**EF-19.9** — Ces dispositions sont des **scènes** : elles peuvent être modifiées,
dupliquées, renommées, exportées.

---

## 12.4 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-14** | Annonce avec image | image copiée dans le projet, rendu correct sur les 5 presets |
| **A-14b** | Compte à rebours 35 min, seuils 5 min / 1 min | couleurs correctes, vue scène synchronisée |
| **A-14c** | Changer de minuteur pendant une diffusion de verset | le verset reste affiché |
| **A-14d** | Habillage + verset simultanés sur deux sorties différentes | les deux coexistent |
| **A-14e** | Recharger la page pendant un compte à rebours | le temps continue correctement |
