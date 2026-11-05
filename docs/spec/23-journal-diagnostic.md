# 23 — Journal, diagnostic et intégrité

> **Exigences couvertes :** EF-28, EF-30, EF-01.15, ENF-23, ENF-34, P8
> **Maquettes :** MAQ-10 (diagnostic), MAQ-02 (console du lanceur) — la page Diagnostic
> reprend exactement la grammaire visuelle de la console du lanceur.
> **URL :** `/diagnostic.html`
> **Principe concerné :** P8 — *« quand ça casse, on doit comprendre en 30 secondes »*.

---

## 23.1 À quoi sert cet écran

Trois publics, trois usages, un seul écran :

| Public | Question posée | Réponse attendue |
|---|---|---|
| Le bénévole en régie | « Pourquoi la sortie est noire ? » | une ligne rouge, en français, avec un bouton de correction |
| Le responsable technique | « Est-ce que tout est prêt pour dimanche ? » | la liste verte complète, sans rien lire |
| Le développeur (par téléphone) | « Envoie-moi le rapport » | un bouton `Copier le rapport` qui produit un texte exploitable |

**EF-30.1** — La page Diagnostic est accessible **sans le studio** :
- depuis l'accueil, lien `Diagnostic` (zone 4) ;
- depuis le studio, `Ctrl+Maj+D` ;
- par URL directe `/diagnostic.html` ;
- depuis la console du lanceur : toute erreur fatale affiche cette URL.

**EF-30.2** — Elle fonctionne **même si le projet est illisible** : c'est le seul écran qui
n'a besoin que du serveur (voir 23.7, mode secours).

**EF-30.3** — Aucune information de cette page ne part sur le réseau. Le rapport est
copié dans le presse-papiers ou téléchargé, jamais envoyé (ENF-34).

---

## 23.2 Disposition normative

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Accueil        DIAGNOSTIC                       [⟳ Revérifier] [⧉ Copier] │
│ Projet : ICC Pahou · 3 bibles · 84 chants        Vérifié il y a 2 s         │
├────────────────────────────────────────────────────────────────────────────┤
│  ✔ 12 contrôles sur 13 réussis                        ● 1 avertissement     │
│                                                                            │
│  SERVEUR                                                                   │
│  ✔ Serveur local                      en marche · port 8788 · 41 min       │
│  ✔ Port disponible                    8788 libre pour la prochaine session  │
│  ✔ Dossier du projet                  inscriptible · 128,4 Go libres        │
│  ✔ Version du format                  3 (à jour)                           │
│  ✔ Runtime Node.js                    v22.11.0                             │
│                                                                            │
│  DIFFUSION                                                                 │
│  ⚠ Sorties connectées                 1 sur 3 — « Bas centré » sans client  │
│                                       [Ouvrir le lien] [Copier les 3 liens] │
│  ✔ Contenu à l'antenne                Jean 3:16 · 2 sorties                │
│  ✔ Horloge système                    écart < 1 s                          │
│  ✔ WebSocket                          latence médiane 3 ms                 │
│                                                                            │
│  DONNÉES                                                                   │
│  ✔ Intégrité du projet                0 orphelin · 2 miniatures manquantes  │
│  ⚠ Dernière sauvegarde               il y a 6 jours (auto désactivée)      │
│  ✔ Index de recherche                à jour · 31 102 versets · 84 chants   │
│                                                                            │
│  ENVIRONNEMENT                                                             │
│  ✔ Navigateur                         Chrome 141 — supporté                │
│  ✔ Réseau local                       192.168.1.24 · jeton 4F2K            │
│  ⚠ Accès Internet                      désactivé par réglage (catalogue)   │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│  Ne exposez jamais ce port sur Internet. Ce logiciel est conçu pour un      │
│  réseau local de confiance.                                                │
└────────────────────────────────────────────────────────────────────────────┘
```

**EF-30.4** — Chaque contrôle tient sur **une ligne** : symbole, nom, valeur constatée.
Le détail (chemin, pile d'appel, code d'erreur) est derrière un `▸` qui déplie un bloc
`<pre>` de 6 lignes maximum.

**EF-30.5** — L'ordre des sections est **fixe** : Serveur, Diffusion, Données,
Environnement. Il ne dépend ni du résultat des contrôles ni de l'ordre d'exécution.

**EF-30.6** — Un contrôle n'est jamais supprimé de la page parce qu'il échoue : il passe
en rouge avec la raison et l'action.

---

## 23.3 Les treize contrôles

Chaque contrôle a un identifiant `DIAG-nn`, un état (`ok`, `warn`, `err`, `na`), une
valeur affichée et une action.

### 23.3.1 Serveur

| ID | Nom affiché | Vert | Orange | Rouge | Action |
|---|---|---|---|---|---|
| **DIAG-01** | `Serveur local` | réponse `/api/health` < 500 ms | réponse > 500 ms | aucune réponse | `Relancer` (ouvre la console du lanceur) |
| **DIAG-02** | `Port disponible` | port actuel unique | port occupé par un autre programme mais serveur actif | port déjà pris par **deux** serveurs | `Voir le journal` |
| **DIAG-03** | `Dossier du projet` | lecture + écriture testées par un fichier `.probe` supprimé aussitôt | lecture seule | absent ou illisible | `Ouvrir le dossier` · `Choisir un autre dossier` |
| **DIAG-04** | `Version du format` | `formatVersion` = version de l'application | `formatVersion` < version de l'application (migration possible) | `formatVersion` > version de l'application | `Migrer` (avec sauvegarde préalable) |
| **DIAG-05** | `Runtime Node.js` | ≥ 20, LTS | 18 ≤ v < 20 | < 18 | `Télécharger Node.js` (ouvre nodejs.org — seul cas d'ouverture réseau, et uniquement sur clic) |

**EF-30.7** — `DIAG-05` affiche **uniquement** le numéro de version, jamais le chemin de
l'exécutable (P8 : pas de détail technique au premier niveau).

### 23.3.2 Diffusion

| ID | Nom affiché | Calcul | État |
|---|---|---|---|
| **DIAG-06** | `Sorties connectées` | pages de sortie ayant un WebSocket ouvert dans les 10 dernières secondes, sur le total des sorties activées | `ok` si total ; `warn` si 0 < n < total ; `err` si 0 alors qu'une diffusion est en cours |
| **DIAG-07** | `Contenu à l'antenne` | dernier `show` par sortie, âge et `kind` | `ok` si cohérent ; `warn` si deux sorties affichent des contenus différents depuis > 30 s |
| **DIAG-08** | `Horloge système` | écart entre l'heure du serveur et l'heure fournie par le client | `warn` si > 2 s, `err` si > 30 s (les minuteurs seraient faux) |
| **DIAG-09** | `WebSocket` | médiane des aller-retours de `ping` sur 10 mesures | `ok` < 50 ms ; `warn` < 250 ms ; `err` ≥ 250 ms ou canal fermé |

**EF-30.8** — `DIAG-06` liste **nommément** les sorties sans client :
`TXT: Bas centré — aucun client connecté`, avec deux boutons par sortie :
`Ouvrir le lien` (ouvre un onglet local) et `Copier le lien`.

**EF-30.9** — Un client déconnecté depuis **plus de 10 s** n'est plus compté comme
connecté, mais apparaît dans une ligne `Dernière connexion : il y a 12 s`.

### 23.3.3 Données

| ID | Nom affiché | Source | Détail déplié |
|---|---|---|---|
| **DIAG-10** | `Intégrité du projet` | `GET /api/integrity` | nombre d'assets orphelins, manquants, de `.tmp-*`, de références cassées |
| **DIAG-11** | `Dernière sauvegarde` | `backups/auto-*.zip` le plus récent | nom du fichier, taille, nombre de sauvegardes conservées |
| **DIAG-12** | `Index de recherche` | `cache/search-index.json` : horodatage, nombre d'entrées | écart entre les objets sur disque et les entrées indexées |

**EF-30.10** — `DIAG-10` en orange propose `Ouvrir l'outil d'intégrité` (23.5).
**EF-30.11** — `DIAG-11` en orange propose `Sauvegarder maintenant` ; s'il n'existe
**aucune** sauvegarde, le contrôle est rouge avec
`TXT: Aucune sauvegarde. Vos données ne tiennent qu'à ce dossier.`
**EF-30.12** — `DIAG-12` en orange propose `Reconstruire l'index` ; la reconstruction est
lancée par le serveur et l'écran affiche un pourcentage.

### 23.3.4 Environnement

| ID | Nom affiché | Règle |
|---|---|---|
| **DIAG-13a** | `Navigateur` | vert : Chrome/Edge ≥ 110, Firefox ≥ 110, Safari ≥ 16. Rouge : tout autre, ou version antérieure, avec `TXT: Navigateur non pris en charge. Utilisez Chrome, Edge, Firefox ou Safari à jour.` |
| **DIAG-13b** | `Réseau local` | adresse(s) IPv4 privée(s) + port + jeton, ou `TXT: Aucune adresse réseau — ce poste n'est pas connecté à un réseau local.` |
| **DIAG-13c** | `Accès Internet` | `ok` si le réglage catalogue est activé et la sonde a réussi ; `na` grisé `TXT: Désactivé par réglage` si le catalogue est désactivé (état par défaut) |

**EF-30.13** — `DIAG-13c` ne sonde **jamais** Internet sans action de l'utilisateur : la
valeur par défaut est `Désactivé par réglage`, sans requête (ENF-01).

> Le décompte affiché en tête (« 12 contrôles sur 13 ») additionne les lignes, pas les
> identifiants : 13a, 13b et 13c comptent pour trois.

---

## 23.4 Rafraîchissement et états de la page

| Situation | Comportement |
|---|---|
| Ouverture | tous les contrôles exécutés en parallèle, résultats affichés **au fur et à mesure** |
| Contrôle en cours | ligne grise avec un point animé et `Vérification…` (jamais un écran vide) |
| Rafraîchissement automatique | toutes les **10 s** tant que la page est visible ; suspendu quand l'onglet est caché |
| `⟳ Revérifier` | relance immédiate, le bouton passe en `Vérification…` et est désactivé pendant l'exécution |
| Perte du serveur pendant l'affichage | toutes les lignes passent en gris `Inconnu — serveur injoignable`, la page **ne se ferme pas** |
| Projet illisible | bandeau rouge `TXT: Le dossier du projet est illisible.` + bouton `Mode secours` (23.7) |
| Retour du serveur | reprise automatique du rafraîchissement, sans rechargement de page |

**EF-30.14** — Un contrôle qui échoue n'empêche jamais les autres de s'exécuter.
**EF-30.15** — Le temps de la vérification complète est affiché : `Vérifié il y a 2 s`.
**EF-30.16** — Aucun contrôle ne dure plus de **3 s** ; au-delà, il affiche
`Délai dépassé` et l'action `Réessayer`.

---

## 23.5 Intégrité du projet

Écran `/diagnostic.html#integrite`, également ouvert par `DIAG-10`.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ INTÉGRITÉ DU PROJET — ICC Pahou                       [Analyser à nouveau] │
├──────────────────────────────────────────────────────────────────────────┤
│ Assets orphelins (référencés par personne)          3 fichiers   1,4 Go    │
│   media/9f2c8e1a.mp4 · media/1b77c0de.mp4 · …        [Supprimer]          │
│ Assets manquants (référencés, introuvables)         0                     │
│ Références cassées (scène ou profil supprimé)       2   scn_old, prof_x   │
│   …                                                                        │
│ Miniatures manquantes                              12   [Régénérer]        │
│ Index de recherche                                 obsolète [Reconstruire] │
│ Fichiers temporaires abandonnés                     0                     │
│ Doublons de chants (même titre)                     1   « Grâce infinie »  │
│                                                                           │
│ Aucune action n'est automatique. Chaque suppression demande confirmation.  │
└──────────────────────────────────────────────────────────────────────────┘
```

**EF-01.15** — Toute action affiche d'abord le nombre d'éléments et l'espace concernés.
**EF-01.16** — Les actions sont **individuelles** : aucun bouton « Tout nettoyer ».
**EF-01.17** — « Supprimer » un asset orphelin déplace le fichier dans
`project/backups/orphelins-<date>/` au lieu de l'effacer, pendant 30 jours.
**EF-01.18** — Les doublons de chants ne sont **jamais** fusionnés automatiquement : la
ligne ouvre la comparaison côte à côte et propose `Fusionner` ou `Ignorer`.

### 23.5.1 Confirmation de suppression

```
TXT: Supprimer 3 fichiers orphelins ?

     1,4 Go seront libérés. Les fichiers seront déplacés dans
     backups/orphelins-2026-10-21/ et conservés 30 jours.

     [S] Supprimer      [A] Annuler
```

**EF-01.19** — Le bouton `Supprimer` est le bouton **secondaire** ; `Annuler` est
pré-sélectionné (action destructive).

---

## 23.6 Copier le rapport

Le bouton `⧉ Copier` produit un texte brut, stable, destiné à être collé dans un message.

**EF-30.17** — Le rapport suit **exactement** ce format, dans cet ordre, sans couleur :

```
OpenPresenter — rapport de diagnostic
Généré le 2026-10-21 à 18:04:12 (Africa/Lagos)
Version 3.0.0 · format 3 · projet prj_7f3c1a9e2b4d
Système : Linux 6.8 · Node v22.11.0 · Chrome 141

[SERVEUR]
DIAG-01 ok   Serveur local : en marche, port 8788, 41 min
DIAG-02 ok   Port disponible : 8788
DIAG-03 ok   Dossier du projet : inscriptible, 128,4 Go libres
DIAG-04 ok   Version du format : 3
DIAG-05 ok   Runtime Node.js : v22.11.0

[DIFFUSION]
DIAG-06 warn Sorties connectées : 1/3 — out_bottom sans client
DIAG-07 ok   Contenu à l'antenne : Jean 3:16, 2 sorties
DIAG-08 ok   Horloge système : écart 0,2 s
DIAG-09 ok   WebSocket : 3 ms

[DONNÉES]
DIAG-10 ok   Intégrité : 0 orphelin, 0 manquant, 12 miniatures absentes
DIAG-11 warn Dernière sauvegarde : il y a 6 jours
DIAG-12 ok   Index de recherche : à jour, 31 102 versets, 84 chants

[ENVIRONNEMENT]
DIAG-13a ok  Navigateur : Chrome 141
DIAG-13b ok  Réseau local : 192.168.1.24:8788, jeton 4F2K
DIAG-13c na  Accès Internet : désactivé par réglage

[ERREURS RÉCENTES]
18:03:41 WARN  output: no client on out_bottom
17:58:02 ERROR catalog: network disabled by settings

Fin du rapport.
```

**EF-30.18** — Le rapport ne contient **aucun** chemin absolu, aucun nom d'utilisateur
système, aucune adresse MAC, aucun contenu de chant ou de verset (seulement des noms de
ressources et des identifiants).
**EF-30.19** — Il contient les **20 dernières** entrées de niveau `WARN` ou `ERROR`.
**EF-30.20** — Le bouton affiche `Copié` pendant 2 s ; si le presse-papiers est refusé par
le navigateur, un `<textarea>` sélectionné s'ouvre avec
`TXT: Copie automatique impossible — sélectionnez tout (Ctrl+A) et copiez.`

**EF-30.21** — Un second bouton `⤓ Enregistrer` télécharge
`openpresenter-diagnostic-2026-10-21-1804.txt` (même contenu, UTF-8, fins de ligne `\n`).

---

## 23.7 Mode secours

Déclenché quand `project.json` est absent, illisible, ou d'une version supérieure.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  MODE SECOURS                                                            │
│                                                                          │
│  Le dossier du projet n'a pas pu être ouvert.                            │
│  Raison : project.json est illisible (ligne 1, colonne 1).                │
│                                                                          │
│  Vos fichiers sont probablement intacts : bibles, chants et médias sont    │
│  des fichiers séparés.                                                    │
│                                                                          │
│  [R] Restaurer la dernière sauvegarde       backups/auto-2026-10-15.zip   │
│  [O] Ouvrir un autre dossier de projet                                   │
│  [C] Créer un projet vide (les fichiers existants ne sont pas touchés)    │
│  [J] Voir le journal complet                                             │
│                                                                          │
│  Rien ne sera modifié sans votre confirmation.                            │
└──────────────────────────────────────────────────────────────────────────┘
```

**EF-30.22** — En mode secours, **aucune** écriture n'est possible : le serveur répond
`503 LOCKED` à toute route `PUT`/`POST`/`DELETE`.
**EF-30.23** — `[R]` restaure dans un dossier temporaire, vérifie, puis demande
confirmation avant remplacement ; l'ancien `project.json` est conservé en `.bak`.
**EF-30.24** — Le mode secours est aussi atteignable par l'URL `/diagnostic.html` : c'est
la seule page servie si `project.json` est illisible.

---

## 23.8 Le journal

### 23.8.1 Fichiers

| Fichier | Écrit par | Contenu |
|---|---|---|
| `project/logs/session-AAAA-MM-JJ.log` | serveur | journal structuré de la session |
| `project/logs/launch-AAAA-MM-JJ.log` | lanceur | console du lanceur (03-lanceur.md) |
| `project/logs/migration-AAAA-MM-JJ.log` | migration | éléments importés, ignorés, en erreur |

**EF-28.1** — Un fichier par jour ; un nouveau fichier est créé à minuit local sans
interrompre le serveur.
**EF-28.2** — Rotation : les fichiers de plus de **30 jours** sont supprimés au lancement ;
au-delà de **50 Mo** au total, les plus anciens partent d'abord.
**EF-28.3** — Le journal est **toujours** en UTF-8, une ligne JSON par évènement :

```jsonc
{ "ts": "2026-10-21T18:04:12.481Z", "level": "warn", "event": "output.no_client",
  "msg": "no client on out_bottom", "ctx": { "outputId": "out_bottom" }, "pid": 4211 }
```

**EF-28.4** — Champs obligatoires : `ts`, `level`, `event`, `msg`. `ctx` est facultatif et
ne contient **jamais** de contenu de chant, de verset, de texte d'annonce, de chemin
absolu, ni de jeton LAN.
**EF-28.5** — Niveaux : `debug`, `info`, `warn`, `error`. Le niveau `debug` n'est écrit que
si `OPENPRESENTER_VERBOSE=1` (variable du lanceur) ou si le réglage
`settings.verboseLog` est vrai.

### 23.8.2 Évènements journalisés (liste fermée)

| Domaine | `event` | Niveau |
|---|---|---|
| Démarrage | `server.start`, `server.ready`, `server.port.conflict`, `server.shutdown` | info / warn |
| Projet | `project.open`, `project.lock.acquired`, `project.lock.stale`, `project.lock.conflict`, `project.readonly`, `project.format.migrated` | info / warn / error |
| Assets | `asset.import`, `asset.dedup`, `asset.too_large`, `asset.write_failed`, `asset.missing`, `asset.orphan.purged` | info / warn / error |
| Écriture | `write.retry`, `write.failed`, `write.conflict`, `write.tmp_orphan_removed` | warn / error |
| Bible | `bible.import`, `bible.parse_error`, `bible.quickentry.invalid`, `bible.split.applied` | info / warn |
| Chants | `song.import`, `song.edit_note`, `song.parse_error` | info / warn |
| Diffusion | `show.sent`, `show.no_target`, `output.no_client`, `output.connected`, `output.disconnected`, `clear.all`, `nav.part`, `nav.verse` | info / warn |
| Plan | `plan.advance`, `plan.back`, `plan.restored` | info |
| Minuteurs | `timer.start`, `timer.threshold`, `timer.end` | info |
| Sauvegarde | `backup.done`, `backup.failed`, `restore.done`, `restore.partial` | info / warn / error |
| Migration | `migrate.analyze`, `migrate.run`, `migrate.item_skipped`, `migrate.done` | info / warn |
| Catalogue | `catalog.disabled`, `catalog.fetch.start`, `catalog.fetch.done`, `catalog.fetch.checksum_failed`, `catalog.fetch.timeout` | info / warn / error |
| Sécurité | `auth.token_failed`, `ws.origin_rejected` | warn |
| Interface | `ui.error`, `ui.module_crash` | error |

**EF-28.6** — Un évènement non listé ici est un défaut : la liste est fermée et versionnée
avec le format (`formatVersion`).
**EF-28.7** — Chaque évènement de niveau `error` produit **aussi** un toast dans
l'interface (EF-06.33) et est copiable.

### 23.8.3 Consultation

Depuis le studio : module **Réglages → Journal** ; depuis le diagnostic :
`Voir le journal complet`.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Journal · dernier 1 jour        [Tous niveaux ▾] [Rechercher…]  [⤓ Exporter]│
├──────────────────────────────────────────────────────────────────────────┤
│ 18:04:12  WARN   output.no_client    Bas centré : aucun client connecté   │
│ 18:03:41  INFO   show.sent           Jean 3:16 → 2 sorties               │
│ 17:58:02  ERROR  catalog.fetch.timeout  Délai dépassé (8 s)              │
│ …                                                                        │
│ 1 248 entrées · 412 Ko          [Purger les entrées de plus de 7 jours]   │
└──────────────────────────────────────────────────────────────────────────┘
```

**EF-28.8** — Filtres : niveau, période (1 h, 1 j, 7 j, 30 j), texte libre (sur `event`,
`msg` et les valeurs de `ctx`).
**EF-28.9** — La recherche est insensible à la casse et aux accents.
**EF-28.10** — `⤓ Exporter` produit un `.jsonl` des entrées filtrées.
**EF-28.11** — `Purger` demande confirmation, affiche le nombre d'entrées et ne touche
jamais au fichier du jour.
**EF-28.12** — Le journal n'est **jamais** supprimé automatiquement en totalité : il
survit au redémarrage et à la mise à jour du logiciel.

---

## 23.9 Sécurité et vie privée

| ID | Règle |
|---|---|
| **ENF-34** | Aucune télémétrie, aucune requête sortante, aucun identifiant unique ; le rapport et le journal restent sur le disque |
| **EF-28.13** | Le jeton LAN n'apparaît dans le journal que sous la forme `****` |
| **EF-28.14** | Le mot de passe obs-websocket n'est jamais journalisé (SEC-3) |
| **EF-28.15** | Les chemins sont journalisés **relativement** à `project/` ; en cas de besoin d'un chemin absolu (asset `linked`), seul le nom du fichier apparaît |
| **EF-28.16** | Le journal est accessible en lecture seule depuis l'interface : aucune modification manuelle n'est proposée |

---

## 23.10 Tests d'acceptation liés

| Test | Scénario | Attendu |
|---|---|---|
| **A-18** | Diagnostic complet, tout est normal | 13 lignes vertes, rapport copiable conforme à EF-30.17 |
| **A-18b** | Débrancher une sortie | `DIAG-06` orange en < 10 s, sortie nommée, bouton `Copier le lien` |
| **A-18c** | Rendre `project.json` illisible | mode secours, aucune écriture possible, restauration proposée |
| **A-18d** | Supprimer `cache/` puis ouvrir le diagnostic | `DIAG-12` orange, reconstruction < 3 s, retour au vert |
| **A-18e** | 200 diffusions puis `DIAG-09` | pas de fuite de sockets, latence < 50 ms |
| **A-18f** | Chercher un mot dans le journal | résultat en < 3 s sur 30 jours de journal |
| **A-18g** | Purger les entrées de plus de 7 jours | confirmation chiffrée, fichier du jour intact |
| **A-18h** | Rapport de diagnostic | aucun chemin absolu, aucun jeton, aucune adresse MAC (grep sur le texte) |
| **A-18i** | Coupure du serveur pendant l'affichage | lignes grises, page conservée, reprise automatique |
| **A-18j** | `Ctrl+Maj+D` depuis le studio | diagnostic ouvert en < 300 ms |
