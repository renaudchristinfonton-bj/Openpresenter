# Phase 1 — Le moteur de scène (A-10)

Tranche 2 de la phase 1 : **une seule fonction de rendu** pour l'éditeur et la sortie.

```
scène (JSON)  ──renderScene()──►  HTML + SCENE_CSS  ──►  éditeur
                                          └────────────►  sortie /o/<id>
```

Tant qu'il existait deux rendus (un `div` stylé à la main dans `output.html`, un aperçu
simplifié dans le studio), « l'éditeur et la sortie se ressemblent » restait une intention.
Ici, c'est une propriété du code : les deux vues appellent `mountScene()` du même module.

## Ce qui est livré

| Où | Quoi |
|---|---|
| `app/src/core/scene.mjs` | modèle de scène : presets, calques, bornes EF-09.2→4, `normalizeScene`, `validateScene`, opérations de calques |
| `app/src/core/render/engine.mjs` | `renderScene()` (pur, testable) et `mountScene()` (DOM), `applyAutoFit()`, `SCENE_CSS` |
| `app/src/core/render/autofit.mjs` | auto-ajustement EF-09.29→33 : pas de 2 px, plancher 35 %, `scaleUp` optionnel |
| `app/src/core/render/content.mjs` | liaisons (`verse`, `ref`, `badge`…), exemples réalistes, `contentFromPayload()` |
| `app/src/core/render/contrast.mjs` | contraste WCAG de chaque calque texte sur son fond réel (A-10e) |
| `app/src/core/looks.mjs` | looks : copie indépendante des scènes (A-10f), application à une sortie |
| `app/src/core/history.mjs` | annuler/rétablir borné bas à 80 états (A-10h) |
| `app/src/core/ids.mjs` | identifiants courts sans `node:crypto` — utilisables dans le navigateur |
| `app/web/scene.html` | éditeur WYSIWYG : glisser/redimensionner, aimantation, panneau de propriétés, historique, contraste |
| `app/web/output.html` | page de sortie reconstruite sur le moteur (plus aucun style de contenu local) |
| `app/web/studio.html` | l'aperçu du studio est la scène de la sortie, réduite |

Les scènes vivent sur le disque, dans `project/scenes/<id>.json`, et chaque sortie pointe
ses scènes par type de contenu (`scenesByKind`) — D-02 : le disque est la vérité.

## Contrats à ne pas casser

- Coordonnées : `x`/`y` = **centre** du calque, en % ; `w`/`h` en % ; `h: null` = hauteur auto.
- `w`, `h` ∈ [2 ; 300] ; `x` ∈ [−w/2+1 ; 100+w/2−1] : un calque garde toujours 1 % visible (A-10g).
- `renderScene()` renvoie `{ html, css }` avec `data-layer-id`, `data-autofit`, `data-box-w/h`,
  `data-base-size` — c'est la base de comparaison des tests.
- Une liaison vide n'affiche **aucun nœud** (EF-09.16) : jamais « undefined » à l'antenne.
- Une sortie transparente ignore le calque de fond sauf `forceVisible` (EF-09.9).
- En édition seulement, une image sans fichier montre un emplacement `＋ Nom` (EF-09.35) ;
  en sortie, rien.
- Style : `SCENE_CSS` est l'unique feuille de style de contenu. Aucune page ne réécrit
  `font-size`, `text-align` ou une position de calque.

## Tests

| Test | Ce qu'il vérifie |
|---|---|
| A-10 | deux rendus de la même scène sont identiques ; la feuille de style vient du moteur |
| A-10b | 12 étapes du scénario Saint-Valentin (§ 8.8) rendent un HTML sans `undefined` ni `NaN` |
| A-10c | les 9 combinaisons d'alignement horizontal × vertical |
| A-10d | `justify` + `alignLast` sur la dernière ligne |
| A-10e | fond image + teinte 45 % + texte blanc ≥ 4,5:1 ; un gris pâle est signalé |
| A-10f | modifier la scène d'origine ne change pas un look déjà enregistré |
| A-10g | un calque poussé au bord reste partiellement visible |
| A-10h | 80 annulations restaurent les 80 états |
| EF-09.16 / 09.9 / 09.29→33 / 09.35 | liaison vide, transparence, auto-ajustement, emplacement d'image |
| API scènes | création au premier lancement, lecture, écriture, 404, liste blanche `/shared` |

```
npm test               # 176 tests
npm run schema:check
npm run trace:check
```

## Essayer

```
OPENPRESENTER_NO_BROWSER=1 PORT=8790 node app/server.mjs
```

- `/` — studio (l'aperçu est une vraie scène)
- `/scene.html` — éditeur de scène (glisser, poignée, flèches, `Ctrl+S`, `Ctrl+Z`)
- `/o/out_bottom?kind=bible` — sortie, rendue par le même moteur

## Ce qui reste dans la phase 1

- éditeur : sélection multiple, alignement/distribution, verrouillage visuel, zoom
- looks : écran de gestion (création depuis l'éditeur, aperçu, application en un clic)
- chants, médias, annonces : modules de contenu encore à écrire
- import de bibles XML, télécommande, vue scène
