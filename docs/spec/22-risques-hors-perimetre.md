# 22 — Risques et hors-périmètre

---

## 22.1 Risques

Chaque risque a un **propriétaire de décision** (la personne qui tranche si le risque se
matérialise) et une **mitigation vérifiable** (une action, pas une intention).

| ID | Risque | Prob. | Impact | Mitigation | Vérifiable par |
|---|---|---|---|---|---|
| **R-01** | Deux bases de code maintenues en parallèle → effort doublé, comportements divergents | **Certaine** | **Élevé** | Décision D-03 appliquée en phase 0.1 : consolidation en un dossier unique, suppression des doublons (§ 4.7 du CDC) | Un seul dossier `app/` dans le dépôt ; `servergestionobs/` et `openpresenter2/` archivés |
| **R-02** | Le runtime Node embarqué alourdit la distribution | Faible | Moyen | D-01 : runtime **détecté** + installation assistée ; l'archive complète reste une variante optionnelle | Le dépôt reste < 10 Mo ; aucun binaire dans Git |
| **R-03** | Migration IndexedDB → disque : perte de données existantes | Moyenne | **Élevé** | Outil de migration en phase 0.5, testé sur les sauvegardes réelles du dépôt | Test A-03b sur `openpresenter-sauvegarde-2026-08-09.json` |
| **R-04** | macOS Gatekeeper bloque `.command` et binaires non signés | **Certaine** | Moyen | Documentation « clic droit → Ouvrir », `xattr` documenté et appliqué par le lanceur (§ 3.4.4), signature envisagée plus tard | Test manuel sur macOS 14 et 15 |
| **R-05** | Rendu différent entre l'éditeur et la sortie OBS (CEF) | Moyenne | **Élevé** | Une seule fonction `render()` (ENF-42), `&debug=1`, test de comparaison de capture A-10 | A-10 passe sur OBS 28, 29, 30 |
| **R-06** | Médias très volumineux dans le dossier de projet | Moyenne | Moyen | D-04 : avertissement au-delà de 500 Mo, option `linked` signalée en orange | EF-02.6, EF-02.7 |
| **R-07** | Périmètre trop large → rien de fini | **Élevé** | **Élevé** | Phasage strict (ch. 21), recette bloquante, aucune phase commencée avant la précédente | Rapport de recette par phase |
| **R-08** | Licences hétérogènes des bibles du catalogue | Moyenne | Moyen | Licence affichée avant téléchargement (EF-27.10), bouton désactivé si inconnue (EF-27.11) | Revue de `catalog-sources.json` |
| **R-09** | Rendu des polices différent selon l'OS | Faible | Moyen | Toutes les polices par défaut sont vendues dans le dépôt (EF-09.57), avertissement si police système (EF-09.28) | `grep` : aucune police système dans les scènes livrées |
| **R-10** | Relais LAN sans authentification | Faible | **Élevé** | Jeton d'accès (ENF-32), `Origin` vérifié (ENF-31), avertissement explicite (ENF-33) | Revue de sécurité |
| **R-11** | Dépendance cachée à un CDN réintroduite par mégarde | Faible | **Élevé** | Test automatisé : `grep` des URL absolues dans les sources, échec de build si trouvé | Test d'intégrité CI |
| **R-12** | Le découpage des versets produit des parties trop courtes ou mal coupées | Moyenne | Moyen | Jeu de tests de référence obligatoire (A-07 → A-07j) | 10 sous-tests |
| **R-13** | Performance dégradée avec de grosses bibliothèques (40 000 versets) | Moyenne | Moyen | Index de recherche en cache disque (EF-11.1), chargement à la demande | Tests P-02, P-03 |
| **R-14** | Fuite mémoire avec les vidéos en boucle | Moyenne | Moyen | Révocation systématique des URLs (ENF-15.2), cache LRU | Test P-09 |
| **R-15** | L'utilisateur perd son travail parce qu'il a fermé l'onglet | Faible | **Élevé** | Écriture immédiate (EF-26.1), sauvegarde auto, restauration de session | CU-17 |
| **R-16** | Le port 8788 est souvent occupé (autres outils) | Moyenne | Faible | Incrément automatique jusqu'à +20, mémorisation du choix | A-02 |
| **R-17** | Le projet devient illisible après un changement de schéma | Faible | **Élevé** | `formatVersion` + migration automatique après sauvegarde (EF-03.37), refus si version trop récente | A-13d |
| **R-18** | Trop de sorties ouvertes saturent la machine | Faible | Moyen | Limite de 32 sorties, avertissement au-delà de 8 actives | EF-07.4 |

---

## 22.2 Ce qui est explicitement hors périmètre

Chaque exclusion est **assumée** et justifiée : ce n'est pas un oubli.

| Exclusion | Justification |
|---|---|
| **Encodage et diffusion RTMP / SRT / WebRTC** | OBS et vMix le font mieux, gratuitement, et sont déjà l'écosystème cible. Le logiciel fournit les **sources**, pas le transport. |
| **NDI, DeckLink, sortie SDI/HDMI matérielle** | Nécessite des pilotes natifs ; contredit P2 (dossier portable) et P3 (double-clic). |
| **Pilotage lumière (DMX, Art-Net)** | Domaine distinct ; une intégration approximative serait nuisible. |
| **MIDI / Stream Deck** | Prévoir l'API (les raccourcis clavier suffisent), ne pas implémenter. |
| **Application mobile native (iOS / Android)** | La PWA couvre le besoin sans store, sans compte, sans frais. |
| **Comptes utilisateurs, rôles, permissions** | Contredit P9 (zéro compte). Un projet = un dossier = une équipe. |
| **Synchronisation cloud obligatoire** | Contredit P1 et P9. Le partage se fait par dossier ou par archive. |
| **Édition vidéo, montage, étalonnage** | Hors sujet. |
| **Reconnaissance vocale, traduction automatique** | Dépend de services distants ; contredit P1. |
| **Calcul d'empreintes CCLI automatisé / déclarations** | Nécessite un compte CCLI et une connexion ; hors périmètre. |
| **Hébergement web des sorties** | Les sorties sont sur le LAN. Exposer sur Internet est explicitement déconseillé (ENF-33). |
| **Conversion `.ppt` / Keynote** | Aucune conversion fidèle possible ; message explicite + demande d'export PDF. |
| **Génération d'un fichier de scène `.vmix`** | D-06 : format non documenté publiquement, risque de corruption. La liste d'URLs est fournie. |
| **Signature / notarisation macOS** | Coût et complexité hors proportion de la phase 0 ; documenté comme manipulation manuelle. |
| **Mise à jour automatique** | Inutile : remplacer le dossier suffit, et c'est cohérent avec P2. |
| **Thèmes graphiques « design » avancés (masques, particules, shaders)** | Complexité de rendu et risque de divergence CEF (R-05). Les calques et filtres CSS couvrent l'essentiel. |

---

## 22.3 Ce qui est **reporté** (pas exclu)

| Élément | Raison du report | Phase envisagée |
|---|---|---|
| Génération `.vmix` | format non documenté (D-06) | après validation terrain |
| Paramètres de scène avancés (masques, tracés) | priorité plus basse que les fondations | après phase 2 |
| Mode kiosque (fenêtre dédiée) | D-11 | phase 4 |
| Traduction anglaise complète | EF-29.22 | après phase 4 |
| Synchronisation multi-projets | cas d'usage non exprimé | non planifié |
| Import OSIS / USFX | EF-11.4 | phase 2 (bibles) |

---

## 22.4 Décisions encore ouvertes

Depuis la version 1.0 du cahier des charges, **D-04** (seuil de 500 Mo, option `linked`
signalée) et **D-08** (scènes en fichiers séparés) sont tranchées : elles ne figurent plus
ici mais dans le CDC § 14.1. Les décisions restantes ne bloquent **aucune** phase.

| ID | Question | Recommandation | Échéance | Impact |
|---|---|---|---|---|
| **D-09** | Nom définitif du produit et du dossier | `OpenPresenter` | avant publication | cosmétique |
| **D-10** | Licence du projet | MIT | avant publication | aucune incidence technique |
| **D-11** | Mode kiosque en phase 4 ? | optionnel | avant phase 4 | aucune : le navigateur suffit |
| **D-12** | Langues livrées | FR livré, EN préparé | avant phase 4 | aucune : chaînes externalisées (ch. 25) |

**Règle** : aucune décision ouverte ne bloque la phase 0. Une décision qui deviendrait
bloquante est tranchée immédiatement et déplacée au § 14.1 du cahier des charges.

---

## 22.5 Signaux d'alerte à surveiller

Ces situations doivent déclencher une révision du plan, pas un contournement.

| Signal | Interprétation | Réaction |
|---|---|---|
| Un module dépasse 2× son estimation | le périmètre de la phase est trop large | découper, reporter la partie non critique |
| Une fonctionnalité exige une dépendance npm au runtime | violation de § 2.2 | réécrire ou abandonner la fonctionnalité |
| Une fonctionnalité exige une connexion pour fonctionner | violation de P1 | repenser ou abandonner |
| Le rendu éditeur ≠ rendu sortie | violation de ENF-42 | bloquer la phase, corriger le moteur |
| Un test de la grille est « presque » vert | il est rouge | ne pas livrer |
| Un utilisateur doit lire la doc pour démarrer | violation de P3 | retravailler le parcours |
| Le dossier projet ne suffit plus à tout transporter | violation de P2 | bloquer, corriger la persistance |
