# 21 — Plan de livraison

> Chaque phase est **démontrable** à la fin. Aucune phase ne commence avant que la
> précédente ne passe sa recette (`20-tests-acceptation.md`).

---

## 21.1 Principe de séquencement

Les phases sont ordonnées par **dépendance technique**, pas par taille ni par envie.

```
Phase 0 ──▶ Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4
socle       régie       organisation compléments réseau
```

**Règle** : une fonctionnalité qui dépend d'une fondation non livrée est **reportée**,
jamais contournée par une implémentation temporaire.

---

## 21.2 Phase 0 — Fondations

> **Objectif** : le logiciel existe comme produit installable, avec des données portables.
> **Rien de visible à l'antenne ne change encore.**

| # | Livrable | Exigences | Dépend de |
|---|---|---|---|
| 0.1 | Consolidation des deux bases en un dossier unique (D-03, § 4.7 du CDC) | — | — |
| 0.2 | Persistance disque `project/` + API serveur complète | EF-01 | 0.1 |
| 0.3 | Gestion d'assets : copie, SHA-256, déduplication, miniatures | EF-02 | 0.2 |
| 0.4 | Lanceur universel avec auto-diagnostic et installation assistée | EF-03, EF-04 | 0.2 |
| 0.5 | Migration V1 / V2 vers `project/` | EF-26.25 → EF-26.29 | 0.2, 0.3 |
| 0.6 | Sauvegarde automatique et export complet | EF-26.1 → EF-26.15 | 0.2 |
| 0.7 | Suite de tests fusionnée, `npm test` | ENF-40, ENF-41 | tout |

**Recette** : A-01, A-02, A-03, A-03b, A-04, A-05, A-13, A-13b → A-13e.

**Critère de sortie** : un utilisateur peut copier le dossier sur un autre PC et retrouver
exactement le même logiciel ; le lanceur fonctionne sur les trois OS.

---

## 21.3 Phase 1 — Le cœur de la régie

> **Objectif** : on peut conduire un culte complet, avec deux sorties et des visuels.
> **C'est la phase qui rend le produit utilisable.**

| # | Livrable | Exigences | Dépend de |
|---|---|---|---|
| 1.1 | Sorties multiples + matrice de liens sortie × contenu | EF-07, EF-08 | 0.2 |
| 1.2 | Éditeur de scène WYSIWYG étendu (alignements, groupes, aimants) | EF-09 | 0.1 |
| 1.3 | Bible : saisie clavier unifiée complète | EF-12 | 0.2 |
| 1.4 | Bible : découpage en mots + navigation par parties | EF-13, EF-12.29+ | 1.3 |
| 1.5 | Page d'accueil | EF-05 | 1.1, 0.2 |
| 1.6 | Studio unifié et recherche unifiée | EF-06 | 1.1 → 1.5 |
| 1.7 | Chants : sections, arrangements, navigation | EF-15 | 1.4 |

**Recette** : A-06, A-07, A-08, A-09, A-10, A-12, A-12b → A-12e.

**Critère de sortie** : CU-01, CU-03, CU-04, CU-05 passent de bout en bout.

---

## 21.4 Phase 2 — Organisation

> **Objectif** : le logiciel s'adapte à une église ou à une conférence, et se prépare à l'avance.

| # | Livrable | Exigences | Dépend de |
|---|---|---|---|
| 2.1 | Profils + les 3 profils livrés | EF-20 | 1.1, 1.2 |
| 2.2 | Organisations et lieux | EF-21 | 0.2 |
| 2.3 | Événements, récurrence, duplication, historique | EF-22 | 2.2 |
| 2.4 | Plan de déroulement + import CSV / Planning Center | EF-23 | 2.3, 1.3, 1.7 |
| 2.5 | Looks réutilisables | EF-10 | 1.2 |
| 2.6 | Médias complets (vidéo synchronisée, PDF, PPTX) | EF-16 | 0.3 |

**Recette** : A-11, A-12f → A-12k, A-13f → A-13i, A-14f → A-14h.

**Critère de sortie** : CU-02, CU-09, CU-10, CU-14, CU-15 passent.

---

## 21.5 Phase 3 — Compléments

> **Objectif** : le confort de la scène, des annonces, et le diagnostic.

| # | Livrable | Exigences | Dépend de |
|---|---|---|---|
| 3.1 | Vue scène enrichie | EF-24 | 1.1 |
| 3.2 | Télécommande PWA | EF-25 | 1.1 |
| 3.3 | Minuteurs | EF-18 | 0.2 |
| 3.4 | Annonces | EF-17 | 1.2 |
| 3.5 | Habillages / lower thirds | EF-19 | 1.2 |
| 3.6 | Diagnostic et journal | EF-28, EF-30 | 0.2 |
| 3.7 | Intégrité du projet, maintenance | EF-01.15 | 0.3 |

**Recette** : A-14, A-14b → A-14e, A-15 → A-15f.

**Critère de sortie** : CU-06, CU-12, CU-13, CU-17, CU-18 passent.

---

## 21.6 Phase 4 — Réseau et finitions

| # | Livrable | Exigences | Dépend de |
|---|---|---|---|
| 4.1 | Catalogue en ligne | EF-27 | 0.4 |
| 4.2 | Assistant OBS 1 clic (obs-websocket v5) | EF-08.16 → EF-08.21 | 1.1 |
| 4.3 | Bloc « Tout copier » + onglet vMix | EF-08.14, EF-08.22 | 1.1 |
| 4.4 | Accessibilité complète, i18n préparée | EF-29 | tout |
| 4.5 | Documentation intégrée | ENF-43 | tout |
| 4.6 | Jeton d'accès LAN | ENF-32 | 0.4 |

**Recette** : A-16, A-16b → A-16d, A-17, A-17b → A-17g.

**Critère de sortie** : CU-08, CU-11, CU-16 passent ; tous les tests P-01 → P-10 sont dans les seuils.

---

## 21.7 Dépendances critiques entre livrables

```
                     ┌──────────────┐
                     │ 0.2 API      │◀─── bloque TOUT
                     │ disque       │
                     └──────┬───────┘
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │0.3 assets│  │1.3 Bible │  │1.1 Sorties│
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │             │             │
             ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │2.6 médias│  │1.4 découpe│  │1.2 éditeur│
        └──────────┘  └────┬─────┘  └────┬─────┘
                           │             │
                           ▼             ▼
                      ┌───────────────────────┐
                      │ 2.5 looks · 2.1 profils│
                      └───────────────────────┘
```

**Risque identifié (R-07)** : vouloir commencer par la phase 1 sans la phase 0 conduit à
construire sur IndexedDB, donc à devoir tout refaire. C'est le piège à éviter.

---

## 21.8 Ce qui n'est pas planifié

| Élément | Motif |
|---|---|
| Application native (Electron/Tauri) | D-01 : non retenu |
| Génération d'un fichier de scène `.vmix` | D-06 : format non documenté |
| NDI, DeckLink, sortie matérielle | hors périmètre (§ 13 du CDC) |
| Signature / notarisation macOS | risque R-04, traitement séparé |
| Mise à jour automatique de l'application | non nécessaire : il suffit de remplacer le dossier |
| Application mobile native | la PWA couvre le besoin |
