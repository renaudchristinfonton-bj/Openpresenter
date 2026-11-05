# Phase 0 — le socle est en place

> **État : livré et vérifié par 62 tests automatisés** (`npm test`), `npm run schema:check`,
> `npm run trace:check`. Rien ici n'est déclaré fait sans avoir été exécuté.

Le cahier des charges ([`CAHIER-DES-CHARGES.md`](../CAHIER-DES-CHARGES.md)) décrit
l'application complète. Ce document décrit ce qui existe maintenant : le **socle**
sur lequel la suite se construit — disque, API, assets, sauvegarde, migration, lanceur.

Le studio, les sorties et la Bible arrivent en phase 1 ([`spec/21-plan-livraison.md`](spec/21-plan-livraison.md)).

---

## 1. Ce qui fonctionne

| Domaine | Ce qui existe | Fichier |
|---|---|---|
| **Dossier = projet** | arborescence normative créée au premier lancement, `project.json` versionné, verrou de projet, reprise de session | `app/src/core/project.mjs` |
| **Écriture sûre** | écriture atomique (fichier temporaire → `fsync` → `rename`), sérialisation par fichier, nettoyage des `.tmp-`, JSON à clés triées | `app/src/core/json-store.mjs` |
| **Assets** | import en flux, empreinte SHA-256 calculée sans charger le fichier entier, déduplication, comptage des références, orphelins déplacés (pas supprimés) | `app/src/core/assets.mjs` |
| **Objets métier** | bibles, chants, looks, annonces, minuteurs, habillages, scènes, profils, organisations, événements — un fichier par objet, contrôle de révision | `app/src/core/library.mjs` |
| **Sauvegarde / export** | archive ZIP écrite à la main (méthode *store*), `manifest.json` avec empreinte par fichier, restauration « remplacer » ou « fusionner », refus des archives d'un format futur | `app/src/core/exporter.mjs`, `app/src/core/zip.mjs` |
| **Migration V1** | analyse avant écriture, rapport chiffré, migration idempotente du dump réel `openpresenter-sauvegarde-2026-08-09.json` (9 chants, 1 vidéo de fond) | `app/src/migration/v1.mjs` |
| **Serveur** | API REST sur `node:http`, WebSocket écrit à la main, jeton LAN, origine vérifiée, chemins confinés, journal JSONL, diagnostic consolidé | `app/server.mjs`, `app/src/core/ws.mjs`, `app/src/core/log.mjs` |
| **Lanceur** | `OpenPresenter.sh` / `.command` / `.bat` → `app/launcher/launch.mjs` : détection du runtime, choix du port, attente de `/api/health`, ouverture du navigateur, arrêt propre | `app/launcher/`, `OpenPresenter.*` |
| **Outils** | validateur JSON Schema maison (16 schémas de l'annexe 24) et contrôle de traçabilité T1→T16 | `app/src/core/validate.mjs`, `app/tools/` |

---

## 2. Comment lancer

```bash
./OpenPresenter.sh        # Linux / macOS : OpenPresenter.command
# Windows : double-clic sur OpenPresenter.bat
```

Le lanceur affiche l'adresse locale, ouvre le navigateur et écrit son journal dans
`project/logs/launch-<date>.log`. La page d'accueil actuelle est **l'état du socle** :
contrôles de diagnostic, sauvegarde, export, intégrité, journal.

Options utiles :

| Variable | Effet |
|---|---|
| `PORT` | impose le port (sinon 8788, mémorisé dans `project.json`) |
| `OPENPRESENTER_PROJECT` | utilise un autre dossier de projet |
| `OPENPRESENTER_NO_BROWSER=1` | n'ouvre pas le navigateur |
| `OPENPRESENTER_READONLY=1` | force le mode lecture seule |
| `OPENPRESENTER_VERBOSE=1` | journal détaillé |

---

## 3. Tests de recette couverts

`npm test` — 62 tests, 0 échec.

| Test du CDC | Vérification automatisée |
|---|---|
| **A-01** hors-ligne absolu | aucune ressource externe dans `app/web/`, aucune connexion sortante dans le code, en-têtes `no-store` |
| **A-02** un double-clic | démarrage complet, URL affichée, journal du lanceur, code de sortie, refus d'un Node trop ancien (`70`), scripts < 80 lignes |
| **A-02d** double lancement | un seul serveur, second lancement sort en `0`, verrou unique |
| **A-02e** chemin accentué | projet dans `Clé USB - L'Église du Plateau / culte`, journal sans caractère corrompu |
| **A-02f** lecture seule | `403 READ_ONLY` sur toute écriture, lecture intacte |
| **A-03** dossier = projet | **test fondateur** : copie intégrale du dossier, relecture de tous les objets, aucun chemin absolu |
| **A-03b** migration | dump V1 réel : 9 chants restitués ligne à ligne, média de 2,5 Mo, analyse sans écriture, double exécution sans doublon |
| **A-04** copie à l'import | fichier source supprimé, média toujours servi, aucune trace de `/tmp/` |
| **A-05** déduplication | un seul binaire, `refs: 2`, noms d'origine alternatifs mémorisés |
| **A-13** export complet | restauration dans un dossier vierge : chants, looks, sorties, binaires identiques |
| **A-13b** fusion | deux restaurations successives, zéro doublon |
| **A-13c** média manquant | archive refusée, aucune écriture, données d'origine intactes |
| **A-13d** format futur | `FORMAT_TOO_RECENT`, dossier inchangé |
| **A-13e** archive partielle | archive tronquée refusée, jamais interprétée à moitié |
| **A-18** diagnostic | 10 lignes présentes, 0 erreur, **aucun chemin absolu, jeton ni adresse MAC** dans le rapport |
| **A-18d** cache supprimé | `DIAG-12` orange, reconstruction < 3 s, retour au vert |
| **A-18k** orphelins | confirmation chiffrée, fichiers déplacés dans `backups/orphelins-<date>/` |
| **A-09e** resynchronisation | WebSocket : une sortie qui se reconnecte reçoit le dernier état affiché |

Les blocs B à F (Bible, sorties, studio, organisation, réseau) demandent le navigateur :
ils seront couverts par les tests Playwright des phases suivantes.

---

## 4. Points de contrat respectés

- **0 dépendance npm** au runtime — `package.json` n'en déclare aucune (T8).
- **0 appel réseau obligatoire** — le catalogue est la seule route sortante, désactivée par
  défaut (`settings.catalogEnabled = false`), et renvoie `503 OFFLINE` sinon.
- **0 stack trace brute** — toute erreur sort en `{error: {code, message}}` avec un code
  stable (`VALIDATION`, `CONFLICT`, `NOT_FOUND`, `READ_ONLY`, `FORMAT_TOO_RECENT`…).
- **Chemins confinés** — les archives sont relues avec refus de `..`, `/`, `C:\` (test dédié),
  les fichiers statiques sont résolus sous `app/web/`.

---

## 5. Ce qu'il reste à faire (phases suivantes)

1. **Phase 1 — cœur** : éditeur de scène WYSIWYG, rendu partagé régie/sortie, découpage Bible
   (A-07), navigation clavier (A-06, A-08), matrice de liens des sorties (A-09).
2. **Phase 2 — organisation** : import de bibles XML, gestion de chants, profils, événements.
3. **Phase 3 — compléments** : PPTX, minuteurs, habillages, annonces.
4. **Phase 4 — réseau** : vue scène, télécommande, tests P-01→P-10.

Dettes assumées et documentées :

- l'accueil (`app/web/index.html`) est une page d'état, pas encore le studio ;
- `app/launcher/install.mjs` (téléchargement de Node avec vérification SHA-256) n'existe pas
  encore : le lanceur détecte et explique, il n'installe pas ;
- les schémas sont lus depuis l'annexe 24 à chaque contrôle ; une extraction vers
  `app/schemas/` viendra quand la validation sera branchée sur chaque route d'écriture.
