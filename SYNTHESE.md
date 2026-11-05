# Synthèse — une seule régie, le meilleur des branches + le design FREESTREAM

**Date : 5 novembre 2026** · Branche : `arena/b374ea1b-openpresenter`

Ce document explique **ce qui a été comparé**, **ce qui a été gardé**, **ce qui a été
écarté et pourquoi**. Il sert de carte de decision pour la suite : une seule base de
code, pas quatre variantes à maintenir.

---

## 1. Ce qui a été passé en revue

### Les branches du dépôt `Openpresenter`

| Branche | Dernier commit | Fichiers | Tests | Verdict |
|---|---|---|---|---|
| `main` | 15a31f0 · « Vue pasteur » | 169 | scripts de garde | **V1** : 8 pages HTML monolithiques, gratuit et fonctionnel, mais chaque page duplique son CSS et son JS |
| `arena/01a02459-openpresenter` | 4d9036a · 28/08/2026 | 163 | 99 vérifications annoncées | V1 **+ Looks** (éditeur complet, animations d'entrée par mode), minuteur, recherche unifiée. Peaufinage de la V1, pas de refonte |
| `arena/01a04f03-openpresenter` | 50d9796 · 10/10/2026 | 281 | **46 tests** (tous verts) | **V2** : réécriture modulaire (`openpresenter2/`), jetons de design, registre de sorties, viewport, éditeur de scène. Bonnes idées, périmètre encore étroit |
| `arena/df2cc4c1-openpresenter` | 8e37642 · 22/10/2026 | 296 | **281 tests** (tous verts) | **V3 = la plus aboutie.** Cahier des charges de 29 chapitres, serveur sans dépendance, projet = dossier portable, 6 modules, plans, événements, profils, scènes, exports, migration V1 |

### Le dépôt `audiovisueliccpahou/FREESTREAM`

Branche `arena/f85b6260-freestream`, version 1.4.1 (31/10/2026) : régie web 100 %
hors ligne, rendu 8K, sorties multiples (plein, bas, cœur, orateur, minuteur),
éditeur de designs, serveurs Node/Python/PowerShell.
**Ce n'est pas un concurrent à fusionner : c'est une référence de design.** Sa
palette (nuit `#0b0e15` + or `#ffd479` + bleu `#6ea8ff`), son rail d'icônes, ses
moniteurs « TRAVAIL / À L'ANTENNE » et ses pastilles d'état sont repris ici.

---

## 2. La décision

> **Base = `arena/df2cc4c1-openpresenter` (V3).** C'est la seule branche qui tient un
> culte complet (Bible, chants, médias, annonces, habillage, minuteur, plan,
> événements, sorties paramétrables) avec des tests qui la protègent. Les trois
> autres branches n'ont pas été fusionnées telles quelles : deux d'entre elles sont
> des variantes de la V1 (monolithes) et la V2 est un sous-ensemble de la V3.

Sur cette base, la synthèse ajoute trois choses que **aucune** branche n'avait :

| Apport | Origine | Ce que ça change |
|---|---|---|
| **Thème commun FREESTREAM** (`app/web/theme.css`) | design FREESTREAM | une seule palette, un seul jeu de rayons/ombres/pastilles pour les 8 pages. Avant : 4 palettes voisines qui divergeaient |
| **Coque « ProPresenter » du studio** | demande utilisateur | rail vertical de 6 modules + bibliothèque à gauche + moniteur d'aperçu au centre + colonne « À l'antenne » à droite avec la vraie sortie en direct |
| **Vue orateur + Mur des sorties** | V1 (`vue_pasteur`, `mur_previews`) + FREESTREAM (orateur) | deux écrans qui manquaient à la V3 : l'écran retour de scène et la surveillance de toutes les sorties |
| **Session réseau (`session.js`)** | correction d'un bug V3 | le jeton `?t=` n'était propagé que par 4 pages sur 8 : depuis un second poste, la régie répondait 401. Et sans jeton, `withToken()` renvoyait une chaîne vide → `fetch('')` → l'accueil affichait « Serveur injoignable ». Les deux sont corrigés et testés |

Détail des ajouts :

- `app/web/theme.css` — jetons FREESTREAM + briques communes (pastille, moniteur,
  carte, raccourci clavier). Chargé par toutes les pages sauf `output.html`, qui doit
  rester noir/transparent (vérifié par test).
- `studio.html` — la coque : barre haute avec logo, horloge, pastille « en direct » ;
  rail des 6 modules (icônes SVG, `Alt+1…6`) ; colonne de droite qui rejoue la sortie
  principale dans une iframe (le même moteur que OBS) ; compteur de séance.
- `orateur.html` (`/orateur`, `/prompteur`) — texte courant en très grand, « à suivre »,
  référence, horloge, minuteur. **Strictement en lecture seule** : elle s'abonne au
  canal de la sortie, elle ne peut pas couper le direct (test dédié).
- `mur.html` (`/mur`, `/sorties`) — chaque sortie dans son cadre vivant, URL copiable,
  état « à l'antenne » par sortie.
- `/regie` et `/studio` — raccourcis d'URL stables pour ouvrir la régie.
- Liaison de scène **`next`** — le contenu suivant voyage avec la diffusion
  (`nextText`), ce qui permet une sortie « cœur » (texte courant + annonce du suivant)
  façon FREESTREAM, sans requête supplémentaire.
- `app/web/session.js` — le jeton réseau (`?t=`) est transporté par toutes les pages :
  `fetch`, WebSocket et liens internes. Sans lui, piloter depuis un second PC était
  cassé (401) et l'accueil local affichait « serveur injoignable ».
- `app/tests/synthese-ui.test.mjs` — 10 contrôles qui protègent ces acquis.

---

## 3. Ce qui a été écarté (et pourquoi)

| Écarté | Raison |
|---|---|
| Fusionner `servergestionobs/` (V1) dans la nouvelle app | doublons : les mêmes outils existent en mieux dans `app/`. La V1 reste dans l'historique Git et **la migration** (`app/src/migration/v1.mjs`) sait déjà importer ses données |
| Remplacer le moteur de rendu V3 par celui de FREESTREAM | le rendu V3 est déjà partagé entre l'éditeur, l'aperçu et la sortie (une seule vérité). Le changer aurait cassé 281 tests pour un gain nul |
| Serveurs Python / PowerShell de FREESTREAM | Node.js suffit et reste la seule dépendance déclarée du projet |
| Le « mode dossier » (File System Access) de FREESTREAM | agréable, mais incompatible avec le pilotage multi-poste par WebSocket, qui est le cœur d'OpenPresenter |
| Copier les Looks V1 par-dessus les Profils/Looks V3 | les profils V3 font plus (sorties + looks + capture d'état). Les animations d'entrée existent déjà côté scènes (`TRANSITIONS`) |

---

## 4. Vérifier en trois commandes

```bash
node app/server.mjs            # ou ./OpenPresenter.sh
# puis, dans le navigateur :
#   http://localhost:8788/regie      → la régie (rail + 2 moniteurs)
#   http://localhost:8788/mur        → toutes les sorties en un écran
#   http://localhost:8788/orateur    → l'écran retour de scène
npm test                       # 291 contrôles — 0 échec
```

---

## 5. Suite logique

1. **Designs/Looks globaux** appliqués d'un clic aux 4 outils (déjà en profils V3 : il
   reste l'écran de choix rapide dans la régie).
2. **Sortie « cœur » livrée d'usine** : une troisième sortie par défaut, avec la scène
   qui utilise la liaison `next` (le socle est prêt : liaison, payload et orateur).
3. **Rendus 4K/8K** : monter la résolution interne du canevas (aujourd'hui 1920×1080,
   réduit/agrandi par transformation DOM : net pour le texte, à revoir pour les images)
   lorsque les sorties dépassent 1080p.
4. **Anciens documents** : déjà regroupés sous [`docs/archive/`](docs/archive/) (V1) —
   à conserver comme mémoire du projet.
