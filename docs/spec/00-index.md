# OpenPresenter — Spécification détaillée

Ce dossier contient la **spécification exhaustive** d'OpenPresenter.
Le document `CAHIER-DES-CHARGES.md` à la racine du dépôt en est l'**index et la synthèse** ;
les chapitres ci-dessous en sont le **détail contractuel**.

## Règles de lecture

1. **Tout est prédéfini.** Si un comportement n'est pas écrit ici, il n'existe pas.
   Aucun écran, aucun bouton, aucun message d'erreur n'est laissé à l'appréciation
   de l'implémentation.
2. **Chaque exigence a un identifiant** (`EF-nn.m`) réutilisé dans les tests
   (`docs/spec/20-tests-acceptation.md`).
3. **Chaque écran a une maquette** dans `docs/maquettes/`, référencée en tête de chapitre.
4. **Chaque interaction a une table** : déclencheur → préconditions → effet → état résultant
   → cas d'erreur.
5. **Les textes affichés à l'utilisateur sont littéraux**, entre guillemets. Ils ne sont
   pas des exemples : ce sont les chaînes à implémenter.

## Conventions

| Notation | Sens |
|---|---|
| `EF-09.3` | exigence fonctionnelle 9, sous-point 3 |
| `ENF-12` | exigence non fonctionnelle |
| `CU-03` | cas d'utilisation |
| `A-07` | test d'acceptation |
| `D-04` | décision d'architecture |
| `INV-3` | invariant du modèle de données |
| `KBD` | raccourci clavier |
| `TXT:` | chaîne littérale affichée à l'utilisateur |
| **⚠ ERREUR** | comportement en cas d'échec |
| **MAQ-xx** | référence à une maquette `docs/maquettes/` |

## Chapitres

| # | Fichier | Contenu | État |
|---|---|---|---|
| 00 | `00-index.md` | le présent document | ✅ rédigé |
| 01 | `01-vision-personas.md` | vision, personas, contextes, parcours | ✅ rédigé |
| 02 | `02-architecture.md` | architecture cible, serveur, API, canaux | ✅ rédigé |
| 03 | `03-lanceur.md` | lanceur universel, auto-diagnostic, installation | ✅ rédigé |
| 04 | `04-projet-et-donnees.md` | arborescence `project/`, schémas, migration | ✅ rédigé |
| 05 | `05-accueil.md` | page d'accueil | ✅ rédigé |
| 06 | `06-studio.md` | studio unifié, navigation, recherche | ✅ rédigé |
| 07 | `07-sorties-et-liens.md` | sorties, matrice de liens, OBS/vMix | ✅ rédigé |
| 08 | `08-editeur-scene.md` | éditeur WYSIWYG, calques, propriétés | ✅ rédigé |
| 09 | `09-bible.md` | Bible : import, saisie clavier, découpage, navigation | ✅ rédigé |
| 10 | `10-chants.md` | chants, sections, arrangements | ✅ rédigé |
| 11 | `11-medias.md` | images, vidéos, PDF, présentations | ✅ rédigé |
| 12 | `12-annonces-minuteurs-habillages.md` | annonces, minuteurs, lower thirds | ✅ rédigé |
| 13 | `13-profils.md` | profils réutilisables | ✅ rédigé |
| 14 | `14-organisations-evenements-plans.md` | organisations, événements, plans | ✅ rédigé |
| 15 | `15-scene-et-telecommande.md` | vue scène, télécommande | ✅ rédigé |
| 16 | `16-sauvegarde-export.md` | sauvegarde, export, import | ✅ rédigé |
| 17 | `17-catalogue.md` | catalogue en ligne | ✅ rédigé |
| 18 | `18-clavier-accessibilite.md` | clavier, accessibilité, i18n | ✅ rédigé |
| 19 | `19-cas-utilisation.md` | cas d'utilisation détaillés | ✅ rédigé |
| 20 | `20-tests-acceptation.md` | grille de recette | ✅ rédigé |
| 21 | `21-plan-livraison.md` | phasage, dépendances | ✅ rédigé |
| 22 | `22-risques-hors-perimetre.md` | risques, exclusions | ✅ rédigé |
| 99 | `99-glossaire.md` | glossaire | ✅ rédigé |

## Maquettes

`docs/maquettes/` contient des maquettes HTML fidèles, ouvrables dans un navigateur.
Elles servent de **captures de référence** : la disposition, les libellés et les états
y sont figés.

| ID | Écran |
|---|---|
| MAQ-01 | Page d'accueil |
| MAQ-02 | Console du lanceur (auto-diagnostic) |
| MAQ-03 | Studio — module Bible |
| MAQ-04 | Studio — module Chants |
| MAQ-05 | Éditeur de scène WYSIWYG |
| MAQ-06 | Sorties et matrice de liens |
| MAQ-07 | Profils |
| MAQ-08 | Événements et plan de déroulement |
| MAQ-09 | Vue scène / pasteur |
| MAQ-10 | Diagnostic |

## Statut de rédaction

Le cahier des charges est rédigé par vagues successives. Ce tableau est la **seule source
de vérité** sur l'avancement ; il est mis à jour à chaque vague.

| Vague | Contenu | Statut |
|---|---|---|
| 1 | Chapitres 00 à 04 (index, vision, architecture, lanceur, projet/données) | ✅ rédigés |
| 2 | Chapitres 05 à 09 (accueil, studio, sorties, éditeur, Bible) | ✅ rédigés |
| 3 | Chapitres 10 à 15 (chants, médias, annonces, profils, événements, scène) | ✅ rédigés |
| 4 | Chapitres 16 à 22 et 99 (sauvegarde, catalogue, clavier, cas d'usage, recette, livraison, risques, glossaire) | ✅ rédigés |
| 5 | Maquettes MAQ-01 → MAQ-09 | ✅ rédigées |
| 6 | Maquette MAQ-10 (diagnostic) | ⬜ à rédiger |
