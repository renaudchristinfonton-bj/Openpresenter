# 03 — Lanceur universel

> **Exigences couvertes :** EF-03, EF-04, EF-30, ENF-10, ENF-30 → ENF-34, principe P3
> **Décision appliquée :** D-01 — runtime **détecté**, installation automatique si possible,
> instructions explicites sinon.
> **Maquettes :** MAQ-02 (console du lanceur)

---

## 3.1 Le contrat du lanceur

Le lanceur est **le** point d'entrée. Un utilisateur qui ne lit jamais la documentation
doit réussir son culte en ayant fait exactement **un** geste : double-cliquer.

| ID | Exigence |
|---|---|
| EF-03.1 | Un fichier de lancement par plateforme, à la **racine** du dossier du projet : `OpenPresenter.bat`, `OpenPresenter.command`, `OpenPresenter.sh` |
| EF-03.2 | Le lanceur fonctionne **quel que soit le répertoire courant** du shell |
| EF-03.3 | Le lanceur fonctionne si le dossier est sur une clé USB, un disque réseau, ou un chemin contenant espaces et accents |
| EF-03.4 | Le lanceur n'écrit **jamais** hors du dossier du projet, sauf dans le répertoire temporaire système pour les téléchargements |
| EF-03.5 | Le lanceur est **idempotent** : le relancer alors que le serveur tourne ne crée pas de doublon |
| EF-03.6 | Toute sortie console est **dupliquée** dans `project/logs/launch-<AAAA-MM-JJ>.log` |
| EF-03.7 | Aucune stack trace brute n'est affichée à l'utilisateur ; les détails vont dans le journal |
| EF-03.8 | Le lanceur n'installe **jamais** rien sans accord explicite de l'utilisateur |
| EF-03.9 | Le lanceur ouvre le **navigateur par défaut** sur la page d'accueil une fois le serveur prêt |
| EF-03.10 | Si le navigateur ne peut pas être ouvert, l'URL est affichée en gros avec un bouton « copier » équivalent (sélection facile) |
| EF-03.11 | La fenêtre du lanceur reste ouverte pendant toute la durée d'utilisation ; sa fermeture arrête le serveur proprement |

---

## 3.2 Fichiers et arborescence attendue

```
OpenPresenter.bat            ← Windows
OpenPresenter.command        ← macOS
OpenPresenter.sh             ← Linux
app/                         ← l'application (ne pas modifier)
├── server.mjs
├── launcher/
│   ├── detect.mjs           ← logique de détection partagée (Node)
│   ├── install.mjs          ← logique d'installation partagée
│   └── messages.json        ← tous les textes affichés (une seule source)
├── web/
└── vendor/
project/                     ← créé au 1er lancement
runtime/                     ← créé par le lanceur s'il installe un runtime
LISEZ-MOI.txt
```

**EF-03.12** — Les trois scripts shell sont des **coquilles fines** (< 80 lignes) : ils
résolvent le dossier, affichent l'en-tête, puis délèguent à `app/launcher/detect.mjs`
dès qu'un runtime est disponible, ou à leur logique native sinon. Aucune règle métier
n'est dupliquée entre les trois plateformes.

**EF-03.13** — Les textes affichés vivent dans `app/launcher/messages.json`, avec les clés
`fr` et `en`. Aucun texte n'est codé en dur dans les scripts shell.

---

## 3.3 Séquence de démarrage — spécification pas à pas

### Étape 0 — Résolution du dossier

| Plateforme | Mécanisme |
|---|---|
| Windows | `cd /d "%~dp0"` |
| macOS / Linux | `cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"` |

**⚠ ERREUR** — dossier introuvable ou illisible :
```
TXT: Impossible d'accéder au dossier du projet.
     Vérifiez que le dossier n'a pas été déplacé ou supprimé, puis relancez.
```
Code de sortie `10`.

---

### Étape 1 — En-tête

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║    OpenPresenter                                         ║
║    Suite de régie live — Bible, chants, médias           ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  Dossier : D:\OpenPresenter
  Version : 3.0.0
  Vérifications en cours…
```

**EF-03.14** — L'en-tête affiche toujours le **chemin absolu résolu** du dossier, pour que
l'utilisateur sache immédiatement sur quel projet il travaille (cas des clés USB multiples).

---

### Étape 2 — Vérification du dossier de projet

| Contrôle | Si absent |
|---|---|
| `project/` existe | créé (arborescence complète, voir `04-projet-et-donnees.md`) |
| `project/project.json` existe | créé avec un `id` UUIDv4, `name` = nom du dossier, `version` du format |
| `project/` est inscriptible | mode lecture seule → voir 3.7 |

Message au premier lancement :
```
TXT: Première utilisation détectée.
     Le dossier « project » a été créé : il contiendra toutes vos données.
     Vous pourrez copier ce dossier pour emporter votre régie partout.
```

---

### Étape 3 — Détection du runtime

Ordre de recherche, **strict** :

| Priorité | Emplacement | Commande de test |
|---|---|---|
| 1 | `runtime/node` (installé par un lancement précédent) | `runtime/node -v` |
| 2 | Variable d'environnement `OPENPRESENTER_NODE` | `"$OPENPRESENTER_NODE" -v` |
| 3 | Runtime système dans le `PATH` | `node -v` |
| 4 | Emplacements usuels (voir ci-dessous) | test direct du binaire |
| 5 | **Aucun** → étape 4 (installation) | — |

Emplacements usuels testés en priorité 4 :

| Plateforme | Chemins |
|---|---|
| Windows | `%ProgramFiles%\nodejs\node.exe`, `%ProgramFiles(x86)%\nodejs\node.exe`, `%LOCALAPPDATA%\Programs\nodejs\node.exe`, `%APPDATA%\nvm\<version>\node.exe` |
| macOS | `/usr/local/bin/node`, `/opt/homebrew/bin/node`, `$HOME/.nvm/versions/node/*/bin/node` (version la plus récente), `$HOME/.volta/bin/node` |
| Linux | `/usr/bin/node`, `/usr/local/bin/node`, `$HOME/.nvm/versions/node/*/bin/node`, `$HOME/.volta/bin/node`, `/snap/bin/node` |

**EF-03.15** — Version minimale : **Node 20**. Un runtime plus ancien est **refusé**
(pas de tentative d'exécution), avec le message :
```
TXT: OpenPresenter nécessite Node.js 20 ou plus récent.
     Version détectée : v16.20.2  (emplacement : /usr/bin/node)
```

**EF-03.16** — Le lanceur affiche **toujours** le runtime retenu et son emplacement :
```
  ✓ Runtime    Node.js v22.11.0
               emplacement : runtime/node
```

**EF-03.17** — Si plusieurs runtimes sont trouvés, le **premier dans l'ordre** est utilisé
et les autres sont listés dans le journal uniquement (pas à l'écran).

---

### Étape 4 — Aucun runtime : proposition d'installation

C'est le cœur de la décision D-01. Le lanceur ne se contente pas d'afficher un lien.

#### 4.1 Diagnostic préalable

```
  ✗ Runtime    Node.js introuvable

     OpenPresenter a besoin de Node.js 20 ou plus récent.
     Nous pouvons l'installer pour vous dans ce dossier.

     Méthode proposée : téléchargement du binaire portable officiel
       source      https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip
       taille      29,1 Mo
       empreinte   SHA-256 3f2a1b… (vérifiée après téléchargement)
       destination runtime\  (dans le dossier du projet)
       connexion   Internet requise pour cette étape uniquement

     [O] Installer maintenant (recommandé)
     [M] M'indiquer la commande à taper moi-même
     [N] Ne rien faire — je vais installer Node.js puis relancer
```

**EF-03.18** — Le choix par défaut (touche `Entrée`) est **O**.

**EF-03.19** — Si aucune connexion Internet n'est détectée, l'option `O` est retirée et
remplacée par :
```
TXT: Aucune connexion Internet détectée : le téléchargement automatique
     n'est pas possible. Voir les instructions ci-dessous.
```

#### 4.2 Méthode par plateforme

| Plateforme | Méthode automatique | Repli |
|---|---|---|
| **Windows** | Téléchargement du ZIP portable officiel `node-v<ver>-win-x64.zip` → vérification SHA-256 → extraction de `node.exe` + `npm*` dans `runtime/` | `winget install OpenJS.NodeJS.LTS` si `winget` présent · `choco install nodejs-lts` si `choco` présent · sinon instructions |
| **macOS** | Téléchargement du TAR.GZ officiel `node-v<ver>-darwin-<arch>.tar.gz` → vérification SHA-256 → extraction dans `runtime/` (binaire **non signé**, voir 4.4) | `brew install node` si Homebrew présent · sinon instructions |
| **Linux** | Téléchargement du TAR.XZ officiel → vérification SHA-256 → extraction dans `runtime/` | Détection du gestionnaire et affichage de la commande exacte : `sudo apt install nodejs` / `sudo dnf install nodejs` / `sudo pacman -S nodejs` / `sudo zypper install nodejs` / `sudo apk add nodejs` · sinon instructions |

**EF-03.20** — L'empreinte SHA-256 attendue est stockée dans `app/launcher/runtimes.json`
avec l'URL, la version, l'architecture et la taille. **Aucun téléchargement n'est accepté
si l'empreinte ne correspond pas.**

**EF-03.21** — Le téléchargement affiche une progression réelle (pourcentage + Mo) et peut
être interrompu par `Ctrl+C` sans laisser de fichier partiel (écriture dans `.part` puis
renommage).

**EF-03.22** — Après installation, le lanceur **revérifie** le runtime installé
(`runtime/node -v`) avant de continuer.

#### 4.3 Instructions de repli (texte exact)

Windows, sans `winget` ni `choco` :
```
TXT: Installation manuelle de Node.js

     1. Ouvrez https://nodejs.org/fr dans votre navigateur
     2. Téléchargez la version « LTS » (Windows Installer .msi, 64-bit)
     3. Lancez l'installateur et acceptez les options par défaut
     4. Fermez cette fenêtre
     5. Double-cliquez à nouveau sur OpenPresenter.bat

     Alternative sans installation système :
       téléchargez l'archive « Windows Binary (.zip) », décompressez-la,
       puis copiez le fichier node.exe dans le dossier :
       D:\OpenPresenter\runtime\
```

macOS :
```
TXT: Installation manuelle de Node.js

     Option A — installateur :
       1. Ouvrez https://nodejs.org/fr
       2. Téléchargez la version « LTS » (macOS Installer .pkg)
       3. Lancez l'installateur
       4. Relancez OpenPresenter.command

     Option B — Homebrew (si installé) :
       brew install node

     Option C — sans installation système :
       téléchargez l'archive « macOS Binaries (.tar.gz) », décompressez-la,
       puis copiez le dossier bin/ dans :
       /Volumes/CLE/OpenPresenter/runtime/
```

Linux :
```
TXT: Installation manuelle de Node.js

     Votre système utilise « apt ». Tapez dans un terminal :

       sudo apt update && sudo apt install -y nodejs npm

     Puis vérifiez la version :

       node -v        (doit afficher v20 ou plus)

     Si la version est trop ancienne, utilisez NodeSource :

       curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
       sudo apt install -y nodejs

     Puis relancez ./OpenPresenter.sh
```

**EF-03.23** — Le gestionnaire de paquets affiché est celui **réellement détecté**, pas un
texte générique.

**EF-03.24** — Un bouton/lien « Ouvrir la page de téléchargement » ouvre le navigateur sur
`https://nodejs.org/fr` quand c'est possible.

#### 4.4 Cas macOS particulier : binaire non signé

Un binaire Node téléchargé et extrait par le lanceur porte l'attribut de quarantaine
(`com.apple.quarantine`) et peut être bloqué par Gatekeeper.

**EF-03.25** — Après extraction, le lanceur exécute
`xattr -d com.apple.quarantine runtime/node 2>/dev/null || true`.
Si l'exécution reste refusée, le message suivant est affiché :
```
TXT: macOS bloque l'exécution du runtime téléchargé.
     Ouvrez un terminal et tapez :

       xattr -dr com.apple.quarantine "/Volumes/CLE/OpenPresenter/runtime"

     Puis relancez OpenPresenter.command
```

**EF-03.26** — Le fichier `OpenPresenter.command` lui-même est documenté dans
`LISEZ-MOI.txt` avec la procédure « clic droit → Ouvrir » pour contourner Gatekeeper.

---

### Étape 5 — Choix du port

| Contrôle | Comportement |
|---|---|
| Port par défaut libre | utilisé |
| Port occupé par **notre** serveur | voir 3.5 (double lancement) |
| Port occupé par autre chose | incrément jusqu'à +20, premier port libre retenu |
| Aucun port libre | **⚠ ERREUR** avec liste des ports testés |

Port par défaut : **8788**, modifiable dans `project/project.json` (`settings.port`) et par
la variable d'environnement `PORT`.

Message si le port par défaut est occupé :
```
  ! Port       8788 déjà utilisé → utilisation du port 8789
```

**EF-03.27** — Le port finalement retenu est **mémorisé** dans `project.json` pour les
lancements suivants, sauf s'il a été imposé par la variable `PORT`.

**⚠ ERREUR** — aucun port libre :
```
TXT: Aucun port disponible entre 8788 et 8808.
     Fermez les applications qui occupent ces ports, ou lancez avec un port libre :
       Windows  : set PORT=9000 && OpenPresenter.bat
       Mac/Linux: PORT=9000 ./OpenPresenter.sh
```
Code de sortie `20`.

---

### Étape 6 — Démarrage du serveur

Le lanceur démarre `app/server.mjs` en processus fils, avec :
- `stdio` hérité (les logs du serveur s'affichent dans la même fenêtre) ;
- `cwd` = dossier du projet ;
- variables `OPENPRESENTER_PROJECT` (chemin absolu de `project/`) et `PORT`.

**EF-03.28** — Le lanceur attend `GET http://127.0.0.1:<port>/api/health` avec :
- 1 requête toutes les 250 ms ;
- timeout total de **20 s** ;
- affichage d'une progression : `Démarrage du serveur… (2,4 s)`.

**⚠ ERREUR** — timeout ou processus fils mort :
```
TXT: Le serveur n'a pas démarré.

     Dernières lignes du journal :
       <3 dernières lignes de project/logs/session-*.log>

     Le rapport complet est disponible ici :
       D:\OpenPresenter\project\logs\session-2026-10-21.log

     [C] Copier le rapport dans le presse-papiers
     [O] Ouvrir le dossier des journaux
```
Code de sortie `30`.

---

### Étape 7 — Affichage des accès et ouverture du navigateur

```
  ✓ Serveur    démarré en 1,8 s

╔══════════════════════════════════════════════════════════╗
║                                                          ║
║    Sur ce PC          http://localhost:8788/             ║
║    Depuis le réseau   http://192.168.1.42:8788/          ║
║    Code d'accès       4F2K                               ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝

  Ouverture du navigateur…

  ────────────────────────────────────────────────────────
  Laissez cette fenêtre ouverte pendant l'utilisation.
  Appuyez sur Ctrl+C (ou fermez cette fenêtre) pour arrêter.
  ────────────────────────────────────────────────────────
```

**EF-03.29** — Ouverture du navigateur par défaut :

| Plateforme | Commande |
|---|---|
| Windows | `start "" "http://localhost:%PORT%/"` |
| macOS | `open "http://localhost:$PORT/"` |
| Linux | `xdg-open` → `gio open` → `sensible-browser` → `x-www-browser` (premier disponible) |

**EF-03.30** — Si toutes les tentatives échouent :
```
TXT: Impossible d'ouvrir automatiquement votre navigateur.
     Copiez cette adresse dans votre navigateur :

         http://localhost:8788/
```

**EF-03.31** — Toutes les adresses IPv4 privées sont listées (pas seulement la première),
car les PC de régie ont souvent Wi-Fi **et** Ethernet :
```
  Réseau       eth0  → http://192.168.1.42:8788/
               wlan0 → http://10.0.0.7:8788/
```

**EF-03.32** — Le **code d'accès LAN** (ENF-32) est un code de 4 caractères
`[A-Z0-9]` (hors `0`, `O`, `1`, `I`), affiché au lancement et requis par les pages
ouvertes depuis un autre appareil. Il est stocké dans `project.json`
(`settings.lanToken`) et désactivable.

**EF-03.33** — Si aucune interface réseau privée n'existe (machine hors réseau), la ligne
« Depuis le réseau » est remplacée par :
```
TXT: Réseau      aucune interface réseau détectée — accès local uniquement
```

---

### Étape 8 — Arrêt

| Déclencheur | Comportement |
|---|---|
| `Ctrl+C` dans la fenêtre | `SIGTERM` au serveur, attente 3 s, puis `SIGKILL` ; message d'au revoir |
| Fermeture de la fenêtre | idem (Windows : gestion de l'évènement de fermeture de console) |
| Serveur qui meurt seul | message d'erreur + code de sortie du serveur |
| Arrêt du système | le serveur ferme ses handles ; les écritures sont atomiques (ENF-22) |

```
TXT: Arrêt d'OpenPresenter…
     Sauvegarde effectuée. Vous pouvez fermer cette fenêtre.
```

**EF-03.34** — Un arrêt **provoque toujours** une sauvegarde de l'état courant
(dernier élément diffusé, position dans le plan) dans `project/session-state.json`.

---

## 3.4 Sortie console complète — exemple nominal

```
╔══════════════════════════════════════════════════════════╗
║    OpenPresenter                                         ║
║    Suite de régie live — Bible, chants, médias           ║
╚══════════════════════════════════════════════════════════╝
  Dossier : D:\OpenPresenter
  Version : 3.0.0
  Vérifications en cours…

  ✓ Runtime    Node.js v22.11.0
               emplacement : runtime/node
  ✓ Projet     project/  (12 bibles · 84 chants · 213 médias)
  ✓ Écriture   dossier inscriptible
  ✓ Port       8788 disponible
  ✓ Serveur    démarré en 1,8 s

╔══════════════════════════════════════════════════════════╗
║    Sur ce PC          http://localhost:8788/             ║
║    Depuis le réseau   http://192.168.1.42:8788/          ║
║    Code d'accès       4F2K                               ║
╚══════════════════════════════════════════════════════════╝

  Ouverture du navigateur…

  Laissez cette fenêtre ouverte pendant l'utilisation.
  Appuyez sur Ctrl+C pour arrêter.
```

**EF-03.35** — Chaque ligne de vérification utilise exactement trois états :
`✓` (ok), `!` (avertissement, on continue), `✗` (échec).

---

## 3.5 Cas particuliers

### 3.5.1 Double lancement du même dossier

1. Le second lanceur détecte le port occupé.
2. Il interroge `GET /api/health`.
3. Si la réponse contient le **même `projectId`** que `project/project.json` :
```
TXT: OpenPresenter tourne déjà sur ce dossier.
     Ouverture de http://localhost:8788/ dans votre navigateur.
```
   …puis il ouvre le navigateur et se termine avec le code `0`.
4. Si le `projectId` diffère (autre projet sur ce port) : incrément de port normal.

**EF-03.36** — Ce cas ne doit **jamais** produire deux serveurs sur le même dossier
(risque de corruption des écritures).

### 3.5.2 Dossier en lecture seule (clé USB protégée, DVD)

```
  ! Écriture   dossier en LECTURE SEULE
TXT: Mode lecture seule : vous pourrez diffuser, mais aucune modification
     ne sera enregistrée. Les imports seront refusés.
```
L'interface affiche un **bandeau permanent** :
```
TXT: ⚠ Lecture seule — aucune modification ne sera enregistrée
```
Code de sortie à l'arrêt : `0`.

### 3.5.3 Espace disque insuffisant

Contrôle au lancement : si l'espace libre sur le volume de `project/` est **< 200 Mo**,
avertissement `!`. En dessous de **50 Mo**, refus de démarrer :
```
TXT: Espace disque insuffisant (31 Mo libres).
     OpenPresenter a besoin d'au moins 50 Mo pour fonctionner.
     Libérez de l'espace puis relancez.
```
Code de sortie `40`.

### 3.5.4 Dossier déplacé pendant l'exécution

Le serveur vérifie toutes les 5 s que `project/project.json` est toujours lisible et que
son `id` correspond. Sinon :
```
TXT: Le dossier du projet a été déplacé ou déconnecté.
     OpenPresenter va s'arrêter. Rebranchez la clé puis relancez.
```
Arrêt propre, code `50`.

### 3.5.5 Projet d'une version plus récente

Si `project.json` indique un `formatVersion` **supérieur** à celui de l'application :
```
TXT: Ce projet a été créé avec une version plus récente d'OpenPresenter
     (format v4, application v3).
     Ouvrir ce projet risquerait de perdre des données.
     Mettez à jour OpenPresenter, ou restaurez une sauvegarde antérieure.
```
Refus de démarrer, code `60`. **Aucune écriture** n'est tentée.

### 3.5.6 Projet d'une version plus ancienne

Migration automatique **après sauvegarde** :
```
TXT: Ce projet utilise un format plus ancien (v2).
     Une sauvegarde a été créée : project/backups/pre-migration-2026-10-21.zip
     Migration en cours…  ✓ terminée.
```
**EF-03.37** — Aucune migration n'est effectuée sans sauvegarde préalable vérifiée.

---

## 3.6 Variables d'environnement

| Variable | Effet |
|---|---|
| `PORT` | impose le port (pas de mémorisation) |
| `OPENPRESENTER_NODE` | chemin explicite du runtime à utiliser |
| `OPENPRESENTER_NO_BROWSER=1` | n'ouvre pas le navigateur |
| `OPENPRESENTER_HOST` | interface d'écoute (défaut `0.0.0.0`) |
| `OPENPRESENTER_VERBOSE=1` | journal détaillé dans la console |
| `OPENPRESENTER_READONLY=1` | force le mode lecture seule (pour test) |

---

## 3.7 Codes de sortie

| Code | Signification |
|---|---|
| `0` | arrêt normal |
| `10` | dossier du projet inaccessible |
| `20` | aucun port disponible |
| `30` | le serveur n'a pas démarré |
| `40` | espace disque insuffisant |
| `50` | dossier déplacé / déconnecté pendant l'exécution |
| `60` | format de projet trop récent |
| `70` | l'utilisateur a refusé l'installation du runtime |
| `80` | échec du téléchargement ou empreinte SHA-256 invalide |

**EF-03.38** — Chaque code est documenté dans `LISEZ-MOI.txt` avec la cause et le remède.

---

## 3.8 Tests d'acceptation liés

| Test | Scénario |
|---|---|
| **A-02** | Machine sans Node, avec Internet → le lanceur propose l'installation → après accord, l'application s'ouvre |
| **A-02b** | Machine sans Node, sans Internet → instructions exactes affichées, code `70` après refus |
| **A-02c** | Runtime Node 16 présent → refus avec message explicite, aucune tentative d'exécution |
| **A-02d** | Double-clic alors que le serveur tourne → le navigateur s'ouvre, un seul serveur |
| **A-02e** | Dossier sur clé USB avec accents et espaces → démarrage nominal |
| **A-02f** | Dossier en lecture seule → mode dégradé, bandeau affiché, diffusion possible |

---

## 3.9 Ce qui n'est pas dans le périmètre du lanceur

- Signature / notarisation macOS (prévue séparément, risque R-04)
- Mise à jour automatique de l'application elle-même
- Désinstallation (il suffit de supprimer le dossier)
- Création de raccourcis bureau / menu Démarrer (proposé en phase 4, non bloquant)
