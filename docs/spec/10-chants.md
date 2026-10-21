# 10 — Chants

> **Exigences couvertes :** EF-15
> **Module repris :** `openpresenter2/src/modules/songs/parser.mjs` (ChordPro, OpenSong),
> `openpresenter2/src/modules/songs/SongEditor.mjs`
> **Maquette :** MAQ-04 (module Chants)

---

## 10.1 Import

| Format | Détection | Contenu récupéré |
|---|---|---|
| **Texte brut** | repli | sections découpées sur les lignes vides |
| **ChordPro** | directives `{title:}` `{soc}` `{start_of_chorus}`… | titre, métadonnées, sections, accords |
| **OpenSong XML** | racine `<song>` | titre, auteur, copyright, clave, sections |
| **CCLI / SongSelect** | export texte avec en-tête | titre, auteur, n° CCLI **[à préciser]** |

**EF-15.1** — Le format est détecté automatiquement ; un aperçu est montré avant validation.
**EF-15.2** — Le fichier d'origine est copié dans `assets/songs/` (P4).
**EF-15.3** — La détection de sections reprend `sectionHeader()` de V2 :
`Couplet 1`, `Refrain`, `Pont`, `Intro`, `Fin`, `Tag`, `Pré-refrain`, `V1`, `C`, `B`…
**EF-15.4** — Les lignes **vides** séparent les sections ; la mise en forme ligne par ligne
est conservée (repris de V1).

### 10.1.1 Prévisualisation d'import

```
TXT: Chant détecté

     Titre        Grâce infinie
     Format       ChordPro
     Sections     6  (Couplet 1, Refrain, Couplet 2, Refrain, Pont, Refrain)
     Accords      oui (G, C, D, Em)
     Métadonnées  auteur, clave, tempo

     [I] Importer      [M] Modifier avant d'importer      [A] Annuler
```

---

## 10.2 Sections et arrangements

### 10.2.1 Sections

```jsonc
{ "id": "sec_v1", "name": "Couplet 1", "type": "verse",
  "lines": ["Grâce infinie, quel doux son", "Qui a sauvé un misérable"] }
```

| Type | Nom par défaut | Couleur d'identification |
|---|---|---|
| `verse` | Couplet | bleu |
| `chorus` | Refrain | violet |
| `bridge` | Pont | orange |
| `intro` | Intro | gris |
| `outro` / `ending` | Fin | gris |
| `tag` | Tag | vert |
| `prechorus` | Pré-refrain | bleu clair |
| `other` | Autre | neutre |

**EF-15.5** — Renommer une section ne change pas son `id`.
**EF-15.6** — Une section peut être **dupliquée** (`Couplet 1` → `Couplet 1 (copie)`).
**EF-15.7** — Les lignes vides **internes** à une section sont conservées.

### 10.2.2 Arrangements ⭐

Un **arrangement** est une suite ordonnée de sections. C'est ce qui permet de
« répéter un refrain, sauter un couplet » en direct.

```jsonc
"arrangements": [
  { "id": "arr_default", "name": "Ordre standard",
    "order": ["sec_v1", "sec_c", "sec_v2", "sec_c", "sec_b", "sec_c"] },
  { "id": "arr_court",   "name": "Version courte",
    "order": ["sec_v1", "sec_c", "sec_c"] }
]
```

| ID | Exigence |
|---|---|
| EF-15.8 | Un chant a au moins **un** arrangement, `Ordre standard` par défaut |
| EF-15.9 | Plusieurs arrangements par chant, sélectionnables avant **et pendant** la diffusion |
| EF-15.10 | L'ordre se modifie par **glisser-déposer** |
| EF-15.11 | Une même section peut apparaître **plusieurs fois** dans un arrangement |
| EF-15.12 | Changer d'arrangement **pendant** la diffusion préserve la position : si l'opérateur en est au refrain, il reste au premier refrain du nouvel arrangement |
| EF-15.13 | Boutons rapides : `+ Refrain à la fin`, `+ Répéter la section courante`, `Sauter la section courante` |
| EF-15.14 | Toute modification d'arrangement en direct est **immédiate** sur les sorties et la vue scène |

### 10.2.3 Conducteur en direct

```
  Grâce infinie          arrangement : [Ordre standard ▾]
  ┌────────────────────────────────────────────────────────┐
  │  1  Couplet 1                                          │
  │  2  Refrain                                            │
  │ ▶3  Couplet 2        ← en cours                        │
  │  4  Refrain           ← suivant                        │
  │  5  Pont                                               │
  │  6  Refrain                                            │
  └────────────────────────────────────────────────────────┘
  [＋ Refrain à la fin]  [↻ Répéter]  [⤼ Sauter]
```

---

## 10.3 Navigation

**Identique à la Bible** (`09-bible.md` § 9.4) : la sélection est aplatie en une liste
d'éléments où chaque partie d'une section longue est un élément.

| Touche | Effet |
|---|---|
| `→` `↓` `Espace` `PageDown` | partie suivante, puis section suivante de l'arrangement |
| `←` `↑` `PageUp` | précédent |
| `Maj + →` / `Maj + ←` | section suivante / précédente (ignore les parties) |
| `1`…`9` | aller à la n-ième étape de l'arrangement |
| `Échap` | couper |

**EF-15.15** — Arriver à la **fin de l'arrangement** n'avance pas plus loin ; un toast
informe : `TXT: Fin du chant « Grâce infinie ».`
**EF-15.16** — Le découpage utilise le même moteur que la Bible, avec
`maxWordsPerScreen` propre à la scène de chants.

---

## 10.4 Métadonnées

| Champ | Type | Note |
|---|---|---|
| `title` | texte | obligatoire |
| `titleOriginal` | texte | titre en langue originale |
| `artist` | texte | interprète |
| `composer` | texte | auteur |
| `copyright` | texte | mentions de droit |
| `ccli` | texte | n° CCLI |
| `key` | enum | `C C# D D# E F F# G G# A A# B` + `m` |
| `tempo` | entier | BPM |
| `timeSignature` | texte | `4/4`, `3/4`… |
| `durationSec` | entier | durée estimée |
| `language` | code | `fr`, `en`… |
| `tags` | liste | étiquettes libres |
| `folders` | liste | dossiers |

**EF-15.17** — Les métadonnées sont affichées dans le contrôleur mais **jamais** projetées
par défaut. Un look peut choisir d'afficher `title` via la liaison `title`.

---

## 10.5 Organisation

| ID | Exigence |
|---|---|
| EF-15.18 | **Dossiers** et **étiquettes** libres, cumulables |
| EF-15.19 | Tri par titre, auteur, date d'ajout, dernier usage |
| EF-15.20 | Filtre « utilisés récemment » |
| EF-15.21 | Recherche instantanée par titre, auteur **ou paroles** |
| EF-15.22 | Un chant peut être dupliqué (cas : variante en une autre langue) |
| EF-15.23 | Suppression avec confirmation nommant le chant et le nombre de plans qui le référencent |

**⚠ ERREUR** — suppression d'un chant référencé dans un plan :
```
TXT: « Grâce infinie » est utilisé dans 3 plans de déroulement.
     Ces étapes seront remplacées par des notes.
     [S] Supprimer quand même      [A] Annuler
```

---

## 10.6 Accords (vue scène uniquement)

| ID | Exigence |
|---|---|
| EF-15.24 | Les accords peuvent être affichés **uniquement** sur la vue scène |
| EF-15.25 | Jamais sur une sortie publique : la liaison `chords` n'existe pas pour les sorties |
| EF-15.26 | Les accords sont positionnés au-dessus du mot correspondant (décalage en caractères) |
| EF-15.27 | Transposition d'une section affichée : ±11 demi-tons, appliqué à l'affichage sans modifier la source |

---

## 10.7 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-12f** | Importer un ChordPro | titre, 6 sections et accords récupérés |
| **A-12g** | Réordonner l'arrangement en direct | la vue scène suit immédiatement |
| **A-12h** | Changer d'arrangement au refrain | la position reste sur un refrain |
| **A-12i** | `→` jusqu'à la fin de l'arrangement | toast de fin, pas de dépassement |
| **A-12j** | Accords activés | visibles sur la vue scène, absents des sorties |
