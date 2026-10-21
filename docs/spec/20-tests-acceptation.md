# 20 — Grille de recette

> **Une phase n'est livrée que si tous ses tests passent.**
> Chaque test est binaire : il passe ou il ne passe pas. Aucun « partiellement ».

---

## 20.1 Comment exécuter la recette

| Niveau | Commande | Ce qu'il couvre | Prérequis |
|---|---|---|---|
| **Unitaire** | `npm test` | modules purs, API serveur | Node 20+ |
| **Navigateur** | `npm run test:browser` | parcours P0, rendu, clavier | Chromium |
| **Hors-ligne** | `npm run test:offline` | capture réseau, coupure | Chromium |
| **Manuel** | cette grille | ce qui ne s'automatise pas honnêtement | un humain |

**EF-20.1** — Chaque test ci-dessous porte un identifiant utilisé dans les tickets.
**EF-20.2** — Un test qui échoue produit un rapport lisible : action, attendu, obtenu, capture.

---

## 20.2 Bloc A — Socle et hors-ligne

### A-01 — Hors-ligne absolu

| Élément | Détail |
|---|---|
| **Préconditions** | projet préparé (bible, chant, média, plan), aucune connexion réseau |
| **Scénario** | lancer → ouvrir le studio → diffuser un verset, un chant, un média → avancer dans le plan → ouvrir une page de sortie |
| **Attendu** | tout fonctionne ; capture réseau = **0** requête vers un hôte externe |
| **Échec** | toute requête sortante, ou toute fonction dégradée |

### A-02 — Un double-clic

| Sous-test | Environnement | Attendu |
|---|---|---|
| **A-02** | sans Node + Internet | installation proposée, acceptée, application ouverte |
| **A-02b** | sans Node + **sans** Internet | instructions exactes (03-lanceur.md § 3.4.3), aucune tentative d'installation, sortie code `20` |
| **A-02c** | Node 16 présent | refus explicite avec la version minimale, code `30`, jamais de démarrage dégradé silencieux |
| **A-02d** | serveur déjà lancé sur le même dossier | navigateur ouvert sur l'instance existante, **un seul** serveur (vérifié par `ps` et par `.lock`) |
| **A-02e** | chemin avec accents et espaces (`/home/jean/L'Église du Plateau/`) | démarrage nominal, journal sans erreur d'encodage |
| **A-02f** | dossier en lecture seule | mode dégradé explicite, bandeau orange, aucune écriture tentée |
| **Échec** | installation silencieuse, stack trace affichée, deux serveurs sur le même dossier |

### A-03 — Dossier = projet

| Élément | Détail |
|---|---|
| **Scénario** | copier le dossier sur une autre machine, **vider tout le cache du navigateur**, ouvrir |
| **Attendu** | bibliothèque, looks, sorties, profils, événements **identiques** |
| **Échec** | un élément manquant, une ré-importation nécessaire |

### A-03b — Migration

| Élément | Détail |
|---|---|
| **Scénario** | migrer `openpresenter-sauvegarde-2026-08-09.json` (2,5 Mo, présent dans le dépôt) |
| **Attendu** | rapport d'analyse correct, tous les éléments restitués, journal téléchargeable |
| **Échec** | perte silencieuse d'un élément |

### A-04 — Copie à l'import

| Élément | Détail |
|---|---|
| **Scénario** | importer `/tmp/fond.jpg`, supprimer `/tmp/fond.jpg`, redémarrer |
| **Attendu** | le média s'affiche toujours ; `grep` sur `project/` : aucune occurrence de `/tmp/` |
| **Échec** | référence au chemin d'origine, média manquant |

### A-05 — Déduplication

| Scénario | Attendu |
|---|---|
| Importer deux fois le même fichier | un seul binaire dans `assets/`, `refs: 2` |
| Importer deux fichiers de contenu identique et de noms différents | un seul binaire, deux noms d'origine mémorisés |

---

## 20.3 Bloc B — Bible

### A-06 — Saisie clavier

| Sous-test | Frappes | Attendu |
|---|---|---|
| A-06 | `j` `e` `Entrée` `3` `Espace` `1` `6` `Entrée` | Jean 3:16 à l'écran, **sans souris** |
| A-06b | `jn` `Entrée` | Jean sélectionné |
| A-06c | `ésa` `Entrée` `40` `Espace` `31` `Entrée` | Ésaïe 40:31 |
| A-06d | coller `1 Corinthiens 13:4-7` + `Entrée` | plage diffusée |
| A-06e | `xyz` `Entrée` | message d'erreur, **champ non vidé** |
| A-06f | `je` `↓` `Entrée` | le deuxième livre est sélectionné |
| A-06g | `Jean` `Entrée` `99` | message `Jean ne contient pas de chapitre 99 (1 à 21)` |

### A-07 — Découpage lisible

| Sous-test | Texte | Limite | Attendu |
|---|---|---|---|
| A-07 | verset de 60 mots, 3 virgules | 25 | 3 parties, coupes sur les virgules |
| A-07b | verset de 60 mots sans ponctuation | 25 | 3 parties, coupes sur les espaces |
| A-07c | verset de 27 mots | 25 | **1 seule partie** (pas d'orphelin) |
| A-07d | verset de 52 mots | 25 | 2 parties équilibrées |
| A-07e | texte avec saut de ligne au mot 20 | 25 | coupe **sur le saut de ligne** |
| A-07f | `« Voici, je fais… »` | 4 | guillemets collés à leur contenu |
| A-07g | texte de 500 mots | 25 | 20 parties, aucune vide |
| A-07h | aucune partie de moins de 3 mots | — | vérifié sur les 7 cas |
| A-07i | annotations à cheval | — | le balisage est reporté sur les deux parties |
| A-07j | deux exécutions successives | — | résultat **identique** (déterminisme) |

### A-08 — Navigation

| Sous-test | Scénario | Attendu |
|---|---|---|
| A-08 | `→` répété | traverse toutes les parties puis le verset suivant |
| A-08b | clicker USB | navigation fonctionnelle |
| A-08c | `Maj + →` en partie 1/3 | va au verset suivant |
| A-08d | `Maj + ←` | revient à la partie 1 du verset précédent |
| A-08e | `←` au premier élément | ne fait rien (pas de sortie hors liste) |
| A-08f | `→` dans un champ de saisie | saisie normale, pas de navigation |
| A-08g | deux versions activées | découpage indépendant, indice borné |

---

## 20.4 Bloc C — Sorties

### A-09 — Matrice de liens

| Sous-test | Scénario | Attendu |
|---|---|---|
| A-09 | sortie `media: false` + URL `?kind=media` | rien affiché, message explicite |
| A-09b | diffuser un média vers 2 sorties dont une l'exclut | la sortie filtrée reste vide, toast |
| A-09c | renommer une sortie puis recharger l'ancien lien | le lien fonctionne |
| A-09d | supprimer une sortie puis ouvrir son lien | page « Sortie introuvable » + liste |
| A-09e | déconnecter une sortie en diffusion | les autres continuent ; reconnexion → resynchronisation |
| A-09f | 33ᵉ sortie | refus `Maximum : 32 sorties.` |
| A-09g | `?kind=` inconnu | comportement « tout », avertissement journalisé |

### A-10 — Éditeur de scène

| Sous-test | Scénario | Attendu |
|---|---|---|
| A-10 | comparer éditeur et `/o/out_bottom?kind=bible` | rendu **pixel-identique** |
| A-10b | rejouer les 13 étapes du § 8.8 | chaque étape conforme |
| A-10c | 9 combinaisons d'alignement | texte correctement placé |
| A-10d | `justify` sur 3 lignes | 2 justifiées, dernière centrée |
| A-10e | fond image + teinte 45 % + texte blanc | contraste ≥ 4,5:1 |
| A-10f | look modifié après édition de la scène d'origine | le look n'a pas changé |
| A-10g | déplacer un calque au-delà du bord | reste partiellement visible |
| A-10h | annuler 80 fois | 80 états restaurés |

---

## 20.5 Bloc D — Organisation

### A-11 — Profils

| Sous-test | Scénario | Attendu |
|---|---|---|
| A-11 | passer de « Église » à « Stream live » | sorties, looks, liens changent en une action |
| A-11b | diffuser puis revenir à l'accueil | l'aperçu montre le contenu en moins de 200 ms |
| A-11c | « Tout couper » depuis l'accueil | toutes les sorties vides en < 100 ms |
| A-11d | écran 1366×768 | les 4 zones de l'accueil visibles sans défilement |
| A-11e | navigation clavier depuis l'accueil | « Ouvrir le Studio » atteint en ≤ 5 tabulations |
| A-11f | profil référençant une scène supprimée | rapport, aucune erreur bloquante |
| A-11g | modifier une copie de profil | l'original intact |
| A-11h | export avec médias → import dans un projet vierge | tout fonctionne |
| A-11i | appliquer un profil en diffusion | confirmation, coupure, application atomique |

### A-12 — Accueil, Studio, Plan

| Sous-test | Scénario | Attendu |
|---|---|---|
| A-12 | `Ctrl+K`, `gra`, `Entrée` | premier chant diffusé |
| A-12b | `Alt+3` | module Médias |
| A-12c | changer de module en diffusion | la diffusion continue |
| A-12d | diffuser sans cible | message d'erreur |
| A-12e | 1366×768 | 3 colonnes + barre de plan utilisables |
| A-12f | créer/dupliquer/supprimer un événement | plan correct |
| A-12g | import CSV du § 14.4.3 | types reconnus, chants appariés |
| A-12h | `Espace` ×8 dans le plan | 8 étapes, notes non diffusées |
| A-12i | reculer d'une étape | contenu précédent rejoué |
| A-12j | dupliquer un événement | plan copié, historique non copié |
| A-12k | recharger au milieu du plan | position restaurée |

---

## 20.6 Bloc E — Contenus

| Test | Scénario | Attendu |
|---|---|---|
| A-13 | export complet → autre machine | tout fonctionne |
| A-13b | restaurer « Fusionner » deux fois | aucun doublon |
| A-13c | archive avec média manquant | signalé, restauration possible |
| A-13d | archive d'un format plus récent | refus, aucune écriture |
| A-13e | coupure pendant l'export | aucune archive partielle |
| A-13f | vidéo sur 2 sorties | dérive < 120 ms |
| A-13g | PPTX de 18 diapositives | conversion fidèle, navigation |
| A-13h | fichier `.ppt` | refus explicite avec solution |
| A-13i | média supprimé en diffusion | placeholder, pas de gel |

| Test | Scénario | Attendu |
|---|---|---|
| A-14 | annonce avec image | copiée, rendu correct sur 5 presets |
| A-14b | compte à rebours 35 min | seuils corrects, vue scène synchronisée |
| A-14c | changer de minuteur pendant un verset | le verset reste |
| A-14d | habillage + verset | coexistent |
| A-14e | recharger pendant un compte à rebours | temps correct |
| A-14f | importer un ChordPro | titre, sections, accords |
| A-14g | réordonner l'arrangement en direct | la vue scène suit |
| A-14h | changer d'arrangement au refrain | position conservée sur un refrain |

---

## 20.7 Bloc F — Résilience et interface

| Test | Scénario | Attendu |
|---|---|---|
| A-15 | tuer le serveur, relancer | état restauré |
| A-15b | message `urgent` | < 200 ms, au-dessus de tout |
| A-15c | télécommande par QR | fonctionnelle |
| A-15d | Wi-Fi coupé puis rétabli | reconnexion < 1 s |
| A-15e | vue scène à 5 m | lisible, rien ne manque |
| A-15f | 3 crans de taille | ajustement sans débordement |
| A-16 | catalogue désactivé | **0** requête sortante |
| A-16b | télécharger une Bible | importée, dédupliquée |
| A-16c | empreinte invalide | annulé, rien écrit |
| A-16d | timeout | message à 8 s, aucun blocage |
| A-17 | culte complet sans souris | aucune action à la souris |
| A-17b | `Échap` dans un champ | ne coupe pas |
| A-17c | clicker USB | fonctionnel |
| A-17d | remappage en conflit | message, refus |
| A-17e | zoom 200 % | rien d'inaccessible |
| A-17f | `prefers-reduced-motion` | aucune transition |
| A-17g | clé i18n manquante | texte français |

---

## 20.8 Bloc G — Journal, diagnostic et intégrité

> Détail contractuel : `23-journal-diagnostic.md`. Ces tests sont **manuels** sauf A-18h,
> qui est automatisé (analyse du rapport produit).

| Test | Scénario | Attendu |
|---|---|---|
| A-18 | diagnostic complet, tout nominal | 13 lignes vertes, rapport conforme à EF-30.17 |
| A-18b | débrancher une sortie | `DIAG-06` orange en < 10 s, sortie nommée, `Copier le lien` fonctionnel |
| A-18c | rendre `project.json` illisible | mode secours, `503 LOCKED` sur toute écriture, restauration proposée |
| A-18d | supprimer `cache/` puis ouvrir le diagnostic | `DIAG-12` orange, reconstruction < 3 s, retour au vert |
| A-18e | 200 diffusions puis `DIAG-09` | pas de fuite de sockets, latence < 50 ms |
| A-18f | rechercher un mot dans 30 jours de journal | résultat en < 3 s |
| A-18g | purger les entrées de plus de 7 jours | confirmation chiffrée, fichier du jour intact |
| A-18h | analyse du rapport de diagnostic | aucun chemin absolu, aucun jeton, aucune adresse MAC |
| A-18i | couper le serveur pendant l'affichage | lignes grises `Inconnu`, page conservée, reprise automatique |
| A-18j | `Ctrl+Maj+D` depuis le studio | diagnostic ouvert en < 300 ms |
| A-18k | 3 assets orphelins puis `Supprimer` | confirmation chiffrée, fichiers déplacés dans `backups/orphelins-<date>/` |

---

## 20.9 Tests de performance

| Test | Mesure | Seuil |
|---|---|---|
| P-01 | double-clic → page d'accueil | < 5 s (runtime présent) |
| P-02 | import d'une Bible de 40 000 versets | indexation < 3 s |
| P-03 | recherche dans cette Bible | < 50 ms |
| P-04 | diffusion → image sur la sortie | < 80 ms |
| P-05 | contrôleur → OBS | < 120 ms |
| P-06 | poids de l'accueil | < 150 Ko gzip |
| P-07 | poids du studio | < 300 Ko gzip |
| P-08 | poids d'une page de sortie | < 120 Ko gzip |
| P-09 | 200 diffusions successives | pas de fuite mémoire détectable |
| P-10 | 4 sorties + 1 vue scène simultanées | CPU < 40 % sur un PC de 2018 |

---

## 20.10 Couverture minimale exigée

| Module | Couverture |
|---|---|
| `src/modules/bible/*` | ≥ 90 % |
| `src/modules/songs/parser.mjs` | ≥ 90 % |
| `src/core/engine.mjs` (découpage, bindings) | ≥ 85 % |
| `src/core/output-registry.mjs` | ≥ 95 % |
| `src/core/viewport.mjs` | 100 % |
| `src/core/storage.mjs` | ≥ 80 % |
| `server.mjs` (routes API) | ≥ 85 % |

---

## 20.11 Rapport de recette

À la fin de chaque phase, produire :

```
PHASE X — RAPPORT DE RECETTE
Date : …
Tests     : 47
Réussis   : 45
Échoués   :  2   (A-07d, A-10e)
Ignorés   :  0

Détail des échecs
  A-07d  verset de 52 mots → 2 parties 26/26 attendu, obtenu 31/21
         → le point de coupe « balanceParts » n'est pas appliqué
  A-10e  contraste mesuré 4,1:1 (attendu ≥ 4,5:1)
         → la teinte par défaut des nouvelles scènes est trop claire

Décision : phase NON validée.
```
