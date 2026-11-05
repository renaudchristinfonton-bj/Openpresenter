# 27 — Annexe : atlas des écrans

> **But :** il n'existe **aucun** écran non répertorié. Chaque page, panneau et modale
> porte un identifiant `SCR-nn`, une route ou un déclencheur, un chapitre de référence
> et, quand elle existe, une maquette.
> **Règle :** un écran absent de ce chapitre ne doit pas être implémenté.

---

## 27.1 Convention

| Colonne | Sens |
|---|---|
| **ID** | identifiant stable `SCR-nn`, utilisé dans les tickets et les tests |
| **Route / déclencheur** | URL exacte, ou action qui ouvre l'écran |
| **Type** | page pleine · panneau · modale · superposition · console |
| **Chapitre** | où le contenu est spécifié |
| **Maquette** | capture de référence, si elle existe |
| **États** | états obligatoires, détaillés en 27.3 |

**AN-27.1** — Un écran est identifié dans le code par son `SCR-nn` (commentaire d'entête
du fichier ou du composant).
**AN-27.2** — Aucune route non listée ici n'est servie : le serveur renvoie 404 avec
`TXT: Cette page n'existe pas.` et un lien vers l'accueil.

---

## 27.2 Inventaire

### 27.2.1 Écrans publics (accessibles par URL, sans état)

| ID | Écran | Route | Type | Chapitre | Maquette | États |
|---|---|---|---|---|---|---|
| **SCR-01** | Page d'accueil | `/` | page | 05 | MAQ-01 | nominal, première utilisation, aucune sortie, aucune Bible, lecture seule, serveur injoignable |
| **SCR-02** | Studio unifié | `/studio.html` | page | 06 | MAQ-03 (Bible) · MAQ-04 (Chants) | nominal, module vide, erreur de chargement, hors-ligne |
| **SCR-03** | Éditeur de scène | `/studio.html#/scene/<sceneId>` | page (plein écran logique) | 08 | MAQ-05 | nominal, scène vide, modifications non enregistrées, police manquante |
| **SCR-04** | Page de sortie | `/o/<outputId>` | page nue | 07 | — (voir 27.6) | en attente, contenu diffusé, coupé, sortie introuvable, type non autorisé, hors-ligne |
| **SCR-05** | Page de sortie filtrée | `/o/<outputId>?kind=<kind>` | page nue | 07 | — | idem + `kind` inconnu |
| **SCR-06** | Vue scène | `/stage.html` | page | 15 | MAQ-09 | nominal, écran noir, minuteur, message urgent, aucune diffusion |
| **SCR-07** | Télécommande | `/remote.html` | page PWA | 15 | — | nominal, appairage par QR, jeton invalide, hors-ligne |
| **SCR-08** | Diagnostic | `/diagnostic.html` | page | 23 | MAQ-10 | nominal, avertissements, erreurs, serveur injoignable, mode secours |
| **SCR-09** | Intégrité du projet | `/diagnostic.html#integrite` | page | 04, 23 | — | nominal, orphelins, références cassées, aucune anomalie |
| **SCR-10** | Mode secours | `/diagnostic.html` (si `project.json` illisible) | page | 23 | — | projet illisible, version trop récente, dossier absent |
| **SCR-11** | Mur des sorties | `/wall.html` | page | 05, 07 | — | 1 → 32 sorties, sortie sans client |
| **SCR-12** | Console du lanceur | terminal (hors navigateur) | console | 03 | MAQ-02 | diagnostic en cours, installation, erreur, démarrage réussi |

### 27.2.2 Panneaux et modales du Studio

| ID | Écran | Déclencheur | Type | Chapitre | Maquette | États |
|---|---|---|---|---|---|---|
| **SCR-13** | Module Plan | `Alt+1` | panneau | 14 | MAQ-08 | nominal, plan vide, événement passé, étape en cours |
| **SCR-14** | Module Bible | `Alt+2` | panneau | 09 | MAQ-03 | nominal, saisie en cours, suggestions, livre introuvable, aucune Bible |
| **SCR-15** | Module Chants | `Alt+3` | panneau | 10 | MAQ-04 | nominal, aucune section, arrangement en cours |
| **SCR-16** | Module Médias | `Alt+4` | panneau | 11 | — | nominal, import en cours, format refusé, média manquant |
| **SCR-17** | Module Annonces | `Alt+5` | panneau | 12 | — | nominal, annonce vide, image manquante |
| **SCR-18** | Module Minuteur | `Alt+6` | panneau | 12 | — | arrêté, en cours, seuil orange, seuil rouge, terminé |
| **SCR-19** | Module Habillages | `Alt+7` | panneau | 12 | — | nominal, aperçu, en diffusion |
| **SCR-20** | Module Sorties + matrice | `Alt+8` | panneau | 07 | MAQ-06 | nominal, 32 sorties, sortie désactivée, lien copié |
| **SCR-21** | Module Profils | `Alt+9` | panneau | 13 | MAQ-07 | nominal, profil en cours, profil invalide, application en diffusion |
| **SCR-22** | Module Événements | volet | panneau | 14 | MAQ-08 | nominal, aucun événement, récurrence |
| **SCR-23** | Module Bibliothèque | volet | panneau | 06 | — | nominal, recherche sans résultat, filtre actif |
| **SCR-24** | Module Réglages | volet | panneau | 06 | — | nominal, réglage modifié non appliqué, redémarrage requis |
| **SCR-25** | Recherche unifiée | `Ctrl/Cmd+K` | superposition | 06 | — | vide, résultats, aucun résultat, 50 résultats atteints |
| **SCR-26** | Inspecteur de scène | sélection d'un calque | panneau | 08 | MAQ-05 | aucun calque, calque verrouillé, propriété avancée dépliée |
| **SCR-27** | Barre de plan | toujours | panneau fixe | 06 | MAQ-03 | plan vide, étape courante, dernière étape |
| **SCR-28** | Barre de diffusion | toujours (modules de contenu) | panneau fixe | 06 | MAQ-03 | aucune cible, une cible, plusieurs cibles |
| **SCR-29** | Assistant de premier lancement | premier démarrage | modale | 05, 13 | — | étape 1/3, 2/3, 3/3, annulé |
| **SCR-30** | Import / migration | Réglages → Importer | modale | 04 | — | choix de source, analyse, rapport, import en cours, import terminé, erreur |
| **SCR-31** | Export du projet | Réglages → Exporter | modale | 16 | — | options, préparation, écriture, terminé, échec |
| **SCR-32** | Restauration d'archive | Réglages → Restaurer | modale | 16 | — | aperçu, remplacer, fusionner, conflit, terminé |
| **SCR-33** | Catalogue en ligne | Réglages → Catalogue | page modale | 17 | MAQ-13 | désactivé, chargement, liste, téléchargement, hors-ligne, licence inconnue |
| **SCR-34** | Journal | Réglages → Journal · Diagnostic → `Voir le journal` | panneau | 23 | — | nominal, filtre actif, aucun résultat, purge |
| **SCR-35** | Toasts | toute action | superposition | 06 | — | succès, information, avertissement, erreur (copiable) |
| **SCR-36** | Confirmations | action destructive | modale | 04, 08, 16, 23 | — | confirmation simple, double confirmation (nom saisi) |

**AN-27.3** — Les identifiants `SCR-13` → `SCR-24` désignent des **modules** : ils
partagent la même route (`/studio.html`) et ne changent pas d'URL (EF-06.5, aucun iframe).
**AN-27.4** — `SCR-03` est une **vue plein écran** du studio, pas une page séparée : la
barre de plan reste accessible par `Échap` (sortie de l'éditeur, pas de la page).

---

## 27.3 Matrice des états obligatoires

Chaque cellule indique ce qui doit être affiché **à la place du contenu normal**.

| Écran | Vide | Chargement | Erreur | Hors-ligne | Lecture seule |
|---|---|---|---|---|---|
| SCR-01 accueil | `Bienvenue. Choisissez un profil pour commencer →` | squelettes des cartes, jamais d'écran blanc | carte remplacée par `TXT: Cette sortie n'a pas pu être chargée.` + `Réessayer` | `TXT: Serveur déconnecté — relancez OpenPresenter.` | bandeau orange permanent, boutons d'écriture désactivés |
| SCR-02 studio | module affiche `TXT: Aucun contenu.` | squelettes par module | toast d'erreur + module conservé | bandeau `⚠ Serveur déconnecté — affichage en cache, modifications désactivées` | bandeau + `Enregistrer` masqué |
| SCR-03 éditeur | emplacement `＋ <nom>` (EF-09.35) | canevas vide avec damier | `TXT: Cette scène n'a pas pu être chargée.` | édition désactivée, aperçu figé | édition désactivée, export d'image autorisé |
| SCR-04 sortie | noir absolu (pas de logo, pas de texte) | rien (le noir est l'état de chargement) | `TXT: Sortie introuvable.` + liste des sorties | noir + reconnexion automatique | sans objet |
| SCR-06 vue scène | `TXT: Rien à l'antenne` discret | noir | noir + point rouge discret | noir, minuteur local poursuivi | sans objet |
| SCR-08 diagnostic | sans objet | `Vérification…` par ligne | ligne rouge + action | lignes grises `Inconnu` | avertissement lecture seule |
| SCR-14 bible | `TXT: Importez une Bible pour pouvoir diffuser des versets.` | indexation avec pourcentage | `TXT: Cette version biblique est illisible.` | lecture cache | saisie désactivée |
| SCR-20 sorties | `TXT: Aucune sortie. Créez-en une pour diffuser.` | squelettes | `TXT: La liste des sorties est illisible.` | dernière liste connue | `＋ Créer` masqué |
| SCR-25 recherche | historique des 5 dernières recherches | `Recherche…` après 120 ms | `TXT: Recherche indisponible.` | recherche locale uniquement | sans objet |
| SCR-33 catalogue | `TXT: Aucune source disponible.` | chargement des entrées | `TXT: Le catalogue est injoignable.` | `TXT: Aucune connexion Internet.` | bouton `Télécharger` masqué |

**AN-27.5** — Aucun écran n'affiche de spinner seul pendant plus de **1 s** : au-delà,
un texte explicite accompagne le spinner.
**AN-27.6** — Aucun écran ne reste blanc : l'état « chargement » a toujours un squelette
ou un texte.

---

## 27.4 Carte de navigation

```text
                        ┌──────────────────────────┐
   double-clic ────────▶│ SCR-12 Console du lanceur│
                        └────────────┬─────────────┘
                                     │ ouvre le navigateur
                                     ▼
                        ┌──────────────────────────┐
                        │      SCR-01 Accueil      │◀──────────┐
                        └──┬───────┬────────┬──────┘           │
             ┌─────────────┘       │        └────────────┐     │
             ▼                     ▼                     ▼     │
   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐│
   │ SCR-02 Studio    │  │ SCR-08 Diagnostic│  │ SCR-11 Mur   ││
   │  13 modules      │  │  SCR-09 Intégrité│  │  des sorties ││
   └───┬──────┬───────┘  │  SCR-10 Secours  │  └──────────────┘│
       │      │          │  SCR-34 Journal  │                  │
       │      │          └──────────────────┘                  │
       │      └── SCR-03 Éditeur de scène                       │
       │                                                       │
       ├── SCR-25 Recherche (Ctrl+K) ───────────────────────────┘
       │
       ├── SCR-29 Assistant · SCR-30 Migration · SCR-31 Export
       │   SCR-32 Restauration · SCR-33 Catalogue
       │
       └── liens de sortie (copiés dans OBS/vMix)
             │
             ├──▶ SCR-04 / SCR-05 page de sortie  (OBS, vMix, écran)
             ├──▶ SCR-06 vue scène                (écran salle / retour)
             └──▶ SCR-07 télécommande             (téléphone, PWA)
```

**AN-27.7** — Tout écran autre que `SCR-04` et `SCR-05` affiche un chemin de retour vers
l'accueil en un clic.
**AN-27.8** — Une page de sortie (`SCR-04`, `SCR-05`) n'affiche **aucun** élément
d'interface : ni bouton, ni curseur, ni fond autre que celui de la scène.

---

## 27.5 Éléments communs à tous les écrans d'interface

| Élément | Règle | Référence |
|---|---|---|
| Bandeau hors-ligne | pleine largeur, sous l'entête, orange, non fermable | EF-01.14 |
| Bandeau lecture seule | pleine largeur, orange, avec `TXT: Le projet est en lecture seule.` | 04 § 4.5 |
| Toasts | empilés en bas à droite, 4 s (erreur : jusqu'à fermeture), un seul `⧉` par toast | EF-06.33 |
| Modale de confirmation | `Échap` = annuler, focus sur le bouton sûr | EF-01.15 |
| Focus clavier | visible en permanence, anneau de 2 px `#f5b942` | EF-29 |
| Mouvement réduit | aucune transition si `prefers-reduced-motion` | A-17f |
| Zoom 200 % | aucune information inaccessible | A-17e |
| Langue | français par défaut, aucune chaîne codée en dur | 25 |

---

## 27.6 Couverture par les maquettes

| Écran | Maquette | Fichier |
|---|---|---|
| SCR-01 | MAQ-01 | `maq-01-accueil.html` |
| SCR-12 | MAQ-02 | `maq-02-lanceur.html` |
| SCR-02 (Bible) · SCR-14 | MAQ-03 | `maq-03-studio-bible.html` |
| SCR-02 (Chants) · SCR-15 | MAQ-04 | `maq-04-chants.html` |
| SCR-03 · SCR-26 | MAQ-05 | `maq-05-editeur.html` |
| SCR-20 | MAQ-06 | `maq-06-liens.html` |
| SCR-21 | MAQ-07 | `maq-07-profils.html` |
| SCR-13 · SCR-22 | MAQ-08 | `maq-08-plan.html` |
| SCR-06 | MAQ-09 | `maq-09-scene.html` |
| SCR-08 | MAQ-10 | `maq-10-diagnostic.html` |
| SCR-04 · SCR-05 | MAQ-11 | `maq-11-sorties.html` |
| SCR-24 · SCR-34 | MAQ-12 | `maq-12-reglages.html` |
| SCR-33 | MAQ-13 | `maq-13-catalogue.html` |
| SCR-29 · SCR-30 | MAQ-14 | `maq-14-premier-lancement.html` |

**AN-27.9** — Les écrans sans maquette sont ceux dont la disposition est décrite par un
schéma ASCII dans leur chapitre (`SCR-07`, `SCR-11`, `SCR-27`, `SCR-28`, `SCR-35`,
`SCR-36`) : le schéma ASCII est alors **normatif**, au même titre qu'une maquette.
**AN-27.10** — Un écran qui reçoit une maquette ultérieurement doit voir son schéma ASCII
remplacé par la référence `MAQ-nn`, pas conservé en double.

---

## 27.7 Écrans vus depuis un autre appareil

| Écran | Appareil | Contrainte |
|---|---|---|
| SCR-07 télécommande | téléphone en portrait, 360 → 430 px | boutons ≥ 48 px, aucune saisie de texte obligatoire |
| SCR-02 studio (repli) | tablette paysage, 1024 px | volets repliés, barre de plan conservée |
| SCR-06 vue scène | écran 16:9 en plein écran | texte lisible à 5 m (A-15e) |
| SCR-04/05 sortie | client OBS/vMix, résolution quelconque | rendu identique à l'éditeur (A-10) |

**AN-27.11** — La télécommande ne dépend d'aucun store, d'aucune installation et
d'aucun compte : c'est une page du serveur local (P9).
**AN-27.12** — L'adresse de la télécommande contient le jeton LAN
(`/remote.html?t=4F2K`) ; sans jeton valide, l'écran affiche
`TXT: Code d'accès incorrect. Scannez le QR affiché sur l'accueil.` et aucun contrôle.
