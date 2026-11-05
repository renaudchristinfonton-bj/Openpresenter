# OpenPresenter — État des lieux vérifié

**Date de l'audit :** 21 octobre 2026
**Dépôt :** `github.com/renaudchristinfonton-bj/Openpresenter`
**Méthode :** chaque affirmation ci-dessous a été obtenue par une commande exécutée sur le dépôt
(`git`, `gh api`, `grep`, exécution des tests). Rien n'est repris d'une documentation antérieure
sans vérification.

---

## 1. Les trois branches du dépôt

`gh api repos/renaudchristinfonton-bj/Openpresenter/branches` renvoie **3 branches** :

| Branche | Dernier commit | Contenu |
|---|---|---|
| `main` | `15a31f0` — *Vue pasteur : messages au pasteur en très grand — ajustement auto précis* | V1 seule |
| `arena/01a02459-openpresenter` | `4d9036a` — *Looks : ANIMATION D'ENTRÉE par mode — 99/99 tests* | V1, plus avancée que `main` |
| `arena/01a04f03-openpresenter` | `50d9796` — *feat(openpresenter2): complete V2 studio and output fixes* | V1 **+** un dossier `openpresenter2/` (V2) |

La branche de travail actuelle (`arena/df2cc4c1-openpresenter`) pointe sur `4d9036a`,
c'est-à-dire l'état de `arena/01a02459-openpresenter`.

**Conséquence structurante : il existe deux bases de code distinctes dans le dépôt.**
Toute la suite de `arena/01a04f03-openpresenter` (8 commits) construit `openpresenter2/`
en parallèle de `servergestionobs/`, sans jamais y toucher. Le dépôt compte
**281 fichiers** sur cette branche.

---

## 2. V1 — `servergestionobs/` (branche courante)

### 2.1 Inventaire

**14 pages HTML** (liste produite par `check-syntax.sh`, toutes valides) :

```
bible_control_display_pro.html        (134 Ko)
lyrics_control_display_pro.html       (107 Ko)
media_control_display_pro.html        ( 78 Ko)
obs_lower_third_ultimate_studio.html  ( 97 Ko)
index.html                            ( 46 Ko)  ← page d'accueil / Command Center
studio_unifie.html                    ( 17 Ko)
cue_list.html                         ( 34 Ko)  ← plan de déroulement + contrôleur mobile
vue_pasteur.html                      ( 26 Ko)
pasteur_control.html                  (  9 Ko)
stage_display.html                    (  9 Ko)
timer-control-updated.html            ( 33 Ko)
timer-display-updated.html            ( 11 Ko)
looks_editor.html                     ( 21 Ko)
mur_previews.html                     (  5 Ko)
```

Serveur : `sync-relay-server.js` (24 Ko) — Node pur, **zéro dépendance npm au runtime**.
Modules partagés : `js/remote-channel.js`, `js/obs-links.js`, `js/ui.js`, `js/looks.js`,
`js/qrcode.js`, `js/pwa.js`, `js/live-mutex.js`.

### 2.2 Ce qui est réellement hors-ligne (vérifié par `grep`)

| Contrôle | Commande | Résultat |
|---|---|---|
| Références CDN | `grep -roE "https?://(cdn.tailwindcss.com\|fonts.googleapis.com\|fonts.gstatic.com\|cdnjs.cloudflare.com\|unpkg.com\|cdn.jsdelivr.net\|images.unsplash.com)"` | **0 occurrence** |
| Appels réseau sortants | `grep -rnoE "(fetch\|XMLHttpRequest\|new WebSocket)\(..."` filtré sur les URL absolues | **aucun** |

Tout est bien local :
- polices vendues dans `vendor/fonts/` (woff2) ;
- Tailwind **compilé** en 4 fichiers `css/tw-<page>.css` ;
- `jszip.min.js`, `pdf.min.js`, `pdf.worker.min.js` dans `vendor/js/`.

> L'audit d'août 2026 pointait « 15 références CDN » : **ce point est clos.** Le blocage
> hors-ligne restant n'est plus le réseau, il est **architectural** (voir § 4).

### 2.3 Persistance

`sync-relay-server.js` expose `GET/PUT /data/<namespace>/<cle>.json` ; `store.js` écrit
toujours en local (filet de secours) puis synchronise vers le serveur. Le dossier
`servergestionobs/data/` est **git-ignoré** et créé à l'exécution (absent actuellement).
Endpoints globaux `GET /api/export` et `POST /api/import`.

**Mais** : les bibliothèques lourdes (versions Bible, chants, blobs média) vivent en
`IndexedDB` du navigateur. Elles ne sont exportables que via le bouton « Sauvegarder tout ».
→ **Le dossier du projet ne contient pas tout.** C'est l'écart majeur avec l'exigence
« le dossier = le projet ».

### 2.4 Lanceurs

`demarrer-windows.bat` et `demarrer-mac-linux.command` existent et vérifient Node.js + port.
**Ils n'installent rien** : si Node manque, ils affichent « téléchargez depuis nodejs.org »
et s'arrêtent.

### 2.5 Tests

```
$ bash check-syntax.sh   → 14 pages vérifiées, tous les blocs script valides
$ node test-live-mutex.mjs → 14 test(s) OK, 0 échec(s)
```
Les tests d'intégration (`test-integration.mjs`) exigent Playwright + Chromium
(`npm i` dans `servergestionobs/tests/`) et n'ont **pas** été exécutés ici.

---

## 3. V2 — `openpresenter2/` (branche `arena/01a04f03-openpresenter`)

C'est une **refonte propre**, et son architecture est nettement plus proche de la cible
que la V1.

### 3.1 Architecture

```
openpresenter2/
├── server.mjs              serveur HTTP + relais WebSocket écrit à la main (0 dépendance)
├── index.html              le Studio (3 044 lignes)
├── obs/output.html         la sortie OBS (une page, paramétrée ?scene=&fit=&res=)
├── app/stage.html          vue pasteur / scène
├── app/remote.html         télécommande (QR code)
├── src/core/               engine, database, backup, output-registry, output-url, themes, viewport
├── src/components/         SceneEditor.mjs (688 lignes, WYSIWYG)
├── src/modules/bible/      xml.mjs, annotations.mjs
├── src/modules/songs/      parser.mjs, SongEditor.mjs
├── src/modules/media/      library.mjs, pptx.mjs
├── vendor/                 polices + js vendus (aucun CDN)
├── css/                    tokens.css, components.css
├── tests/                  17 fichiers de tests (node --test)
├── demarrer-windows.bat
└── demarrer-mac-linux.command
```

`package.json` : **zéro dépendance de runtime** ; `devDependencies` uniquement pour les
tests (`@xmldom/xmldom`, `happy-dom`, `jszip`). Serveur sur `0.0.0.0:8788`, préfixe
`/openpresenter2/`.

### 3.2 Le moteur de scène (le vrai acquis de la V2)

`src/core/engine.mjs` — un **modèle à calques unique** qui sert à la fois au contrôleur, à
l'éditeur WYSIWYG, à la sortie OBS et à la vue scène. C'est exactement la brique que demande
le besoin « créer mes visuels de fond et mettre mon texte dessus ».

- **4 types de calques** : `background` (dégradé / image / flou / fit), `overlay`
  (panneau : fond, rayon, bordures par côté), `text`, `image` (ou vidéo).
- **Géométrie normalisée** : `x/y/w/h` en **pourcentage d'un canevas 1920×1080**, avec
  `rotate`, `opacity`, `visible`, `locked`, `zIndex`.
- **Liaisons de données** (`bind`) : `custom`, `ref`, `badge`, `verse`, `title`, `section`,
  `lyrics`, `announcement`, `timer`, `image`, `media`. Un même calque peut donc être
  « texte libre » ou « alimenté par le verset en cours ».
- **5 dispositions** : `full`, `screen80`, `bottom`, `bottom-right`, `lowerthird`.
- **6 familles de contenu** (`kind`) : `bible`, `songs`, `announcements`, `lowerthird`,
  `timer`, `media`.
- **Auto-ajustement** du texte (`autoFitText`) et **découpage intelligent** (`splitSmart`,
  coupe sur ponctuation → saut de ligne → espace, `splitChars` configurable).
- **8 transitions** entrée/sortie : `fade`, `zoom`, `slide-up/down/left/right`, `wipe`, `blur`.
- **11 thèmes** (`themes.mjs`) + looks personnalisés enregistrables.
- **Scènes par sortie** : `createDefaultSceneMap(outputs, kinds, makeScene)` → chaque sortie
  possède **sa propre scène par type de contenu**. C'est déjà la bonne structure.

`output-registry.mjs` : jusqu'à **32 sorties**, chacune avec `id`, `name`, `preset`,
`width`, `height`, `fit` (`contain`/`cover`/`stretch`), `enabled`, `targetByDefault`,
plus créer / renommer / dupliquer / supprimer.

`viewport.mjs` : conversion du canevas 1920×1080 vers la résolution réelle de la source
navigateur, avec le correctif CEF/DPR documenté dans le code.

### 3.3 Ce qui manque déjà en V2 (vérifié)

| Manque | Preuve |
|---|---|
| **Les données ne sont PAS dans le dossier du projet** | `database.mjs` : `DB_NAME = 'openpresenter2'`, `DB_VERSION = 3`, stores `settings, bibles, songs, media, announcements, scenes, assets, notes` → **IndexedDB du navigateur**, pas le disque. Le transfert passe par un `.openpresenter.zip` manuel (`backup.mjs`, plafond 512 Mo). |
| **Aucun import de médias vers le disque** | `media/library.mjs` crée des enregistrements à partir d'un `File` stocké en blob IndexedDB. Aucune copie dans un dossier du projet. |
| **Saisie Bible : pas de nom de livre** | `parseBibleQuickEntry` = `/^(\d+)\s*(?::|\s)\s*(\d+)(?:\s*[-–]\s*(\d+))?$/` → il faut **déjà** avoir ouvert le livre. Le flux « taper 3 lettres → Entrée → chapitre → espace → verset → Entrée » n'existe pas. |
| **Pas de profils (église / conférence / stream)** | Aucun store, aucune UI. |
| **Pas de gestion d'événement / d'organisation** | Aucun store, aucune UI. |
| **Pas de catalogue en ligne (Bibles / chants)** | Aucun module réseau. |
| **Liens OBS = par sortie, pas par type de contenu** | `output-url.mjs` : `buildObsOutputUrl(baseUrl, output)` → un lien par sortie. La matrice « sortie × type de contenu » (une scène OBS qui ne prend *que* la Bible) n'existe pas. |
| **Le lanceur n'installe rien** | `demarrer-*.bat/.command` : `node` manquant → message + `exit 1`. |

En V1, le champ de saisie rapide Bible **n'existe pas du tout**
(`grep -c "quick" bible_control_display_pro.html` → `0`).

---

## 4. Synthèse : où en est-on face au besoin exprimé

| Exigence | V1 | V2 | Écart |
|---|---|---|---|
| Zéro dépendance Internet au runtime | ✅ vérifié | ✅ vérifié | aucun |
| Lancement par un seul fichier | ⚠️ oui mais exige Node préinstallé | ⚠️ idem | **installer / embarquer Node** |
| Dossier du projet = tout le projet | ❌ IndexedDB | ❌ IndexedDB | **persistance disque** |
| Copie automatique des fichiers importés | ❌ | ❌ | **gestion d'assets disque** |
| Export du projet complet | ⚠️ JSON | ⚠️ ZIP manuel | **export automatique** |
| Page d'accueil avec les sorties | ✅ `index.html` | ✅ Studio | à refondre en « accueil » |
| Profils (église / conférence / stream) | ❌ | ❌ | **à créer** |
| Gestion événement / église éditable | ❌ | ❌ | **à créer** |
| 2 sorties personnalisables (bas centré + plein écran) | ✅ modes | ✅ 32 sorties | V2 gagne |
| Lien d'affichage par type de contenu | ⚠️ `lockMode` par outil | ❌ | **matrice sortie × contenu** |
| Éditeur visuel fond + texte | ⚠️ réglages | ✅ **WYSIWYG à calques** | V2 gagne nettement |
| Découpage des versets longs | ✅ | ✅ `splitSmart` | équivalent |
| Saisie Bible clavier complète | ❌ | ⚠️ chapitre+verset seulement | **à créer** |
| Navigation flèches verset / partie | ⚠️ | ⚠️ `moveBibleSelection` | **à compléter (parties)** |
| Vue scène / pasteur | ✅ | ✅ | équivalent |
| Plan de déroulement | ✅ `cue_list.html` + import CSV | ✅ `plan` | V1 plus complet sur l'import |

### Verdict

> **La V2 a le bon moteur ; la V1 a le bon périmètre fonctionnel et le bon hors-ligne.**
> Aucune des deux ne satisfait aujourd'hui les trois exigences structurantes du nouveau
> besoin : **lanceur auto-suffisant**, **dossier du projet auto-porteur**,
> **matrice de liens sortie × contenu**.

C'est ce constat qui structure le cahier des charges : on ne repart pas de zéro,
on **consolide sur le moteur de la V2** et on y greffe la persistance disque,
les profils, la gestion d'événements et la matrice de sorties.

---

## 5. Commandes de vérification (reproductibles)

```bash
# branches
gh api repos/renaudchristinfonton-bj/Openpresenter/branches --paginate -q '.[].name'
git fetch origin 'refs/heads/*:refs/remotes/origin/*' && git branch -a

# hors-ligne V1
grep -roE "https?://(cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|unpkg\.com|cdn\.jsdelivr\.net|images\.unsplash\.com)" servergestionobs --include=*.html --include=*.js | wc -l   # → 0

# persistance V2
git show origin/arena/01a04f03-openpresenter:openpresenter2/src/core/database.mjs | head -20

# saisie Bible V2
git show origin/arena/01a04f03-openpresenter:openpresenter2/index.html | sed -n '/function parseBibleQuickEntry/,/^}/p'

# tests V1
cd servergestionobs/tests && bash check-syntax.sh && node test-live-mutex.mjs
```
