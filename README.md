# OpenPresenter

**Suite gratuite et open-source de régie live** pour cultes, concerts et évènements — une alternative libre à des logiciels comme ProPresenter.

OpenPresenter réunit tous les outils de projection dont une régie a besoin (Bible, paroles de chants, médias, habillages/lower thirds) dans une interface unifiée, avec sortie directe vers **OBS Studio**. Tout fonctionne en local sur le réseau de la salle, via un petit serveur Node.js — aucun compte à créer, aucun abonnement, aucune dépendance à un service cloud.

---

## Sommaire

- [Pourquoi ce projet](#pourquoi-ce-projet)
- [Fonctionnalités](#fonctionnalités)
- [Comment ça fonctionne](#comment-ça-fonctionne)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Bibles au format XML](#bibles-au-format-xml)
- [Structure du projet](#structure-du-projet)
- [Licence](#licence)
- [Auteur & contact](#auteur--contact)

---

## Pourquoi ce projet

Les logiciels de régie live pour l'église ou l'évènementiel (type ProPresenter) sont souvent payants, parfois chers à l'échelle d'une petite structure, et pas toujours disponibles ou maintenus sur toutes les plateformes. Beaucoup d'équipes techniques bénévoles (églises, associations, petites salles) n'ont ni le budget ni le besoin d'une licence commerciale complète, mais ont quand même besoin d'un outil fiable pour :

- afficher des versets bibliques et des paroles de chants pendant un culte,
- projeter des images, vidéos, PDF ou présentations PowerPoint,
- habiller un live ou un stream avec des titres et bandeaux animés,
- tout ça en le diffusant proprement dans OBS Studio, pour du streaming, de l'enregistrement ou de la régie salle.

OpenPresenter est né de ce besoin concret : un outil gratuit, qui tourne partout où Node.js est installé, sans hébergement ni service tiers, et qui reste simple à faire évoluer.

## Fonctionnalités

- 📖 **Bible** — recherche par livre/chapitre/verset, import de Bibles au format XML, plusieurs styles d'affichage OBS (plein écran, bas centré, bas droite, 80% écran, ruban défilant)
- 🎤 **Paroles de chants** — collez un chant et il est automatiquement découpé en sections (couplet/refrain) à partir des lignes vides, tout en conservant la mise en forme d'origine ligne par ligne
- 🖼️ **Médias** — bibliothèque d'images, vidéos, PDF et PowerPoint, organisée par groupes, avec import multiple et cadrage automatique (une image qui n'est pas en 1920×1080 s'affiche à sa taille, sans être déformée ni rognée)
- 🏷️ **Lower Thirds** — bandeaux de titre/sous-titre personnalisables (couleurs, polices, formes, animations d'entrée/sortie, logo), avec positionnement au glisser-déposer
- 🖥️ **Studio Unifié** — les 4 outils dans une seule fenêtre avec un volet de navigation, plus des boutons globaux pour couper ou relancer instantanément la diffusion de chacun, sans changer d'onglet
- 🧩 **Mur de Sorties** — aperçu en direct des 4 sorties OBS réunies sur une seule page, pour surveiller ce qui est à l'antenne en un coup d'œil
- 🔗 **Sorties OBS multiples par mode** — en plus du lien qui suit le style choisi en direct, des liens à mode fixe pour afficher le même contenu différemment sur plusieurs scènes OBS (ex. plein écran en régie, bas centré en scène caméra)
- 🌐 **Pilotage à distance** — le contrôleur peut être ouvert depuis n'importe quel navigateur (pas seulement dans un dock OBS), y compris depuis un autre PC du même réseau

## Portabilité (dossier = tout)

OpenPresenter est **entièrement portable** : tout votre contenu — versions Bible, chants, médias (avec leurs images/vidéos), présets de titres, favoris, réglages, file de déroulement, groupes — est sauvegardé **dans le dossier du projet** (dossier `servergestionobs/data/`), pas dans le navigateur.

**Conséquence :** vous pouvez **copier le dossier sur un autre PC** (clé USB, disque réseau) et continuer exactement où vous vous étiez arrêté, sans rien reconfigurer ni réimporter. Il suffit de relancer le serveur (double-clic sur `demarrer-windows.bat` ou `demarrer-mac-linux.command`).

Au premier lancement sur une nouvelle machine, les outils **restaurent automatiquement** leur contenu depuis ce dossier.

## Comment ça fonctionne

OpenPresenter n'a pas de backend complexe : c'est un ensemble de pages HTML/JS autonomes, servies et reliées entre elles par un **petit serveur relais** (`sync-relay-server.js`), qui tourne avec Node.js pur (aucune dépendance à installer).

Ce serveur remplit deux rôles :

1. **Serveur de fichiers** : il sert les pages de l'outil en HTTP (`http://localhost:8787/...`), pour qu'elles puissent être ouvertes dans un navigateur classique ou dans OBS.
2. **Relais de synchronisation** : chaque outil a un contrôleur (l'interface de pilotage) et un affichage (la page à ajouter dans OBS comme Source Navigateur). Le serveur relaie en WebSocket tout ce qui se passe entre les deux, en plus de la synchronisation locale par `BroadcastChannel`. Résultat : le contrôleur peut être ouvert n'importe où sur le réseau — un autre onglet, un autre navigateur, un autre PC — et piloter l'affichage dans OBS en temps réel.

Rien ne transite par internet : tout reste sur le réseau local (Wi-Fi/Ethernet) de la salle.

## Installation

**Pré-requis :** [Node.js](https://nodejs.org/) (version LTS), aucune autre dépendance à installer.

1. Téléchargez ou clonez ce dépôt.
2. Gardez tous les fichiers du projet dans un même dossier.
3. Lancez le serveur :
   - **Windows** : double-cliquez sur `demarrer-windows.bat`
   - **Mac/Linux** : double-cliquez sur `demarrer-mac-linux.command` (ou `./demarrer-mac-linux.command` dans un terminal)

Le script vérifie automatiquement que Node.js est bien installé, que le port n'est pas déjà utilisé, et vous guide en cas de problème. Une fois lancé, il affiche l'adresse à utiliser :

```
Sur ce PC        : http://localhost:8787/
Depuis le réseau : http://192.168.x.x:8787/
```

Laissez cette fenêtre de terminal ouverte tant que vous diffusez.

## Utilisation

### Ouvrir les outils

Depuis un navigateur, ouvrez :

- `http://localhost:8787/studio_unifie.html` — l'interface tout-en-un recommandée (navigation entre les 4 outils + contrôles globaux)
- ou individuellement : `bible_control_display_pro.html`, `lyrics_control_display_pro.html`, `media_control_display_pro.html`, `obs_lower_third_ultimate_studio.html`
- `http://localhost:8787/mur_previews.html` — pour surveiller les 4 sorties en direct sur un seul écran

### Ajouter les sources dans OBS

Dans OBS, ajoutez une **Source Navigateur** par outil, avec l'URL affichée dans le panneau "Sortie Directe (OBS)" de chaque contrôleur (en général l'adresse suivie de `?obs=true`, ou `?obs=1` pour le Lower Third). Réglez la largeur/hauteur de la source sur la même résolution que votre Canvas OBS (Paramètres → Vidéo → Résolution de base), pour que le positionnement corresponde exactement à l'écran de sortie.

### Piloter depuis un autre PC

Sur un second PC connecté au même réseau, ouvrez l'adresse "Depuis le réseau" affichée au démarrage du serveur (ex. `http://192.168.1.42:8787/studio_unifie.html`). Tout ce qui est déclenché depuis ce PC s'affiche en direct dans OBS sur le PC principal.

## Bibles au format XML

L'outil Bible s'appuie sur des fichiers Bible au format XML. Une bonne source pour en télécharger dans plusieurs langues et versions :

👉 **https://github.com/Beblia/Holy-Bible-XML-Format**

Téléchargez le fichier XML de votre choix, puis importez-le directement depuis l'interface de l'outil Bible.

## Structure du projet

```
FreePresenter/
├── studio_unifie.html                   # Interface tout-en-un (recommandée)
├── mur_previews.html                    # Aperçu des 4 sorties réunies
├── bible_control_display_pro.html       # Outil Bible (contrôleur + affichage)
├── lyrics_control_display_pro.html      # Outil Paroles de chants
├── media_control_display_pro.html       # Outil Médias (images/vidéos/PDF/PPTX)
├── obs_lower_third_ultimate_studio.html # Outil Lower Third
├── sync-relay-server.js                 # Serveur relais (fichiers + synchro réseau)
├── package.json
├── demarrer-windows.bat                 # Démarrage Windows (avec vérifications)
├── demarrer-mac-linux.command           # Démarrage Mac/Linux (avec vérifications)
└── LISEZ-MOI.md                         # Notice d'utilisation détaillée (FR)
```

## Licence

Projet distribué librement — voir le fichier `LICENSE` du dépôt pour les conditions exactes (à ajouter selon le choix de licence retenu par l'auteur, par exemple MIT pour un usage et une modification libres).

## Auteur & contact

Projet créé et maintenu par **Renaud Christin FONTON**.

- 📧 Email : [renaudchristinfonton@gmail.com](mailto:renaudchristinfonton@gmail.com)
- 🌐 Site : [renaudfonton.netlify.app](https://renaudfonton.netlify.app)

Suggestions, retours ou questions sont les bienvenus.
#   O p e n p r e s e n t e r  
 #   O p e n p r e s e n t e r  
 