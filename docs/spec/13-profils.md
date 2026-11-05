# 13 — Profils

> **Exigences couvertes :** EF-20, décisions D-07
> **Maquette :** MAQ-07 (Profils)
> **Origine du besoin :** *« sur la page d'accueil, on doit avoir la possibilité de choisir
> des types de profils, par exemple un profil déjà configuré pour une conférence, une
> église, un stream live. »*

---

## 13.1 Définition

Un **profil** est un **gabarit complet et réutilisable** de configuration. Il ne contient
**aucun binaire** : il référence des objets du projet (`assetId`, `sceneId`, `bibleId`…).

Changer de profil **ne supprime rien** : les sorties, looks et scènes de l'ancien profil
restent dans le projet et peuvent être réappliqués.

| Ce qu'un profil définit | Ce qu'il ne définit pas |
|---|---|
| La liste des sorties (nom, preset, résolution, cadrage, `receives`) | Le contenu des bibliothèques |
| Les looks et la scène par type de contenu | Les médias eux-mêmes |
| La Bible par défaut et la seconde version | Les données d'un événement |
| Le réglage de la vue scène | Les préférences d'interface locales |
| Le gabarit de plan de déroulement | Les journaux |
| Les raccourcis (jeu de touches) | L'état de diffusion |

---

## 13.2 Schéma normatif

```jsonc
{
  "id": "prof_icc_culte",
  "rev": 7,
  "name": "ICC Pahou — Culte du dimanche",
  "kind": "church",                    // church | conference | stream | school | custom
  "description": "Projecteur salle + bandeau stream OBS",
  "color": "#f5b942",
  "icon": "church",                    // church | mic | video | graduation | star

  "outputs": [
    { "ref": "out_full",   "name": "Plein écran — Salle", "preset": "full",
      "width": 1920, "height": 1080, "fit": "contain", "transparent": false,
      "receives": { "bible": true, "songs": true, "media": true,
                    "announcements": true, "lowerthird": true, "timer": true, "plan": true } },
    { "ref": "out_bottom", "name": "Bas centré — Stream", "preset": "bottom",
      "width": 1920, "height": 1080, "fit": "contain", "transparent": true,
      "receives": { "bible": true, "songs": true, "media": false,
                    "announcements": true, "lowerthird": true, "timer": false, "plan": true } }
  ],

  "looks": ["look_sobre", "look_festif"],
  "defaultLook": "look_sobre",

  "bibles": { "primary": "bible_lsg", "secondary": "bible_bds", "showTwoVersions": false },

  "songFolders": ["fld_louange_2026"],
  "mediaGroups": ["grp_visuels_culte"],

  "stage": {
    "enabled": true,
    "timerLabel": "Prédication",
    "defaultMinutes": 35,
    "warnMinutes": 5,
    "criticalMinutes": 1,
    "showChords": true,
    "messageHistorySize": 5
  },

  "planTemplate": "plan_culte_type",
  "keyboardProfile": "standard",

  "splitDefaults": {
    "bible":  { "maxWordsPerScreen": 25, "splitBy": "words" },
    "songs":  { "maxWordsPerScreen": 30, "splitBy": "words" }
  }
}
```

| Champ | Règle |
|---|---|
| `ref` | référence vers une sortie existante (`id`), ou définit une nouvelle sortie si inconnue |
| `looks` | **références partagées** (D-07) ; l'action « Détacher » crée une copie |
| `bibles.primary` | doit exister dans le projet ; sinon, première Bible disponible |
| `planTemplate` | gabarit appliqué au prochain événement créé avec ce profil |
| `splitDefaults` | **valeurs initiales** des scènes créées par ce profil, jamais une contrainte |

**EF-20.11** — Un profil ne peut pas référencer un objet qui n'existe pas : à l'application,
les références manquantes sont ignorées avec un rapport.
**EF-20.12** — Toute valeur absente d'un profil retombe sur le défaut global.

---

## 13.3 Les trois profils livrés

### 13.3.1 « Église » (kind `church`)

| Élément | Valeur |
|---|---|
| Couleur / icône | `#f5b942` · `church` |
| Sorties | **Plein écran — Salle** (`full`, opaque, tout) · **Bas centré — Stream** (`bottom`, transparent, sans médias) |
| Looks | Sobre (défaut), Festif, Carême, Noël, Aube, Mission |
| Bibles | LSG (primaire), BDS (secondaire), 2 versions **désactivé** |
| Vue scène | activée, minuteur « Prédication » 35 min, accords affichés |
| Plan type | *Culte du dimanche* : Accueil · Louange (3 chants) · Annonces · Offrande · Prédication · Prière · Bénédiction |
| Découpage Bible | 25 mots (bandeau) · 40 mots (plein écran) |

### 13.3.2 « Conférence » (kind `conference`)

| Élément | Valeur |
|---|---|
| Couleur / icône | `#38bdf8` · `mic` |
| Sorties | **Plein écran — Salle** · **Retour scène** (`full`, 1280×720) · **Bas centré — Stream** |
| Looks | Moderne (défaut), Minimal, Cinéma |
| Bibles | LSG uniquement, 2 versions **désactivé** |
| Vue scène | activée, minuteur « Session » 45 min, accords masqués |
| Plan type | *Conférence 3 sessions* : Ouverture · Session 1 · Pause · Session 2 · Session 3 · Clôture |
| Découpage Bible | 22 mots (bandeau) · 45 mots (plein écran) |

### 13.3.3 « Stream live » (kind `stream`)

| Élément | Valeur |
|---|---|
| Couleur / icône | `#e879f9` · `video` |
| Sorties | **Bandeau stream** (`bottom`, transparent, **sans médias**) · **Habillage** (`lowerthird`, transparent) · **Médias plein écran** (`full`, opaque, médias seulement) |
| Looks | Cinéma (défaut), Néon |
| Bibles | LSG, 2 versions désactivé |
| Vue scène | **désactivée** |
| Plan type | *Conducteur de direct* : Pré-show · Décompte · Ouverture · Louange · Message · Outro |
| Découpage Bible | **18 mots** (bandeau étroit) · 40 mots (plein écran) |

**EF-20.13** — Ces trois profils sont créés **à la première ouverture d'un projet**, avec
toutes leurs scènes prêtes à l'emploi (aucune configuration nécessaire).

---

## 13.4 Écran « Profils »

```
┌────────────────────────────────────────────────────────────────────────────┐
│  PROFILS                                            [+ Créer un profil]    │
├────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ 🏛 Église ✓  │ │ 🎤 Conférence│ │ 🎬 Stream    │ │ ＋ Nouveau   │      │
│  │ 2 sorties    │ │ 3 sorties    │ │ 3 sorties    │ │              │      │
│  │ 6 looks      │ │ 3 looks      │ │ 2 looks      │ │              │      │
│  │ [Aperçu]     │ │ [Aperçu]     │ │ [Aperçu]     │ │              │      │
│  │ [Appliquer]  │ │ [Appliquer]  │ │ [Appliquer]  │ │              │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
├────────────────────────────────────────────────────────────────────────────┤
│  PROFIL ACTIF : ICC Pahou — Culte du dimanche                              │
│  [Modifier]  [Dupliquer]  [Exporter]  [Renommer]  [Supprimer]              │
└────────────────────────────────────────────────────────────────────────────┘
```

| ID | Exigence |
|---|---|
| EF-20.1 | Chaque vignette affiche le nom, le nombre de sorties et de looks, un aperçu du look par défaut |
| EF-20.2 | `Appliquer` demande confirmation si quelque chose est à l'antenne |
| EF-20.3 | Tout profil est **entièrement éditable** : aucun champ n'est figé |
| EF-20.4 | `Enregistrer la configuration actuelle comme profil` capture sorties + looks + réglages |
| EF-20.5 | Dupliquer produit `« X (copie) »` |
| EF-20.6 | Exporter produit un `.opprofile.json` **sans** les binaires |
| EF-20.7 | Exporter « avec les médias » produit un `.opprofile.zip` autonome |
| EF-20.8 | Importer un profil propose de fusionner avec l'existant ou de le créer à côté |
| EF-20.9 | Le profil actif est affiché en permanence sur l'accueil (EF-05) |

---

## 13.5 Application d'un profil

### 13.5.1 Séquence normative

| Étape | Action |
|---|---|
| 1 | Vérifier que le profil est valide (références existantes) |
| 2 | Si quelque chose est à l'antenne → **couper** après confirmation |
| 3 | Créer ou mettre à jour les sorties listées |
| 4 | Appliquer les scènes par type de contenu (selon les looks) |
| 5 | Mettre à jour `settings.activeProfileId` |
| 6 | Diffuser l'invalidation aux onglets ouverts |
| 7 | Afficher : `TXT: Profil « Conférence » appliqué · 3 sorties · 3 looks` |

**EF-20.14** — Les sorties présentes dans le profil mais **absentes** du projet sont
créées ; les sorties du projet **non mentionnées** ne sont pas supprimées, elles sont
simplement désactivées (`enabled: false`) avec une note.
**EF-20.15** — Les scènes utilisées par le profil sont **copiées** dans les scènes du projet
si elles sont embarquées (`embed`), ou référencées sinon.
**EF-20.16** — L'application d'un profil est **atomique** : en cas d'erreur, aucun changement
n'est appliqué (sauvegarde de l'état précédent, restauration en cas d'échec).

### 13.5.2 Confirmation

```
TXT: Appliquer le profil « Conférence » ?

     Cette action va :
       • couper ce qui est à l'antenne
       • remplacer 2 sorties et créer 1 sortie
       • appliquer les looks Moderne, Minimal, Cinéma
       • changer la Bible par défaut pour LSG

     Vos scènes et looks actuels sont conservés : ils pourront être
     réappliqués à tout moment.

     [A] Appliquer      [Annuler]
```

---

## 13.6 Profils, organisations et événements

| Relation | Règle |
|---|---|
| Organisation → Profil | une organisation **propose** un profil par défaut |
| Événement → Profil | un événement **impose** son profil au chargement |
| Profil → Événement | un profil fournit un **gabarit de plan** pour les nouveaux événements |

**EF-20.17** — Un événement peut utiliser un profil différent de celui de son organisation.
**EF-20.18** — Charger un événement dont le profil diffère du profil actif propose
l'application de ce profil (§ 5.4.2).

---

## 13.7 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-11** | Passer de « Église » à « Stream live » | sorties, looks, binaires et liens changent en une action |
| **A-11f** | Appliquer un profil avec une scène supprimée | rapport de références manquantes, aucune erreur bloquante |
| **A-11g** | Dupliquer puis modifier un profil | l'original n'est pas affecté |
| **A-11h** | Exporter un profil avec médias, l'importer dans un projet vierge | tout fonctionne |
| **A-11i** | Appliquer un profil pendant une diffusion | confirmation, coupure, application complète |
