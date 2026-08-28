# Serveur relais OBS — Bible / Paroles / Lower Third

## Le problème que ça résout

Vos 3 outils communiquent entre "Contrôleur" et "Affichage OBS" via une technologie
(`BroadcastChannel`) qui **ne fonctionne qu'à l'intérieur d'un seul et même navigateur**.
Un Dock OBS et une Source Navigateur OBS partagent le moteur interne d'OBS, donc ça
marchait — mais c'est pour ça que vous étiez obligé de tout garder dans OBS (docks
minuscules, obligé d'agrandir, etc.), et impossible de piloter depuis un Chrome normal
ou depuis un autre PC.

Ce petit serveur ajoute un second canal de communication (réseau, via WebSocket) **en plus**
de BroadcastChannel. Résultat :

- Le **Contrôleur** peut être ouvert dans un navigateur normal (Chrome, Edge...), en
  plein écran, sur votre grand écran, sans jamais toucher aux docks OBS.
- L'**Affichage OBS** reste une Source Navigateur dans OBS, comme avant.
- Vous pouvez ouvrir le Contrôleur **depuis un autre PC** du même réseau (WiFi/Ethernet)
  pour piloter l'affichage à distance.

Rien ne change dans la façon dont vous utilisez les outils au quotidien — juste la façon
dont vous les ouvrez.

## Installation (une seule fois)

1. Installez [Node.js](https://nodejs.org/) (version LTS) si ce n'est pas déjà fait.
   Vérifiez avec `node -v` dans un terminal — il faut voir un numéro de version.
2. Gardez tous les fichiers de ce dossier ensemble : `sync-relay-server.js`, et vos 3
   fichiers `.html` (déjà mis à jour et inclus ici).

Aucune installation de dépendance n'est nécessaire (le serveur n'utilise que Node.js pur).

## Démarrage

**Windows** : double-cliquez sur `demarrer-windows.bat`
**Mac / Linux** : double-cliquez sur `demarrer-mac-linux.command` (ou lancez
`./demarrer-mac-linux.command` dans un terminal ; sur Mac il faudra peut-être
`chmod +x demarrer-mac-linux.command` une fois — le script essaie aussi de le
faire automatiquement pour vous)

Ou en ligne de commande, depuis ce dossier :
```
node sync-relay-server.js
```

### Ce que le script vérifie tout seul avant de démarrer

À chaque lancement, le script fait 4 vérifications et vous guide en cas de
problème (rien à faire si tout est vert) :

1. **Node.js est-il installé ?** Sinon, il vous donne le lien de téléchargement
   et s'arrête proprement (au lieu de planter sans explication).
2. **Droits d'exécution** : sur Windows, il détecte si vous n'êtes pas en mode
   administrateur et vous explique quand c'est important (uniquement si le
   pare-feu bloque les autres PC du réseau, ou si vous voyez une erreur
   "accès refusé") — ce n'est pas obligatoire pour un usage normal en solo.
3. **Le port est-il déjà pris ?** (8787 par défaut). Si oui, le script vous le
   signale — c'est peut-être qu'un serveur tourne déjà ailleurs, auquel cas
   inutile d'en relancer un deuxième — et vous laisse choisir de continuer ou
   d'annuler.
4. **Démarrage** du serveur relais lui-même.

Une fenêtre de terminal reste ouverte et affiche quelque chose comme :

```
Sur ce PC        : http://localhost:8787/
Depuis le réseau : http://192.168.1.42:8787/
```

**Laissez cette fenêtre ouverte** tant que vous diffusez — c'est elle qui fait tourner
le relais. Vous pouvez la réduire.

## Utilisation

### 1. Dans OBS (Source Navigateur)

Remplacez l'URL `file://...` de vos Sources Navigateur par l'adresse du serveur, par
exemple :
```
http://localhost:8787/bible_control_display_pro.html?obs=true
http://localhost:8787/lyrics_control_display_pro.html?obs=true
http://localhost:8787/obs_lower_third_ultimate_studio.html?obs=1
```
(remplacez `8787` par le port affiché si différent — c'est le port par défaut).

Vous pouvez garder ces Sources dans OBS comme avant. Ce qui change, c'est que
maintenant elles écoutent aussi le réseau, pas seulement les Docks OBS.

### 2. Le Contrôleur — sur ce PC, en plein écran, hors d'OBS

Ouvrez simplement dans un navigateur normal (Chrome, Edge, Firefox...) :
```
http://localhost:8787/bible_control_display_pro.html
http://localhost:8787/lyrics_control_display_pro.html
http://localhost:8787/obs_lower_third_ultimate_studio.html
```
Vous pouvez maintenant l'agrandir, le mettre sur un second écran, etc. — plus besoin
du dock OBS du tout (vous pouvez même le retirer d'OBS si vous voulez).

Un petit badge en haut de l'interface indique l'état :
- 🟢 **Relais réseau actif** → tout est connecté, ça pilote bien OBS.
- ⚪ **Local uniquement** → la page n'a pas réussi à joindre le serveur relais (vérifiez
  qu'elle est bien ouverte via `http://...` et pas en double-cliquant le fichier).

### 3. Piloter depuis un AUTRE PC du réseau

Sur le PC qui fait tourner OBS + le serveur, notez l'adresse "Depuis le réseau" affichée
au démarrage (ex: `http://192.168.1.42:8787/`). Sur l'autre PC (même WiFi/réseau local),
ouvrez dans un navigateur :
```
http://192.168.1.42:8787/bible_control_display_pro.html
```
en remplaçant par la vraie adresse IP affichée. Tout ce que vous affichez depuis ce
second PC apparaîtra en direct dans OBS sur le premier PC.

## Notes importantes

- **Réseau local uniquement.** Ce serveur n'a pas de mot de passe / authentification.
  Ne l'exposez pas sur Internet (pas de redirection de port routeur). Il est prévu pour
  un usage sur votre réseau WiFi/local de confiance (salle, église, studio...).
- **Pare-feu Windows** : au premier lancement, Windows peut demander d'autoriser
  Node.js sur les réseaux privés — acceptez pour que les autres PC puissent se
  connecter.
- **Changer de port** : si `8787` est déjà utilisé, lancez avec
  `PORT=9000 node sync-relay-server.js` (Mac/Linux) ou
  `set PORT=9000 && node sync-relay-server.js` (Windows), puis adaptez les URLs.
- Vos 3 outils continuent de fonctionner exactement comme avant même sans ce serveur
  (en ouvrant les fichiers directement) — c'est juste que dans ce cas, vous retombez
  dans la limitation d'origine (obligé de tout garder dans les docks OBS).

## Exclusion mutuelle des 3 outils (Bible / Paroles / Médias)

**La règle :** si l'un des trois outils « plein écran » passe à l'antenne, les deux
autres se coupent automatiquement. Exemple : un verset s'affiche → le média en cours
disparaît ; vous relancez un média → la Bible s'efface. Le **Lower Third, lui, reste
permanent** : il n'est jamais coupé par cette règle (il est conçu pour rester à
l'écran en même temps que les autres).

- Ça marche **entre le contrôleur et OBS**, mais aussi **entre plusieurs PC**
  (l'événement transite par le même relais réseau que le reste).
- C'est géré par un petit module partagé : `js/live-mutex.js`. Il est volontairement
  défensif : aucune erreur dans ce module ne peut casser une page (chaque callback
  est protégée, et un outil ne peut jamais se masquer lui-même).

## Tests automatisés (dossier `tests/`)

Pour vérifier que tout marche **avant/après chaque modification** (règle d'or du
projet : ne rien casser) :

```
cd servergestionobs/tests
npm install        # une seule fois (télécharge Playwright + Chromium)
npm test           # syntaxe des pages + exclusion mutuelle + intégration navigateur
```

- `check-syntax.sh` : vérifie la syntaxe JavaScript de tous les blocs `<script>`
  des pages (une coquille de syntaxe dans une page = page muette).
- `test-live-mutex.mjs` : test unitaire du module d'exclusion mutuelle
  (14 vérifications : doublons, messages malformés, callback fautive…).
- `test-integration.mjs` : démarre le serveur relais + un vrai Chromium, ouvre les
  3 contrôleurs et les 3 sorties OBS **dans deux contextes séparés** (tout passe
  donc par le relais réseau, comme entre deux PC), puis vérifie : ajout de médias,
  ajout de chant, exclusion mutuelle dans les 4 sens, chargement de toutes les
  pages sans erreur. C'est le test qui a validé la correction du bug d'ajout.

**Après chaque modification du code, relancez `npm test`.** Si vous touchez à
l'ajout de médias ou de paroles, c'est la garantie que ça marche toujours.

## Résolution de sortie personnalisée (tous les outils)

Dans chaque outil (Bible, Paroles, Médias, Lower Third), saisissez une taille
**libre** `largeur × hauteur` dans le panneau « Résolution de sortie » : le lien
OBS devient `...?obs=true&res=1280x720` (Lower Third : `?obs=1&res=...`), avec
bouton **Copier**. Le contenu s'adapte à votre écran grâce au **mode
d'adaptation** choisi :

- **Adapter** (par défaut) : la mise en page s'organise DANS la taille réelle de
  votre écran — cartes et textes se répartissent proportionnellement, tout est
  visible, sans bandes noires ni déformation, quel que soit le ratio (bandeau
  LED très large, écran portrait, etc.) ;
- **Tout afficher** : rendu 1920×1080 réduit uniformément — tout visible, bandes
  noires possibles si le ratio diffère ;
- **Remplir** : rendu 1920×1080 agrandi — couvre tout l'écran, peut rogner ;
- **Étirer** : échelle horizontale/verticale indépendante — pour les écrans à
  pixels non carrés (panneaux LED) : remplissage exact.

Le choix (taille + adaptation) est mémorisé (et suit le dossier `data/` du
projet) ; par défaut 1920×1080 en mise en page classique — donc rien ne change
si vous n'y touchez pas. Dans OBS, réglez la Source Navigateur à la même taille.
Des captures d'exemple sont dans `captures/` à la racine du dépôt.

## Deux versions du même verset en direct (Bible)

Cochez **« 2 versions »** dans la barre des versions et choisissez la seconde
traduction : à l'affichage, le verset apparaît **côte à côte** dans les deux
versions (nom de chacune au-dessus, séparateur central) — en préview comme sur
OBS, et ça se rafraîchit en direct. Si un livre n'existe pas sous le même nom
dans la seconde version, l'affichage reste simple.

## Annoter un verset avant projection (Bible)

Bouton **✏️** sur chaque verset : sélectionnez un mot dans l'éditeur, puis
**B** (gras), *I* (italique), 🖍 surlignage, 🎨 couleur du texte, ou effacez le
format. **Contraste intelligent** : quand vous surlignez, la couleur du texte
s'adapte automatiquement (noir sur un surlignage clair, blanc sur un surlignage
foncé) pour rester toujours lisible. La mise en forme est enregistrée par verset
(et suit le dossier `data/`) et apparaît telle quelle à la projection. Le bouton
✏️ passe en orange quand un verset est annoté.

## Découpage des versets longs (uniquement les sorties « bas »)

Le découpage est piloté par l'option **« Afficher ligne par ligne (versets
longs) »** des réglages d'affichage — pas par le mode du contrôleur. Quand elle
est active et qu'un verset dépasse ~160 caractères, il est découpé en parties
lisibles (~150 caractères, coupure à l'espace) et des boutons **← →** avec un
indicateur **x/y** apparaissent (aussi les flèches du clavier).

**Seules les sorties « Bas centré » et « Bas droite » affichent une partie à la
fois** : le lien général quand le mode sélectionné est « bas », ou les liens
verrouillés `?obs=true&lockMode=bottom` / `lockMode=bottom-right` du panneau de
liens. Toutes les autres sorties (plein écran, 80%, ruban défiler) affichent
toujours le verset **ENTIER** et ne sont en aucun cas affectées — vous pouvez
donc diffuser en même temps un verset complet au plein écran et par parties en
bandeau bas. Un verset annoté (✏️) n'est jamais découpé.

## Sauvegardes globales (Command Center)

Sur la page d'accueil (`/`) : **⬇️ Sauvegarder tout** télécharge UN fichier
contenant tout (favoris, réglages, présets, file, groupes, 2 versions, annotations,
résolution, bibliothèques IndexedDB avec les médias, données du dossier `data/`).
**⬆️ Restaurer** remet tout en place (sur n'importe quel PC).

## Vue Pasteur (écran compagnon)

`vue_pasteur.html` — l'écran à installer face au pasteur (tablette, PC, TV) :
- **3/5 de l'écran** : tout ce qui se passe réellement à l'antenne (les sorties
  Bible / Paroles / Médias / Titres y sont embarquées en direct, avec un libellé
  « en direct » et un badge quand un titre est affiché) ;
- **1/5 : minuteur** — horloge + compte à rebours ou chronomètre, libellé
  (« Prédication »…), couleurs d'alerte (orange à 5 min, rouge à 1 min, clignotant
  en dépassement) ;
- **1/5 : messages** — la régie envoie des messages (info / important / URGENT),
  le dernier s'affiche en grand, les précédents restent en historique.

**Côté régie** : ouvrez `vue_pasteur.html?admin=1` (bouton « ⚙️ Contrôle » en haut
de la vue, ou carte du Command Center) — préréglages 5→60 min, durée libre mm:ss,
Démarrer/Pause/Reset, rédaction et envoi des messages. Tout transite par le relais
local : ça marche depuis n'importe quel appareil du réseau, et l'état survit aux
rechargements (localStorage + dossier `data/`).

Vous avez déjà votre propre page de minuteur ? Ouvrez la vue avec
`vue_pasteur.html?timer=timer-display.html` : elle s'affiche à la place du
minuteur intégré, pilotée par vos boutons habituels.
