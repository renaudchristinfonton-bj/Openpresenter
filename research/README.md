# REA + FreeShow — sources amont exactes

État au 7 novembre 2026. REA et FreeShow sont les dépôts amont eux-mêmes, conservés comme **sous-modules séparés et épinglés**. FreeShow n’est pas à réimplémenter approximativement : sa source canonique complète est `research/freeshow`, sans modification locale. L’application OpenPresenter reste séparée tant qu’elle n’a pas été basculée explicitement sur cette source; ne pas présenter une fonctionnalité partielle comme une copie exacte.

## Clones amont

| Dépôt | Révision épinglée | Version / licence |
|---|---|---|
| [morluto/rea](https://github.com/morluto/rea) (`research/rea`) | `c5301e6145a9c8e06719f27e83da55af8e5480fc` | REA 6.8.0, MIT |
| [ChurchApps/FreeShow](https://github.com/ChurchApps/FreeShow) (`research/freeshow`) | `ff784eb388c7baef60d67e6d4e7c504f4322bca3` | FreeShow 1.6.8-beta.3, GPL-3.0 |

Pour récupérer les sous-modules après un clone du dépôt OpenPresenter :

```sh
git submodule update --init --depth 1 research/rea research/freeshow
```

## Analyse effectivement exécutée avec REA

Le CLI publié `rea-agents@6.8.0` a été lancé sur l’arborescence source FreeShow, avec Node `22.23.4` (la version système `22.22.3` est inférieure au minimum demandé par REA).

```sh
npm exec --yes --package=node@22.23.4 --package=rea-agents@6.8.0 -- \
  rea-agents analyze-javascript-application "$PWD/research/freeshow" --json \
  > /tmp/freeshow-rea-analysis.json
```

Résultat REA :

- 576 fichiers retenus, dont 520 fichiers JavaScript/TypeScript analysés;
- 8 909 218 octets de texte source et 997 720 nœuds AST visités;
- graphe applicatif : 2 450 nœuds et 2 825 relations;
- frontières Electron détectées statiquement : 9 candidats `BrowserWindow`, 7 déclarations `webPreferences`, 1 entrée preload, 2 API `contextBridge` et 7 membres exposés;
- 21 opérations IPC observées : 7 canaux littéraux, 14 canaux dynamiques et 15 handlers côté main;
- 4 120 findings (constats), 955 limitations signalées et 1 échec de parsing.

Le JSON brut fait 95 953 927 octets. Il n’est pas commité afin de ne pas ajouter un artefact de près de 96 Mo; le présent fichier conserve le résumé utile.

## Carte de code sommaire

Les répertoires source montrent notamment :

- interface et présentation : `src/frontend/components/{show,slide,edit,output,stage,media,drawer,settings}`;
- services Electron : `src/electron/{IPC,data,output,streaming,capture,cloud,ai,contentProviders}`;
- interfaces réseau : `src/server/{remote,stage,controller,cam,output_stream}`.

C’est une carte issue de l’arborescence source, pas une preuve que chaque parcours fonctionne à l’exécution.

## Aperçu exact et limites

- L’aperçu navigateur actuellement servi utilise directement `public/index.html` et les modules de ce checkout FreeShow — pas une interface réécrite. Il s’agit du frontend Vite en développement, avec un petit override local de l’hôte autorisé pour Arena; aucun fichier source suivi du sous-module n’a été modifié.
- Le lancement complet Electron n’a pas été construit ni exécuté, et aucun parcours OBS/CEF réel n’a été validé. L’aperçu frontend seul ne prouve donc pas que les services Electron fonctionnent.
- `npm ci` reste bloqué sur `UNABLE_TO_VERIFY_LEAF_SIGNATURE` pour les archives de dépendances GitHub. La vérification TLS n’a pas été désactivée; les dépendances du frontend de l’aperçu ont été préparées temporairement à partir des commits Git exacts et du registre npm, sans modifier `package.json` ni `package-lock.json` du sous-module.
- Le point d’entrée compilé déclaré par `package.json` (`build/electron/index.js`) n’existe pas dans le checkout source non compilé; REA ne peut donc pas confirmer toute la chaîne Electron.
- REA indique que les canaux IPC dynamiques restent non résolus et que la couverture du graphe est incomplète. Les observations ne doivent pas être interprétées comme une spécification exhaustive.
- Le sous-module REA contient lui-même des sous-modules tiers non initialisés. L’analyse ci-dessus utilise le CLI npm publié, et non une compilation du dépôt REA.

## Séparation de licence

FreeShow est sous GPL-3.0; REA est sous MIT. FreeShow est gardé en sous-module distinct pour éviter d’incorporer accidentellement son code dans OpenPresenter. Toute reprise ou adaptation de son code devra conserver les avis de licence et respecter les obligations GPL-3.0 applicables.
