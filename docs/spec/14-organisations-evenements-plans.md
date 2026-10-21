# 14 — Organisations, événements et plans de déroulement

> **Exigences couvertes :** EF-21, EF-22, EF-23
> **Repris de :** V1 `cue_list.html` (types de cues, bouton Avancer, panneau
> En cours / Suivant, import CSV et Planning Center)
> **Maquette :** MAQ-08 (Événements et plan)

---

## 14.1 Origine du besoin

> *« j'ai besoin de quoi gérer totalement un événement, une église, mais de façon
> éditable. »*

Trois niveaux, **tous éditables**, **aucun obligatoire** :

```
Organisation  (église, association, école)
└── Lieu      (temple, salle annexe, studio)
    └── Événement   (culte, conférence, concert, direct)
        ├── Profil appliqué
        ├── Plan de déroulement
        ├── Ressources attachées
        └── Historique de diffusion
```

**EF-21.1** — On peut créer un événement **sans** organisation ni lieu.
**EF-21.2** — On peut créer un lieu **sans** organisation (organisation vide).
**EF-21.3** — Supprimer une organisation ne supprime **jamais** ses événements : ils
deviennent simplement « sans organisation ».

---

## 14.2 Organisations et lieux (EF-21)

### 14.2.1 Modèle

```jsonc
{
  "id": "org_icc",
  "rev": 2,
  "name": "ICC Pahou",
  "kind": "church",              // church | association | school | company | other
  "contact": { "email": "", "phone": "", "address": "Pahou, Bénin" },
  "logoAssetId": "as_logo_icc…",
  "places": [
    { "id": "plc_temple", "name": "Temple principal",
      "capacity": 800,
      "screens": ["Projecteur salle", "Retour scène", "Écran hall"],
      "notes": "" },
    { "id": "plc_annexe", "name": "Salle annexe", "capacity": 120, "screens": [] }
  ]
}
```

| ID | Exigence |
|---|---|
| EF-21.4 | Une organisation a un nom, un type, des coordonnées, un logo optionnel |
| EF-21.5 | Une organisation contient **N lieux**, chacun avec ses écrans nommés |
| EF-21.6 | Les écrans d'un lieu servent de **libellés** dans l'interface (ex. « Projecteur salle ») |
| EF-21.7 | Le logo est copié dans `assets/logos/` (P4) |

### 14.2.2 Écran

```
┌──────────────────────────────────────────────────────────────────┐
│  ORGANISATIONS                                [+ Nouvelle]        │
├──────────────────┬───────────────────────────────────────────────┤
│  🏛 ICC Pahou  ● │  Nom        [ICC Pahou          ]              │
│  🏫 École Bethel │  Type       [Église ▾]                        │
│                  │  Adresse    [Pahou, Bénin       ]              │
│                  │  Logo       [logo-icc.png] [Changer] [Retirer] │
│                  │                                                │
│                  │  LIEUX (2)                                     │
│                  │  ┌──────────────────────────────────────────┐ │
│                  │  │ Temple principal      800 places          │ │
│                  │  │ Écrans : Projecteur · Retour scène · Hall │ │
│                  │  │ [Modifier] [Supprimer]                    │ │
│                  │  ├──────────────────────────────────────────┤ │
│                  │  │ Salle annexe          120 places          │ │
│                  │  │ [Modifier] [Supprimer]                    │ │
│                  │  └──────────────────────────────────────────┘ │
│                  │  [+ Ajouter un lieu]                           │
└──────────────────┴───────────────────────────────────────────────┘
```

---

## 14.3 Événements (EF-22)

### 14.3.1 Modèle

```jsonc
{
  "id": "evt_2026-10-26",
  "rev": 9,
  "name": "Culte du dimanche",
  "startsAt": "2026-10-26T08:30:00+01:00",
  "endsAt": "2026-10-26T11:00:00+01:00",
  "orgId": "org_icc",
  "placeId": "plc_temple",
  "profileId": "prof_icc_culte",
  "color": "#f5b942",
  "description": "",
  "recurrence": { "freq": "weekly", "byDay": ["SU"], "until": "2027-12-31" },
  "templateSourceId": "evt_2026-10-19",
  "plan": { "id": "plan_1", "cues": [ … ] },
  "history": [ … ]
}
```

### 14.3.2 Exigences

| ID | Exigence |
|---|---|
| EF-22.1 | Créer un événement : nom, dates, lieu, profil, couleur, description |
| EF-22.2 | Récurrence : `daily`, `weekly` (+ jours), `monthly`, avec date de fin |
| EF-22.3 | Les occurrences sont **matérialisées** à la demande (pas de génération infinie) |
| EF-22.4 | Dupliquer un événement copie le plan, le profil, la couleur — **pas** l'historique |
| EF-22.5 | L'événement du jour est mis en avant sur l'accueil (EF-05.4) |
| EF-22.6 | L'historique enregistre chaque diffusion : cue, horodatage, sorties (append-only) |
| EF-22.7 | L'historique est **exportable** en CSV |
| EF-22.8 | Un événement passé est en lecture seule par défaut, avec un bouton « Modifier quand même » |
| EF-22.9 | Suppression avec confirmation nommant le nombre de cues |
| EF-22.10 | Un événement sans plan est valide : le plan peut être créé plus tard |

### 14.3.3 Vue calendrier et liste

| Vue | Contenu |
|---|---|
| **Aujourd'hui** | l'événement du jour, son plan, l'heure |
| **À venir** | les 10 prochains événements, groupés par semaine |
| **Passés** | les 20 derniers, avec leur historique |
| **Calendrier** | vue mensuelle, une pastille colorée par événement |

---

## 14.4 Plan de déroulement (EF-23) ⭐

### 14.4.1 Modèle d'une étape

```jsonc
{
  "id": "cue_3",
  "kind": "bible",              // note | bible | song | media | announcement
                                //        | lowerthird | timer | blank
  "label": "Jean 3:16",
  "durationSec": 300,           // estimation, optionnelle
  "payload": {
    "bibleId": "bible_lsg",
    "ref": "43-3-16..43-3-18",
    "outputs": ["out_full", "out_bottom"]
  },
  "notes": "Insister sur « donné »"
}
```

| `kind` | `payload` | Diffusion |
|---|---|---|
| `note` | `{ text }` | **rien** — repère de conduite (EF-23.2) |
| `bible` | `{ bibleId, ref, outputs? }` | verset ou plage |
| `song` | `{ songId, arrangementId, startAtSectionId?, outputs? }` | chant |
| `media` | `{ assetId, outputs? }` | média |
| `announcement` | `{ announcementId, outputs? }` | annonce |
| `lowerthird` | `{ lowerthirdId, outputs? }` | habillage |
| `timer` | `{ timerId, action: "start" }` | minuteur |
| `blank` | `{}` | écran noir |

**EF-23.1** — `ref` utilise le format `book-chapter-verse` et accepte une plage `..`
(`43-3-16..43-3-18`). La forme lisible (`Jean 3:16-18`) est affichée mais **n'est pas**
stockée.

### 14.4.2 Écran

```
┌────────────────────────────────────────────────────────────────────────────┐
│  PLAN · Culte du 26/10/2026 · 08:30          Durée estimée : 1 h 52        │
│  [⬆ Importer]  [+ Étape]  [🖨 Imprimer]  [↺ Réinitialiser]                 │
├──────────────────────────────────────┬─────────────────────────────────────┤
│  1  ▸ Accueil                5 min   │  EN COURS                           │
│  2    Grâce infinie          4 min   │  ┌───────────────────────────────┐  │
│  3    Jean 3:16-18           2 min   │  │ Jean 3:16                     │  │
│ ▶4  ▸ Offrande               7 min   │  │ « Car Dieu a tant aimé… »     │  │
│  5    Tu es saint            5 min   │  └───────────────────────────────┘  │
│  6    [Minuteur] Prédication 35 min  │                                     │
│  7    [Note] Prière          5 min   │  SUIVANT                            │
│  8    [Habillage] Intervenant        │  Tu es saint · Couplet 1            │
│                                      │                                     │
│  Total : 1 h 52                      │  APRÈS                              │
│                                      │  [Minuteur] Prédication             │
├──────────────────────────────────────┴─────────────────────────────────────┤
│   ⏮  ◀   [ ▶ AVANCER ]   ▶   ⏭        ■ Couper        ⎵ Espace            │
└────────────────────────────────────────────────────────────────────────────┘
```

| ID | Exigence |
|---|---|
| EF-23.3 | `Espace` / `→` avance, `←` recule, `Échap` coupe — **une seule touche en direct** |
| EF-23.4 | Panneaux **En cours / Suivant / Après** toujours visibles |
| EF-23.5 | Durée estimée par étape et **durée totale** du déroulé |
| EF-23.6 | Réordonnancement par glisser-déposer |
| EF-23.7 | Une étape peut être dupliquée, désactivée (`⏭ sautée`), supprimée |
| EF-23.8 | Avancer sur une étape `note` affiche son libellé partout **sans rien diffuser** |
| EF-23.9 | Reculer sur une étape rejoue le contenu précédent |
| EF-23.10 | Arriver à la dernière étape n'avance pas plus loin ; toast `TXT: Fin du plan.` |
| EF-23.11 | Le plan est **lié à l'événement** (EF-23.9 du CDC) |
| EF-23.12 | Le plan est pilotable depuis la télécommande et la vue scène |
| EF-23.13 | L'état du plan survit à un rechargement (position dans `session-state.json`) |

### 14.4.3 Import CSV / texte (repris de V1)

**EF-23.14** — Une ligne = une étape. Reconnaissance automatique :

| Motif de ligne | Type reconnu |
|---|---|
| `<Livre> <ch>[:.]<v>[-<v>]` | `bible` |
| Titre correspondant exactement à un chant existant | `song` |
| `#…` ou `//…` | `note` |
| Ligne vide | ignorée |
| Tout le reste | `note` |

```
TXT: Importer un plan

     Collez le déroulé ou choisissez un fichier CSV / TXT :

       Accueil
       Grâce infinie
       Jean 3:16-18
       # Offrande
       Tu es saint
       Prédication

     Résultat de l'analyse :
       Accueil          → note
       Grâce infinie    → chant  (correspondance exacte)
       Jean 3:16-18     → verset (LSG)
       Offrande         → note
       Tu es saint      → chant  (correspondance exacte)
       Prédication      → note  ⚠ aucun élément correspondant

     [R] Remplacer la file      [A] Ajouter à la fin      [Annuler]
```

### 14.4.4 Import Planning Center (repris de V1)

**EF-23.15** — Un export JSON d'un plan Planning Center est accepté.
**EF-23.16** — Les items deviennent des étapes ; les chants sont appariés **par titre**,
avec un rapport des correspondances et des échecs.
**EF-23.17** — Aucune connexion réseau n'est nécessaire : c'est un import de fichier.

### 14.4.5 Impression / export du déroulé

**EF-23.18** — Génération d'un document lisible (impression navigateur ou texte) :
```
PLAN DE CULTE — Culte du 26/10/2026
ICC Pahou · Temple principal · 08:30

 1. Accueil                          5 min
 2. Grâce infinie                    4 min     (Couplet 1 · Refrain · Couplet 2…)
 3. Jean 3:16-18                     2 min     LSG
 4. Offrande                         7 min
 …
Durée estimée : 1 h 52
```

---

## 14.5 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-12f** | Créer, dupliquer, supprimer un événement | le plan suit correctement |
| **A-12g** | Import CSV du § 14.4.3 | types reconnus comme indiqué, appariement des chants correct |
| **A-12h** | `Espace` 8 fois dans le plan | 8 étapes franchies, `note` non diffusée |
| **A-12i** | Reculer sur une étape | le contenu précédent est rejoué |
| **A-12j** | Dupliquer un événement | le plan est copié, l'historique n'est pas copié |
| **A-12k** | Recharger la page au milieu du plan | la position est restaurée |
