# 17 — Catalogue en ligne

> **Exigences couvertes :** EF-27, ENF-01, ENF-04, principe P1
> **C'est la SEULE fonction du logiciel autorisée à émettre une requête réseau sortante.**

---

## 17.1 Périmètre

> *« Il faut que le logiciel soit totalement indépendant d'internet, même si ce sera possible
> de télécharger des bibles, des chants, qui sont sur des API libres directement depuis
> internet si on est connecté dans le logiciel. »*

Le catalogue est **un confort**, jamais une dépendance.

| ID | Exigence |
|---|---|
| EF-27.1 | **Désactivé par défaut** (`settings.catalogEnabled: false`) |
| EF-27.2 | Ne s'active que par une action explicite dans les Réglages |
| EF-27.3 | Son indisponibilité n'a **aucun** effet sur le reste de l'application |
| EF-27.4 | Aucune requête n'est émise tant qu'il est désactivé |
| EF-27.5 | Aucune donnée utilisateur n'est transmise au serveur distant |

---

## 17.2 Sources

### 17.2.1 Fichier de sources livré

`app/data/catalog-sources.json` — **éditable par l'utilisateur**.

```jsonc
{
  "version": 1,
  "sources": [
    {
      "id": "beblia-bibles",
      "kind": "bible",
      "name": "Bibles XML libres (Beblia)",
      "description": "Dépôt de Bibles dans de nombreuses langues, format XML.",
      "indexUrl": "https://raw.githubusercontent.com/Beblia/Holy-Bible-XML-Format/master/README.md",
      "pattern": "github:Beblia/Holy-Bible-XML-Format",
      "license": "Variable selon la version",
      "enabled": true
    },
    {
      "id": "getbible",
      "kind": "bible",
      "name": "getBible",
      "description": "API de Bibles libres, formats JSON et OSIS.",
      "indexUrl": "https://api.getbible.net/v2/translations.json",
      "license": "Domaine public / libre",
      "enabled": true
    },
    {
      "id": "hymnes-libres",
      "kind": "song",
      "name": "Recueils de cantiques libres",
      "description": "Recueils en domaine public, format texte / ChordPro.",
      "indexUrl": "",
      "license": "Domaine public",
      "enabled": false
    },
    {
      "id": "fonds-libres",
      "kind": "background",
      "name": "Fonds d'écran libres",
      "description": "Images sous licence libre pour les fonds de scène.",
      "indexUrl": "",
      "license": "CC0 / CC-BY",
      "enabled": false
    }
  ]
}
```

**EF-27.6** — Chaque source porte : identifiant, type, nom, description, URL d'index,
licence, état activé.
**EF-27.7** — Une source peut être ajoutée par l'utilisateur (URL libre).
**EF-27.8** — Une source `enabled: false` n'est **jamais** interrogée.
**EF-27.9** — La licence est **toujours** affichée avant le téléchargement.

### 17.2.2 Types de contenu

| `kind` | Contenu | Destination |
|---|---|---|
| `bible` | fichier XML / JSON de version biblique | `assets/bibles/` puis `library/bibles/` |
| `song` | recueil ou chant | `library/songs/` |
| `background` | image de fond | `assets/backgrounds/` |
| `logo` | logos libres | `assets/logos/` |

---

## 17.3 Écran

```
┌────────────────────────────────────────────────────────────────────────────┐
│  CATALOGUE EN LIGNE                                    ● Connecté          │
│  [Bibles] [Chants] [Fonds] [Logos]        Rechercher : [            ]      │
├────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 📖 Louis Segond 1910                              français · fr      │  │
│  │    Beblia · Licence : Domaine public · 4,3 Mo · 31 102 versets      │  │
│  │    [Télécharger]  [Voir la source]                                   │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ 📖 King James Version                             anglais · en      │  │
│  │    Beblia · Licence : Domaine public · 4,8 Mo · 31 102 versets      │  │
│  │    [Télécharger]                                                     │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ 📖 Bible du Semeur                                français · fr      │  │
│  │    Licence : ⚠ à vérifier avant usage · 5,1 Mo                       │  │
│  │    [Voir la licence]  [Télécharger quand même]                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────┤
│  💡 Vous pouvez aussi importer un fichier téléchargé manuellement.         │
│     [Importer un fichier XML…]                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

| ID | Exigence |
|---|---|
| EF-27.10 | Une entrée affiche : nom, langue, source, **licence**, taille, nombre de versets |
| EF-27.11 | Le bouton de téléchargement est désactivé si la licence est inconnue, sauf confirmation explicite |
| EF-27.12 | Une entrée déjà importée est marquée `✓ Déjà dans le projet` |
| EF-27.13 | La recherche filtre par nom et langue |

---

## 17.4 Téléchargement

| Étape | Action | Erreur possible |
|---|---|---|
| 1 | Résoudre l'URL de la ressource | `RESOLVE_FAILED` |
| 2 | `HEAD` ou `GET` avec **timeout 8 s** | `TIMEOUT` |
| 3 | Afficher la progression (octets reçus / attendus) | — |
| 4 | Vérifier la taille maximale (100 Mo par défaut) | `TOO_LARGE` |
| 5 | Vérifier l'empreinte SHA-256 si annoncée | `CHECKSUM_MISMATCH` |
| 6 | Écrire dans `assets/<kind>/` via `.part` puis `rename` | `WRITE_FAILED` |
| 7 | Analyser et importer comme un fichier local | `PARSE_FAILED` |
| 8 | Ajouter au projet | — |

**EF-27.14** — Le téléchargement est **reprenable** si le serveur le supporte (`Range`).
**EF-27.15** — Une empreinte non annoncée est calculée et **affichée** après téléchargement,
pour que l'utilisateur puisse vérifier s'il le souhaite.
**EF-27.16** — Un échec n'écrit **rien** dans le projet.
**EF-27.17** — Le résultat passe par la **même** procédure d'import qu'un fichier local
(déduplication, miniature, métadonnées).

---

## 17.5 Messages d'erreur (littéraux)

| Situation | Message |
|---|---|
| Catalogue désactivé | `TXT: Le catalogue est désactivé. Activez-le dans Réglages → Catalogue en ligne.` |
| Aucune connexion | `TXT: Aucune connexion Internet détectée. Le catalogue est indisponible — le reste du logiciel n'est pas affecté.` |
| Timeout | `TXT: Le serveur n'a pas répondu dans les 8 secondes. Réessayez plus tard.` |
| Empreinte invalide | `TXT: Le fichier téléchargé ne correspond pas à l'empreinte annoncée. Le téléchargement a été annulé par sécurité.` |
| Trop volumineux | `TXT: Ce fichier fait 240 Mo, au-delà de la limite de 100 Mo. Téléchargez-le manuellement puis importez-le.` |
| Analyse impossible | `TXT: Le fichier a été téléchargé mais n'est pas une Bible reconnue. Il a été supprimé.` |
| Licence inconnue | `TXT: La licence de ce contenu n'est pas indiquée. Vérifiez vos droits avant de l'utiliser publiquement.` |

---

## 17.6 Mode hors-ligne

**EF-27.18** — Au lancement, si le catalogue est activé, une vérification de connectivité
a lieu **en arrière-plan** (sans bloquer).
**EF-27.19** — L'état est affiché : `● Connecté` / `● Hors ligne` / `● Vérification…`
**EF-27.20** — Hors ligne, les entrées du catalogue **déjà vues** restent affichées depuis
le cache, avec un bandeau `TXT: Liste en cache — téléchargement indisponible.`
**EF-27.21** — Le cache du catalogue vit dans `project/cache/catalog.json` (supprimable).

---

## 17.7 Ce que le catalogue ne fait jamais

| Interdiction | Motif |
|---|---|
| Envoyer un identifiant, un historique ou une télémétrie | P9, ENF-34 |
| Interroger un serveur si le catalogue est désactivé | EF-27.4 |
| Bloquer le démarrage en attendant une réponse | P1 |
| Installer un contenu sans confirmation | EF-03.8 |
| Écraser une version existante sans demander | — |
| Télécharger un contenu dont la licence est inconnue sans confirmation explicite | EF-27.11 |

---

## 17.8 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-01** | Réseau coupé, catalogue activé | message clair, application pleinement fonctionnelle |
| **A-16** | Catalogue désactivé | **aucune** requête sortante (vérifié par capture réseau) |
| **A-16b** | Télécharger une Bible | importée comme un fichier local, dédupliquée |
| **A-16c** | Empreinte invalide simulée | téléchargement annulé, rien écrit |
| **A-16d** | Timeout simulé | message après 8 s, aucun blocage |
