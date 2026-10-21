# OpenPresenter — Cahier des charges fonctionnel et technique

**Version :** 1.0 — spécification complète
**Date :** 21 octobre 2026
**Auteur du besoin :** Renaud Christin FONTON
**Rédaction :** agent Arena.ai, à partir de l'audit vérifié du dépôt (`docs/ETAT-DES-LIEUX-2026-10.md`)
**Statut :** **spécification opposable**. Ce document est l'index et la synthèse ; le détail
contractuel est dans `docs/spec/` (27 chapitres), les captures de référence dans
`docs/maquettes/` (14 maquettes). Les décisions résiduelles (§ 14.2) ne bloquent aucune phase.
**Volume :** 30 exigences fonctionnelles, 21 exigences non fonctionnelles, 613 identifiants
`EF-nn.m` (+ 33 identifiants d'annexe `AN-nn.m`), 115 tests, 18 cas d'utilisation, 99 chaînes d'interface cataloguées, 16 schémas JSON.

---

## Sommaire

- [0. Objet, périmètre, principes](#0-objet-périmètre-principes)
- [1. Personas et contexte d'usage](#1-personas-et-contexte-dusage)
- [2. Exigences fonctionnelles — vue d'ensemble](#2-exigences-fonctionnelles--vue-densemble)
- [3. Exigences non fonctionnelles](#3-exigences-non-fonctionnelles)
- [4. Architecture technique cible](#4-architecture-technique-cible)
- [5. Spécifications détaillées par module](#5-spécifications-détaillées-par-module)
- [6. Cas d'utilisation bout-en-bout](#6-cas-dutilisation-bout-en-bout)
- [7. Modèle de données](#7-modèle-de-données)
- [8. Raccourcis clavier](#8-raccourcis-clavier)
- [9. Compatibilité](#9-compatibilité)
- [10. Plan de livraison](#10-plan-de-livraison)
- [11. Critères d'acceptation](#11-critères-dacceptation)
- [12. Risques](#12-risques)
- [13. Hors périmètre](#13-hors-périmètre)
- [14. Décisions](#14-décisions)
- [15. Glossaire](#15-glossaire)
- [16. Où lire quoi — carte documentaire](#16-où-lire-quoi--carte-documentaire)
- [Annexe A — Comment lire ce document](#annexe-a--comment-lire-ce-document)
- [Annexe B — Ce qui existe déjà et sera réutilisé](#annexe-b--ce-qui-existe-déjà-et-sera-réutilisé)
- [Annexe C — Traçabilité et vérifications](#annexe-c--traçabilité-et-vérifications)

---

## 0. Objet, périmètre, principes

### 0.1 Objet

OpenPresenter est une **suite de régie live** gratuite et open source pour cultes,
conférences et évènements : Bible, chants, médias, annonces, minuteurs et habillages,
diffusés vers OBS Studio, vMix ou un écran de salle.

Le présent cahier des charges décrit la **version cible** — celle qui répond au besoin
exprimé le 21/10/2026 — et non l'état actuel du dépôt (documenté séparément dans
`docs/ETAT-DES-LIEUX-2026-10.md`).

### 0.2 Les 10 principes directeurs

Tout ce qui suit en découle. En cas de conflit entre deux exigences, **le principe de
rang inférieur gagne**.

| # | Principe | Formulation opérationnelle |
|---|---|---|
| **P1** | **Le logiciel fonctionne sans Internet** | Aucune fonction de diffusion, de recherche, d'édition ou de sauvegarde ne peut émettre une requête réseau sortante. Internet n'est utilisé **que** par le catalogue de téléchargement (§ 5.13), explicitement déclenché par l'utilisateur, et son indisponibilité ne doit jamais provoquer d'erreur bloquante. |
| **P2** | **Le dossier du projet EST le projet** | Copier le dossier sur une clé USB et le rouvrir ailleurs redonne **exactement** le même logiciel : bibles, chants, médias, looks, sorties, profils, événements, historique. Rien d'essentiel ne vit dans le navigateur. |
| **P3** | **Un fichier, un double-clic** | `OpenPresenter.bat` / `OpenPresenter.command` / `OpenPresenter.sh` : détection des prérequis → installation silencieuse si possible → instructions explicites sinon → démarrage → ouverture du navigateur par défaut. |
| **P4** | **Ce qui est importé est copié** | Toute ressource extérieure (bible, chant, image, vidéo, PDF, PPTX, logo, fond) est dupliquée dans `assets/` du projet au moment de l'import. Le chemin d'origine n'est plus référencé. |
| **P5** | **Tout est éditable** | Aucun habillage, aucune disposition, aucun texte, aucune couleur n'est figé dans le code. Chaque visuel est un objet modifiable, nommable, duplicable, exportable. |
| **P6** | **Une sortie = un lien = une scène** | Chaque sortie a sa propre URL et sa propre composition par type de contenu. Une scène OBS peut ne recevoir *que* la Bible, *que* les médias, *que* les habillages. |
| **P7** | **La lisibilité prime sur l'exhaustivité** | À l'écran, on affiche peu de mots. Un verset long est découpé et navigable, jamais compressé. |
| **P8** | **Le clavier suffit** | Un opérateur doit pouvoir conduire un culte entier sans souris : recherche Bible, navigation, diffusion, coupure. |
| **P9** | **Zéro compte, zéro cloud obligatoire** | Aucune inscription, aucune télémétrie, aucune synchronisation imposée. |
| **P10** | **Rien ne casse en direct** | Toute défaillance (fichier absent, réseau coupé, sortie déconnectée) dégrade proprement l'affichage et informe l'opérateur sans jamais figer la régie. |

### 0.3 Périmètre

**Inclus** : application locale, serveur embarqué, navigateur comme interface de régie,
sorties vers OBS/vMix/écran, gestion de contenu, gestion d'événements et d'organisations,
profils, catalogue de contenus libres en ligne, export de projet.

**Exclus** (voir § 13) : encodage/streaming RTMP natif, NDI, pilotage matériel
(lumières, MIDI), application mobile native, multi-utilisateurs avec comptes.

---

## 1. Personas et contexte d'usage

### 1.1 Personas

| ID | Persona | Description | Exigence dominante |
|---|---|---|---|
| **PE-1** | **Bénévole régie** | Arrive 10 min avant le culte, n'a jamais ouvert un terminal. Peut changer chaque semaine. | Installation et démarrage sans friction (P3) |
| **PE-2** | **Opérateur confirmé** | Prépare le culte la veille, crée les habillages, gère 3 écrans et un stream. | Puissance d'édition (P5), clavier (P8) |
| **PE-3** | **Pasteur / intervenant** | Regarde un écran de confiance sur scène. Ne touche jamais à la régie. | Lisibilité, lisibilité du « suivant », minuteur |
| **PE-4** | **Responsable de profil** | Configure une fois un gabarit (église, conférence, stream) réutilisé par tous. | Profils, gabarits (P5) |
| **PE-5** | **Responsable stream** |Compose ses scènes OBS/vMix, veut des overlays qui ne prennent que ce qu'il faut. | Matrice de liens (P6) |
| **PE-6** | **Site sans Internet** | Salle sans connexion, ou connexion coupée en plein évènement. | P1 absolu |

### 1.2 Contextes matériels typiques

| Contexte | Matériel | Contrainte |
|---|---|---|
| Petite église | 1 PC Windows + 1 vidéoprojecteur | Simplicité maximale |
| Église équipée | PC régie Windows + OBS + 2 écrans + stream | Multi-sorties, overlays |
| Conférence | PC régie + vMix + écran géant + retours scène | 3 à 6 sorties simultanées |
| Itinérant | PC portable, contenu sur clé USB | P2, démarrage rapide |
| Sans connexion | aucune | P1 |

---

## 2. Exigences fonctionnelles — vue d'ensemble

Chaque exigence porte un identifiant unique (`EF-nn`) qui sera réutilisé dans les tests
(§ 11) et dans les tickets d'implémentation.

| ID | Intitulé | Module | Priorité |
|---|---|---|---|
| EF-01 | Dossier de projet auto-porteur | Système | **P0** |
| EF-02 | Copie automatique des ressources importées | Système | **P0** |
| EF-03 | Lanceur universel avec auto-diagnostic | Système | **P0** |
| EF-04 | Serveur local embarqué et navigateur par défaut | Système | **P0** |
| EF-05 | Page d'accueil : sorties, studio, profils | Accueil | **P0** |
| EF-06 | Studio unifié | Studio | **P0** |
| EF-07 | Sorties multiples personnalisables | Sorties | **P0** |
| EF-08 | Matrice de liens « sortie × type de contenu » | Sorties | **P0** |
| EF-09 | Éditeur de scène WYSIWYG à calques | Scènes | **P0** |
| EF-10 | Looks / thèmes réutilisables | Scènes | P1 |
| EF-11 | Bible : import, recherche, navigation | Bible | **P0** |
| EF-12 | Bible : saisie clavier unifiée | Bible | **P0** |
| EF-13 | Bible : découpage lisible des versets longs | Bible | **P0** |
| EF-14 | Bible : multi-versions et annotations | Bible | P1 |
| EF-15 | Chants : import, sections, arrangements | Chants | **P0** |
| EF-16 | Médias : images, vidéos, PDF, présentations | Médias | **P0** |
| EF-17 | Annonces et textes libres | Annonces | P1 |
| EF-18 | Minuteurs et comptes à rebours | Minuteurs | P1 |
| EF-19 | Habillages / lower thirds | Habillages | P1 |
| EF-20 | Profils (église, conférence, stream…) | Profils | **P0** |
| EF-21 | Organisations et lieux | Gestion | P1 |
| EF-22 | Événements et services | Gestion | **P0** |
| EF-23 | Plan de déroulement (cue list) | Plan | **P0** |
| EF-24 | Vue scène / pasteur | Scène | P1 |
| EF-25 | Télécommande (mobile / second PC) | Remote | P1 |
| EF-26 | Sauvegarde, restauration, export de projet | Système | **P0** |
| EF-27 | Catalogue en ligne (Bibles, chants libres) | Catalogue | P2 |
| EF-28 | Historique et journal d'activité | Système | P2 |
| EF-29 | Accessibilité et internationalisation | Transverse | P2 |
| EF-30 | Diagnostic et dépannage guidé | Système | P1 |

---

## 3. Exigences non fonctionnelles

### 3.1 Hors-ligne (ENF-01 → ENF-04)

| ID | Exigence | Critère mesurable |
|---|---|---|
| ENF-01 | Aucune ressource tierce au runtime | `grep` sur les sources : 0 URL absolue vers un hôte externe, hors catalogue |
| ENF-02 | Polices, CSS, bibliothèques JS vendus dans le dépôt | `vendor/` complet ; aucune `@import` distante |
| ENF-03 | Fonctionnement vérifié câble débranché | Test d'acceptation A-01 (§ 11) |
| ENF-04 | Le catalogue en ligne est optionnel et non bloquant | Mode « hors-ligne » désactivable ; timeout 8 s ; message explicite |

### 3.2 Performance (ENF-10 → ENF-15)

| ID | Exigence | Cible |
|---|---|---|
| ENF-10 | Lancement (double-clic → page d'accueil) | < 5 s sur un PC de 2018, < 10 s si le runtime doit être extrait |
| ENF-11 | Chargement d'une Bible de 40 000 versets | indexation < 3 s, recherche < 50 ms |
| ENF-12 | Passage d'un verset à l'autre en direct | < 80 ms du clic à l'image |
| ENF-13 | Latence contrôleur → sortie OBS | < 120 ms sur réseau local |
| ENF-14 | Poids servi par page | < 300 Ko (gzip), modules lourds chargés à la demande |
| ENF-15 | Mémoire après 2 h de diffusion avec vidéos | pas de fuite : les URLs d'objets sont révoquées |

### 3.3 Fiabilité (ENF-20 → ENF-25)

| ID | Exigence |
|---|---|
| ENF-20 | Une sortie OBS déconnectée n'affecte pas les autres sorties |
| ENF-21 | Un fichier média absent → placeholder explicite, jamais un écran figé |
| ENF-22 | Écriture atomique des fichiers de données (écrire dans un temporaire puis renommer) |
| ENF-23 | Reprise après coupure de courant : au relancement, l'état de la dernière session est restauré |
| ENF-24 | Aucune donnée utilisateur n'est écrite hors du dossier du projet |
| ENF-25 | Le serveur refuse toute requête hors du dossier racine (protection chemin relatif) |

### 3.4 Sécurité réseau (ENF-30 → ENF-34)

| ID | Exigence |
|---|---|
| ENF-30 | Écoute sur `0.0.0.0` uniquement sur le port choisi ; aucune exposition par défaut au-delà du LAN |
| ENF-31 | Le relais WebSocket vérifie l'`Origin` contre l'`Host` |
| ENF-32 | **Jeton d'accès LAN** : un code court affiché au lancement, requis par les pages ouvertes depuis un autre appareil **[D-05]** |
| ENF-33 | Avertissement explicite : « ne pas exposer ce port sur Internet » |
| ENF-34 | Aucune télémétrie, aucun identifiant unique envoyé à l'extérieur |

### 3.5 Qualité (ENF-40 → ENF-44)

| ID | Exigence |
|---|---|
| ENF-40 | Chaque module `src/` couvert par des tests unitaires `node --test` sans navigateur |
| ENF-41 | Tests d'intégration navigateur pour les parcours P0 |
| ENF-42 | Le rendu d'une scène doit être **identique** dans le contrôleur, l'éditeur et la sortie OBS (même fonction `render`) |
| ENF-43 | Documentation utilisateur en français, intégrée à l'application |
| ENF-44 | Toute chaîne visible par l'utilisateur est externalisable (préparation i18n) |

---

## 4. Architecture technique cible

### 4.1 Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│  DOSSIER DU PROJET  (copiable sur clé USB — P2)                  │
│                                                                  │
│  OpenPresenter.bat / .command / .sh        ← un double-clic (P3) │
│  runtime/                                  ← Node embarqué       │
│  app/                                      ← le logiciel         │
│  │   ├── server.mjs        serveur HTTP + relais WS              │
│  │   ├── web/              interface (Studio, sorties, scène)    │
│  │   ├── src/core/         moteur de scène, stockage, sorties    │
│  │   ├── src/modules/      bible, chants, médias, annonces       │
│  │   └── vendor/           polices + JS vendus (aucun CDN)       │
│  │                                                               │
│  project/                        ← LES DONNÉES DE L'UTILISATEUR  │
│      ├── project.json            identité, réglages, version     │
│      ├── library/                                                │
│      │   ├── bibles/*.json       bibles indexées                 │
│      │   ├── songs/*.json        chants                          │
│      │   └── looks/*.json        looks et thèmes                 │
│      ├── assets/                 TOUTES les ressources binaires  │
│      │   ├── bibles/ chants/ media/ backgrounds/ logos/          │
│      ├── outputs/outputs.json    sorties + scènes par sortie     │
│      ├── profiles/               profils réutilisables           │
│      ├── orgs/                   organisations, lieux            │
│      ├── events/                 événements, services, plans     │
│      ├── cache/                  miniature, index de recherche   │
│      └── logs/                   journal de session              │
└──────────────────────────────────────────────────────────────────┘
                    │ HTTP + WebSocket (LAN)
   ┌────────────────┼─────────────────┬──────────────────┐
   ▼                ▼                 ▼                  ▼
Studio          Sortie OBS 1     Sortie OBS 2        Vue scène
(régie)         bas centré       plein écran         (pasteur)
                                                      Remote (tel)
```

### 4.2 Choix du runtime — **décision D-01 tranchée : runtime détecté + auto-installation**

Trois options ont été évaluées :

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A. Runtime détecté** ⭐ **RETENUE** | Le lanceur cherche un runtime, propose de l'installer si possible, sinon donne les instructions | Dépôt léger (< 10 Mo), aucune chaîne de publication de binaires, P3 respecté *via* l'assistant | Premier lancement dépend d'une installation (réseau ou manuelle) |
| **B. Runtime embarqué portable** | Un binaire Node officiel dans `runtime/` par plateforme | Double-clic garanti hors-ligne | 3 binaires à publier (~40 Mo chacun), poids du ZIP de distribution |
| **C. Application native** (Electron/Tauri) | Installateur `.exe`/`.dmg`/`.AppImage` | Fenêtre dédiée, intégration OS | **Viole P2** (installation ≠ dossier), 150-300 Mo, chaîne de build lourde |

**Décision :** option **A**, avec les exigences suivantes.

1. Le lanceur est un **assistant d'installation**, pas un simple vérificateur (§ 5.1).
2. Il détecte, dans l'ordre : `runtime/node` (s'il a déjà été installé par le lanceur) →
   runtime système → gestionnaire de paquets → repli manuel.
3. **L'installation automatique est proposée, jamais imposée** : question explicite,
   commande affichée en clair, empreinte vérifiée quand c'est un téléchargement.
4. Une fois installé par le lanceur, le runtime est placé dans `runtime/` **du dossier du
   projet** → les lancements suivants sont instantanés et hors-ligne.
5. **Variante de distribution** : une archive `OpenPresenter-complet.zip` contenant déjà
   `runtime/` peut être publiée pour les sites sans connexion. C'est la même application,
   seule la présence du dossier `runtime/` change.
6. **Règle de conception** : l'application ne doit **jamais** supposer qu'elle tourne sous
   un runtime embarqué. Toute la logique est « runtime Node ≥ 20 trouvé quelque part ».

> **Pourquoi cette option** : elle garde le dépôt léger et vérifiable, elle rend le
> lanceur utile même pour un utilisateur avancé, et elle laisse ouverte la porte du
> hors-ligne total via l'archive complète. Elle reporte la complexité sur le lanceur —
> d'où la spécification détaillée du § 5.1 et du chapitre `docs/spec/03-lanceur.md`.


### 4.3 Persistance : disque plutôt qu'IndexedDB **[D-02]**

L'état des lieux montre que V1 **et** V2 stockent les bibliothèques dans IndexedDB.
C'est **l'écart majeur avec P2** : vider le cache du navigateur efface la bibliothèque.

**Cible :**

- **Source de vérité = les fichiers de `project/`**, lus et écrits par le serveur
  (`GET/PUT /api/<ressource>`), en JSON pour les structures et en fichiers bruts pour les
  binaires.
- **IndexedDB = cache de lecture uniquement** (accélère l'ouverture, permet de rouvrir la
  page si le serveur a été arrêté), jamais source de vérité.
- Écriture atomique : `write tmp → fsync → rename` (ENF-22).
- Index de recherche reconstruit au lancement et mis en cache dans `project/cache/`.

### 4.4 Gestion des assets (EF-02, P4)

À l'import d'un fichier :

1. Calcul d'une empreinte SHA-256 du contenu.
2. Si l'empreinte existe déjà dans `assets/`, **réutilisation** (pas de doublon).
3. Sinon, écriture dans `assets/<catégorie>/<empreinte-8>.<ext>` en conservant
   l'extension d'origine et le nom lisible dans les métadonnées.
4. Création de l'enregistrement dans `library/` avec `assetId`, `originalName`,
   `mime`, `bytes`, `importedAt`.
5. Génération d'une miniature (`cache/thumb/<empreinte>.webp`) pour les images/vidéos/PDF.
6. Le chemin d'origine **n'est jamais stocké**.

Corollaire : l'export du projet (§ 5.26) est un simple `zip` du dossier, et la
« restauration » est une décompression.

### 4.5 Le moteur de scène (EF-09)

**Reprendre le moteur de la V2** (`openpresenter2/src/core/engine.mjs`) : c'est le seul
composant du dépôt qui réponde déjà à P5 et à la demande « créer mes visuels de fond et
mettre mon texte dessus ».

Modèle retenu :

```jsonc
{
  "id": "scene_...",
  "kind": "bible",            // bible | songs | announcements | lowerthird | timer | media
  "preset": "bottom",         // full | screen80 | bottom | bottom-right | lowerthird | custom
  "name": "Bas centré — Saint-Valentin",
  "transparent": true,
  "splitMode": "auto",        // none | auto
  "splitChars": 120,
  "transitionIn": "fade", "transitionOut": "fade", "transitionDurationMs": 250,
  "layers": [
    { "type": "background", "x":50,"y":50,"w":100,"h":100,
      "source": { "kind": "image", "assetId": "as_...", "fit": "cover", "blur": 0, "tint": "#000", "tintOpacity": .35 } },
    { "type": "overlay", "x":50,"y":85,"w":82,"h":25, "bg":"rgba(8,10,16,.92)", "radius":14,
      "border": { "width":7, "color":"#f5b942", "sides":["left"] } },
    { "type": "text", "bind": "ref",   "x":51,"y":72,"w":68,"h":5,  "style": { … } },
    { "type": "text", "bind": "verse", "x":53,"y":88,"w":69,"h":15, "style": { … } }
  ]
}
```

**Extensions demandées par le besoin** (absentes de la V2 actuelle) :

| Ajout | Détail |
|---|---|
| `verticalAlign` | `top / center / bottom` par calque texte (demande explicite : « en haut, en bas ») |
| `justify` | alignement `justify` en plus de `left / center / right` |
| `lineSpacing`, `paragraphSpacing` | contrôle typographique fin |
| `textCase`, `letterSpacing` avancé | capitales, petites capitales |
| `stroke` (contour de texte) | lisibilité sur fond clair |
| `shadow` paramétrable | couleur, décalage x/y, flou — pas seulement une intensité |
| calque `video` explicite | boucle, point d'entrée, volume, muet |
| calque `clock` / `timer` | horloge, compte à rebours lié |
| calque `group` | grouper/dégrouper, déplacer ensemble |
| `safeArea` | repères 5 % / 10 % affichables pour cadrer un stream |
| alignement / distribution | aimants, guides, aligner sur le canevas |
| copier/coller de calque, verrouillage, masquage, réordonnancement | déjà partiellement présent |

### 4.6 Serveur local

Reprendre `server.mjs` de la V2 (HTTP + relais WebSocket écrits à la main, zéro
dépendance) et ajouter :

| Route | Rôle |
|---|---|
| `GET /api/health` | état, version, port, adresses LAN |
| `GET/PUT /api/project` | identité et réglages du projet |
| `GET /api/library/:type` · `GET/PUT/DELETE /api/library/:type/:id` | bibles, chants, looks |
| `POST /api/assets` | téléversement d'un fichier → déduplication + miniature |
| `GET /api/assets/:id` · `/thumb/:id` | lecture des binaires et miniatures |
| `GET/PUT /api/outputs` | sorties et scènes associées |
| `GET/PUT /api/profiles` · `/orgs` · `/events` | profils, organisations, événements |
| `GET /api/search?q=` | recherche unifiée (bibles, chants, médias) |
| `GET /api/export` · `POST /api/import` | archive du projet |
| `GET /api/catalog` · `POST /api/catalog/fetch` | **seules** routes sortantes (§ 5.13) |
| `/ws?channel=` | relais temps réel (état de diffusion, messages scène, minuteurs) |

### 4.7 Provenance des composants (décision D-03 : consolidation « best of both »)

Chaque composant cible est rattaché à la base dont il provient. Rien n'est conservé par
habitude : ce qui n'apparaît pas ici est **supprimé**.

| Composant cible | Provenance | Traitement |
|---|---|---|
| Moteur de scène à calques | **V2** `src/core/engine.mjs` | conservé, étendu (§ 4.5) |
| Éditeur WYSIWYG | **V2** `src/components/SceneEditor.mjs` | conservé, refondu pour l'inspecteur du Studio |
| Registre de sorties | **V2** `src/core/output-registry.mjs` | conservé, étendu avec `receives` (EF-08) |
| Viewport / cadrage CEF | **V2** `src/core/viewport.mjs` | conservé tel quel |
| Thèmes | **V2** `src/core/themes.mjs` | conservé, fusionné avec les palettes V1 |
| Parseur Bible XML | **V2** `src/modules/bible/xml.mjs` | conservé, étendu OSIS / USFX |
| Annotations de versets | **V2** `src/modules/bible/annotations.mjs` | conservé tel quel |
| Parseur de chants (ChordPro, OpenSong) | **V2** `src/modules/songs/parser.mjs` | conservé |
| Parseur PPTX | **V2** `src/modules/media/pptx.mjs` | conservé |
| Serveur HTTP + relais WS (0 dépendance) | **V2** `server.mjs` | conservé, étendu avec l'API disque |
| Sortie OBS / vue scène / télécommande | **V2** `obs/output.html`, `app/stage.html`, `app/remote.html` | conservés comme base |
| Concepts de **Looks** (6 palettes, géométrie par mode, photo dans le look, onglets Bible/Chants, case « Lié ») | **V1** `looks_editor.html`, `js/looks.js` | **repris** dans le modèle de look (§ 5.7) |
| **Plan de déroulement** (types de cues, bouton Avancer, panneau En cours / Suivant, persistance) | **V1** `cue_list.html` | **logique reprise** dans le module Plan |
| **Import CSV / Planning Center** | **V1** `cue_list.html` | **repris** tel quel (EF-23.7, EF-23.8) |
| **Installation OBS 1 clic** (obs-websocket v5, SHA-256, création des scènes/sources) | **V1** `sync-relay-server.js` | **porté** en V2 (EF-08.5) |
| **Recherche unifiée** (champ unique, ↑↓, Entrée diffuse) | **V1** `studio_unifie.html` + **V2** `index.html` | fusion des deux implémentations |
| **Vue pasteur** (messages en très grand, ajustement auto, ton info/important/urgent) | **V1** `vue_pasteur.html` | **repris** dans `app/stage.html` |
| **Minuteur** (file de décomptes, ±1 min, page intégrable) | **V1** `timer-*.html` | **repris** |
| **Exclusion mutuelle** des outils à l'antenne | **V1** `js/live-mutex.js` (14 tests) | **repris** comme règle du moteur de diffusion |
| **Hors-ligne** : polices vendues, Tailwind compilé, jszip/pdf.js vendus | **V1** `vendor/`, `css/tw-*.css` | **fusionné** avec `vendor/` V2 ; plus aucune duplication |
| **PWA** (manifest + service worker) | **V1** `js/pwa.js`, `sw.js` | **repris** |
| Générateur de **QR code** local | **V1** `js/qrcode.js` | **repris** |
| Persistance `data/` par namespace | **V1** `store.js` + `sync-relay-server.js` | **remplacée** par l'API disque (§ 4.3) ; le concept de filet de secours local est conservé en cache |
| Sauvegarde `.openpresenter.zip` | **V2** `src/core/backup.mjs` | conservé, alimenté par `project/` |
| Suite de tests | **V2** `tests/` (17 fichiers) + **V1** `tests/` (syntaxe, mutex, intégration Playwright) | **fusionnée** en une seule commande `npm test` |

**Supprimés** (doublons ou obsolètes) : les 4 pages HTML monolithiques de V1
(`bible_…`, `lyrics_…`, `media_…`, `obs_lower_third_…`) dont la logique est reprise dans
les modules V2 ; `mur_previews.html` (remplacé par la page d'accueil) ;
`studio_unifie.html` V1 (remplacé par le Studio cible) ; `guide.html`,
`build-exe-*`, `sea-config.json`, `js/demo-content.js`.

---

## 5. Spécifications détaillées par module

### 5.1 EF-03 — Lanceur universel

**Fichiers** : `OpenPresenter.bat` (Windows), `OpenPresenter.command` (macOS),
`OpenPresenter.sh` (Linux). Un **seul** fichier de lancement par plateforme, à la racine
du dossier du projet.

#### 5.1.1 Séquence de démarrage

```
1. Résoudre le dossier du script (indépendamment du répertoire courant)
2. Lire project/project.json → port, langue, profil par défaut
3. DIAGNOSTIC des prérequis :
   a. runtime/node  présent ?          → sinon chercher node système (≥ 20)
   b. aucun ?                          → voir 5.1.2
   c. port libre ?                     → sinon proposer 8789, 8790… (jusqu'à +20)
   d. dossier project/ existe ?        → sinon créer l'arborescence (§ 5.1.4)
   e. droits d'écriture ?              → sinon message explicite
   f. navigateur par défaut trouvable ?→ sinon afficher l'URL à copier
4. Démarrer app/server.mjs en processus fils
5. Attendre GET /api/health (timeout 20 s, avec barre de progression)
6. Ouvrir http://localhost:<port>/ dans le navigateur par défaut
7. Afficher dans le terminal :
      Sur ce PC        : http://localhost:8788/
      Depuis le réseau : http://192.168.1.42:8788/   [code d'accès : 4F2K]
      QR code          : (dans la page d'accueil)
   Arrêter : fermer cette fenêtre ou Ctrl+C
```

#### 5.1.2 Si le runtime manque

| Plateforme | Comportement |
|---|---|
| **Windows** | 1) chercher `runtime\node.exe` ; 2) chercher `node` dans le `PATH` ; 3) si Internet, **proposer le téléchargement** du binaire portable officiel Node (avec URL, taille, empreinte SHA-256 affichées) dans `runtime\` ; 4) sinon afficher les instructions exactes : « Téléchargez Node.js LTS sur https://nodejs.org → installez → relancez ce fichier », et ouvrir la page dans le navigateur par défaut |
| **macOS** | 1) `runtime/node` ; 2) `command -v node` ; 3) `brew install node` si Homebrew détecté **et** accord explicite ; 4) sinon instructions + `open https://nodejs.org` |
| **Linux** | 1) `runtime/node` ; 2) `command -v node` ; 3) détecter le gestionnaire (`apt`, `dnf`, `pacman`, `zypper`, `apk`) et **afficher la commande exacte** sans l'exécuter sans accord ; 4) instructions claires |

**Règle absolue** : le lanceur **n'installe jamais rien à l'insu de l'utilisateur**.
Toute installation automatique est précédée d'une question explicite `[o/N]`,
et la commande exécutée est affichée en clair.

#### 5.1.3 Sortie console

Le lanceur écrit un journal lisible (pas de stack trace brute) **et** un fichier
`project/logs/launch-<date>.log`. En cas d'échec, il affiche :
ce qui a été vérifié, ce qui manque, la commande exacte à taper, et où trouver de l'aide.

#### 5.1.4 Arborescence créée au premier lancement

Voir § 4.1. Création idempotente, avec un `project/README.txt` expliquant à l'utilisateur
que **ce dossier contient tout** et qu'il peut le copier.

#### 5.1.5 Cas limites

| Cas | Comportement attendu |
|---|---|
| Double lancement du même dossier | Le second détecte le port occupé par **notre** serveur (`/api/health` répond avec le même `projectId`) → ouvre simplement le navigateur, ne relance rien |
| Dossier sur une clé USB en lecture seule | Mode lecture seule assumé : diffusion possible, sauvegarde impossible, bandeau d'avertissement permanent |
| Dossier déplacé pendant l'exécution | Le serveur détecte la perte de `project.json` → arrête proprement avec message |
| Port occupé par un autre logiciel | Propose le port suivant libre, mémorise le choix |
| Nom du dossier avec accents / espaces | Doit fonctionner (cas réel : « ICC PAHOU ») |
| macOS bloque le `.command` | Le lanceur affiche la marche à suivre (clic droit → Ouvrir) ; documentée dans un `LISEZ-MOI.txt` |

---

### 5.2 EF-05 — Page d'accueil

C'est la page ouverte par le lanceur. Elle doit répondre en **un coup d'œil** à :
« qu'est-ce qui est en train de passer, et où ? »

#### 5.2.1 Composition

```
┌───────────────────────────────────────────────────────────────┐
│  ● EN DIRECT : Jean 3:16 → [Bas centré] [Plein écran]   ⏹ Tout couper │
├───────────────────────────────────────────────────────────────┤
│  PROFIL ACTIF : [ICC Pahou — Culte du dimanche ▾]             │
│  Événement    : [Culte du 26/10/2026 ▾]   ⏱ 00:42:18         │
├───────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ BAS CENTRÉ  │  │ PLEIN ÉCRAN │  │  + AJOUTER  │            │
│  │ aperçu live │  │ aperçu live │  │   UNE SORTIE│            │
│  │ 🔗 Bible    │  │ 🔗 Bible    │  └─────────────┘            │
│  │ 🔗 Chants   │  │ 🔗 Chants   │                             │
│  │ 🔗 Médias   │  │ 🔗 Médias   │                             │
│  │ 🔗 Habillage│  │ 🔗 Habillage│                             │
│  │ ⚙ Modifier  │  │ ⚙ Modifier  │                             │
│  └─────────────┘  └─────────────┘                             │
├───────────────────────────────────────────────────────────────┤
│  [ 🎬 OUVRIR LE STUDIO UNIFIÉ ]   ← bouton principal, très visible │
├───────────────────────────────────────────────────────────────┤
│  Vues secondaires :  Vue scène · Télécommande · Mur des sorties │
│  Outils : Bible · Chants · Médias · Annonces · Minuteur         │
├───────────────────────────────────────────────────────────────┤
│  Profils disponibles : Église ICC Pahou · Conférence · Stream   │
│  Derniers événements : …            [ 📦 Exporter le projet ]   │
└───────────────────────────────────────────────────────────────┘
```

#### 5.2.2 Exigences

| ID | Exigence |
|---|---|
| EF-05.1 | Le bouton **« Ouvrir le Studio Unifié »** est le plus gros élément cliquable de la page |
| EF-05.2 | Chaque sortie affiche un **aperçu en direct** de ce qu'elle diffuse |
| EF-05.3 | Chaque sortie expose ses **liens par type de contenu** (§ 5.8) avec bouton « Copier » et QR code |
| EF-05.4 | Un bouton global **« Tout couper »** stoppe instantanément toutes les sorties |
| EF-05.5 | Le sélecteur de **profil** est en haut de page ; changer de profil propose de recharger |
| EF-05.6 | Le sélecteur d'**événement** charge le plan de déroulement associé |
| EF-05.7 | L'état de connexion (serveur, sorties connectées) est visible en permanence |
| EF-05.8 | L'adresse LAN et le code d'accès sont affichés avec un QR code scannable |
| EF-05.9 | Aucun élément ne nécessite de défilement pour les actions essentielles |

---

### 5.3 EF-06 — Studio unifié

Une seule fenêtre qui réunit tous les outils, sans iframe si possible.

| Zone | Contenu |
|---|---|
| **Gauche** | Navigation : Plan · Bible · Chants · Médias · Annonces · Minuteur · Habillages · Sorties · Profils · Événements · Réglages |
| **Centre** | Contenu de l'outil actif : bibliothèque à gauche, aperçu au centre, inspecteur à droite |
| **Droite** | **Inspecteur de scène** (le WYSIWYG, § 5.9) ou inspecteur de l'élément sélectionné |
| **Bas** | Barre de diffusion : cible(s) de sortie, « Diffuser », « Couper », transitions, aperçu de la prochaine étape du plan |
| **Haut** | Recherche unifiée, horloge, minuteur, état live, bouton « Vue scène », bouton « Télécommande » |

**Recherche unifiée (EF-06.1)** : un champ, quelques lettres, résultats groupés
(versets / chants / médias / annonces), `↑↓` pour naviguer, `Entrée` pour diffuser le
premier résultat, `Échap` pour fermer. *(Déjà présent en V1 et V2 — à conserver.)*

---

### 5.4 EF-07 — Sorties multiples personnalisables

#### 5.4.1 Modèle

Reprendre `output-registry.mjs` de la V2 et l'étendre :

```jsonc
{
  "id": "out_bottom",
  "name": "Bas centré — Stream",
  "preset": "bottom",              // disposition par défaut des scènes
  "width": 1920, "height": 1080,
  "fit": "contain",                // contain | cover | stretch
  "transparent": true,             // fond transparent pour keying OBS/vMix
  "enabled": true,
  "targetByDefault": true,         // cochée par défaut lors d'une diffusion
  "receives": {                    // ⭐ filtre de contenu (EF-08)
    "bible": true, "songs": true, "media": true,
    "announcements": false, "lowerthird": true, "timer": false
  },
  "scenesByKind": { "bible": "scene_…", "songs": "scene_…", … },
  "notes": "Source navigateur OBS « BIBLE BAS CENTRE »"
}
```

#### 5.4.2 Exigences

| ID | Exigence |
|---|---|
| EF-07.1 | **Deux sorties créées par défaut** : « Plein écran » (`full`, opaque) et « Bas centré » (`bottom`, transparente) |
| EF-07.2 | Jusqu'à 32 sorties ; créer, renommer, dupliquer, supprimer, désactiver |
| EF-07.3 | Résolution libre (320 → 8192 px), cadrage `contain`/`cover`/`stretch` |
| EF-07.4 | Chaque sortie a **sa propre scène par type de contenu** |
| EF-07.5 | L'aperçu du Studio montre la sortie sélectionnée à l'échelle réelle |
| EF-07.6 | Le canevas de conception reste **normalisé en 1920×1080** quelle que soit la résolution de sortie |
| EF-07.7 | Mode `&debug=1` sur l'URL : affiche le viewport réel, la résolution configurée et l'échelle appliquée |
| EF-07.8 | Une sortie peut être « muette » (désactivée) sans perdre sa configuration |

---

### 5.5 EF-08 — Matrice de liens « sortie × type de contenu »

> C'est la demande : *« pour chaque type de sortie, je veux un lien d'affichage aussi,
> comme pour la bible, si j'ai des scènes avec des overlays qui doivent prendre juste la
> bible, ou juste les médias. »*

#### 5.5.1 Principe

Pour une sortie `S` et un type de contenu `K`, l'URL est :

```
http://<hote>:<port>/o/<S.id>?kind=<K>[&fit=contain][&res=1920x1080][&debug=1]
```

`kind` ∈ `bible | songs | media | announcements | lowerthird | timer | plan`.
Une URL **sans** `kind` affiche le programme complet de la sortie (comportement V2 actuel).

#### 5.5.2 Ce que cela permet concrètement

| Scène OBS/vMix | URL à coller |
|---|---|
| Caméra + bandeau de versets en bas | `/o/out_bottom?kind=bible` |
| Plein écran versets (projecteur salle) | `/o/out_full?kind=bible` |
| Overlay « seulement les chants » sur le stream | `/o/out_bottom?kind=songs` |
| Overlay « seulement les médias » (logo, visuel) | `/o/out_full?kind=media` |
| Habillage bas tiers (noms des intervenants) | `/o/out_lt?kind=lowerthird` |
| Compte à rebours avant le direct | `/o/out_full?kind=timer` |

#### 5.5.3 Exigences

| ID | Exigence |
|---|---|
| EF-08.1 | L'interface liste **toutes** les combinaisons utiles sous forme de tableau copiable : une ligne par sortie, une colonne par type de contenu |
| EF-08.2 | Chaque cellule donne : copier l'URL, QR code, « ouvrir dans un onglet » |
| EF-08.3 | `receives` (§ 5.4.1) masque les combinaisons désactivées plutôt que de les rendre muettes silencieusement |
| EF-08.4 | Un lien `kind=bible` **ne reçoit jamais** de contenu d'un autre type, même si la sortie le permet par ailleurs |
| EF-08.5 | Un bouton **« Configurer OBS »** crée les sources navigateur correspondantes via obs-websocket v5 *(déjà prototypé en V1 — à porter)* |
| EF-08.6 | Un bouton **« Configurer vMix »** génère la liste des URLs + résolutions à coller, et un fichier de scène `.vmix` si le format le permet **[D-06]** |
| EF-08.7 | Les liens restent stables dans le temps : l'`id` de sortie ne change jamais, même après renommage |

---

### 5.6 EF-09 — Éditeur de scène WYSIWYG

> C'est la demande : *« des interfaces éditables où je peux moi-même, pour chaque type de
> sortie plein écran ou bas centré, créer mes visuels de fond et les mettre en bas, puis
> mon texte dessus. »*

#### 5.6.1 Ce que l'éditeur doit permettre

**Fonds**
- Image du projet (importée → copiée dans `assets/backgrounds/`)
- Vidéo en boucle (avec point d'entrée, muet par défaut)
- Dégradé linéaire / radial, 2 couleurs + angle
- Couleur unie
- **Teinte et opacité** appliquées au fond pour garantir la lisibilité du texte
- **Flou** de fond (déjà présent)
- Cadrage `contain` / `cover` / `stretch`, position, décalage x/y
- Mosaïque / répétition pour les motifs

**Texte**
- Tout calque texte peut être **libre** ou **lié** (`ref`, `verse`, `title`, `section`, `lyrics`, `announcement`, `timer`, `custom`)
- Police (liste des polices vendues + polices système détectées), taille, graisse, italique, souligné, barré
- Couleur, contour, ombre paramétrable, fond de texte, rayon
- **Alignement horizontal** : gauche, centré, droite, **justifié**
- **Alignement vertical** : haut, milieu, bas
- Interlignage, espacement des lettres, espacement des paragraphes
- Capitales / petites capitales
- Taille automatique avec bornes min/max
- Aperçu avec un **vrai contenu d'exemple** (un vrai verset long, un vrai couplet)

**Panneaux / formes**
- Rectangle, rectangle arrondi, cercle, ligne
- Fond + opacité, bordure par côté, rayon, ombre portée

**Images / logo**
- Placement libre, cadrage, opacité, masque arrondi

**Manipulation**
- Glisser-déposer, poignées de redimensionnement (4 coins + 4 bords)
- Rotation libre
- Alignement et distribution, aimants sur les bords et le centre
- Guides de zone de sécurité (5 % / 10 %)
- Ordre des calques : monter, descendre, premier plan, arrière-plan
- Verrouiller, masquer, dupliquer, supprimer, grouper
- Annuler / rétablir illimité dans la session
- Zoom du canevas, mode « pixel réel »

#### 5.6.2 Organisation des scènes

```
Scènes
├── Par type de contenu
│   ├── Bible       → Plein écran · Bas centré · Bas droite · Lower third · …
│   ├── Chants      → …
│   ├── Médias      → …
│   ├── Annonces    → …
│   ├── Habillages  → …
│   └── Minuteur    → …
└── Looks (jeu complet réutilisable, § 5.10)
```

| ID | Exigence |
|---|---|
| EF-09.1 | Ouvrir l'éditeur depuis **n'importe quelle sortie**, pour **n'importe quel type de contenu** |
| EF-09.2 | L'aperçu de l'éditeur utilise **exactement** la fonction `render()` de la sortie (ENF-42) |
| EF-09.3 | Créer, dupliquer, renommer, supprimer, exporter, importer une scène |
| EF-09.4 | Une scène peut être **appliquée à plusieurs sorties** en un clic |
| EF-09.5 | « Appliquer à Bible + Chants » en une action *(déjà présent en V2)* |
| EF-09.6 | Modifier une scène pendant la diffusion met à jour la sortie **en direct** |
| EF-09.7 | Toute scène est exportable en JSON réimportable |
| EF-09.8 | Le texte ne déborde **jamais** : auto-ajustement + découpage |

---

### 5.7 EF-10 — Looks et thèmes

- Un **look** = un jeu de scènes nommé, couvrant plusieurs types de contenu,
  avec ses fonds, couleurs, typographies et géométries.
- Appliquer un look = remplacer les scènes d'une sortie en un clic.
- Looks fournis d'office : sobre, festif, carême, Noël, aube, mission *(les 6 de V1)*
  + les 11 thèmes de V2 comme point de départ d'un look.
- Les looks sont stockés dans `project/library/looks/` et **suivent le profil**.
- Un look peut être partagé entre profils (copie ou référence) **[D-07]**.

---

### 5.8 EF-11 → EF-14 — Bible

#### 5.8.1 Import (EF-11)

| Source | Format |
|---|---|
| Fichier local | XML Beblia, Zefania, OSIS **(à ajouter)**, USFX **(à ajouter)** |
| Catalogue en ligne | Dépôts libres (§ 5.13) |
| Démonstration | Un extrait LSG fourni dans le dépôt, chargé en un clic |

À l'import : validation, indexation (`project/cache/index-bible-<id>.json`),
statistiques (livres, chapitres, versets), nom modifiable, suppression possible.

#### 5.8.2 Saisie clavier unifiée (EF-12) ⭐

> Demande exacte : *« il suffit de mettre quelques lettres et il doit afficher les livres
> correspondants, taper Entrée sélectionne le premier résultat ; dès que le livre est
> sélectionné, il suffit de mettre le chapitre en chiffre, de faire espace et de taper le
> verset puis de faire Entrée, puis le verset s'affiche. »*

**Un seul champ**, une machine à états :

```
        ┌──────────────────────────────────────────────────────┐
        │  ÉTAT 0 : LIVRE                                      │
        │  « je » → [Jérémie, Jean, Job, Josué, Jacques, Jude] │
        │  ↑↓ navigue · Entrée = premier résultat · Échap vide │
        └───────────────────────┬──────────────────────────────┘
                                │ Entrée  (ou clic)
        ┌───────────────────────▼──────────────────────────────┐
        │  ÉTAT 1 : CHAPITRE                                   │
        │  « 3 »  · Espace / ":" / "." / "-" → état 2          │
        │  Entrée seul → affiche tout le chapitre              │
        │  Retour arrière jusqu'à effacer → état 0             │
        └───────────────────────┬──────────────────────────────┘
                                │ Espace
        ┌───────────────────────▼──────────────────────────────┐
        │  ÉTAT 2 : VERSET                                     │
        │  « 16 »      → Entrée : diffuse Jean 3:16            │
        │  « 16-18 »   → Entrée : diffuse Jean 3:16-18         │
        │  « 16 18 »   → idem (tolérance)                      │
        └───────────────────────┬──────────────────────────────┘
                                │ Entrée
                          DIFFUSION IMMÉDIATE
```

| ID | Règle |
|---|---|
| EF-12.1 | L'entrée est **insensible à la casse et aux accents** : « jé », « JE », « je » → même liste |
| EF-12.2 | La correspondance est **préfixe d'abord, puis inclusion** : « jn » ne trouve rien par préfixe mais « jean » oui ; « ésa » et « esa » trouvent Ésaïe |
| EF-12.3 | Les **abréviations usuelles** sont reconnues : `gn`, `ex`, `lv`, `ps`, `pr`, `es`, `mt`, `mc`, `lc`, `jn`, `ac`, `ro`, `1co`, `ap`… (table fournie et éditable) |
| EF-12.4 | La liste déroulante affiche au plus 8 livres, le premier en surbrillance |
| EF-12.5 | `Entrée` en état 0 sélectionne **toujours** le résultat en surbrillance (le premier par défaut) |
| EF-12.6 | Si la saisie correspond exactement à un nom de livre, `Entrée` le sélectionne directement |
| EF-12.7 | Après sélection du livre, le champ bascule en mode chapitre : le nom du livre reste affiché en préfixe non éditable (ex. `Jean ▸ `) |
| EF-12.8 | Séparateurs acceptés entre chapitre et verset : **espace**, `:`, `.`, `-` |
| EF-12.9 | `Entrée` en état 2 **diffuse immédiatement** sur les sorties cibles |
| EF-12.10 | Une référence invalide affiche un message explicite et **ne vide pas** la saisie |
| EF-12.11 | `Échap` remonte d'un état ; au second `Échap`, vide le champ |
| EF-12.12 | Les **10 dernières références** sont proposées en historique (`↑` champ vide) |
| EF-12.13 | La saisie rapide accepte une référence complète collée : « Jean 3:16-18 » |
| EF-12.14 | Le tout fonctionne **sans souris**, y compris depuis la télécommande |

#### 5.8.3 Navigation en direct (EF-12.15 → EF-12.22)

> *« passer d'un verset à un autre en utilisant les touches de direction, ou d'une partie
> d'un verset à l'autre en fonction de la longueur du verset. »*

Le modèle de navigation est une **liste plate** : chaque élément est soit un verset
court, soit une **partie** d'un verset long.

| Touche | Effet |
|---|---|
| `→` / `↓` / `Espace` / `PageDown` | élément **suivant** : partie suivante du verset courant, sinon premier verset suivant |
| `←` / `↑` / `PageUp` | élément **précédent**, symétrique |
| `Entrée` | rediffuser l'élément courant (relancer l'animation) |
| `Début` / `Fin` | premier / dernier élément de la sélection |
| `Échap` | couper la sortie |
| `Maj + →` | sauter au **verset** suivant (ignore les parties) |
| `Maj + ←` | verset précédent |
| `Ctrl + →` | chapitre suivant |
| `Ctrl + ←` | chapitre précédent |

| ID | Règle |
|---|---|
| EF-12.15 | La navigation traverse les **parties** avant de changer de verset |
| EF-12.16 | L'indicateur « partie 2/3 » est visible dans le contrôleur **et** sur la vue scène |
| EF-12.17 | La sortie affiche discrètement une flèche latérale tant qu'il reste des parties *(déjà en V2)* |
| EF-12.18 | Le découpage est **stable** : le même verset donne toujours les mêmes parties pour un `splitChars` donné |
| EF-12.19 | Naviguer met à jour toutes les sorties ciblées **simultanément** |
| EF-12.20 | La navigation fonctionne depuis la télécommande et la vue scène |
| EF-12.21 | Un clicker USB (flèches / PageUp / PageDown) fonctionne sans configuration |
| EF-12.22 | Les touches sont **désactivées** quand le focus est dans un champ de saisie |

#### 5.8.4 Découpage lisible (EF-13) ⭐

> *« privilégier la vision des gens, qu'il n'y ait pas beaucoup de mots affichés ; si le
> verset est très long, il faut juste le couper comme FreeShow. »*

| ID | Règle |
|---|---|
| EF-13.1 | **Objectif en mots**, pas en caractères : réglage par scène `maxWordsPerScreen` (défaut **25 mots** pour un bandeau, **40** pour un plein écran) |
| EF-13.2 | Le découpage cherche d'abord une **coupure sémantique** : `;` puis `,` puis `:` puis espace, dans la seconde moitié de la fenêtre |
| EF-13.3 | Ne jamais couper **à l'intérieur d'un mot**, ni séparer un chiffre de son unité, ni orphaniser une ponctuation |
| EF-13.4 | Ne jamais produire une partie de **moins de 3 mots** si elle peut être rattachée à la précédente |
| EF-13.5 | Équilibrage : si 2 parties, éviter 30 mots puis 2 mots — répartir autour de la coupure la plus proche du milieu |
| EF-13.6 | Les annotations (gras, couleur, surlignage) sont **reportées** sur la bonne partie |
| EF-13.7 | Le nombre de parties est affiché avant diffusion dans l'aperçu |
| EF-13.8 | Un mode « **jamais plus de N lignes** » est disponible en alternative au mode mots |
| EF-13.9 | Le réglage est **par scène**, donc différent entre plein écran et bas centré |

#### 5.8.5 Multi-versions et annotations (EF-14)

- Afficher **2 versions** du même verset côte à côte *(déjà en V2)*, avec réglage de la
  seconde version par sortie.
- Annotations avant projection : gras, italique, souligné, couleur, surlignage,
  plus une **note de régie non projetée** *(déjà en V2)*.
- Favoris de versets, notes par verset.

---

### 5.9 EF-15 — Chants

| ID | Exigence |
|---|---|
| EF-15.1 | Import : texte brut, ChordPro, OpenSong XML, CCLI **(à préciser)** |
| EF-15.2 | Découpe automatique en sections sur les lignes vides *(déjà en V1 et V2)* |
| EF-15.3 | Types de sections nommés : couplet, refrain, pont, intro, fin, tag |
| EF-15.4 | **Arrangement réordonnable en direct** : la suite des sections peut être modifiée pendant le culte, sans perdre la position courante |
| EF-15.5 | Navigation identique à la Bible : flèches entre sections, puis entre parties d'une section longue |
| EF-15.6 | Le même moteur de découpage lisible que la Bible (EF-13) |
| EF-15.7 | Métadonnées : titre, artiste, auteur, clé, tempo, durée, n° CCLI, copyright |
| EF-15.8 | Affichage optionnel des **accords** (vue scène uniquement, jamais sur l'écran public) |
| EF-15.9 | Transposition d'une section affichée (option) |
| EF-15.10 | Recherche instantanée par titre, artiste ou **paroles** |
| EF-15.11 | Dossiers / étiquettes pour organiser (par saison, par groupe de louange) |

---

### 5.10 EF-16 → EF-19 — Médias, annonces, minuteurs, habillages

**Médias (EF-16)**
- Images (png, jpg, webp, gif, svg), vidéos (mp4, webm, mov), PDF, PPTX
- **Copie systématique dans `assets/media/`** (P4) + miniature
- Groupes et étiquettes
- Vidéo : lecture, pause, boucle, muet, point d'entrée, vitesse, aller-à
- PDF / PPTX : navigation page à page avec les flèches *(déjà en V1 et V2)*
- Une **file de lecture** : enchaîner plusieurs médias automatiquement
- Fond d'écran de la sortie : un média peut être affecté comme fond de scène

**Annonces (EF-17)** — texte libre avec titre, image, durée d'affichage programmable.

**Minuteurs (EF-18)** — chrono et compte à rebours, file de décomptes,
alerte visuelle et message à la scène quand le temps est écoulé *(déjà en V1 et V2)*.

**Habillages / lower thirds (EF-19)** — titres animés réutilisables, avec logo,
animations d'entrée/sortie, durée d'affichage automatique.

---

### 5.11 EF-20 — Profils

> *« sur la page d'accueil on doit avoir la possibilité de choisir des types de profils,
> par exemple un profil déjà configuré pour une conférence, une église, un stream live. »*

#### 5.11.1 Définition

Un **profil** est un ensemble nommé et réutilisable de configurations :

```jsonc
{
  "id": "prof_icc_culte",
  "name": "ICC Pahou — Culte du dimanche",
  "kind": "church",                 // church | conference | stream | school | custom
  "description": "2 sorties : projecteur salle + stream OBS",
  "outputs": [ … ],                 // définitions complètes des sorties
  "looks": ["look_sobre", "look_festif"],
  "defaultLook": "look_sobre",
  "bibles": ["bible_lsg", "bible_bds"],
  "defaultBible": "bible_lsg",
  "songFolders": ["louange-2026"],
  "mediaGroups": ["visuels-culte"],
  "planTemplate": "plan_culte_type",
  "stage": { "timerLabel": "Prédication", "defaultMinutes": 35 },
  "keyboard": { "profile": "standard" },
  "network": { "lanToken": true }
}
```

#### 5.11.2 Exigences

| ID | Exigence |
|---|---|
| EF-20.1 | **Trois profils fournis d'office** : `Église`, `Conférence`, `Stream live` |
| EF-20.2 | Choisir un profil sur la page d'accueil configure sorties, looks et réglages en une action |
| EF-20.3 | Un profil est **entièrement éditable** : rien n'est figé |
| EF-20.4 | Créer un profil depuis la configuration courante (« Enregistrer comme profil ») |
| EF-20.5 | Dupliquer, renommer, exporter, importer un profil |
| EF-20.6 | Un profil n'embarque **pas** les binaires : il référence les `assetId` du projet |
| EF-20.7 | Exporter un profil **avec** ses médias (archive autonome) pour le partager |
| EF-20.8 | Changer de profil **en direct** est possible mais demande confirmation |
| EF-20.9 | Le profil actif est affiché en permanence sur la page d'accueil |
| EF-20.10 | Un profil peut définir un **gabarit de plan de déroulement** |

#### 5.11.3 Contenu des 3 profils livrés

| Élément | Église | Conférence | Stream live |
|---|---|---|---|
| Sorties | Plein écran (salle) + Bas centré (stream) | Plein écran + Bas centré + Retour scène | Bas centré alpha + Habillage + Médias |
| Look par défaut | Sobre | Moderne | Cinéma |
| Bible | LSG + BDS | LSG | LSG |
| Minuteur | Prédication 35 min | Session 45 min | Direct |
| Vue scène | activée | activée | désactivée |
| Plan type | Culte du dimanche | Conférence 3 sessions | Conducteur de direct |

---

### 5.12 EF-21 → EF-23 — Organisations, événements, plans

> *« j'ai besoin de quoi gérer totalement un événement, une église, mais de façon éditable. »*

#### 5.12.1 Hiérarchie

```
Organisation  (Église ICC Pahou)
└── Lieu      (Temple de Pahou, Salle annexe)
    └── Événement   (Culte du 26/10/2026, Conférence Jeunesse, Saint-Valentin)
        ├── Profil appliqué
        ├── Plan de déroulement (cue list ordonnée)
        ├── Ressources attachées (chants, médias, versets)
        ├── Équipe / rôles (opérateur, pasteur, régie)   [optionnel]
        └── Notes
```

Tout est **éditable, duplicable, supprimable, exportable**. Aucune hiérarchie imposée :
un événement peut exister sans lieu, un lieu sans organisation.

#### 5.12.2 Événement

| ID | Exigence |
|---|---|
| EF-22.1 | Créer un événement : nom, date/heure, lieu, profil, description, couleur d'identification |
| EF-22.2 | Un événement peut être **récurrent** (chaque dimanche) avec instances |
| EF-22.3 | Un événement peut être **dupliqué** (cas réel : préparer le culte suivant) |
| EF-22.4 | L'événement du jour est mis en avant sur la page d'accueil |
| EF-22.5 | Un événement garde son **historique** : ce qui a été diffusé, quand |
| EF-22.6 | Cas d'usage **Saint-Valentin** : créer un événement, lui attacher un look dédié, un fond, des versets et des chants — puis le réappliquer l'année suivante |

#### 5.12.3 Plan de déroulement (EF-23)

| ID | Exigence |
|---|---|
| EF-23.1 | Une liste ordonnée d'étapes : verset, chant, média, annonce, habillage, minuteur, écran noir, note |
| EF-23.2 | Une **note** est un repère non diffusé (ex. « prière », « offrande ») |
| EF-23.3 | `Espace` / `→` avance, `←` recule, `Échap` coupe — **une seule touche en direct** |
| EF-23.4 | Panneau « En cours / Suivant / Après » toujours visible |
| EF-23.5 | Durée estimée par étape et durée totale du déroulé |
| EF-23.6 | Réordonner par glisser-déposer |
| EF-23.7 | Import **CSV / texte** : une ligne par étape, reconnaissance automatique des références bibliques et des titres de chants *(déjà en V1)* |
| EF-23.8 | Import **JSON Planning Center** avec appariement par titre *(déjà en V1)* |
| EF-23.9 | Le plan est **lié à l'événement** et suit le profil |
| EF-23.10 | Le plan est pilotable depuis la télécommande et la vue scène |
| EF-23.11 | Imprimer / exporter le déroulé en PDF ou texte |

---

### 5.13 EF-24 → EF-25 — Vue scène et télécommande

**Vue scène / pasteur (EF-24)** : texte courant **et suivant**, référence, minuteur,
horloge, message de la régie avec niveau d'urgence, boutons précédent / suivant /
écran noir *(déjà largement présent en V1 et V2)*. Ajouts :
- choix de la sortie suivie ;
- affichage des **accords** de chant si autorisé ;
- taille de texte réglable depuis l'écran de scène lui-même.

**Télécommande (EF-25)** : QR code, ouverture sur téléphone, plan de déroulement
tactile, recherche Bible, boutons couper / écran noir. Doit fonctionner hors-ligne
une fois la page chargée (PWA + service worker).

---

### 5.14 EF-26 — Sauvegarde, restauration, export

| ID | Exigence |
|---|---|
| EF-26.1 | **Sauvegarde automatique** dans `project/` après chaque modification, avec historique tournant (N dernières versions) |
| EF-26.2 | **« Exporter le projet »** produit une archive `.openpresenter.zip` contenant **tout** : données, médias, looks, sorties, profils, événements |
| EF-26.3 | **« Restaurer »** accepte cette archive, avec choix *remplacer* ou *fusionner* |
| EF-26.4 | Un **contrôle d'intégrité** est affiché avant restauration (taille, nombre d'éléments, version) |
| EF-26.5 | La version du format est stockée ; une migration ascendante est fournie |
| EF-26.6 | Exporter **un seul** élément (un chant, une scène, un profil, un événement) |
| EF-26.7 | Copier le dossier du projet à la main **suffit** — aucune étape d'export préalable n'est nécessaire (P2) |

---

### 5.15 EF-27 — Catalogue en ligne (seule fonction réseau)

> *« il sera possible de télécharger des bibles, des chants, qui sont sur des API libres
> directement depuis internet si on est connecté. »*

| ID | Exigence |
|---|---|
| EF-27.1 | Le catalogue est **désactivé par défaut** et s'active explicitement dans les réglages |
| EF-27.2 | Il liste des **sources libres** : bibles (dépôts XML libres type Beblia / getBible / API Bible libres), chants libres, fonds d'écran libres |
| EF-27.3 | Chaque entrée affiche : nom, langue, licence, taille, source — **avant** téléchargement |
| EF-27.4 | Le téléchargement écrit **directement dans `assets/`** comme un import manuel |
| EF-27.5 | Une source est **configurable** : l'utilisateur peut ajouter une URL de dépôt |
| EF-27.6 | Timeout 8 s ; échec → message clair, aucune dégradation du reste |
| EF-27.7 | Le catalogue fonctionne **aussi** en important une URL ou un fichier téléchargé à la main |
| EF-27.8 | Aucune donnée utilisateur n'est envoyée au serveur distant (pas de télémétrie, pas d'identifiant) |
| EF-27.9 | Liste des sources livrées dans un fichier éditable `app/catalog-sources.json` |

---

### 5.16 EF-28 → EF-30 — Journal, accessibilité, diagnostic

- **EF-28** : journal de session dans `project/logs/` (actions de diffusion, erreurs),
  consultable dans l'interface, purgeable.
- **EF-29** : contrastes conformes WCAG AA pour l'interface de régie, navigation clavier
  complète, `aria-label` sur les commandes, tailles de police respectées,
  chaînes externalisées pour traduction (FR livré, EN préparé).
- **EF-30** : page **« Diagnostic »** qui vérifie et affiche en vert/rouge :
  serveur, port, dossier de projet inscriptible, sorties connectées, navigateur supporté,
  version du runtime, espace disque, dernière sauvegarde. Bouton « Copier le rapport ».

---

### 5.17 Renvois vers la spécification détaillée

Les sujets suivants sont spécifiés intégralement dans un chapitre dédié ; le présent
document n'en donne que la synthèse.

| Sujet | Chapitre | Ce qu'on y trouve |
|---|---|---|
| Journal, diagnostic, intégrité, mode secours | `23-journal-diagnostic.md` | 13 contrôles `DIAG-nn`, format du rapport, liste fermée des évènements, écran d'intégrité |
| Schémas JSON machine-vérifiables | `24-annexe-schemas.md` | 16 schémas 2020-12, `$defs` communs, vecteurs `-ok` / `-ko` |
| Chaînes d'interface | `25-annexe-textes.md` | 99 textes `TXT-nnn`, règles typographiques, codes d'erreur → messages |
| Traçabilité | `26-annexe-tracabilite.md` | EF → chapitre → test → maquette, contrôles T1–T4 |
| Atlas des écrans | `27-atlas-ecrans.md` | 36 écrans `SCR-nn`, routes, états obligatoires, couverture maquettes |

---

## 6. Cas d'utilisation bout-en-bout

Chaque cas doit être démontrable en test d'acceptation.

### CU-01 — Premier lancement sur un PC vierge

> PE-1 dézippe `OpenPresenter.zip` sur le bureau et double-clique.

1. Double-clic sur `OpenPresenter.bat`.
2. La console affiche l'auto-diagnostic : runtime trouvé (ou proposé), port libre, dossier créé.
3. Le navigateur s'ouvre sur la page d'accueil.
4. L'assistant propose : choisir un profil → charger la Bible de démonstration → voir une démo.
5. **Aucune installation, aucun compte, aucune connexion Internet.**

**Échec acceptable** : Node absent et pas d'Internet → instructions précises affichées.

### CU-02 — Préparer le culte du dimanche (la veille)

PE-2 crée l'événement « Culte du 26/10 », applique le profil `Église`,
importe 4 chants, choisit 3 passages bibliques, ajoute les visuels d'offrande,
construit le plan de déroulement, règle le look « Sobre », vérifie les deux sorties
dans l'aperçu, ferme. **Le lendemain, tout est là.**

### CU-03 — Évènement Saint-Valentin

1. Créer l'événement « Saint-Valentin 2027 ».
2. Dans l'éditeur de scène, **importer une image de fond** (copiée dans `assets/backgrounds/`).
3. Créer un calque texte lié à `ref` : police Cinzel, couleur rose, centré, en haut.
4. Créer un calque texte lié à `verse` : 40 mots max, justifié, en bas.
5. Enregistrer la scène sous le nom « Saint-Valentin — Bible ».
6. L'appliquer à la sortie « Plein écran ».
7. Enregistrer l'ensemble comme **look** « Saint-Valentin ».
8. Diffuser `1 Corinthiens 13` : le verset est découpé en 3 parties navigables,
   le fond et les références restent parfaitement lisibles.
9. L'année suivante : dupliquer l'événement, le look est déjà là.

### CU-04 — Live stream avec overlays sélectifs

PE-5 veut : la caméra plein cadre, les versets en bas, **mais jamais** les médias plein
écran sur le stream.

1. Créer la sortie « Stream — bandeau » (transparente, bas centré).
2. Régler `receives` : bible ✅, chants ✅, médias ❌, habillages ✅.
3. Copier `/o/out_stream?kind=bible` dans une source navigateur OBS `1920×1080`.
4. Copier `/o/out_stream?kind=lowerthird` dans une seconde source, en mode keying.
5. Diffuser un verset : il apparaît **uniquement** dans le bandeau.
6. Diffuser un média : il apparaît sur la sortie salle, **pas** sur le stream.

### CU-05 — Dépannage pendant le culte

- Une vidéo ne charge plus → placeholder « média indisponible » + toast à l'opérateur,
  la sortie continue d'afficher le reste.
- Le Wi-Fi de la télécommande tombe → la régie locale continue de fonctionner.
- OBS plante → les autres sorties ne sont pas affectées.
- Coupure de courant → au relancement, le plan et le dernier état sont restaurés.

### CU-06 — Transférer le projet sur un autre PC

Copier le dossier sur une clé USB → brancher sur le PC de la salle → double-cllic →
**tout est identique**, y compris les polices et les médias. Aucune ré-importation.

### CU-07 — Mode sans Internet

Débrancher le câble / couper le Wi-Fi → ouvrir le logiciel → conduire un culte complet.
Le seul endroit où l'absence de réseau se voit est le catalogue, qui affiche
« Catalogue indisponible — aucune connexion ».

### CU-08 — Le bénévole change

PE-1 arrive, ouvre la page d'accueil, voit le profil et l'événement déjà sélectionnés,
appuie sur `Espace` pour avancer dans le plan. **Il n'a rien à comprendre.**

---

## 7. Modèle de données

### 7.1 Arborescence disque

```
project/
├── project.json                 { id, name, version, createdAt, settings }
├── library/
│   ├── bibles/<id>.json         { id, name, lang, source, bookCount, verseCount, assetId? }
│   ├── songs/<id>.json          { id, title, artist, sections[], arrangement[], meta }
│   ├── looks/<id>.json          { id, name, scenesByKind{}, createdAt }
│   └── announcements/<id>.json
├── assets/
│   ├── index.json               { <sha256>: { path, mime, bytes, originalName, importedAt } }
│   ├── bibles/  chants/  media/  backgrounds/  logos/
├── outputs/outputs.json         [ …§5.4.1 ]
├── scenes/<id>.json             scènes (ou embarquées dans outputs.json) [D-08]
├── profiles/<id>.json           [ …§5.11.1 ]
├── orgs/<id>.json               organisation + lieux
├── events/<id>.json             { id, name, startsAt, orgId, placeId, profileId, plan[] }
├── cache/
│   ├── thumb/<sha>.webp
│   └── index-*.json
├── logs/launch-*.log · session-*.log
└── backups/<date>.zip           historique tournant
```

### 7.2 Invariants

| ID | Invariant |
|---|---|
| INV-1 | Aucun fichier hors de `project/` n'est écrit |
| INV-2 | Aucun chemin absolu de la machine d'origine n'est stocké |
| INV-3 | Chaque binaire est référencé par son `sha256` et **dédupliqué** |
| INV-4 | Toute écriture est atomique (tmp + rename) |
| INV-5 | Les `id` sont stables et ne changent jamais, y compris après renommage |
| INV-6 | Un `assetId` orphelin est détecté et proposé au nettoyage |
| INV-7 | Le schéma est versionné ; une migration est fournie à chaque évolution |

---

## 8. Raccourcis clavier

### 8.1 Globaux

| Touche | Action |
|---|---|
| `Ctrl/Cmd + K` | recherche unifiée |
| `Espace` | diffuser / avancer dans le plan |
| `Échap` | couper toutes les sorties |
| `Ctrl/Cmd + .` | écran noir immédiat |
| `F11` | plein écran du contrôleur |
| `?` | aide clavier contextuelle |

### 8.2 Bible / Chants

| Touche | Action |
|---|---|
| `→` `↓` `PageDown` | partie suivante, puis verset/section suivant |
| `←` `↑` `PageUp` | précédent |
| `Maj + →` / `Maj + ←` | verset/section suivant/précédent (ignore les parties) |
| `Ctrl + →` / `Ctrl + ←` | chapitre suivant/précédent |
| `Début` / `Fin` | premier / dernier élément |
| `Entrée` | rediffuser l'élément courant |
| `1`–`9` | aller à la section/verset n° n |
| `V` | basculer l'affichage 2 versions |
| `N` | annoter le verset sélectionné |

### 8.3 Médias

| Touche | Action |
|---|---|
| `→` / `←` | page/ diapositive suivante / précédente |
| `L` | lecture / pause vidéo |
| `M` | muet |
| `B` | boucle |

### 8.4 Éditeur de scène

`Suppr` supprimer · `Ctrl+D` dupliquer · `Ctrl+Z` / `Ctrl+Maj+Z` annuler/rétablir ·
flèches déplacer de 1 % · `Maj + flèches` déplacer de 0,1 % ·
`Ctrl + flèches` redimensionner · `L` verrouiller · `H` masquer ·
`[` `]` ordre des calques · `Ctrl+A` tout sélectionner · `G` grouper.

---

## 9. Compatibilité

| Élément | Exigence |
|---|---|
| OS | Windows 10/11, macOS 12+, Linux (glibc ≥ 2.28) |
| Navigateur de régie | Chromium ≥ 110, Edge ≥ 110, Firefox ≥ 115, Safari ≥ 16 |
| Source navigateur | OBS ≥ 28 (CEF intégré), vMix (navigateur intégré) |
| Écran | 1280×720 minimum pour l'interface de régie ; sorties de 320 à 8192 px |
| Chemins | accents, espaces, caractères non-ASCII supportés |
| Réseau | LAN IPv4 ; IPv6 non requis |
| Matériel | 4 Go RAM, 2 Go d'espace disque pour le projet type |

---

## 10. Plan de livraison

Le plan détaillé, avec dépendances et critères de sortie, est le chapitre
`docs/spec/21-plan-livraison.md`. Synthèse opposable :

| Phase | Objectif | Livrables | Recette | Critère de sortie |
|---|---|---|---|---|
| **0 — Fondations** | le produit existe et les données sont portables | consolidation `app/` · API disque `project/` · assets (SHA-256, déduplication, miniatures) · lanceur universel · migration V1/V2 · sauvegarde/export · suite de tests | A-01 → A-05, A-13 → A-13e, A-18 | copier le dossier sur un autre PC restitue tout ; le lanceur fonctionne sur les 3 OS |
| **1 — Cœur de la régie** | conduire un culte complet avec deux sorties | sorties + matrice de liens · éditeur WYSIWYG · saisie Bible clavier · découpage + parties · accueil · studio · chants | A-06 → A-10, A-12, A-12b → A-12e | CU-01, CU-03, CU-04, CU-05 passent de bout en bout |
| **2 — Organisation** | s'adapter à une église, préparer à l'avance | profils (3 livrés) · organisations/lieux · événements + plans · looks · médias complets | A-11, A-12f → A-12k, A-13f → A-13i, A-14f → A-14h | CU-02, CU-09, CU-10, CU-14, CU-15 passent |
| **3 — Compléments** | confort de scène et dépannage | vue scène · télécommande · minuteurs · annonces · habillages · diagnostic/journal · intégrité | A-14, A-14b → A-14e, A-15 → A-15f, A-18b → A-18k | CU-06, CU-12, CU-13, CU-17, CU-18 passent |
| **4 — Réseau et finitions** | ce qui exige une connexion ou une finition | catalogue · assistant OBS · vMix · accessibilité/i18n · documentation intégrée · jeton LAN | A-16, A-16b → A-16d, A-17, A-17b → A-17g | CU-08, CU-11, CU-16 passent ; P-01 → P-10 dans les seuils |

**Règle** : aucune phase ne commence avant que la précédente ait produit son rapport de
recette (chapitre 20 § 20.11). Une fonctionnalité qui dépend d'une fondation non livrée est
reportée, jamais contournée.

---

## 11. Critères d'acceptation

La grille complète (115 tests) est `docs/spec/20-tests-acceptation.md`. Elle est **binaire** :
un test passe ou il ne passe pas ; « presque vert » vaut rouge.

| Bloc | Domaine | Tests | Exigences |
|---|---|---|---|
| **A** | socle et hors-ligne | A-01 → A-05 | EF-01, EF-02, EF-03, EF-04 |
| **B** | Bible | A-06 → A-08g | EF-11 → EF-14 |
| **C** | sorties et éditeur | A-09 → A-10h | EF-07, EF-08, EF-09, EF-10 |
| **D** | profils, studio, plan | A-11 → A-12k | EF-05, EF-06, EF-20, EF-23 |
| **E** | contenus | A-13 → A-14h | EF-15 → EF-19, EF-26 |
| **F** | résilience et interface | A-15 → A-17g | EF-24, EF-25, EF-27, EF-29 |
| **G** | journal et diagnostic | A-18 → A-18k | EF-28, EF-30 |
| **P** | performance | P-01 → P-10 | ENF-10 → ENF-15 |

Les quatre tests historiques qui fondent la promesse produit :

| ID | Test | Critère |
|---|---|---|
| **A-01** | **Hors-ligne absolu** | réseau coupé → culte complet conduit ; capture réseau = 0 requête sortante |
| **A-02** | **Un double-clic** | machine sans Node → installation assistée ou instructions exactes ; navigateur ouvert |
| **A-03** | **Dossier = projet** | copie sur une autre machine + cache navigateur vidé → tout est identique |
| **A-10** | **Rendu identique** | éditeur et page de sortie pixel-identiques (même `render()`) |

---

## 12. Risques

| ID | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | Deux bases de code (V1/V2) → effort doublé | **Certain** | Élevé | Décision D-03 dès la phase 0 |
| R-02 | Binaires Node par plateforme lourds à publier | Moyenne | Moyen | Publication en *release* GitHub, hors Git ; lanceur capable de télécharger |
| R-03 | Migration IndexedDB → disque : perte de données utilisateurs existantes | Moyenne | **Élevé** | Outil de migration en phase 0.5, testé sur les sauvegardes réelles du dépôt |
| R-04 | macOS Gatekeeper bloque le `.command` non signé | **Certaine** | Moyen | Documentation + `xattr` expliqué ; à terme signature/notarisation |
| R-05 | Rendu différent entre éditeur et sortie OBS (CEF) | Moyenne | Élevé | Une seule fonction `render` (ENF-42) + `&debug=1` + tests de capture |
| R-06 | Gros médias (> 1 Go) dans le dossier de projet | Moyenne | Moyen | Avertissement à l'import, seuil configurable, option « ne pas copier » **[D-04]** |
| R-07 | Périmètre trop large, rien de fini | **Élevé** | **Élevé** | Phasage strict, chaque phase démontrable, P0 d'abord |
| R-08 | Sources de bibles libres : licences hétérogènes | Moyenne | Moyen | Licence affichée avant téléchargement, liste éditable et auditable |
| R-09 | Portabilité des polices : rendu différent selon l'OS | Faible | Moyen | Polices vendues dans le dépôt, jamais de police système pour les scènes |
| R-10 | Sécurité LAN : relais sans authentification | Faible | Élevé | Jeton d'accès (ENF-32) + avertissement explicite |

---

## 13. Hors périmètre

Explicitement **non** prévu dans cette version, pour protéger le périmètre :

- Encodage et diffusion RTMP/SRT/WebRTC natifs → **OBS/vMix le font déjà, mieux**
- NDI, DeckLink, sortie matérielle directe
- Pilotage lumière, MIDI, Stream Deck (prévoir l'API, ne pas l'implémenter)
- Application mobile native (la PWA couvre le besoin)
- Comptes utilisateurs, rôles, authentification multi-utilisateurs
- Synchronisation cloud obligatoire
- Édition vidéo, montage, étalonnage
- Reconnaissance vocale, traduction automatique

---

## 14. Décisions

### 14.1 Décisions **tranchées**

| ID | Question | **Décision retenue** | Conséquence |
|---|---|---|---|
| **D-01** | Comment le logiciel est-il exécuté ? | ✅ **Runtime détecté** + installation automatique si possible, instructions explicites sinon | Lanceur assistant (ch. 03) ; runtime embarqué seulement en distribution optionnelle |
| **D-02** | Où vivent les données ? | ✅ **Disque = source de vérité**, IndexedDB = cache de lecture | `project/` seul lieu d'écriture (ch. 04) ; migration V1/V2 obligatoire en phase 0 |
| **D-03** | Que fait-on des deux bases de code ? | ✅ **Consolidation « best of both »** | § 4.7 et Annexe B ; aucun composant conservé par habitude |
| **D-04** | Copie-t-on tous les médias ? | ✅ **Toujours copier**, avec **avertissement au-delà de 500 Mo** et option `linked` explicitement signalée comme non portable | EF-02.6 → EF-02.8 ; seuil réglable dans `project.json` |
| **D-05** | Le relais LAN exige-t-il un jeton ? | ✅ **Oui** : jeton de 4 caractères, obligatoire hors `localhost` | ENF-32 ; QR code sur l'accueil |
| **D-06** | Jusqu'où aller avec vMix ? | ✅ **Liste d'URLs à coller** ; génération `.vmix` hors périmètre | EF-08.22 ; § 13 |
| **D-07** | Un look est-il partagé ou copié entre profils ? | ✅ **Référence partagée**, avec action « Détacher » qui crée une copie | EF-20.11 ; ch. 13 |
| **D-08** | Scènes en fichiers séparés ou incluses ? | ✅ **Fichiers séparés** (`scenes/<id>.json`) | ch. 04 § 4.2 ; débloque la phase 0 |

### 14.2 Décisions **encore ouvertes**

Aucune ne bloque une phase de livraison.

| ID | Question | Recommandation | Échéance | Impact si non tranchée |
|---|---|---|---|---|
| **D-09** | Nom définitif du produit et du dossier | `OpenPresenter` | avant publication | cosmétique : libellés, nom du dossier |
| **D-10** | Licence du projet | MIT | avant publication | aucune incidence technique |
| **D-11** | Mode kiosque (fenêtre dédiée) | phase 4, optionnel | avant phase 4 | aucune : le navigateur suffit |
| **D-12** | Langues livrées | FR livré, EN préparé | avant phase 4 | aucune : les chaînes sont déjà externalisées (ch. 25) |

**Règle** : une décision ouverte ne peut jamais être contournée par une implémentation
temporaire. Si elle devient bloquante, elle est tranchée et reportée dans 14.1.

---

## 15. Glossaire

| Terme | Définition |
|---|---|
| **Sortie** | Destination d'affichage : une URL consommée par OBS/vMix ou un écran. Possède une résolution, un cadrage et ses propres scènes. |
| **Type de contenu** (`kind`) | Famille de contenu diffusé : bible, chants, médias, annonces, habillages, minuteur, plan. |
| **Scène** | Composition visuelle à calques, propre à un couple (sortie, type de contenu). |
| **Calque** | Élément d'une scène : fond, panneau, texte, image. Positionné en % d'un canevas 1920×1080. |
| **Liaison** (`bind`) | Champ de données qui alimente un calque texte (référence, verset, paroles…). |
| **Look** | Jeu de scènes nommé et réutilisable, appliqué à une sortie en un clic. |
| **Profil** | Ensemble nommé de sorties, looks, réglages et gabarit de plan. |
| **Organisation** | Entité propriétaire (église, association). Contient des lieux. |
| **Événement** | Occurrence datée (culte, conférence) attachée à un lieu, un profil et un plan. |
| **Plan de déroulement** | Liste ordonnée d'étapes conduite en direct. |
| **Partie** | Fragment d'un texte long découpé pour rester lisible. |
| **Projet** | Le dossier complet contenant logiciel, données et médias. |
| **Asset** | Fichier binaire du projet, adressé par son empreinte SHA-256. |
| **Relais** | Serveur WebSocket local qui synchronise régie, sorties et télécommande. |

---

## 16. Où lire quoi — carte documentaire

| Document | Rôle | Volume |
|---|---|---|
| `CAHIER-DES-CHARGES.md` (ce fichier) | index, synthèse, décisions, plan, glossaire | ~1 400 lignes |
| `docs/ETAT-DES-LIEUX-2026-10.md` | audit vérifié du dépôt : 3 branches, V1/V2, ce qui marche, ce qui manque | 232 lignes |
| `docs/spec/01` → `22` | spécification contractuelle écran par écran, module par module | ~7 000 lignes |
| `docs/spec/23-journal-diagnostic.md` | journal, diagnostic, intégrité, mode secours | 407 lignes |
| `docs/spec/24-annexe-schemas.md` | 16 schémas JSON Schema 2020-12 + vecteurs de test | 1 240 lignes |
| `docs/spec/25-annexe-textes.md` | catalogue des 99 chaînes d'interface (`TXT-001` → `TXT-099`) | 978 lignes |
| `docs/spec/26-annexe-tracabilite.md` | EF → chapitre → test → maquette ; contrôles automatiques | 220 lignes |
| `docs/spec/27-atlas-ecrans.md` | 36 écrans (`SCR-01` → `SCR-36`), routes, états, maquettes | 200 lignes |
| `docs/spec/99-glossaire.md` | 40+ termes normalisés | 239 lignes |
| `docs/maquettes/` | 14 captures de référence contractuelles | ~4 500 lignes |

### 16.1 Ordre de lecture recommandé

| Lecteur | Parcours |
|---|---|
| **Décideur** | § 0 → § 2 → § 10 → § 12 → § 14 |
| **Développeur** | § 4 → `02-architecture` → `24-annexe-schemas` → `27-atlas-ecrans` → chapitres de son module |
| **Designer / intégrateur** | `01-vision-personas` → `docs/maquettes/` → chapitres 05 à 15 → `25-annexe-textes` |
| **Testeur** | `20-tests-acceptation` → `26-annexe-tracabilite` → `19-cas-utilisation` |
| **Utilisateur final** | `LISEZ-MOI.txt` (livré avec le logiciel), pas ce document |

### 16.2 Ce qui n'est **pas** dans ce document

| Sujet | Où il est |
|---|---|
| Manuels utilisateur pas à pas | `LISEZ-MOI.txt` livré (ENF-43), à rédiger en phase 4 |
| Documentation de l'API pour intégrateurs | `02-architecture` § 2.3 (contrat) ; publication OpenAPI prévue en phase 4 |
| Journal des modifications | `CHANGELOG.md` (à créer en phase 0) |
| Guide de contribution | `CONTRIBUTING.md` (à créer avant publication) |

---

## Annexe A — Comment lire ce document

1. **§ 0** fixe les règles du jeu : en cas de désaccord sur une fonctionnalité,
   on revient aux principes P1–P10.
2. **§ 2** est l'index : chaque `EF-nn` est une promesse testable.
3. **§ 5** est le contrat détaillé : ce que l'utilisateur voit et ce qui doit se passer.
4. **§ 6** vérifie que le tout tient debout dans la vraie vie.
5. **§ 11** est la grille de recette : tant qu'un `A-nn` échoue, la phase n'est pas livrée.
6. **§ 14** doit être vidé avant la phase 0 : ce sont les seuls points qui peuvent
   encore faire changer l'architecture.

## Annexe B — Ce qui existe déjà et sera réutilisé

| Composant | Source | Réutilisation |
|---|---|---|
| Moteur de scène à calques | `openpresenter2/src/core/engine.mjs` | **tel quel**, étendu (§ 4.5) |
| Éditeur WYSIWYG | `openpresenter2/src/components/SceneEditor.mjs` | base de l'éditeur cible |
| Registre de sorties | `openpresenter2/src/core/output-registry.mjs` | base de EF-07 |
| Viewport / cadrage | `openpresenter2/src/core/viewport.mjs` | tel quel |
| Parseur Bible XML | `openpresenter2/src/modules/bible/xml.mjs` | étendu OSIS/USFX |
| Annotations de versets | `openpresenter2/src/modules/bible/annotations.mjs` | tel quel |
| Parseur de chants | `openpresenter2/src/modules/songs/parser.mjs` | tel quel |
| Parseur PPTX | `openpresenter2/src/modules/media/pptx.mjs` | tel quel |
| Serveur HTTP + relais WS | `openpresenter2/server.mjs` | étendu avec l'API disque |
| Sortie OBS / vue scène / remote | `openpresenter2/obs/output.html`, `app/stage.html`, `app/remote.html` | base |
| Polices et JS vendus | `openpresenter2/vendor/`, `servergestionobs/vendor/` | fusionnés |
| Looks (6 palettes + éditeur) | `servergestionobs/looks_editor.html`, `js/looks.js` | concepts repris |
| Plan de déroulement + import CSV/PCO | `servergestionobs/cue_list.html` | **logique reprise** |
| Installation OBS 1 clic | `servergestionobs/sync-relay-server.js` (obs-websocket v5) | porté en V2 |
| Recherche unifiée | V1 `studio_unifie.html`, V2 `index.html` | conservée |
| Suite de tests | `openpresenter2/tests/` (17 fichiers), `servergestionobs/tests/` | fusionnée |

## Annexe C — Traçabilité et vérifications

| Vérification | Où | Critère |
|---|---|---|
| Chaque chapitre est indexé | `26-annexe-tracabilite.md` T1 | 0 fichier non indexé |
| Chaque EF est couverte | T2 | 0 EF orpheline (30 domaines, 569 identifiants) |
| Chaque test est défini une fois | T3 | 0 test orphelin (115 identifiants) |
| Chaque maquette citée existe | T4 | 0 maquette manquante (14 fichiers) |
| Chaque écran est répertorié | `27-atlas-ecrans.md` | 36 écrans, 0 route sauvage |
| Chaque chaîne est cataloguée | `25-annexe-textes.md` | 99 chaînes, 0 littéral codé en dur |
| Chaque objet a un schéma | `24-annexe-schemas.md` | 16 schémas, vecteurs `-ok` / `-ko` |
| Aucune dépendance réseau | `ETAT-DES-LIEUX` + A-01 | 0 CDN, 0 requête sortante hors catalogue |

**Commande unique** : `npm run trace:check` (spécifiée en 26.7). Le cahier des charges n'est
publié que si elle sort avec le code 0.

---

