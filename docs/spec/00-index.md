# OpenPresenter — Spécification détaillée

Ce dossier contient la **spécification exhaustive** d'OpenPresenter.
Le document `CAHIER-DES-CHARGES.md` à la racine du dépôt en est l'**index et la synthèse** ;
les chapitres ci-dessous en sont le **détail contractuel**.

**État au 21 octobre 2026 — version 1.0 :** 29 fichiers, **9 774 lignes**,
613 identifiants `EF-nn.m`, 33 identifiants d'annexe `AN-nn.m`, 115 tests, 99 chaînes cataloguées, 16 schémas JSON.
Les captures de référence sont dans `docs/maquettes/` (14 maquettes, 4 332 lignes).

## Règles de lecture

1. **Tout est prédéfini.** Si un comportement n'est pas écrit ici, il n'existe pas.
   Aucun écran, aucun bouton, aucun message d'erreur n'est laissé à l'appréciation
   de l'implémentation.
2. **Chaque exigence a un identifiant** (`EF-nn.m`) réutilisé dans les tests
   (`docs/spec/20-tests-acceptation.md`).
3. **Chaque écran a une entrée** dans `27-atlas-ecrans.md` (`SCR-nn`) et, quand elle
   existe, une maquette dans `docs/maquettes/`.
4. **Chaque interaction a une table** : déclencheur → préconditions → effet → état résultant
   → cas d'erreur.
5. **Les textes affichés à l'utilisateur sont littéraux**, entre guillemets, et catalogués
   dans `25-annexe-textes.md`.
6. **Les schémas de données sont machine-vérifiables** (`24-annexe-schemas.md`) : le JSON
   commenté des chapitres est illustratif, le schéma fait foi en cas de divergence.

## Conventions

| Notation | Sens |
|---|---|
| `EF-09.3` | exigence fonctionnelle 9, sous-point 3 |
| `AN-24.1` | exigence d'annexe (chapitres 24 à 27), numérotée séparément pour ne jamais entrer en collision avec une `EF` |
| `ENF-12` | exigence non fonctionnelle |
| `CU-03` | cas d'utilisation |
| `A-07` | test d'acceptation |
| `P-09` | test de performance |
| `D-04` | décision d'architecture |
| `INV-3` | invariant du modèle de données |
| `SCR-14` | écran (atlas, chapitre 27) |
| `DIAG-06` | contrôle du diagnostic (chapitre 23) |
| `TXT-042` | chaîne d'interface cataloguée (chapitre 25) |
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
| 19 | `19-cas-utilisation.md` | 18 cas d'utilisation détaillés | ✅ rédigé |
| 20 | `20-tests-acceptation.md` | grille de recette (115 tests) | ✅ rédigé |
| 21 | `21-plan-livraison.md` | phasage, dépendances | ✅ rédigé |
| 22 | `22-risques-hors-perimetre.md` | risques, exclusions, décisions ouvertes | ✅ rédigé |
| 23 | `23-journal-diagnostic.md` | journal, diagnostic, intégrité, mode secours | ✅ rédigé |
| 24 | `24-annexe-schemas.md` | 16 schémas JSON Schema | ✅ rédigé |
| 25 | `25-annexe-textes.md` | catalogue des chaînes d'interface | ✅ rédigé |
| 26 | `26-annexe-tracabilite.md` | EF → chapitre → test → maquette | ✅ rédigé |
| 27 | `27-atlas-ecrans.md` | 36 écrans, routes, états | ✅ rédigé |
| 99 | `99-glossaire.md` | glossaire (40+ termes) | ✅ rédigé |

## Maquettes

`docs/maquettes/` contient des maquettes HTML fidèles, ouvrables dans un navigateur
**sans réseau**. Elles servent de **captures de référence** : la disposition, les libellés
et les états y sont figés.

| ID | Écran | Fichier |
|---|---|---|
| MAQ-01 | Page d'accueil | `maq-01-accueil.html` |
| MAQ-02 | Console du lanceur (auto-diagnostic) | `maq-02-lanceur.html` |
| MAQ-03 | Studio — module Bible | `maq-03-studio-bible.html` |
| MAQ-04 | Studio — module Chants | `maq-04-chants.html` |
| MAQ-05 | Éditeur de scène WYSIWYG | `maq-05-editeur.html` |
| MAQ-06 | Sorties et matrice de liens | `maq-06-liens.html` |
| MAQ-07 | Profils | `maq-07-profils.html` |
| MAQ-08 | Événements et plan de déroulement | `maq-08-plan.html` |
| MAQ-09 | Vue scène / pasteur | `maq-09-scene.html` |
| MAQ-10 | Diagnostic | `maq-10-diagnostic.html` |
| MAQ-11 | Pages de sortie (plein écran, alpha, habillage, refus) | `maq-11-sorties.html` |
| MAQ-12 | Réglages et journal | `maq-12-reglages.html` |
| MAQ-13 | Catalogue en ligne | `maq-13-catalogue.html` |
| MAQ-14 | Premier lancement et migration | `maq-14-premier-lancement.html` |

## Statut de rédaction

Ce tableau est la **seule source de vérité** sur l'avancement ; il est mis à jour à chaque
vague. Les statuts ✅ ne sont posés qu'**après** vérification de l'existence du fichier.

| Vague | Contenu | Statut |
|---|---|---|
| 1 | Chapitres 00 à 04 (index, vision, architecture, lanceur, projet/données) | ✅ rédigés |
| 2 | Chapitres 05 à 09 (accueil, studio, sorties, éditeur, Bible) | ✅ rédigés |
| 3 | Chapitres 10 à 15 (chants, médias, annonces, profils, événements, scène) | ✅ rédigés |
| 4 | Chapitres 16 à 22 et 99 (sauvegarde, catalogue, clavier, cas d'usage, recette, livraison, risques, glossaire) | ✅ rédigés |
| 5 | Maquettes MAQ-01 → MAQ-09 | ✅ rédigées |
| 6 | Maquettes MAQ-10 → MAQ-14 (diagnostic, sorties, réglages, catalogue, premier lancement) | ✅ rédigées |
| 7 | Chapitre 23 (journal et diagnostic) | ✅ rédigé |
| 8 | Annexes 24 à 27 (schémas, textes, traçabilité, atlas) | ✅ rédigées |
| 9 | Nettoyage des artefacts d'édition (caractères CJK résiduels) | ✅ fait |
| 10 | Relevé de cohérence final (`trace:check` simulé) | ✅ fait — voir ci-dessous |

## Relevé de cohérence final (21/10/2026)

| Contrôle | Résultat |
|---|---|
| Fichiers indexés | 29 / 29 |
| Domaines `EF-nn` couverts | 30 / 30 (dont EF-28 et EF-30 par le chapitre 23) |
| Identifiants `EF-nn.m` | 613 (30 domaines) |
| Identifiants d'annexe `AN-nn.m` | 33 |
| Tests définis dans le chapitre 20 | 115 (dont `A-02b` → `A-02f`, `A-11b` → `A-11e`, `A-18` → `A-18k`) |
| Tests cités sans définition | 0 |
| Maquettes citées sans fichier | 0 |
| Caractères CJK résiduels dans `docs/` | 0 (hors glyphe `＋` utilisé comme icône) |
| Blocs JSON invalides dans l'annexe 24 | 0 / 16 |
| Liens `href` des maquettes cassés | 0 |
| Balises `<div>` déséquilibrées | 0 / 15 fichiers |

## Prochaine étape

La spécification est **complète et opposable**. La suite est l'**implémentation de la
phase 0** (`docs/spec/21-plan-livraison.md` § 21.2) : consolidation `app/`, API disque
`project/`, gestion d'assets, lanceur universel, migration V1/V2.
