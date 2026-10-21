# 09 — Bible

> **Exigences couvertes :** EF-11, EF-12, EF-13, EF-14
> **Maquettes :** MAQ-03 (Studio — module Bible)
> **Modules repris :** `openpresenter2/src/modules/bible/xml.mjs`,
> `openpresenter2/src/modules/bible/annotations.mjs`

---

## 9.1 Vue d'ensemble du module

```
┌──────────────┬────────────────────────────────────┬──────────────────┐
│  VERSIONS    │  RECHERCHE / SAISIE                │  INSPECTEUR      │
│  [LSG][BDS]  │  ┌──────────────────────────────┐  │  Scène : Bas     │
│  + Importer  │  │ jean          ← 3 lettres    │  │  centré          │
│              │  └──────────────────────────────┘  │  [Modifier…]     │
│  LIVRES      │   Jean · Jérémie · Job · Josué     │                  │
│  Genèse      │   Jacques · Jude                   │  Verset courant  │
│  Exode       │                                    │  ┌────────────┐  │
│  …           │  CHAPITRES  1 2 [3] 4 5 …          │  │ aperçu     │  │
│  Jean  ←     │                                    │  │ en direct  │  │
│  …           │  VERSETS                           │  └────────────┘  │
│              │  ┌──────────────────────────────┐  │                  │
│  FAVORIS ★   │  │ 14 …                         │  │  Parties  2 / 3  │
│              │  │ 15 …                         │  │  ◀  ▶            │
│              │  │ 16 Car Dieu a tant aimé…  ★  │  │                  │
│              │  │ 17 …                         │  │  [Diffuser]      │
│              │  └──────────────────────────────┘  │  [Annoter]       │
└──────────────┴────────────────────────────────────┴──────────────────┘
```

---

## 9.2 EF-11 — Import et gestion des versions

### 9.2.1 Formats acceptés

| Format | Détection | État |
|---|---|---|
| **Beblia** (`<XMLBIBLE>` / `<BIBLEBOOK>`) | racine `XMLBIBLE` | repris de V2 |
| **Zefania** (`<XMLBIBLE>` / `<BOOK>`) | présence de `<BOOK>` | repris de V2 |
| **OSIS** (`<osis>` / `<div type="book">`) | espace de nom OSIS | **à ajouter** |
| **USFX** (`<usfx>` / `<book id="…">`) | racine `usfx` | **à ajouter** |
| **Texte structuré** | repli heuristique | **à ajouter**, avec prévisualisation avant validation |

**EF-11.4** — Le format est **détecté automatiquement** ; l'utilisateur n'a rien à choisir.
**EF-11.5** — Si la détection échoue, le message est :
```
TXT: Ce fichier n'est pas une Bible reconnue.
     Formats acceptés : Beblia XML, Zefania XML, OSIS, USFX.
     Source de fichiers libres : https://github.com/Beblia/Holy-Bible-XML-Format
```

### 9.2.2 Procédure d'import

| Étape | Action |
|---|---|
| 1 | Lecture du fichier, détection du format |
| 2 | **Copie dans `assets/bibles/<sha8>.xml`** (P4) |
| 3 | Analyse : nom, langue, nombre de livres / chapitres / versets |
| 4 | **Prévisualisation** avant validation (voir 9.2.3) |
| 5 | Indexation : écriture de `library/bibles/<id>.verses.json` + index de recherche |
| 6 | Détection des doublons (même empreinte → proposition de remplacer) |
| 7 | Sélection automatique si c'est la première version importée |

### 9.2.3 Prévisualisation avant validation

```
TXT: Bible détectée

     Nom            French Bible
     Format         Beblia XML
     Langue         français (détectée)
     Livres         66
     Chapitres      1 189
     Versets        31 102
     Taille         4,3 Mo

     Aperçu — Genèse 1:1
     « Au commencement, Dieu créa les cieux et la terre. »

     Nom affiché    [Louis Segond 1910        ]
     Abréviation    [LSG ]
     Licence        [Domaine public           ]

     [V] Valider l'import      [A] Annuler
```

**EF-11.6** — Le nom affiché et l'abréviation sont **modifiables** à l'import et après.
**EF-11.7** — L'abréviation (2 à 6 caractères) sert de badge sur les sorties ; elle doit
être unique par projet.
**EF-11.8** — Une Bible dont la langue est `rtl` bascule automatiquement la direction du
texte sur les sorties concernées.

### 9.2.4 Opérations sur une version

| Action | Comportement |
|---|---|
| Sélectionner | devient la version active du module |
| Définir comme version par défaut | écrit dans `project.json` → `settings.defaultBibleId` |
| Choisir comme **seconde version** | utilisée pour l'affichage parallèle (9.6) |
| Renommer / changer l'abréviation | immédiat, `id` inchangé (INV-5) |
| Supprimer | confirmation avec le nom ; refuse si c'est la dernière version |
| Réindexer | reconstruit l'index de recherche |
| Ouvrir le fichier source | ouvre le XML conservé dans `assets/bibles/` |

**⚠ ERREUR** — suppression de la dernière version :
```
TXT: OpenPresenter a besoin d'au moins une version biblique.
     Importez une autre Bible avant de supprimer celle-ci.
```

---

## 9.3 EF-12 — La saisie clavier unifiée ⭐

C'est l'exigence la plus précise du besoin. Elle est spécifiée ici comme une
**machine à états déterministe**.

### 9.3.1 Le champ

Un **seul** champ de saisie, toujours visible en haut du module Bible, également
accessible depuis la recherche unifiée du Studio et depuis la télécommande.

```
┌─────────────────────────────────────────────────────────┐
│  Jean ▸ 3 16                                            │
└─────────────────────────────────────────────────────────┘
   ▲       ▲ ▲
   │       │ └── verset (état 2)
   │       └──── chapitre (état 1)
   └──────────── livre verrouillé (préfixe non éditable)
```

| ID | Exigence |
|---|---|
| EF-12.1 | Un seul champ pour tout le parcours livre → chapitre → verset |
| EF-12.2 | Le champ est accessible par le raccourci `KBD Ctrl/Cmd + B` depuis n'importe quel module |
| EF-12.3 | Le champ ne perd **jamais** le focus pendant la saisie, sauf sur `Échap` ou diffusion |
| EF-12.4 | Un clic sur le préfixe de livre (`Jean ▸`) revient à l'état 0 |

### 9.3.2 Machine à états

```
        ┌─────────────────────────────────────────────────┐
        │  ÉTAT 0 — LIVRE                                 │
        │                                                 │
        │  entrée : lettres                               │
        │  sortie : Entrée (sélection)                    │
        │           Échap (vider)                         │
        │           ↑↓ (naviguer dans la liste)           │
        └──────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────▼──────────────────────────────┐
        │  ÉTAT 1 — CHAPITRE                              │
        │                                                 │
        │  entrée : chiffres                              │
        │  sortie : Espace / ":" / "." / "-" → état 2     │
        │           Entrée → diffuser tout le chapitre    │
        │           Retour arrière → état 0 si vide       │
        │           Échap → état 0                        │
        └──────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────▼──────────────────────────────┐
        │  ÉTAT 2 — VERSET                                │
        │                                                 │
        │  entrée : chiffres, "-" pour une plage          │
        │  sortie : Entrée → DIFFUSER                     │
        │           Échap → état 1                        │
        └──────────────────┬──────────────────────────────┘
                           │
                    DIFFUSION IMMÉDIATE
```

### 9.3.3 État 0 — sélection du livre

**Filtrage**

| ID | Règle |
|---|---|
| EF-12.5 | Insensible à la **casse** et aux **accents** : `je`, `JE`, `jé`, `Jé` → même liste |
| EF-12.6 | Ordre de pertinence : **1.** préfixe exact · **2.** préfixe d'un mot · **3.** inclusion · **4.** abréviation exacte · **5.** abréviation préfixe |
| EF-12.7 | Au plus **8 livres** affichés, dans l'ordre canonique de la Bible à pertinence égale |
| EF-12.8 | Le premier résultat est **toujours** en surbrillance |
| EF-12.9 | `↑` / `↓` déplacent la surbrillance dans la liste (循环 : bas → haut) |
| EF-12.10 | La liste est fermée par `Échap`, un clic ailleurs, ou une sélection |

**Table d'abréviations** — livrée dans `app/data/book-abbr-fr.json`, **éditable** :

| Livre | Abréviations reconnues |
|---|---|
| Genèse | `gn`, `gen`, `ge` |
| Exode | `ex`, `exo` |
| Lévitique | `lv`, `lev` |
| Nombres | `nb`, `nom` |
| Deutéronome | `dt`, `deu` |
| Josué | `jos` |
| Juges | `jg`, `jug` |
| Ruth | `rt`, `ru` |
| 1 Samuel | `1s`, `1sa`, `1sam` |
| 2 Samuel | `2s`, `2sa`, `2sam` |
| 1 Rois | `1r`, `1ro`, `1roi` |
| 2 Rois | `2r`, `2ro`, `2roi` |
| 1 Chroniques | `1ch` |
| 2 Chroniques | `2ch` |
| Esdras | `esd` |
| Néhémie | `ne`, `neh` |
| Esther | `est` |
| Job | `jb`, `jo` |
| Psaumes | `ps`, `psa`, `psaume` |
| Proverbes | `pr`, `prov` |
| Ecclésiaste | `ec`, `ecc` |
| Cantique des cantiques | `ct`, `cant` |
| Ésaïe | `es`, `esa`, `esai`, `isa` |
| Jérémie | `jr`, `jer` |
| Lamentations | `lm`, `lam` |
| Ézéchiel | `ez`, `eze` |
| Daniel | `dn`, `dan` |
| Osée | `os` |
| Joël | `jl`, `joe` |
| Amos | `am` |
| Abdias | `ab` |
| Jonas | `jon` |
| Michée | `mi`, `mic` |
| Nahum | `na`, `nah` |
| Habacuc | `ha`, `hab` |
| Sophonie | `so`, `sop` |
| Aggée | `ag` |
| Zacharie | `za`, `zac` |
| Malachie | `ml`, `mal` |
| Matthieu | `mt`, `mat`, `matt` |
| Marc | `mc`, `mar`, `marc` |
| Luc | `lc`, `luc` |
| Jean | `jn`, `jea`, `jean` |
| Actes | `ac`, `act` |
| Romains | `ro`, `rom` |
| 1 Corinthiens | `1co`, `1cor` |
| 2 Corinthiens | `2co`, `2cor` |
| Galates | `ga`, `gal` |
| Éphésiens | `ep`, `eph` |
| Philippiens | `ph`, `phi` |
| Colossiens | `col` |
| 1 Thessaloniciens | `1th` |
| 2 Thessaloniciens | `2th` |
| 1 Timothée | `1ti`, `1tim` |
| 2 Timothée | `2ti`, `2tim` |
| Tite | `tit` |
| Philémon | `phm` |
| Hébreux | `he`, `heb` |
| Jacques | `jq`, `jac` |
| 1 Pierre | `1pi`, `1pie` |
| 2 Pierre | `2pi`, `2pie` |
| 1 Jean | `1jn`, `1jea` |
| 2 Jean | `2jn`, `2jea` |
| 3 Jean | `3jn`, `3jea` |
| Jude | `jud` |
| Apocalypse | `ap`, `apo` |

**EF-12.11** — Les abréviations sont **indépendantes de la langue de la Bible** : la table
est celle de l'interface (français), les noms de livres sont ceux de la version importée.
**EF-12.12** — Un utilisateur peut **ajouter** ses propres abréviations sans modifier le
fichier livré (surcouche dans `project/library/book-abbr.json`).

**Sélection**

| Déclencheur | Effet |
|---|---|
| `Entrée` | sélectionne le livre **en surbrillance** (le premier par défaut) |
| `Tab` | idem à `Entrée` |
| Clic sur un livre de la liste | sélectionne ce livre |
| `↑` / `↓` | déplace la surbrillance |
| `Échap` | vide le champ, ferme la liste |

**EF-12.13** — `Entrée` sélectionne **toujours quelque chose** : si la liste est vide, le
message d'erreur du 9.3.7 s'affiche et le champ n'est pas vidé.

**Passage à l'état 1**

Le champ devient : `Jean ▸ ` avec le curseur après le séparateur. Le préfixe est un
**jeton non éditable** (style différencié). La liste de livres se ferme.

### 9.3.4 État 1 — chapitre

| Déclencheur | Effet |
|---|---|
| Chiffres | s'ajoutent au chapitre en cours de saisie |
| `Espace` | → état 2 (**chemin principal demandé**) |
| `:` ou `.` | → état 2 (tolérance d'habitude) |
| `-` | → état 2 en mode plage de **chapitres** (`Jean 3-4`) |
| `Entrée` | diffuse **tout le chapitre** (découpé en parties) |
| `Retour arrière` | efface ; si le chapitre devient vide → retour à l'état 0 |
| `Échap` | retour à l'état 0 |
| `↑` / `↓` | chapitre précédent / suivant **si un chapitre est déjà saisi** |

**EF-12.14** — Le nombre de chapitres du livre sélectionné est connu : une saisie
supérieure affiche immédiatement :
```
TXT: Jean compte 21 chapitres.
```
et **n'empêche pas** la frappe (l'utilisateur peut corriger).

**EF-12.15** — La grille des chapitres du panneau central se synchronise avec la saisie :
le chapitre saisi est surligné.

### 9.3.5 État 2 — verset

Grammaire acceptée (regex normative) :

```
^(?<first>\d{1,3})(?:\s*[-–—]\s*(?<last>\d{1,3}))?$
```

| Saisie | Interprétation |
|---|---|
| `16` | verset 16 seul |
| `16-18` | versets 16 à 18 |
| `16 - 18` | idem (espaces tolérés) |
| `16–18` | idem (tiret cadratin) |
| `16 18` | **toléré** comme `16-18` (deuxième espace = plage) |
| `16,18` | **toléré** comme `16-18` |
| `16,` | verset 16 seul (virgule finale ignorée) |

| ID | Règle |
|---|---|
| EF-12.16 | Une plage est limitée à **200 versets** ; au-delà : `TXT: Plage trop large (200 versets maximum).` |
| EF-12.17 | `last < first` est **inversé silencieusement** (`18-16` → `16-18`) |
| EF-12.18 | Un numéro hors limites affiche : `TXT: Jean 3 ne contient pas de verset 42 (1 à 36).` |
| EF-12.19 | Une plage partiellement hors limites est **tronquée** avec avertissement : `TXT: Versets 30 à 36 affichés (le chapitre s'arrête à 36).` |

**Validation**

| Déclencheur | Effet |
|---|---|
| `Entrée` | **diffuse immédiatement** sur les sorties cibles cochées |
| `Maj + Entrée` | met en **aperçu** sans diffuser |
| `Tab` | idem à `Entrée` |
| `Échap` | retour à l'état 1 |

**EF-12.20** — Après diffusion, le champ est **vidé** et le livre est **conservé** :
l'état revient à 1 avec `Jean ▸ 3 ` pour enchaîner rapidement les versets du même chapitre.
**EF-12.21** — `Maj + Entrée` conserve l'état 2 pour ajuster avant diffusion.

### 9.3.6 Saisie d'une référence complète (collage)

**EF-12.22** — Si le champ reçoit d'un coup une chaîne contenant des lettres **et** des
chiffres (collage ou saisie rapide), elle est analysée comme référence complète :

```
^(?<book>[^\d]+?)\s*(?<chapter>\d{1,3})\s*[:.\s]\s*(?<first>\d{1,3})(?:\s*[-–—]\s*(?<last>\d{1,3}))?$
```

| Collage | Résultat |
|---|---|
| `Jean 3:16` | diffusion de Jean 3:16 |
| `jean 3 16` | idem |
| `1 Corinthiens 13:4-7` | diffusion de la plage |
| `Jn 3:16` | idem (abréviation) |
| `Ps 23` | Psaumes 23 en entier |

**EF-12.23** — Le collage est reconnu sur l'évènement `input` **et** `paste`, avec une
analyse différée de 120 ms pour ne pas déclencher sur une frappe normale.

### 9.3.7 Erreurs de saisie

| Cas | Message littéral | Le champ est vidé ? |
|---|---|---|
| Aucune correspondance de livre | `TXT: Aucun livre ne correspond à « xyz ».` | **non** |
| Livre sélectionné mais aucun chapitre saisi + `Entrée` | `TXT: Saisissez un numéro de chapitre, puis Espace et le verset.` | non |
| Chapitre inexistant | `TXT: <Livre> ne contient pas de chapitre <n> (1 à <max>).` | non |
| Verset inexistant | `TXT: <Livre> <c> ne contient pas de verset <n> (1 à <max>).` | non |
| Plage trop large | `TXT: Plage trop large (200 versets maximum).` | non |
| Aucune Bible importée | `TXT: Importez d'abord une version biblique.` | non |

**EF-12.24** — Aucune erreur de saisie ne vide le champ : l'utilisateur corrige sur place.
**EF-12.25** — Les erreurs s'affichent en **toast** (3 s) **et** en rouge sous le champ.

### 9.3.8 Historique

**EF-12.26** — Les **10 dernières références** diffusées sont conservées
(`project/session-state.json` + `project.json` pour les 10 permanentes).
**EF-12.27** — `↑` dans un champ **vide** ouvre la liste de l'historique ; `Entrée`
rediffuse l'entrée en surbrillance.
**EF-12.28** — L'historique affiche la référence **et** un extrait du texte.

### 9.3.9 Exemple complet de session (cas nominal)

```
Frappe          Champ             Liste                       Action
──────────────────────────────────────────────────────────────────────────
j               j                 Jean                        —
e               je                Jean · Jérémie · Job        —
                                                    Jacques · Jude
↓               je                (surbrillance → Jérémie)    navigation
↑               je                (surbrillance → Jean)       navigation
Entrée          Jean ▸            (liste fermée)              → état 1
3               Jean ▸ 3          chapitre 3 surligné         —
Espace          Jean ▸ 3          → état 2                    —
1               Jean ▸ 3 1        —                           —
6               Jean ▸ 3 16       —                           —
Entrée          Jean ▸ 3          DIFFUSION de Jean 3:16      → état 1
↓               Jean ▸ 3          (chapitre 4)                —
```

---

## 9.4 EF-12 — Navigation en direct ⭐

> *« passer d'un verset à un autre en utilisant les touches de direction, ou d'une partie
> d'un verset à l'autre en fonction de la longueur du verset. »*

### 9.4.1 Le modèle : une liste plate d'éléments

Au moment de la diffusion, la sélection est **aplatie** en une liste ordonnée :

```
Sélection : Jean 3:16-18, bandeau, maxWordsPerScreen = 25

  [0] Jean 3:16  partie 1/2   « Car Dieu a tant aimé le monde qu'il a
                               donné son Fils unique, »
  [1] Jean 3:16  partie 2/2   « afin que quiconque croit en lui ne périsse
                               point, mais qu'il ait la vie éternelle. »
  [2] Jean 3:17  partie 1/1   « Dieu, en effet, n'a pas envoyé son Fils… »
  [3] Jean 3:18  partie 1/1   « Celui qui croit en lui n'est point jugé… »
```

**EF-12.29** — L'indice courant est un **entier dans cette liste plate**, pas un couple
(verset, partie). C'est ce qui rend la navigation triviale et sans cas limite.

### 9.4.2 Table des touches

| Touche | Effet |
|---|---|
| `→` / `↓` / `Espace` / `PageDown` | élément suivant ; au dernier élément, **ne fait rien** |
| `←` / `↑` / `PageUp` | élément précédent ; au premier, **ne fait rien** |
| `Maj + →` | **verset suivant** (saute les parties restantes) |
| `Maj + ←` | verset précédent (revient à sa **première** partie) |
| `Ctrl + →` | chapitre suivant, même verset (tronqué si absent) |
| `Ctrl + ←` | chapitre précédent, même verset |
| `Début` | premier élément de la sélection |
| `Fin` | dernier élément de la sélection |
| `Entrée` | rediffuser l'élément courant (relance l'animation d'entrée) |
| `Échap` | couper la sortie |
| `1`…`9` | aller au verset n° n de la sélection |

**EF-12.30** — Les touches sont **inactives** quand le focus est dans un champ de saisie,
un éditeur de texte, ou une modale.
**EF-12.31** — `Espace` ne fait **jamais** défiler la page : `preventDefault` systématique.
**EF-12.32** — La navigation met à jour **simultanément** toutes les sorties ciblées, la
vue scène et la télécommande (< 120 ms, ENF-13).
**EF-12.33** — Un **clicker USB** (qui émet `PageUp`/`PageDown` ou les flèches) fonctionne
sans aucune configuration (A-08b).

### 9.4.3 Indicateurs

Dans le contrôleur :
```
  Jean 3:16          partie 2 / 2          ◀  ▶
```

Sur la sortie (discret, uniquement s'il reste des parties) :
```
  ‹                                    ›
  (flèche latérale à 25 % d'opacité, 80 % au survol)
```

Sur la vue scène : la partie courante **et** la suivante sont affichées (voir
`15-scene-et-telecommande.md`).

**EF-12.34** — L'indicateur de parties est **masquable** par sortie
(`settings.showPartsHint`, défaut `true`).

---

## 9.5 EF-13 — Découpage lisible ⭐

> *« privilégier la vision des gens, qu'il n'y ait pas beaucoup de mots affichés ; si le
> verset est très long, il faut juste le couper comme FreeShow. »*

### 9.5.1 Réglages (par scène)

| Réglage | Défaut bandeau | Défaut plein écran | Plage |
|---|---|---|---|
| `splitMode` | `auto` | `auto` | `none` · `auto` |
| `splitBy` | `words` | `words` | `words` · `chars` · `lines` |
| `maxWordsPerScreen` | **25** | **40** | 5 → 200 |
| `maxCharsPerScreen` | 165 | 260 | 20 → 800 |
| `maxLinesPerScreen` | 3 | 5 | 1 → 12 |
| `minWordsPerPart` | 3 | 3 | 1 → 20 |
| `balanceParts` | `true` | `true` | booléen |

**EF-13.1** — Le réglage est **par scène**, donc différent entre « Plein écran » et
« Bas centré » pour le même verset.
**EF-13.2** — Le mode par défaut est **`words`** : c'est l'unité qui correspond à la
demande (« pas beaucoup de mots »).

### 9.5.2 Algorithme normatif

```
entrée  : texte T, limite L (en mots), minWords m
sortie  : liste de parties

1. Si mode = none            → [T]
2. Tokeniser T en mots en conservant la ponctuation attachée
3. Si nbMots(T) ≤ L          → [T]
4. Répéter jusqu'à épuisement :
   a. fenêtre = les L premiers mots restants
   b. si nbMots(reste après fenêtre) = 0 → dernière partie, fin
   c. chercher le point de coupe dans la fenêtre, par priorité :
        P1  « ; »    le plus proche de la fin de la fenêtre
        P2  « : »
        P3  « , »
        P4  « — » / « – »
        P5  espace
      contrainte : la coupe doit tomber dans les 45 % à 100 % de la fenêtre
   d. si aucune coupe dans la zone → coupe au dernier espace de la fenêtre
   e. si balanceParts et qu'il reste ≤ L mots après la coupe :
        répartir les mots restants en 2 parties de taille ±1 autour
        de la meilleure coupe disponible
   f. si la partie obtenue fait < m mots → la rattacher à la suivante
5. Retourner la liste
```

### 9.5.3 Règles de qualité

| ID | Règle |
|---|---|
| EF-13.3 | **Jamais** de coupure à l'intérieur d'un mot |
| EF-13.4 | **Jamais** de partie commençant par une ponctuation (`,`, `;`, `.`, `:`) — la ponctuation reste avec le mot précédent |
| EF-13.5 | **Jamais** de partie de moins de `minWordsPerPart` mots si elle peut être fusionnée |
| EF-13.6 | **Jamais** de dernière partie d'un seul mot si l'avant-dernière peut l'absorber |
| EF-13.7 | Les **guillemets** ne sont pas séparés de leur contenu (`«` reste avec le mot suivant, `»` avec le précédent) |
| EF-13.8 | Un **nombre** n'est jamais séparé de son unité ni de son millier (`1 000`, `3 h`) |
| EF-13.9 | Les **espaces insécables** (U+00A0, U+202F) sont respectés comme insécables |
| EF-13.10 | Le découpage est **déterministe** : le même texte et les mêmes réglages donnent toujours les mêmes parties (A-07) |
| EF-13.11 | Les **sauts de ligne d'origine** du texte sont des points de coupe prioritaires |
| EF-13.12 | Les **espaces en début/fin** de chaque partie sont supprimés |

### 9.5.4 Report des annotations

**EF-13.13** — Si le verset porte des annotations HTML (gras, couleur, surlignage),
le découpage s'applique au **texte brut** puis chaque partie est reconstituée avec le
balisage qui lui revient. Reprend `splitAnnotationHtml()` de V2.

| Cas | Comportement |
|---|---|
| Une portion en gras à cheval sur deux parties | les deux parties portent le gras sur leur fragment |
| Un surlignage entièrement dans la partie 2 | la partie 1 n'a rien |
| Balisage malformé | assaini par `sanitizeAnnotationHtml()` avant découpage |

### 9.5.5 Aperçu avant diffusion

```
  Jean 3:16-18     →  4 parties avec « Bas centré » (25 mots max)
                      ┌──────────────────────────────────────┐
  Partie 1/4          │ Car Dieu a tant aimé le monde qu'il  │
                      │ a donné son Fils unique,             │
                      └──────────────────────────────────────┘
                      ◀ ▶   [1] [2] [3] [4]
```

**EF-13.14** — Le nombre de parties est affiché **avant** la diffusion.
**EF-13.15** — Cliquer sur `[n]` affiche la partie n en aperçu sans diffuser.
**EF-13.16** — Un avertissement s'affiche si une partie dépasse encore la hauteur du
calque après auto-ajustement en dessous de 60 % de la taille demandée :
```
TXT: Cette partie restera petite à l'écran. Réduisez le nombre de mots
     par écran dans la scène « Bas centré ».
```

### 9.5.6 Exemples de référence (jeu de test obligatoire)

Ces cas doivent passer tels quels (A-07).

| Texte | Limite | Parties attendues |
|---|---|---|
| `Car Dieu a tant aimé le monde` | 25 mots | 1 partie (texte complet) |
| verset de 60 mots avec 3 virgules | 25 mots | 3 parties, coupes sur les virgules |
| verset de 60 mots **sans** ponctuation | 25 mots | 3 parties, coupes sur les espaces les plus proches de 25 |
| verset de 27 mots | 25 mots | **1 partie** (le dernier mot serait orphelin → rattaché) |
| verset de 52 mots | 25 mots | 2 parties équilibrées (~26/26) si `balanceParts` |
| texte avec `\n` au mot 20 | 25 mots | coupe **sur le saut de ligne** |
| `« Voici, je fais toutes choses nouvelles »` | 4 mots | les guillemets restent collés à leur contenu |
| texte de 500 mots | 25 mots | 20 parties, aucune vide |

---

## 9.6 EF-14 — Multi-versions et annotations

### 9.6.1 Deux versions en parallèle

**EF-14.1** — Case **« 2 versions »** dans le module Bible ; le sélecteur de seconde
version n'apparaît que lorsqu'elle est cochée.
**EF-14.2** — Le même livre / chapitre / verset est projeté **côte à côte**, avec le nom
de chaque version au-dessus de sa colonne.
**EF-14.3** — Si la seconde version n'a pas ce verset, la colonne affiche :
```
TXT: Verset absent de cette version
```
**EF-14.4** — La grille est `2 colonnes · 3 % d'écart · filet vertical à 28 % d'opacité`.
**EF-14.5** — Le **découpage** s'applique **à chaque version séparément** ; l'indice de
partie courant est appliqué aux deux, borné à leur propre nombre de parties.
**EF-14.6** — Le réglage 2 versions est **par sortie** (une sortie peut l'activer,
l'autre non).

### 9.6.2 Annotations

**EF-14.7** — Sélectionner un verset puis `KBD N` ouvre l'éditeur d'annotation.
**EF-14.8** — Commandes disponibles : gras, italique, souligné, barré, couleur du texte,
surlignage, effacer la mise en forme.
**EF-14.9** — Une **note de régie** (texte libre, 1 000 caractères max) n'est
**jamais projetée** : elle apparaît dans le contrôleur et sur la vue scène.
**EF-14.10** — Le HTML d'annotation est **assaini** : seuls `B STRONG I EM U S DEL INS BR
DIV P SPAN` sont conservés, avec `style` limité à `color` et `background-color`
(reprend `sanitizeAnnotationHtml()` de V2).
**EF-14.11** — Supprimer une annotation restaure le texte source, jamais une copie.
**EF-14.12** — Les annotations sont stockées **par version** (clés `<book>-<chap>-<verse>`).

### 9.6.3 Favoris et recherche

**EF-14.13** — `★` à droite de chaque verset ; `KBD F` bascule le favori du verset courant.
**EF-14.14** — La recherche plein texte porte sur **la version active**, avec un résultat
plafonné à 250 entrées et le message `TXT: 250+ résultats · affinez votre recherche`.
**EF-14.15** — La recherche est **débouncée à 140 ms** et n'indexe jamais le réseau.
**EF-14.16** — Un clic sur un résultat ouvre le verset ; un double-clic le diffuse.

---

## 9.7 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-06** | `j` `e` `Entrée` `3` `Espace` `1` `6` `Entrée` | Jean 3:16 à l'écran, **sans souris** |
| **A-06b** | `jn` `Entrée` | Jean sélectionné (abréviation) |
| **A-06c** | `ésa` `Entrée` `40` `Espace` `31` `Entrée` | Ésaïe 40:31 (accents + abréviation) |
| **A-06d** | Coller `1 Corinthiens 13:4-7` + `Entrée` | la plage est diffusée |
| **A-06e** | Saisir un livre inexistant | message d'erreur, champ **non vidé** |
| **A-07** | Verset de 60 mots, bandeau 25 mots | ≥ 3 parties, aucune coupure de mot, aucune partie < 3 mots, annotations reportées |
| **A-07b** | Jeu d'exemples du § 9.5.6 | les 8 cas passent exactement |
| **A-08** | `→` répété | traverse toutes les parties puis passe au verset suivant |
| **A-08b** | Clicker USB | navigation fonctionnelle sans configuration |
| **A-08c** | `Maj + →` sur une partie 1/3 | va directement au verset suivant |
| **A-08d** | Deux versions activées | découpage indépendant, même indice borné |
