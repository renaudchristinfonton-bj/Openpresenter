# 25 — Annexe : catalogue des textes d'interface

> **But :** aucun texte affiché à l'utilisateur n'est inventé au moment de coder.
> Ce fichier recense **toutes** les chaînes marquées `TXT:` dans `docs/spec/` et
> `CAHIER-DES-CHARGES.md`, leur attribue un identifiant stable et sert de base au
> fichier de traduction.
> **Exigences couvertes :** EF-29.22 (chaînes externalisées), ENF-40, A-17g.

---

## 25.1 Règles de rédaction (normatives)

| # | Règle | Exemple correct | Contre-exemple |
|---|---|---|---|
| 1 | **Vouvoiement**, jamais de « tu » | « Vérifiez que le dossier… » | « Vérifie ton dossier » |
| 2 | **Phrase complète** avec majuscule initiale et point final ; jamais de style télégraphique | « Aucune sortie en ligne. » | « aucune sortie » |
| 3 | **Pas de jargon** dans les dialogues : ni « WebSocket », ni « JSON », ni « IndexedDB », ni « SHA-256 » | « Le fichier est introuvable. » | « 404 sur /api/assets » |
| 4 | **Espace insécable** avant `: ; ! ?` et à l'intérieur des guillemets français `« »` | `Jean 3:16` (référence) · `« Conférence »` | `«Conférence»` |
| 5 | Les **noms de boutons** sont à l'infinitif ou au nom d'action, sans point final | `Copier le rapport` | `Copie le rapport.` |
| 6 | Les **noms de ressources** sont entre guillemets français | `« dimanche.mp4 »` | `"dimanche.mp4"` |
| 7 | Les **touches** sont entre accents graves dans la spec et rendues en `<kbd>` | `Entrée`, `Échap` | « touche entrée » |
| 8 | Une erreur dit **ce qui s'est passé**, **pourquoi** (si connu) et **quoi faire** | voir 25.4 | « Erreur inconnue » |
| 9 | Jamais de **pile d'appel**, de code HTTP, ni de nom de fichier interne dans l'interface | — | `ENOENT: no such file` |
| 10 | Les **nombres** utilisent la virgule décimale et l'espace fine insécable pour les milliers : `1 189 chapitres`, `1,4 Go` | — | `1189`, `1.4 Go` |
| 11 | Les **dates** suivent `AAAA-MM-JJ` en technique et `26/10/2026` à l'écran | `Culte du 26/10/2026` | `10/26/2026` |
| 12 | Les **durées** s'écrivent `1 h 12 min`, jamais `72 min` au-delà de 60 | `1 h 12 min` | `72:00` |
| 13 | Le **pluriel** est explicite : `1 fichier` / `3 fichiers` ; jamais `fichier(s)` | `3 fichiers` | `fichier(s)` |
| 14 | Les messages d'erreur **ne accusent pas** l'utilisateur | « Le fichier est illisible. » | « Vous avez choisi un mauvais fichier » |
| 15 | Les **confirmations destructives** nomment le nombre d'éléments et l'irréversibilité | `Supprimer 3 fichiers ?` | `Êtes-vous sûr ?` |

**AN-25.1** — Toute chaîne affichée provient d'un fichier de traduction
(`web/i18n/fr.json`), jamais d'un littéral dans le code.
**AN-25.2** — La clé de traduction est `ui.<chapitre>.<numéro>` : par exemple
`ui.launcher.018` pour `TXT-018`. Le numéro est celui de ce catalogue, il ne change jamais.
**AN-25.3** — Une chaîne absente du fichier de traduction s'affiche **en français** (la
langue source fait partie du build), jamais sous forme de clé brute (A-17g).
**AN-25.4** — Les valeurs variables sont des emplacements nommés `{nom}`, `{count}`,
`{version}` ; aucune concaténation dans le code.

### 25.1.1 Typographie technique

| Élément | Rendu |
|---|---|
| Référence biblique | `Jean 3:16` — espace entre livre et chapitre, deux-points sans espace |
| Plage | `Jean 3:16-18` — trait d'union simple, jamais de tiret cadratin |
| Version biblique | `LSG` en capitales, jamais `Lsg` |
| Numéro de version logicielle | `3.0.0` |
| Taille de fichier | `1,4 Go`, `312 Ko`, `48 octets` |
| Code d'accès LAN | 4 caractères, toujours en majuscules : `4F2K` |
| Adresse locale | `192.168.1.24:8788` |
| URL de sortie | `/o/out_bottom?kind=bible` (jamais l'URL absolue dans un texte) |

---

## 25.2 Ce que ce catalogue ne contient pas

| Catégorie | Où elle est définie |
|---|---|
| Libellés des modules, menus et boutons | tableaux de chaque chapitre (`06-studio.md`, etc.) |
| Noms des 66 livres bibliques et abréviations | `09-bible.md` § 9.5 |
| Messages d'erreur de l'API (`error.code`) | `02-architecture.md` § 2.3 + 25.4 |
| Textes du `LISEZ-MOI.txt` | `03-lanceur.md` § 3.9 |
| Contenus des profils livrés | `13-profils.md` § 13.4 |

---

## 25.3 Catalogue

Chaque entrée : identifiant, chapitre d'origine, section, type, texte exact.


### Chapitre 03 — `03-lanceur.md`

**TXT-001** · message long · *Étape 0 — Résolution du dossier*

```text
Impossible d'accéder au dossier du projet.
Vérifiez que le dossier n'a pas été déplacé ou supprimé, puis relancez.
```

**TXT-002** · message long · *Étape 2 — Vérification du dossier de projet*

```text
Première utilisation détectée.
Le dossier « project » a été créé : il contiendra toutes vos données.
Vous pourrez copier ce dossier pour emporter votre régie partout.
```

**TXT-003** · message long · *Étape 3 — Détection du runtime*

```text
OpenPresenter nécessite Node.js 20 ou plus récent.
Version détectée : v16.20.2  (emplacement : /usr/bin/node)
```

**TXT-004** · message long · *4.1 Diagnostic préalable*

```text
Aucune connexion Internet détectée : le téléchargement automatique
n'est pas possible. Voir les instructions ci-dessous.
```

**TXT-005** · message long · *4.3 Instructions de repli (texte exact)*

```text
Installation manuelle de Node.js

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

**TXT-006** · message long · *4.3 Instructions de repli (texte exact)*

```text
Installation manuelle de Node.js

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

**TXT-007** · message long · *4.3 Instructions de repli (texte exact)*

```text
Installation manuelle de Node.js

Votre système utilise « apt ». Tapez dans un terminal :

  sudo apt update && sudo apt install -y nodejs npm

Puis vérifiez la version :

  node -v        (doit afficher v20 ou plus)

Si la version est trop ancienne, utilisez NodeSource :

  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt install -y nodejs

Puis relancez ./OpenPresenter.sh
```

**TXT-008** · message long · *4.4 Cas macOS particulier : binaire non signé*

```text
macOS bloque l'exécution du runtime téléchargé.
Ouvrez un terminal et tapez :

  xattr -dr com.apple.quarantine "/Volumes/CLE/OpenPresenter/runtime"

Puis relancez OpenPresenter.command
```

**TXT-009** · message long · *Étape 5 — Choix du port*

```text
Aucun port disponible entre 8788 et 8808.
Fermez les applications qui occupent ces ports, ou lancez avec un port libre :
  Windows  : set PORT=9000 && OpenPresenter.bat
  Mac/Linux: PORT=9000 ./OpenPresenter.sh
```

**TXT-010** · dialogue · *Étape 6 — Démarrage du serveur*

```text
Le serveur n'a pas démarré.

Dernières lignes du journal :
  <3 dernières lignes de project/logs/session-*.log>

Le rapport complet est disponible ici :
  D:\OpenPresenter\project\logs\session-2026-10-21.log

[C] Copier le rapport dans le presse-papiers
[O] Ouvrir le dossier des journaux
```

**TXT-011** · message long · *Étape 7 — Affichage des accès et ouverture du navigateur*

```text
Impossible d'ouvrir automatiquement votre navigateur.
Copiez cette adresse dans votre navigateur :

    http://localhost:8788/
```

**TXT-012** · message · *Étape 7 — Affichage des accès et ouverture du navigateur*

```text
Réseau      aucune interface réseau détectée — accès local uniquement
```

**TXT-013** · message long · *Étape 8 — Arrêt*

```text
Arrêt d'OpenPresenter…
Sauvegarde effectuée. Vous pouvez fermer cette fenêtre.
```

**TXT-014** · message long · *3.5.1 Double lancement du même dossier*

```text
OpenPresenter tourne déjà sur ce dossier.
Ouverture de http://localhost:8788/ dans votre navigateur.
```

**TXT-015** · message long · *3.5.2 Dossier en lecture seule (clé USB protégée, DVD)*

```text
Mode lecture seule : vous pourrez diffuser, mais aucune modification
ne sera enregistrée. Les imports seront refusés.
```

**TXT-016** · bandeau · *3.5.2 Dossier en lecture seule (clé USB protégée, DVD)*

```text
⚠ Lecture seule — aucune modification ne sera enregistrée
```

**TXT-017** · message long · *3.5.3 Espace disque insuffisant*

```text
Espace disque insuffisant (31 Mo libres).
OpenPresenter a besoin d'au moins 50 Mo pour fonctionner.
Libérez de l'espace puis relancez.
```

**TXT-018** · message long · *3.5.4 Dossier déplacé pendant l'exécution*

```text
Le dossier du projet a été déplacé ou déconnecté.
OpenPresenter va s'arrêter. Rebranchez la clé puis relancez.
```

**TXT-019** · message long · *3.5.5 Projet d'une version plus récente*

```text
Ce projet a été créé avec une version plus récente d'OpenPresenter
(format v4, application v3).
Ouvrir ce projet risquerait de perdre des données.
Mettez à jour OpenPresenter, ou restaurez une sauvegarde antérieure.
```

**TXT-020** · message long · *3.5.6 Projet d'une version plus ancienne*

```text
Ce projet utilise un format plus ancien (v2).
Une sauvegarde a été créée : project/backups/pre-migration-2026-10-21.zip
Migration en cours…  ✓ terminée.
```

### Chapitre 04 — `04-projet-et-donnees.md`

**TXT-021** · message court · *4.4.1 Procédure d'import (normative)*

```text
« <nom> » est illisible.` |
```

**TXT-022** · message court · *4.4.1 Procédure d'import (normative)*

```text
Écriture impossible : <raison>` |
```

**TXT-023** · dialogue · *4.4.2 Fichiers volumineux (décision D-04)*

```text
« Concert-complet.mp4 » fait 1,8 Go.

Le copier dans le projet alourdira les sauvegardes et les copies
sur clé USB. Espace libre restant après copie : 4,2 Go.

[C] Copier quand même dans le projet (recommandé pour la portabilité)
[L] Laisser à son emplacement d'origine (non portable)
[A] Annuler
```

**TXT-024** · message long · *4.4.2 Fichiers volumineux (décision D-04)*

```text
Ce fichier n'est pas dans le projet : il ne sera pas exporté.
Emplacement : E:\Videos\Concert-complet.mp4
```

**TXT-025** · dialogue · *4.5.1 Conflit entre deux onglets*

```text
Cette scène a été modifiée dans un autre onglet.
[R] Recharger la version la plus récente
[E] Enregistrer quand même mes modifications
```

**TXT-026** · bandeau · *4.6 Synchronisation avec le navigateur*

```text
⚠ Serveur déconnecté — affichage en cache, modifications désactivées
```

**TXT-027** · dialogue · *4.11.1 Outil de migration*

```text
Importer des données existantes

OpenPresenter peut récupérer vos bibles, chants, médias, looks
et réglages depuis :

[1] Une sauvegarde OpenPresenter 2 (.openpresenter.zip)
[2] Une sauvegarde OpenPresenter 1 (.json)
[3] Le navigateur de ce PC (données OpenPresenter 1 ou 2 encore présentes)
[4] Un dossier « data » d'OpenPresenter 1

Choisissez une source :
```

**TXT-028** · dialogue · *4.11.1 Outil de migration*

```text
Analyse terminée.

Bibles       3   (LSG, BDS, KJV)          41,2 Mo
Chants      84                            312 Ko
Médias     213   dont 2 vidéos > 500 Mo   3,8 Go
Looks        6
Réglages    12

[I] Importer      [A] Annuler
```

### Chapitre 05 — `05-accueil.md`

**TXT-029** · message · *5.4.1 Sélecteur de profil*

```text
Appliquer le profil « Conférence » ? Les sorties, les looks et le plan type vont être remplacés. Ce qui est à l'antenne sera coupé.` |
```

**TXT-030** · message court · *5.5.1 Contenu d'une carte*

```text
Cette sortie ne reçoit pas les médias. Modifiez-le dans ⚙.`
```

**TXT-031** · message court · *5.8 États particuliers*

```text
Bienvenue. Choisissez un profil pour commencer →` |
```

**TXT-032** · message court · *5.8 États particuliers*

```text
Aucune sortie en ligne. Ouvrez les liens dans OBS.` |
```

**TXT-033** · message court · *5.8 États particuliers*

```text
Importez une Bible pour pouvoir diffuser des versets.` |
```

**TXT-034** · message court · *5.8 États particuliers*

```text
Serveur déconnecté — relancez OpenPresenter.` |
```

### Chapitre 06 — `06-studio.md`

**TXT-035** · message court · *6.5 Barre de diffusion (commune à tous les modules de contenu)*

```text
Aucune sortie sélectionnée.` |
```

**TXT-036** · message court · *6.8 Notifications (toasts)*

```text
Jean 3:16 diffusé sur 2 sorties` |
```

**TXT-037** · message court · *6.8 Notifications (toasts)*

```text
Profil « Conférence » appliqué` |
```

**TXT-038** · message court · *6.8 Notifications (toasts)*

```text
« Lower third » ne reçoit pas les médias — sortie ignorée` |
```

**TXT-039** · message court · *6.8 Notifications (toasts)*

```text
Import impossible : ce fichier n'est pas une Bible reconnue.` |
```

### Chapitre 07 — `07-sorties-et-liens.md`

**TXT-040** · message court · *7.2.3 Propriétés d'une sortie*

```text
Maximum : 32 sorties.
```

**TXT-041** · message court · *7.2.3 Propriétés d'une sortie*

```text
OpenPresenter doit conserver au moins une sortie active.
```

**TXT-042** · dialogue · *7.2.4 Opérations*

```text
Supprimer la sortie « Bas centré — Stream » ?

Les scènes associées (6) seront conservées et pourront être
réaffectées à une autre sortie.

Les sources OBS pointant sur cette sortie afficheront une page vide.

[S] Supprimer      [A] Annuler
```

**TXT-043** · message long · *7.3.1 Format d'URL normatif*

```text
Sortie introuvable

L'identifiant « out_xyz » n'existe pas dans ce projet.
Il a peut-être été supprimé, ou ce lien provient d'un autre projet.

Sorties disponibles :
  • Plein écran — Salle      http://localhost:8788/o/out_full
  • Bas centré — Stream      http://localhost:8788/o/out_bottom
```

**TXT-044** · message court · *7.3.2 Le filtre `receives`*

```text
Cette sortie ne reçoit pas les médias.` sur fond transparent |
```

**TXT-045** · message court · *7.3.2 Le filtre `receives`*

```text
« Bas centré » ne reçoit pas les médias — sortie ignorée.` |
```

**TXT-046** · message · *7.4.1 Assistant « Installer dans OBS »*

```text
Impossible de joindre OBS à ws://localhost:4455. Vérifiez que le serveur WebSocket est activé dans Outils → Paramètres du serveur WebSocket.` |
```

**TXT-047** · message long · *7.4.2 Réglages OBS recommandés (texte affiché)*

```text
Dans OBS, pour chaque source navigateur :
1. Propriétés → Largeur / Hauteur = la résolution indiquée
2. Décochez « Contrôler l'audio via OBS »
3. Cochez « Rafraîchir le navigateur lorsque la scène devient active »
4. Pour les sorties transparentes, laissez le fond par défaut
   (la page fournit déjà la transparence)
```

**TXT-048** · message long · *7.5 Intégration vMix (EF-08.6) — décision D-06 : liste d'URLs d'abord*

```text
Dans vMix :
1. Add Input → Browser
2. URL : collez le lien souhaité
3. Width / Height : la résolution indiquée
4. Pour un overlay, activez l'alpha dans les propriétés de l'entrée
```

**TXT-049** · message court · *7.7 Résilience*

```text
Média indisponible` sur fond neutre, sans figer la sortie |
```

**TXT-050** · message court · *7.8 Tests d'acceptation liés*

```text
Maximum : 32 sorties.` |
```

### Chapitre 08 — `08-editeur-scene.md`

**TXT-051** · dialogue · *Autres propriétés typographiques*

```text
La police « Impact » n'est pas incluse dans le projet.
Le rendu peut différer sur un autre ordinateur.
[C] Choisir une police incluse      [G] Garder quand même
```

**TXT-052** · dialogue · *8.5.2 Historique*

```text
Modifications non enregistrées.
[E] Enregistrer      [N] Ne pas enregistrer      [C] Continuer l'édition
```

### Chapitre 09 — `09-bible.md`

**TXT-053** · message long · *9.2.1 Formats acceptés*

```text
Ce fichier n'est pas une Bible reconnue.
Formats acceptés : Beblia XML, Zefania XML, OSIS, USFX.
Source de fichiers libres : https://github.com/Beblia/Holy-Bible-XML-Format
```

**TXT-054** · dialogue · *9.2.3 Prévisualisation avant validation*

```text
Bible détectée

Nom            French Bible
Format         Beblia XML
Langue         français (détectée)
Livres         66
Chapitres      1 189
Versets        31 102
Taille         4,3 Mo

Aperçu — Genèse 1:1
« Au commencement, Dieu créa les cieux et la terre. »

Nom affiché    [Louis Segond 1910        ]
Abréviation    [LSG ]
Licence        [Domaine public           ]

[V] Valider l'import      [A] Annuler
```

**TXT-055** · message long · *9.2.4 Opérations sur une version*

```text
OpenPresenter a besoin d'au moins une version biblique.
Importez une autre Bible avant de supprimer celle-ci.
```

**TXT-056** · message court · *9.3.4 État 1 — chapitre*

```text
Jean compte 21 chapitres.
```

**TXT-057** · message court · *9.3.5 État 2 — verset*

```text
Plage trop large (200 versets maximum).` |
```

**TXT-058** · message court · *9.3.5 État 2 — verset*

```text
Jean 3 ne contient pas de verset 42 (1 à 36).` |
```

**TXT-059** · message court · *9.3.5 État 2 — verset*

```text
Versets 30 à 36 affichés (le chapitre s'arrête à 36).` |
```

**TXT-060** · message court · *9.3.7 Erreurs de saisie*

```text
Aucun livre ne correspond à « xyz ».` | **non** |
```

**TXT-061** · message court · *9.3.7 Erreurs de saisie*

```text
Saisissez un numéro de chapitre, puis Espace et le verset.` | non |
```

**TXT-062** · message court · *9.3.7 Erreurs de saisie*

```text
<Livre> ne contient pas de chapitre <n> (1 à <max>).` | non |
```

**TXT-063** · message court · *9.3.7 Erreurs de saisie*

```text
<Livre> <c> ne contient pas de verset <n> (1 à <max>).` | non |
```

**TXT-064** · message court · *9.3.7 Erreurs de saisie*

```text
Plage trop large (200 versets maximum).` | non |
```

**TXT-065** · message court · *9.3.7 Erreurs de saisie*

```text
Importez d'abord une version biblique.` | non |
```

**TXT-066** · message long · *9.5.5 Aperçu avant diffusion*

```text
Cette partie restera petite à l'écran. Réduisez le nombre de mots
par écran dans la scène « Bas centré ».
```

**TXT-067** · message court · *9.6.1 Deux versions en parallèle*

```text
Verset absent de cette version
```

**TXT-068** · message court · *9.6.3 Favoris et recherche*

```text
250+ résultats · affinez votre recherche`.
```

### Chapitre 10 — `10-chants.md`

**TXT-069** · dialogue · *10.1.1 Prévisualisation d'import*

```text
Chant détecté

Titre        Grâce infinie
Format       ChordPro
Sections     6  (Couplet 1, Refrain, Couplet 2, Refrain, Pont, Refrain)
Accords      oui (G, C, D, Em)
Métadonnées  auteur, clave, tempo

[I] Importer      [M] Modifier avant d'importer      [A] Annuler
```

**TXT-070** · message court · *10.3 Navigation*

```text
Fin du chant « Grâce infinie ».`
```

**TXT-071** · dialogue · *10.5 Organisation*

```text
« Grâce infinie » est utilisé dans 3 plans de déroulement.
Ces étapes seront remplacées par des notes.
[S] Supprimer quand même      [A] Annuler
```

### Chapitre 11 — `11-medias.md`

**TXT-072** · message long · *11.1 Types acceptés*

```text
« presentation.ppt » n'est pas pris en charge.
Enregistrez-le au format .pptx ou exportez-le en PDF.
```

**TXT-073** · message · *11.2 Import*

```text
« fond.jpg » est identique à un fichier déjà importé (réutilisation).` |
```

**TXT-074** · dialogue · *11.2.1 Rapport d'import*

```text
Import terminé

12 fichiers traités
 9 importés          18,4 Mo
 2 déjà présents     (réutilisés, 0 octet écrit)
 1 refusé            presentation.ppt (format non pris en charge)

[Voir les fichiers]   [Fermer]
```

**TXT-075** · message court · *11.5 PDF et présentations*

```text
2 polices du fichier sont absentes et ont été remplacées.` |
```

### Chapitre 13 — `13-profils.md`

**TXT-076** · message court · *13.5.1 Séquence normative*

```text
Profil « Conférence » appliqué · 3 sorties · 3 looks` |
```

**TXT-077** · dialogue · *13.5.2 Confirmation*

```text
Appliquer le profil « Conférence » ?

Cette action va :
  • couper ce qui est à l'antenne
  • remplacer 2 sorties et créer 1 sortie
  • appliquer les looks Moderne, Minimal, Cinéma
  • changer la Bible par défaut pour LSG

Vos scènes et looks actuels sont conservés : ils pourront être
réappliqués à tout moment.

[A] Appliquer      [Annuler]
```

### Chapitre 14 — `14-organisations-evenements-plans.md`

**TXT-078** · message court · *14.4.2 Écran*

```text
Fin du plan.` |
```

**TXT-079** · dialogue · *14.4.3 Import CSV / texte (repris de V1)*

```text
Importer un plan

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

### Chapitre 16 — `16-sauvegarde-export.md`

**TXT-080** · dialogue · *16.4.3 Progression*

```text
Export du projet

Préparation…            ✓
Données                 ✓   4,2 Mo
Médias (213)            67 %  2,1 Go / 3,1 Go
Finalisation…

[Annuler]
```

**TXT-081** · dialogue · *16.5.1 Analyse préalable*

```text
Restaurer un projet

Archive    OpenPresenter-ICC-Pahou-2026-10-21.zip
Créée le   21/10/2026 à 18:04
Version    format v3 (application 3.0.0)
Taille     3,1 Go

Contenu
  Bibles        3
  Chants       84
  Médias      213   dont 2 vidéos > 500 Mo
  Scènes       22
  Profils       4
  Événements   31

⚠ 1 média lié manquant : Concert.mp4

Mode
  (•) Remplacer le projet actuel
  ( ) Fusionner avec le projet actuel
      Les éléments identiques (même id ou même empreinte)
      seront conservés, les autres ajoutés.

[R] Restaurer      [Annuler]
```

**TXT-082** · dialogue · *16.5.2 Rapport*

```text
Restauration terminée

Bibles        3 importées
Chants       84 importés      2 doublons fusionnés
Médias      211 importés      2 manquants
Scènes       22 importées
Profils       4 importés
Événements   31 importés

[Télécharger le rapport]     [Fermer]
```

### Chapitre 17 — `17-catalogue.md`

**TXT-083** · message · *17.5 Messages d'erreur (littéraux)*

```text
Le catalogue est désactivé. Activez-le dans Réglages → Catalogue en ligne.` |
```

**TXT-084** · message · *17.5 Messages d'erreur (littéraux)*

```text
Aucune connexion Internet détectée. Le catalogue est indisponible — le reste du logiciel n'est pas affecté.` |
```

**TXT-085** · message · *17.5 Messages d'erreur (littéraux)*

```text
Le serveur n'a pas répondu dans les 8 secondes. Réessayez plus tard.` |
```

**TXT-086** · message · *17.5 Messages d'erreur (littéraux)*

```text
Le fichier téléchargé ne correspond pas à l'empreinte annoncée. Le téléchargement a été annulé par sécurité.` |
```

**TXT-087** · message · *17.5 Messages d'erreur (littéraux)*

```text
Ce fichier fait 240 Mo, au-delà de la limite de 100 Mo. Téléchargez-le manuellement puis importez-le.` |
```

**TXT-088** · message · *17.5 Messages d'erreur (littéraux)*

```text
Le fichier a été téléchargé mais n'est pas une Bible reconnue. Il a été supprimé.` |
```

**TXT-089** · message · *17.5 Messages d'erreur (littéraux)*

```text
La licence de ce contenu n'est pas indiquée. Vérifiez vos droits avant de l'utiliser publiquement.` |
```

**TXT-090** · message court · *17.6 Mode hors-ligne*

```text
Liste en cache — téléchargement indisponible.`
```

### Chapitre 18 — `18-clavier-accessibilite.md`

**TXT-091** · message court · *18.1.6 Règles de résolution*

```text
« L » est déjà utilisé pour « Verrouiller ».` |
```

### Chapitre 23 — `23-journal-diagnostic.md`

**TXT-092** · message court · *23.3.2 Diffusion*

```text
Bas centré — aucun client connecté`, avec deux boutons par sortie :
```

**TXT-093** · message court · *23.3.3 Données*

```text
Aucune sauvegarde. Vos données ne tiennent qu'à ce dossier.`
```

**TXT-094** · message · *23.3.4 Environnement*

```text
Navigateur non pris en charge. Utilisez Chrome, Edge, Firefox ou Safari à jour.` |
```

**TXT-095** · message · *23.3.4 Environnement*

```text
Aucune adresse réseau — ce poste n'est pas connecté à un réseau local.` |
```

**TXT-096** · message · *23.3.4 Environnement*

```text
Désactivé par réglage` si le catalogue est désactivé (état par défaut) |
```

**TXT-097** · message · *23.4 Rafraîchissement et états de la page*

```text
Le dossier du projet est illisible.` + bouton `Mode secours` (23.7) |
```

**TXT-098** · dialogue · *23.5.1 Confirmation de suppression*

```text
Supprimer 3 fichiers orphelins ?

1,4 Go seront libérés. Les fichiers seront déplacés dans
backups/orphelins-2026-10-21/ et conservés 30 jours.

[S] Supprimer      [A] Annuler
```

**TXT-099** · message · *23.6 Copier le rapport*

```text
Copie automatique impossible — sélectionnez tout (Ctrl+A) et copiez.`
```

---

## 25.4 Messages d'erreur normalisés (API → interface)

Le serveur renvoie un `code` ; l'interface affiche le texte ci-dessous, sans exception.
Un code inconnu affiche `TXT-ERR` générique et journalise l'évènement `ui.error`.

| `code` | Texte affiché | Action proposée |
|---|---|---|
| `NOT_FOUND` | `Cet élément n'existe plus.` | `Actualiser` |
| `VALIDATION` | `Les informations saisies ne sont pas valides.` | champ fautif mis en évidence |
| `CONFLICT` | `Cet élément a été modifié ailleurs.` | `Recharger` · `Enregistrer quand même` |
| `TOO_LARGE` | `Ce fichier dépasse la taille maximale autorisée.` | `Choisir un autre fichier` |
| `UNSUPPORTED` | `Ce format de fichier n'est pas pris en charge.` | `Voir les formats acceptés` |
| `WRITE_FAILED` | `Écriture impossible : le dossier est protégé ou plein.` | `Ouvrir le diagnostic` |
| `READ_ONLY` | `Le projet est en lecture seule.` | `Voir pourquoi` |
| `BAD_ARCHIVE` | `Cette archive est incomplète ou endommagée.` | `Choisir une autre archive` |
| `FORMAT_TOO_RECENT` | `Cette archive vient d'une version plus récente d'OpenPresenter.` | `Mettre à jour` |
| `OFFLINE` | `Aucune connexion Internet.` | `Réessayer` |
| `TIMEOUT` | `Le serveur n'a pas répondu à temps.` | `Réessayer` |
| `CHECKSUM` | `Le fichier téléchargé est corrompu.` | `Réessayer` |
| `UNKNOWN_TYPE` | `Type de contenu inconnu.` | — |
| `LAST_ITEM` | `Impossible de supprimer le dernier élément de ce type.` | — |
| `LOCKED` | `Le projet est en mode secours.` | `Ouvrir le diagnostic` |
| `UNSUPPORTED_SOURCE` | `Cette source de données n'est pas reconnue.` | `Choisir une autre source` |
| `(générique)` | `Une erreur inattendue est survenue.` | `Copier le rapport` · `Ouvrir le diagnostic` |

**AN-25.5** — Les textes de ce tableau sont les seuls autorisés pour ces codes ; ils
portent les clés `ui.api.<code>`.

---

## 25.5 Vérification automatisée

| Contrôle | Commande | Critère |
|---|---|---|
| Aucun littéral affiché dans le code | `grep -rnE ">[A-ZÉÀ][^<]{3,}<" web/*.html` | 0 résultat hors fichiers de traduction |
| Toutes les clés existent | `npm run i18n:check` | 0 clé manquante, 0 clé orpheline |
| Catalogue à jour | `npm run txt:index` | régénère ce fichier et échoue si le diff est non vide |
| Typographie | `npm run lint:fr` | 0 espace avant `:` simple, 0 `...` (remplacé par `…`) |
