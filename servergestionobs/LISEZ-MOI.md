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
