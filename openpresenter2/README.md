# OpenPresenter 2

Studio de présentation web-first, local et hors-ligne : Bible, chants, annonces, minuteur, scènes OBS indépendantes et affichage pasteur. Aucun compte n’est nécessaire. Les contenus et médias restent dans le stockage local du navigateur jusqu’à ce que vous exportiez une sauvegarde.

## Démarrage

Prérequis : Node.js 20 ou plus récent.

```sh
cd openpresenter2
npm ci
npm start
```

Ouvrez ensuite <http://localhost:8788/openpresenter2/>. Le serveur sert uniquement V2 et fournit le relais WebSocket utilisé par OBS et la télécommande. Il écoute sur les interfaces réseau de l’ordinateur pour permettre l’usage sur le même réseau local.

> **Réseau privé uniquement :** le relais ne comporte pas d’authentification. Ne transférez pas le port 8788 sur Internet. Utilisez un réseau de confiance.

## Première utilisation

1. Dans **Bible**, chargez la Bible de démonstration ou importez une Bible XML standard / Zefania.
2. Dans **Paroles**, créez un chant ou importez un fichier texte, ChordPro ou OpenSong.
3. Créez une annonce texte/image ou configurez le minuteur.
4. Le canevas **Aperçu** montre la sortie principale; **Diffuser** envoie le programme vers les sorties OBS configurées.
5. Ouvrez **Studio de scène** pour choisir un thème, un preset et ajuster les calques. Les coordonnées restent normalisées au canevas 1920 × 1080.
6. Utilisez **Sauvegarde** pour exporter ou restaurer un fichier `.openpresenter.zip` contenant bibliothèques, scènes, notes et médias.

## OBS, stage et téléphone

- Dans OBS, ajoutez une **Source navigateur** pour chaque lien proposé par le bouton **Liens OBS**. Réglez chaque source à **1920 × 1080**. Les canaux principal, annexe et lower third sont isolés.
- Le bouton **Stage** ouvre la vue pasteur. Elle reçoit le même programme et propose la navigation de parties.
- Le bouton **Remote** affiche un QR code. Quand le studio est ouvert sur `localhost`, choisissez l’adresse Wi-Fi de l’ordinateur dans la liste, puis scannez depuis le téléphone sur le même réseau. Si plusieurs réseaux sont disponibles, choisissez l’interface effectivement utilisée par le téléphone.

## Hors-ligne et données

Le service worker met en cache l’interface et les modules locaux après la première ouverture. L’application ne dépend pas de polices ou de bibliothèques CDN. IndexedDB stocke les scènes, bibliothèques et médias dans le navigateur courant : exportez régulièrement une archive pour transférer ou sauvegarder ces données.

## Tests

```sh
npm test
```

Les tests couvrent les parseurs, le stockage et les sauvegardes, le moteur WYSIWYG, le contrôleur, les pages OBS/stage et le relais WebSocket.
