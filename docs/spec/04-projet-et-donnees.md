# 04 — Le dossier de projet et les données

> **Exigences couvertes :** EF-01, EF-02, EF-26, ENF-22 → ENF-25, principes P2 et P4
> **Décision appliquée :** D-02 — le **disque est la source de vérité**, IndexedDB n'est
> qu'un cache de lecture.
> **Maquettes :** aucune (chapitre technique)

---

## 4.1 Le principe

> **Copier le dossier, c'est copier la régie.**

Aucune donnée essentielle ne vit dans le navigateur. Un utilisateur peut :
- copier le dossier sur une clé USB et continuer sur un autre PC ;
- supprimer tout le cache de son navigateur sans rien perdre ;
- archiver le dossier et le restaurer dans 5 ans ;
- envoyer le dossier à une autre église par clé USB.

**EF-01.1** — Tout ce que l'utilisateur crée est écrit sous `project/`.
**EF-01.2** — Rien n'est écrit dans le profil utilisateur de l'OS, ni dans le registre,
ni dans `~/.config`, ni dans le navigateur.
**EF-01.3** — L'application fonctionne si `project/` est sur une clé USB, un disque
réseau SMB, ou un volume chiffré.

---

## 4.2 Arborescence normative

```
project/
├── project.json                     identité, réglages, version du format
├── session-state.json               dernier état de diffusion (reprise)
│
├── library/
│   ├── bibles/<bibleId>.json        métadonnées + index de la version biblique
│   ├── songs/<songId>.json          chants
│   ├── looks/<lookId>.json          looks réutilisables
│   ├── announcements/<id>.json      annonces texte
│   ├── timers/<id>.json             minuteurs nommés
│   └── lowerthirds/<id>.json        habillages nommés
│
├── assets/
│   ├── index.json                   registre des binaires (par empreinte)
│   ├── bibles/<sha>.xml             fichiers Bible d'origine (traçabilité)
│   ├── songs/<sha>.<ext>            fichiers chant d'origine
│   ├── media/<sha>.<ext>            images, vidéos, PDF, PPTX
│   ├── backgrounds/<sha>.<ext>      fonds de scène
│   └── logos/<sha>.<ext>            logos
│
├── outputs/
│   └── outputs.json                 liste des sorties + scènes associées
│
├── scenes/<sceneId>.json            scènes (décision D-08 : fichiers séparés)
│
├── profiles/<profileId>.json        profils
│
├── orgs/<orgId>.json                organisations + lieux
│
├── events/<eventId>.json            événements + plans de déroulement
│
├── cache/                           RECONSTRUISABLE — jamais essentiel
│   ├── thumb/<sha>.webp             miniatures
│   ├── search-index.json            index de recherche unifiée
│   └── browser/                     miroir IndexedDB (facultatif)
│
├── backups/
│   ├── pre-migration-<date>.zip     sauvegarde avant migration
│   └── auto-<date>.zip              historique tournant
│
└── logs/
    ├── launch-<date>.log            journaux du lanceur
    └── session-<date>.log           journaux du serveur
```

**EF-01.4** — `cache/` peut être supprimé à tout moment : il est **entièrement
reconstruit** au lancement suivant. L'interface propose un bouton
« Vider le cache » avec la taille libérée.

**EF-01.5** — `assets/`, `library/`, `scenes/`, `outputs/`, `profiles/`, `orgs/`,
`events/` sont les **seuls** dossiers essentiels.

---

## 4.3 `project.json` — schéma exact

```jsonc
{
  "id": "prj_7f3c1a9e2b4d",            // UUIDv4, stable à vie
  "name": "ICC Pahou",                  // modifiable, défaut = nom du dossier
  "formatVersion": 3,                   // version du schéma, migration auto
  "appVersion": "3.0.0",                // version qui a écrit en dernier
  "createdAt": "2026-10-21T09:14:22.481Z",
  "updatedAt": "2026-10-21T18:02:07.119Z",
  "language": "fr",

  "settings": {
    "port": 8788,
    "lanToken": "4F2K",                 // null si désactivé
    "lanTokenEnabled": true,
    "activeProfileId": "prof_icc_culte",
    "activeEventId": "evt_2026-10-26",
    "defaultBibleId": "bible_lsg",
    "maxAssetWarnBytes": 524288000,     // seuil D-04 : 500 Mo
    "autoBackup": true,
    "autoBackupKeep": 10,
    "readOnly": false,
    "catalogEnabled": false,            // EF-27.1 : désactivé par défaut
    "blankOnStartup": true              // écran noir au démarrage
  },

  "stats": {                            // informatif, affiché sur l'accueil
    "bibles": 3, "songs": 84, "media": 213,
    "scenes": 22, "profiles": 4, "events": 31
  }
}
```

| Champ | Règle |
|---|---|
| `id` | **INV-5** — ne change jamais, même après renommage |
| `formatVersion` | entier croissant ; une migration est fournie pour chaque incrément |
| `settings.lanToken` | 4 caractères `[A-Z2-9]`, régénérable depuis les réglages |
| `settings.maxAssetWarnBytes` | seuil d'avertissement à l'import (D-04) |
| `stats` | recalculé au lancement, jamais source de vérité |

---

## 4.4 Le registre d'assets — `assets/index.json`

C'est la clé de voûte de P4 (« ce qui est importé est copié »).

```jsonc
{
  "version": 1,
  "assets": {
    "9f2c8e1a7b4d6f03c5e8a1b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2": {
      "sha256": "9f2c8e1a…",
      "path": "media/9f2c8e1a.mp4",       // relatif à assets/
      "mime": "video/mp4",
      "ext": "mp4",
      "bytes": 48213760,
      "originalName": "Offrande 2026.mp4",
      "importedAt": "2026-10-21T10:02:11.000Z",
      "kind": "media",                     // bible | song | media | background | logo
      "meta": {                            // spécifique au type
        "width": 1920, "height": 1080, "durationMs": 42130
      },
      "refs": 3                            // nombre d'objets qui le référencent
    }
  }
}
```

### 4.4.1 Procédure d'import (normative)

| Étape | Action | En cas d'échec |
|---|---|---|
| 1 | Lire le fichier source en flux | `TXT: « <nom> » est illisible.` |
| 2 | Calculer le SHA-256 en flux (pas de chargement complet en mémoire) | idem |
| 3 | Chercher l'empreinte dans `assets/index.json` | — |
| 4a | **Trouvée** → incrémenter `refs`, ne rien copier | — |
| 4b | **Absente** → vérifier la taille contre `maxAssetWarnBytes` | voir 4.4.2 |
| 5 | Écrire dans `assets/<kind>/<sha8>.<ext>` via `.part` puis `rename` | `TXT: Écriture impossible : <raison>` |
| 6 | Extraire les métadonnées (dimensions, durée, pages) | métadonnées vides, pas d'échec |
| 7 | Générer la miniature dans `cache/thumb/<sha8>.webp` | miniature absente, icône générique |
| 8 | Ajouter l'entrée dans `index.json` (écriture atomique) | rollback du fichier écrit |
| 9 | Créer l'objet métier (`library/…` ou calque de scène) | — |

**EF-02.1** — Le chemin d'origine **n'est jamais stocké**, nulle part.
**EF-02.2** — Le nom d'origine est conservé dans `originalName` pour l'affichage.
**EF-02.3** — Deux imports du même fichier ne produisent **qu'un seul** binaire (A-05).
**EF-02.4** — `refs` est recalculé au lancement ; un asset à `refs: 0` est signalé par
l'outil de nettoyage (4.9).
**EF-02.5** — L'extension est conservée ; le nom de fichier sur disque est
`<8 premiers caractères du sha>.<ext>`.

### 4.4.2 Fichiers volumineux (décision D-04)

Au-delà de `settings.maxAssetWarnBytes` (défaut 500 Mo) :

```
TXT: « Concert-complet.mp4 » fait 1,8 Go.

     Le copier dans le projet alourdira les sauvegardes et les copies
     sur clé USB. Espace libre restant après copie : 4,2 Go.

     [C] Copier quand même dans le projet (recommandé pour la portabilité)
     [L] Laisser à son emplacement d'origine (non portable)
     [A] Annuler
```

**EF-02.6** — L'option `L` crée un asset de type `linked` avec `absolutePath`.
**EF-02.7** — Un asset `linked` est signalé en **orange** partout dans l'interface, avec
l'infobulle :
```
TXT: Ce fichier n'est pas dans le projet : il ne sera pas exporté.
     Emplacement : E:\Videos\Concert-complet.mp4
```
**EF-02.8** — Le test A-04 (suppression du fichier source) doit afficher un placeholder
explicite et non un écran figé.

---

## 4.5 Écriture atomique et cohérence

**ENF-22** — Toute écriture suit la séquence :

```
1. écrire dans <cible>.tmp-<aleatoire>
2. fsync du fichier
3. rename(<tmp>, <cible>)            ← atomique sur les 3 OS
4. fsync du dossier parent (Linux/macOS)
```

**EF-01.6** — Aucune écriture partielle ne peut être observée par un lecteur.
**EF-01.7** — Un fichier `.tmp-*` orphelin (plantage) est supprimé au lancement.
**EF-01.8** — Les écritures sont **sérialisées** par fichier (file d'attente interne) :
deux onglets qui sauvegardent la même scène ne produisent pas de corruption.
**EF-01.9** — Un verrou `project/.lock` (avec PID et horodatage) empêche **deux serveurs**
d'écrire sur le même projet. Verrou obsolète (> 60 s sans battement) → repris.

### 4.5.1 Conflit entre deux onglets

Le relais WebSocket diffuse un évènement `project:changed` avec la ressource et sa
révision. Un onglet qui reçoit une révision **supérieure** à la sienne :
- si l'utilisateur n'a rien modifié → recharge silencieusement ;
- s'il a des modifications non enregistrées → affiche :
```
TXT: Cette scène a été modifiée dans un autre onglet.
     [R] Recharger la version la plus récente
     [E] Enregistrer quand même mes modifications
```

**EF-01.10** — Chaque objet métier porte un champ `rev` (entier croissant) utilisé pour
cette détection.

---

## 4.6 Synchronisation avec le navigateur

| Couche | Rôle | Contenu |
|---|---|---|
| **Disque** (`project/`) | **source de vérité** | tout |
| **API serveur** (`/api/*`) | seul chemin d'écriture | JSON + binaires |
| **IndexedDB** | cache de lecture | bibliothèques, scènes, assets récents |
| **`localStorage`** | préférences d'interface uniquement | onglet actif, taille des panneaux, dernier module ouvert |

**EF-01.11** — IndexedDB est **régénérable** : le supprimer ne perd rien (A-03).
**EF-01.12** — `localStorage` ne contient **aucune** donnée de contenu : uniquement des
préférences cosmétiques propres à ce navigateur.
**EF-01.13** — Au démarrage, le client compare `project.updatedAt` avec son cache et ne
recharge que ce qui a changé.
**EF-01.14** — Si le serveur est injoignable, l'interface passe en **mode dégradé** :
lecture depuis le cache, écriture désactivée, bandeau :
```
TXT: ⚠ Serveur déconnecté — affichage en cache, modifications désactivées
```

---

## 4.7 Schémas des objets métier

### 4.7.1 Bible — `library/bibles/<id>.json`

```jsonc
{
  "id": "bible_lsg",
  "rev": 4,
  "name": "Louis Segond 1910",
  "shortName": "LSG",
  "language": "fr",
  "abbreviation": "LSG",
  "direction": "ltr",
  "source": {
    "kind": "import",              // import | catalog | sample
    "format": "beblia",            // beblia | zefania | osis | usfx
    "originalName": "FrenchBible.xml",
    "assetId": "a3f9…",            // le XML d'origine est conservé
    "catalogEntry": null,
    "license": "Domaine public",
    "importedAt": "2026-08-09T07:12:44.000Z"
  },
  "counts": { "books": 66, "chapters": 1189, "verses": 31102 },
  "books": [
    { "num": 1, "name": "Genèse", "abbr": "Gn", "chapters": 50 }
  ],
  "indexAssetId": "c1d2…",          // index de recherche binaire (cache/)
  "favorites": ["1-1-1", "43-3-16"],
  "annotations": {
    "43-3-16": {
      "html": "Car <strong>Dieu</strong> a tant aimé…",
      "note": "Verset clé pour la prédication",
      "updatedAt": "2026-10-18T20:00:00.000Z"
    }
  }
}
```

**EF-11.1** — Le **texte des versets** est stocké dans un fichier séparé
`library/bibles/<id>.verses.json` (trop volumineux pour être relu à chaque ouverture).
**EF-11.2** — Les clés de versets utilisent le format `<bookNum>-<chapterNum>-<verseNum>`,
**jamais** le nom du livre (stable quelle que soit la langue).
**EF-11.3** — `annotations` ne modifie jamais le texte source : c'est une surcouche.

### 4.7.2 Chant — `library/songs/<id>.json`

```jsonc
{
  "id": "sng_grace_infinie",
  "rev": 12,
  "title": "Grâce infinie",
  "titleOriginal": "Amazing Grace",
  "artist": "Traditionnel",
  "composer": "John Newton",
  "copyright": "Domaine public",
  "ccli": null,
  "key": "G",
  "tempo": 72,
  "timeSignature": "3/4",
  "durationSec": 240,
  "language": "fr",
  "tags": ["louange", "2026"],
  "folders": ["fld_louange_2026"],
  "sections": [
    { "id": "sec_v1", "name": "Couplet 1", "type": "verse", "lines": ["Grâce infinie…"] },
    { "id": "sec_c",  "name": "Refrain",   "type": "chorus", "lines": ["…"] }
  ],
  "arrangements": [
    { "id": "arr_default", "name": "Ordre standard",
      "order": ["sec_v1", "sec_c", "sec_v2", "sec_c", "sec_b", "sec_c"] }
  ],
  "activeArrangementId": "arr_default",
  "sourceAssetId": "b7e1…",
  "chords": { "sec_v1": [["G", 0], ["C", 12]] }
}
```

**EF-15.1** — Un chant a **au moins une section** et **au moins un arrangement**.
**EF-15.2** — `arrangements[].order` ne référence que des `id` de sections existantes ;
une référence orpheline est nettoyée au chargement.

### 4.7.3 Sortie — `outputs/outputs.json`

```jsonc
{
  "rev": 31,
  "outputs": [
    {
      "id": "out_full",
      "name": "Plein écran — Salle",
      "preset": "full",
      "width": 1920, "height": 1080,
      "fit": "contain",
      "transparent": false,
      "enabled": true,
      "targetByDefault": true,
      "receives": { "bible": true, "songs": true, "media": true,
                    "announcements": true, "lowerthird": true, "timer": true, "plan": true },
      "scenesByKind": {
        "bible": "scn_bible_full", "songs": "scn_songs_full",
        "media": "scn_media_full", "announcements": "scn_ann_full",
        "lowerthird": "scn_lt_full", "timer": "scn_timer_full"
      },
      "notes": "Source navigateur OBS « PRESENTATION PLEIN ECRAN »"
    }
  ]
}
```

### 4.7.4 Scène — `scenes/<id>.json`

Voir `08-editeur-scene.md` § 8.3 pour le schéma complet des calques.

### 4.7.5 Profil — `profiles/<id>.json`

Voir `13-profils.md` § 13.2.

### 4.7.6 Organisation — `orgs/<id>.json`

```jsonc
{
  "id": "org_icc",
  "rev": 2,
  "name": "ICC Pahou",
  "kind": "church",
  "contact": { "email": "", "phone": "", "address": "" },
  "logoAssetId": "d4a8…",
  "places": [
    { "id": "plc_temple", "name": "Temple principal", "capacity": 800,
      "screens": ["Projecteur salle", "Retour scène"] }
  ]
}
```

### 4.7.7 Événement — `events/<id>.json`

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
  "recurrence": null,                 // ou { "freq": "weekly", "byDay": ["SU"] }
  "plan": {
    "id": "plan_1",
    "cues": [
      { "id": "cue_1", "kind": "note",  "label": "Accueil", "durationSec": 300 },
      { "id": "cue_2", "kind": "song",  "songId": "sng_grace_infinie", "arrangementId": "arr_default" },
      { "id": "cue_3", "kind": "bible", "bibleId": "bible_lsg", "ref": "43-3-16..43-3-18" },
      { "id": "cue_4", "kind": "media", "assetId": "9f2c…" },
      { "id": "cue_5", "kind": "note",  "label": "Offrande", "durationSec": 420 },
      { "id": "cue_6", "kind": "timer", "timerId": "tmr_predication" }
    ]
  },
  "history": [
    { "cueId": "cue_2", "shownAt": "2026-10-26T08:42:11.000Z", "outputs": ["out_full", "out_bottom"] }
  ]
}
```

**EF-22.1** — `history` est **append-only** ; il n'est jamais modifié, seulement purgé.
**EF-23.1** — `plan.cues[].kind` ∈ `note | bible | song | media | announcement |
lowerthird | timer | blank`.
**EF-23.2** — Un cue `note` **ne diffuse rien** : il avance le pointeur et affiche son
libellé dans la régie et sur la vue scène.

---

## 4.8 Nomenclature et règles de fichiers

| Règle | Détail |
|---|---|
| Noms de fichiers | `<id>.json` pour les objets métier ; `<sha8>.<ext>` pour les binaires |
| `id` | préfixe typé : `bible_`, `sng_`, `scn_`, `out_`, `prof_`, `org_`, `evt_`, `as_` (12 à 32 caractères `[a-z0-9_]`) |
| Encodage | UTF-8 sans BOM, fins de ligne `\n` |
| JSON | 2 espaces d'indentation, clé `rev` en second, **stable** (clés triées) pour des diffs Git lisibles |
| Taille max d'un fichier JSON | 16 Mo ; au-delà, découpage obligatoire (cas des versets) |
| Caractères interdits dans les noms affichés | aucun — mais les noms de **fichiers** sont toujours des `id`, jamais le nom saisi |

**INV-2** — Aucun chemin absolu de la machine d'origine n'est stocké, **sauf** pour les
assets explicitement `linked` (EF-02.6), signalés comme non portables.

---

## 4.9 Maintenance et intégrité

L'interface expose un écran **« Intégrité du projet »** :

| Contrôle | Action proposée |
|---|---|
| Assets orphelins (`refs: 0`) | « Supprimer (libère 1,4 Go) » |
| Assets manquants (référencés mais absents) | « Restaurer depuis une sauvegarde » |
| Références orphelines (scène supprimée encore référencée) | « Nettoyer » |
| Miniatures manquantes | « Régénérer » |
| Index de recherche obsolète | « Reconstruire » |
| Fichiers `.tmp-*` orphelins | « Supprimer » |
| Doublons de chants (même titre) | liste, pas d'action automatique |

**EF-01.15** — Aucune action de maintenance n'est exécutée sans confirmation explicite
affichant le nombre d'éléments et l'espace concerné.

---

## 4.10 Sauvegarde automatique

| Règle | Détail |
|---|---|
| Déclencheur | après chaque écriture significative, au plus une fois toutes les 60 s |
| Contenu | archive ZIP de `library/`, `scenes/`, `outputs/`, `profiles/`, `orgs/`, `events/`, `assets/index.json`, `project.json` — **sans** les binaires (trop lourds) par défaut |
| Option « inclure les médias » | produit une archive complète, désactivée par défaut |
| Rétention | `settings.autoBackupKeep` dernières archives (défaut 10) |
| Emplacement | `project/backups/auto-<AAAA-MM-JJ-HHmm>.zip` |
| Échec | avertissement non bloquant + entrée dans le journal |

**EF-26.1** — Une sauvegarde **précède toujours** une migration de format (EF-03.37).

---

## 4.11 Migration depuis V1 et V2

Les versions actuelles du dépôt stockent leurs données ailleurs :

| Source | Emplacement | Contenu à migrer |
|---|---|---|
| **V1** `servergestionobs/data/` | fichiers JSON par namespace (`bible/favs`, `lt/presets`, `lyrics/displaySettings`…) | favoris, réglages, présets de lower third, file de déroulement |
| **V1** IndexedDB | versions Bible, chants, blobs média | bibliothèques complètes |
| **V1** export global | JSON produit par `/api/export` | tout ce qui précède, déjà sérialisé |
| **V2** IndexedDB `openpresenter2` v3 | stores `settings, bibles, songs, media, announcements, scenes, assets, notes` | **tout** |
| **V2** `.openpresenter.zip` | archive de secours | tout |

### 4.11.1 Outil de migration

Un écran **« Importer depuis une version précédente »**, accessible au premier lancement
et depuis les réglages :

```
TXT: Importer des données existantes

     OpenPresenter peut récupérer vos bibles, chants, médias, looks
     et réglages depuis :

     [1] Une sauvegarde OpenPresenter 2 (.openpresenter.zip)
     [2] Une sauvegarde OpenPresenter 1 (.json)
     [3] Le navigateur de ce PC (données OpenPresenter 1 ou 2 encore présentes)
     [4] Un dossier « data » d'OpenPresenter 1

     Choisissez une source :
```

**EF-26.2** — La migration est **toujours** précédée d'un rapport :
```
TXT: Analyse terminée.

     Bibles       3   (LSG, BDS, KJV)          41,2 Mo
     Chants      84                            312 Ko
     Médias     213   dont 2 vidéos > 500 Mo   3,8 Go
     Looks        6
     Réglages    12

     [I] Importer      [A] Annuler
```
**EF-26.3** — La migration est **idempotente** : la relancer ne crée pas de doublons
(appariement par empreinte pour les binaires, par `id` puis par nom pour les objets).
**EF-26.4** — Un **journal de migration** liste chaque élément importé, ignoré ou en
erreur, téléchargeable.
**EF-26.5** — La migration n'écrit rien tant que l'utilisateur n'a pas confirmé.
**EF-26.6** — Test d'acceptation **A-03b** : migrer une vraie sauvegarde du dépôt
(`openpresenter-sauvegarde-2026-08-09.json`, 2,5 Mo, présent dans le dépôt) doit
restituer l'intégralité des éléments sans perte.

---

## 4.12 Tests d'acceptation liés

| Test | Scénario |
|---|---|
| **A-03** | Copier le dossier, vider le cache navigateur → tout est identique |
| **A-03b** | Migration d'une vraie sauvegarde V1 du dépôt → aucun élément perdu |
| **A-04** | Import depuis `/tmp`, suppression de la source → le média s'affiche toujours |
| **A-05** | Double import du même fichier → un seul binaire sur disque |
| **A-13** | Export → décompression ailleurs → fonctionnement complet |
| **A-15** | Tuer le serveur en pleine écriture → au relancement, aucun fichier corrompu |
