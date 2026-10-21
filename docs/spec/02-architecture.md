# 02 — Architecture technique

> **Exigences couvertes :** EF-01, EF-04, ENF-10 → ENF-44, décisions D-01, D-02, D-03
> **Base reprise :** `openpresenter2/server.mjs`, `src/core/*`, `src/modules/*`

---

## 2.1 Vue d'ensemble

```
┌────────────────────────────────────────────────────────────────────────┐
│  DOSSIER DU PROJET                                                     │
│                                                                        │
│  OpenPresenter.bat / .command / .sh          ← un double-clic          │
│  runtime/                                    ← runtime Node (si installé)│
│  app/                                                                  │
│  │   ├── server.mjs          HTTP + relais WebSocket (0 dépendance)    │
│  │   ├── launcher/           détection, installation, messages         │
│  │   ├── web/                interface                                 │
│  │   │   ├── index.html          page d'accueil                        │
│  │   │   ├── studio.html         studio unifié                         │
│  │   │   ├── o/<outputId>        page de sortie (OBS / vMix / écran)   │
│  │   │   ├── stage.html          vue scène                             │
│  │   │   ├── remote.html         télécommande                          │
│  │   │   └── diagnostic.html     diagnostic                            │
│  │   ├── src/core/           engine, storage, outputs, viewport, themes│
│  │   ├── src/modules/        bible, songs, media, announcements, plan  │
│  │   ├── vendor/             polices + JS (aucun CDN)                  │
│  │   └── data/               tables livrées (abréviations, sources)    │
│  │                                                                     │
│  project/                     ← TOUTES les données utilisateur         │
└────────────────────────────────────────────────────────────────────────┘
             │                    │                     │
             │ HTTP               │ WebSocket           │ HTTP
             ▼                    ▼                     ▼
        Studio / Accueil     Relais temps réel      Sorties OBS/vMix
                             (régie ↔ sorties ↔      (une URL par
                              scène ↔ télécommande)   sortie × contenu)
```

**EF-04.1** — Un **seul** processus serveur. Aucune base de données externe, aucun
service système, aucun conteneur.
**EF-04.2** — Le serveur écoute sur `0.0.0.0` afin d'être joignable depuis les autres
appareils du LAN (ENF-30).

---

## 2.2 Le serveur

Reprend `openpresenter2/server.mjs` : HTTP et WebSocket écrits à la main sur `node:http`,
**zéro dépendance npm au runtime**. C'est un atout décisif pour l'installation (audit
V1 : « zéro dépendance npm » était déjà cité comme point fort majeur).

### 2.2.1 Ce qui est conservé tel quel

| Élément | Pourquoi |
|---|---|
| Serveur HTTP statique avec protection de chemin | déjà testé, refuse `..`, `.git`, `node_modules` et les sorties de racine via `realpath` |
| Relais WebSocket maison (RFC 6455 : trames, fragmentation, ping/pong, masque) | zéro dépendance, limite de trame 64 Mo |
| Vérification `Origin` == `Host` à l'upgrade | ENF-31 |
| Filtrage des adresses IPv4 privées pour l'affichage réseau | déjà présent |
| En-têtes `X-Content-Type-Options`, `Referrer-Policy`, `Cross-Origin-Resource-Policy` | déjà présents |

### 2.2.2 Ce qui est ajouté

| Ajout | Motif |
|---|---|
| API REST `/api/*` sur disque | D-02 : le disque devient la source de vérité |
| Téléversement de fichiers en flux | EF-02 : copie + déduplication par SHA-256 |
| Compression gzip des réponses texte | ENF-14 |
| En-têtes `Cache-Control` différenciés (immuable pour `assets/`, `no-cache` pour le reste) | ENF-14 |
| Jeton d'accès LAN | ENF-32 |
| Verrou de projet (`project/.lock`) | EF-01.9 |
| Journal structuré | EF-28 |
| Génération de miniatures | EF-02 (étape 7) |

---

## 2.3 API REST — contrat complet

Toutes les réponses sont JSON UTF-8. Toute erreur suit la même forme :

```jsonc
{ "error": { "code": "ASSET_NOT_FOUND", "message": "Fichier introuvable.", "detail": "as_7d1f…" } }
```

| Méthode | Route | Rôle | Codes d'erreur |
|---|---|---|---|
| `GET` | `/api/health` | état, version, `projectId`, port, adresses LAN | — |
| `GET` | `/api/project` | `project.json` | — |
| `PUT` | `/api/project` | réglages | `VALIDATION` |
| `GET` | `/api/library/:type` | liste (`bibles` `songs` `looks` `announcements` `timers` `lowerthirds`) | `UNKNOWN_TYPE` |
| `GET` | `/api/library/:type/:id` | un objet | `NOT_FOUND` |
| `PUT` | `/api/library/:type/:id` | créer / mettre à jour | `VALIDATION`, `CONFLICT` |
| `DELETE` | `/api/library/:type/:id` | supprimer | `NOT_FOUND`, `LAST_ITEM` |
| `GET` | `/api/bibles/:id/verses` | texte des versets (fichier séparé, EF-11.1) | `NOT_FOUND` |
| `POST` | `/api/assets` | téléversement → déduplication + miniature | `TOO_LARGE`, `UNSUPPORTED`, `WRITE_FAILED` |
| `GET` | `/api/assets/:sha` | binaire (flux) | `NOT_FOUND` |
| `GET` | `/api/assets/:sha/thumb` | miniature WebP | `NOT_FOUND` |
| `GET` | `/api/outputs` | sorties + filtre + scènes | — |
| `PUT` | `/api/outputs` | remplacer la liste (avec `rev`) | `CONFLICT`, `VALIDATION` |
| `GET/PUT` | `/api/scenes/:id` | scènes | `NOT_FOUND`, `CONFLICT` |
| `GET/PUT` | `/api/profiles` | profils | `VALIDATION` |
| `GET/PUT` | `/api/orgs` | organisations et lieux | `VALIDATION` |
| `GET/PUT` | `/api/events` | événements et plans | `VALIDATION` |
| `POST` | `/api/events/:id/duplicate` | dupliquer un événement | `NOT_FOUND` |
| `GET` | `/api/search?q=&kinds=` | recherche unifiée | — |
| `GET` | `/api/integrity` | rapport d'intégrité (EF-01.15) | — |
| `POST` | `/api/maintenance` | exécuter une action de maintenance | `VALIDATION` |
| `GET` | `/api/export` | archive ZIP du projet | — |
| `POST` | `/api/import` | restaurer une archive | `BAD_ARCHIVE`, `FORMAT_TOO_RECENT` |
| `GET` | `/api/migrate/analyze` | analyser une source V1/V2 | `UNSUPPORTED_SOURCE` |
| `POST` | `/api/migrate/run` | exécuter la migration | idem |
| `GET` | `/api/catalog` | liste des sources et entrées disponibles | `OFFLINE` |
| `POST` | `/api/catalog/fetch` | télécharger une entrée | `OFFLINE`, `CHECKSUM`, `TIMEOUT` |
| `GET` | `/api/logs` | journaux récents | — |
| `WS` | `/ws?channel=<c>` | relais temps réel | — |

**EF-04.3** — Les routes `/api/catalog*` sont les **seules** à émettre une requête
sortante (P1, ENF-01).
**EF-04.4** — Toute écriture passe par `rev` : un `PUT` dont le `rev` est inférieur à
celui du disque renvoie `409 CONFLICT` avec l'état courant.
**EF-04.5** — Aucune route n'accepte de chemin relatif remontant hors de `project/`.

---

## 2.4 Le relais temps réel

### 2.4.1 Canaux

| Canal | Émetteurs | Récepteurs |
|---|---|---|
| `op_out_<outputId>` | Studio | page de sortie correspondante |
| `op_out_<outputId>_<kind>` | Studio | page de sortie filtrée par `kind` |
| `op_stage` | Studio | vue scène |
| `op_remote` | télécommande | Studio |
| `op_project` | serveur | tous les onglets (invalidation de cache) |

**EF-04.6** — Un message relayé n'est **jamais** renvoyé à son émetteur.
**EF-04.7** — Le nom de canal est validé par `^[\w.-]{1,100}$`.

### 2.4.2 Enveloppes

```jsonc
// Diffusion d'un contenu
{ "t": "show",
  "kind": "bible",
  "bindings": {
    "ref": "Jean 3:16", "badge": "LSG",
    "verse": "Car Dieu a tant aimé…",
    "verseHtml": "Car <strong>Dieu</strong> a tant aimé…",
    "parallelVersions": [ { "name": "LSG", "verse": "…" }, { "name": "BDS", "verse": "…" } ]
  },
  "parts": { "count": 3, "index": 0, "maxWords": 25 },
  "outputs": ["out_full", "out_bottom"],
  "ts": 1792600000000,
  "origin": "studio"
}

// Navigation (partie / verset suivant)
{ "t": "nav", "delta": 1, "mode": "part", "ts": … }        // mode: part | verse | chapter

// Coupure
{ "t": "clear", "outputs": ["out_full"], "ts": … }

// Minuteur
{ "t": "timer", "label": "Prédication", "durationMs": 2100000,
  "remainingMs": 1240000, "running": true, "endAt": …, "queue": [ … ] }

// Message à la scène
{ "t": "stageMessage", "text": "…", "tone": "urgent", "author": "Régie", "ts": … }

// État du plan
{ "t": "plan", "cueId": "cue_3", "index": 2, "label": "Jean 3:16", "next": "Offrande" }

// Invalidation de cache
{ "t": "project:changed", "resource": "scenes/scn_…", "rev": 18 }
```

**EF-04.8** — Toute enveloppe porte `ts` ; un récepteur ignore un message plus ancien que
son état courant **pour le même `kind` et la même sortie**.
**EF-04.9** — À la connexion, une page de sortie envoie `{ "t": "hello" }` ; le relais
répond par l'état courant s'il en conserve un (EF-07.25).

---

## 2.5 Couches du client

| Couche | Rôle | Règle |
|---|---|---|
| **Modules métier** (`src/modules/*`) | analyse, découpage, indexation | **purs** : aucune dépendance au DOM, testables dans Node |
| **Moteur de scène** (`src/core/engine.mjs`) | transformer une scène + des liaisons en DOM | une seule fonction `render()` (ENF-42) |
| **Stockage** (`src/core/storage.mjs`) | lire/écrire via l'API, cache IndexedDB | seule couche autorisée à toucher IndexedDB |
| **Vues** (`web/*.html`) | interface | aucune logique métier inline |

**EF-04.10** — Les modules métier n'importent **jamais** `document` ni `window`. C'est ce
qui permet `node --test` sans navigateur (ENF-40).
**EF-04.11** — Aucun fichier HTML ne contient de logique métier de plus de 20 lignes :
tout est dans un module.

> **Rupture assumée avec l'existant** : les pages V1 font 80 à 134 Ko de HTML monolithique
> avec parseurs inline. C'est précisément ce que cette architecture interdit.

---

## 2.6 Chargement et performance

| Règle | Détail |
|---|---|
| Modules lourds à la demande | `pptx.mjs`, `pdf.js`, `jszip` ne sont importés qu'au premier usage |
| Compression | gzip sur `.html` `.js` `.mjs` `.css` `.json` `.svg` |
| Cache | `assets/` → `Cache-Control: public, max-age=31536000, immutable` (les noms contiennent le SHA) · le reste → `no-cache` |
| Polices | `font-display: swap`, sous-ensembles latin + latin-ext uniquement |
| Service worker | cache des fichiers d'interface, **jamais** de `/api/*` ni de `/ws` |
| Poids cible | accueil < 150 Ko gzip · studio < 300 Ko gzip · page de sortie < 120 Ko gzip |

**ENF-14** — Mesure vérifiée par un test qui charge chaque page et additionne les octets
transférés.

---

## 2.7 Gestion mémoire des médias

| ID | Règle |
|---|---|
| ENF-15.1 | Chaque `URL.createObjectURL()` est enregistré dans une liste de propriété de la page |
| ENF-15.2 | Les URLs sont **révoquées** au remplacement d'une scène ou à la fermeture |
| ENF-15.3 | Un cache LRU de **20** URLs d'assets par page de sortie évite de recréer à chaque diffusion |
| ENF-15.4 | Les vidéos sont `preload="metadata"` jusqu'à la diffusion, puis `auto` |
| ENF-15.5 | Un test de fuite mesure `performance.memory` après 200 diffusions (A-16b) |

---

## 2.8 Sécurité

| ID | Règle |
|---|---|
| ENF-25 | Résolution `realpath` + vérification de préfixe avant toute lecture de fichier |
| ENF-31 | `Origin` == `Host` à l'upgrade WebSocket |
| ENF-32 | Jeton LAN de 4 caractères, requis pour tout accès depuis une origine différente de `localhost` |
| ENF-34 | Aucune télémétrie, aucun identifiant unique transmis |
| SEC-1 | Le HTML d'annotation est assaini côté **serveur** avant stockage, pas seulement côté client |
| SEC-2 | Les noms de fichiers sur disque sont des `id` ou des SHA : jamais le nom saisi |
| SEC-3 | Le mot de passe obs-websocket n'est jamais persisté (EF-08.19) |
| SEC-4 | Le téléchargement du catalogue vérifie l'empreinte annoncée avant écriture (EF-27) |
| SEC-5 | Avertissement permanent dans `LISEZ-MOI.txt` et sur la page Diagnostic : ne pas exposer le port sur Internet (ENF-33) |

---

## 2.9 Tests

| Niveau | Outil | Couverture |
|---|---|---|
| Syntaxe | script dédié | chaque bloc `<script>` de chaque page HTML |
| Unitaires | `node --test` | modules métier purs : parseurs, découpage, viewport, registre de sorties, stockage, sauvegarde |
| Intégration API | `node --test` + `node:http` | serveur démarré sur port éphémère, routes testées une à une |
| Intégration navigateur | Playwright | parcours P0 : saisie Bible, diffusion, matrice de liens, éditeur |
| Rendu | Playwright + capture | comparaison éditeur vs sortie (A-10) |
| Hors-ligne | Playwright avec réseau coupé | A-01 |

**EF-04.12** — Une seule commande : `npm test`.
**EF-04.13** — Les tests d'intégration navigateur sont **séparés** (`npm run test:browser`)
car ils exigent Chromium ; `npm test` doit passer sans navigateur.

> **Référence** : la branche V2 actuelle contient 17 fichiers de tests
> (`openpresenter2/tests/`) et la V1 en contient 3 (`check-syntax.sh`,
> `test-live-mutex.mjs` — 14 assertions vérifiées ce jour —, `test-integration.mjs`).
> Les deux suites sont fusionnées.

---

## 2.10 Ce que l'architecture interdit explicitement

| Interdiction | Motif |
|---|---|
| Toute URL absolue vers un hôte externe hors `/api/catalog` | ENF-01 |
| Toute écriture dans IndexedDB comme source de vérité | D-02 |
| Tout framework SPA avec étape de build | simplicité, audit V1 : « pas de build, pas de framework SPA » |
| Toute dépendance npm au runtime du serveur | installation |
| Tout duplicata du moteur de rendu | ENF-42 |
| Tout stockage de chemin absolu de la machine d'origine | INV-2 |
| Toute installation silencieuse | EF-03.8 |
