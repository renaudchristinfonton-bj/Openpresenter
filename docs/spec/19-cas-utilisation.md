# 19 — Cas d'utilisation détaillés

> Chaque cas est écrit pour être **rejouable tel quel** par quelqu'un qui n'a jamais vu
> le logiciel. Il sert de base aux tests d'acceptation (`20-tests-acceptation.md`).
>
> Notation : **Acteur** · **Préconditions** · **Scénario nominal** · **Variantes** ·
> **Erreurs** · **Postconditions**.

---

## 19.1 Index des cas

| ID | Titre | Acteur | Priorité |
|---|---|---|---|
| CU-01 | Premier lancement sur un PC vierge | PE-1 | P0 |
| CU-02 | Préparer un culte du dimanche | PE-2 | P0 |
| CU-03 | Évènement Saint-Valentin de A à Z | PE-2 | P0 |
| CU-04 | Live stream avec overlays sélectifs | PE-5 | P0 |
| CU-05 | Conduire le culte en direct au clavier | PE-1 | P0 |
| CU-06 | Dépannage pendant le culte | PE-1 | P0 |
| CU-07 | Transférer le projet sur un autre PC | PE-2 | P0 |
| CU-08 | Culte complet sans Internet | PE-6 | P0 |
| CU-09 | Le bénévole remplaçant | PE-1 | P0 |
| CU-10 | Créer un profil d'église réutilisable | PE-4 | P1 |
| CU-11 | Importer une nouvelle Bible | PE-2 | P1 |
| CU-12 | Créer un habillage d'intervenant | PE-2 | P1 |
| CU-13 | Régler le minuteur de prédication | PE-2 | P1 |
| CU-14 | Diffuser un PowerPoint | PE-2 | P1 |
| CU-15 | Rejouer un culte de l'année dernière | PE-2 | P1 |
| CU-16 | Partager un look avec une autre église | PE-4 | P2 |
| CU-17 | Récupérer après une coupure de courant | PE-1 | P1 |
| CU-18 | Ajouter un second écran en cours de culte | PE-5 | P2 |

---

## CU-01 — Premier lancement sur un PC vierge

**Acteur** : PE-1 (bénévole régie)
**Préconditions** : le dossier `OpenPresenter` a été copié sur le PC ; Node.js **n'est pas** installé ; le PC a Internet.

| # | Action | Résultat attendu |
|---|---|---|
| 1 | Double-clic sur `OpenPresenter.bat` | une fenêtre de console s'ouvre avec l'en-tête OpenPresenter |
| 2 | — | la console affiche `✗ Runtime Node.js introuvable` puis propose l'installation avec l'URL, la taille et l'empreinte |
| 3 | L'utilisateur laisse le choix par défaut (`Entrée` = Installer) | barre de progression du téléchargement |
| 4 | — | `✓ Runtime Node.js v22.11.0 (runtime/node)` |
| 5 | — | `✓ Projet project/ (vide)` — arborescence créée |
| 6 | — | `✓ Port 8788 disponible` · `✓ Serveur démarré en 1,8 s` |
| 7 | — | bloc d'adresses affiché avec code d'accès |
| 8 | — | le navigateur par défaut s'ouvre sur `http://localhost:8788/` |

**Postconditions** : la page d'accueil affiche un bandeau `Bienvenue. Choisissez un profil pour commencer →`, trois profils sont disponibles, une Bible de démonstration est proposée.

**Variante A — pas d'Internet** : l'option d'installation disparaît, les instructions Windows exactes s'affichent (`https://nodejs.org/fr`, installateur `.msi` LTS), code de sortie `70` si l'utilisateur abandonne.

**Variante B — Node 16 déjà présent** : `✗ Runtime Node.js v16.20.2 — version trop ancienne (20 minimum)` avec les instructions de mise à jour. Aucune tentative d'exécution.

**Variante C — double-clic alors que le serveur tourne** : `OpenPresenter tourne déjà sur ce dossier.` + ouverture du navigateur, aucun second serveur.

**Erreurs** :
- Dossier en lecture seule → mode dégradé + bandeau permanent.
- Aucun port libre entre 8788 et 8808 → message listant les ports et la commande `PORT=9000`.

---

## CU-02 — Préparer un culte du dimanche

**Acteur** : PE-2 (opérateur confirmé)
**Préconditions** : projet existant, profil « Église » actif, bibliothèques remplies.
**Durée cible** : ≤ 30 minutes.

| # | Action | Résultat |
|---|---|---|
| 1 | Accueil → `＋ Nouvel événement` | formulaire d'événement |
| 2 | Nom `Culte du 26/10`, date `26/10/2026 08:30`, lieu `Temple principal`, profil `ICC Pahou — Culte du dimanche` | événement créé, plan vide |
| 3 | Studio → Chants → `+ Importer` → 4 fichiers ChordPro | 4 chants importés, sections détectées |
| 4 | Chants → chant 1 → arrangement | sections réordonnées si besoin |
| 5 | Bible → `Ctrl+K` → `jean 3:16-18` `Entrée` | verset diffusé en aperçu |
| 6 | Plan → `+ Étape` × 7 : Accueil (note), chant 1, Jean 3:16-18, Offrande (note), chant 2, Minuteur Prédication, Prière (note) | 7 étapes, durée totale affichée |
| 7 | Sorties → vérifier `Plein écran` et `Bas centré` | 2 sorties, aperçus corrects |
| 8 | Looks → appliquer `Sobre` | scènes mises à jour sur les deux sorties |
| 9 | Fermer le studio | aucune perte : tout est déjà écrit |

**Postconditions** : le lendemain, l'événement est en tête de liste, son plan est intact, le profil est déjà sélectionné.

**Variante — import CSV** : au lieu de l'étape 6, `⬆ Importer un plan` avec le déroulé en texte ; les chants sont appariés par titre, les références bibliques reconnues.

**Erreurs** :
- Un chant importé a le même titre qu'un chant existant → avertissement, proposition de renommer ou de fusionner.
- Une référence biblique du plan n'existe pas → l'étape est créée en `note` avec un avertissement.

---

## CU-03 — Évènement Saint-Valentin de A à Z

**Acteur** : PE-2
**Préconditions** : une image de fond `coeurs.jpg` sur le PC.

| # | Action | Résultat |
|---|---|---|
| 1 | Accueil → `＋ Nouvel événement` → `Saint-Valentin 2027`, `14/02/2027` | événement créé |
| 2 | Studio → Sorties → `Bas centré — Stream` → Scènes → Bible → `Modifier…` | éditeur de scène ouvert |
| 3 | Calque `Fond` → Source `Image` → importer `coeurs.jpg` | image copiée dans `assets/backgrounds/`, affichée en `cover` |
| 4 | Fond → Teinte `#2a0511`, opacité `45 %`, luminosité `90 %` | fond lisible pour du texte blanc |
| 5 | Calque `Référence` → grille **haut · centre** → police `Cinzel`, taille `26`, couleur `#ffb3c6`, petites capitales | référence stylée en haut |
| 6 | Calque `Verset` → grille **bas · centre** → `justify`, dernière ligne centrée, taille `40`, interlignage `1,45` | verset justifié en bas |
| 7 | Scène → Découpage → `auto`, `words`, **25 mots** | versets longs découpés |
| 8 | Scène → Transition `slide-up` 300 ms | animation enregistrée |
| 9 | `Enregistrer` sous `Bas centré — Saint-Valentin` | scène créée |
| 10 | Looks → `Enregistrer comme look` → `Saint-Valentin` | look embarquant une copie de la scène |
| 11 | Bible → `1 Corinthiens 13:4-7` `Entrée` | 4 parties navigables, fond et référence lisibles |
| 12 | `→` trois fois | traverse les parties puis le verset suivant |
| 13 | L'année suivante : dupliquer l'événement, appliquer le look `Saint-Valentin` | tout est déjà prêt |

**Postconditions** : l'événement porte sa couleur d'identification, son look, son plan type.

**Variante — plein écran aussi** : répéter les étapes 2 à 9 sur `Plein écran — Salle` avec `40` mots par écran.

---

## CU-04 — Live stream avec overlays sélectifs

**Acteur** : PE-5
**Préconditions** : OBS installé ; le studio ouvert sur le même PC.

| # | Action | Résultat |
|---|---|---|
| 1 | Sorties → `+ Créer une sortie` → `Stream — bandeau`, preset `Bas centré`, transparent, `1920×1080` | sortie créée |
| 2 | Propriétés → `Reçoit` : Bible ✓, Chants ✓, Médias ✗, Annonces ✓, Habillage ✓, Minuteur ✗ | filtre réglé |
| 3 | Liens → cellule `Bible` → `⧉` | URL `…/o/out_stream?kind=bible` copiée |
| 4 | OBS → Source navigateur `BIBLE BAS` → coller → `1920×1080` | source créée |
| 5 | Liens → cellule `Habillage` → `⧉` → OBS → source `HABILLAGE` | deuxième source |
| 6 | Studio → Bible → diffuser `Jean 3:16` vers `Stream — bandeau` | le verset apparaît **uniquement** dans le bandeau |
| 7 | Studio → Médias → diffuser un visuel vers la même sortie | **rien ne s'affiche** ; toast `Cette sortie ne reçoit pas les médias` |
| 8 | Diffuser le même visuel vers `Plein écran — Salle` | le visuel s'affiche en salle, pas sur le stream |

**Postconditions** : les scènes OBS sont stables ; renommer la sortie ne casse aucun lien.

**Variante — assistant OBS** : `Installer dans OBS` → adresse, mot de passe → les 12 sources et 3 scènes sont créées automatiquement.

**Erreurs** :
- OBS injoignable → `Impossible de joindre OBS à ws://localhost:4455…`
- Source existante de même nom → non modifiée (option par défaut).

---

## CU-05 — Conduire le culte en direct au clavier

**Acteur** : PE-1
**Préconditions** : plan chargé, deux sorties connectées.

| # | Touche | Résultat |
|---|---|---|
| 1 | `Espace` | étape 1 (note `Accueil`) : rien n'est diffusé, le libellé s'affiche partout |
| 2 | `Espace` | étape 2 (chant) : le couplet 1 s'affiche sur les deux sorties |
| 3 | `→` ×3 | traverse les parties du couplet, puis passe au refrain |
| 4 | `Maj + →` | saute à la section suivante |
| 5 | `Espace` | étape 3 (verset `Jean 3:16`) : le verset s'affiche |
| 6 | `→` | partie 2/3 |
| 7 | `Maj + ←` | revient à la partie 1 du verset courant |
| 8 | `Espace` | étape 4 (note `Offrande`) |
| 9 | `Échap` | toutes les sorties coupées en < 100 ms |

**Postconditions** : la barre de plan affiche toujours l'étape suivante ; la vue scène a suivi en continu.

**Erreurs** :
- `Espace` dans un champ de recherche → saisie normale, pas d'avance.
- Fin du plan atteinte → `Fin du plan.`, pas de dépassement.

---

## CU-06 — Dépannage pendant le culte

**Acteur** : PE-1

| Incident | Comportement attendu |
|---|---|
| Une vidéo ne charge plus | placeholder `Média indisponible`, la sortie continue d'afficher le reste, toast d'avertissement |
| OBS plante | les autres sorties ne sont pas affectées ; pastille grise sur la sortie concernée |
| Le Wi-Fi de la télécommande tombe | la régie locale continue ; à la reconnexion, resynchronisation en < 1 s |
| Le serveur est tué | relancer le lanceur ; position du plan et dernier contenu restaurés |
| Un fichier média est supprimé sur le disque | placeholder + signalement dans Intégrité |
| La clé USB est retirée | arrêt propre avec message `Le dossier du projet a été déplacé ou déconnecté` |
| Le PC rame (100 % CPU) | la diffusion continue ; les animations peuvent sauter, jamais l'affichage du texte |

**Postcondition** : aucun cas ne produit d'écran figé (P10).

---

## CU-07 — Transférer le projet sur un autre PC

**Acteur** : PE-2

| # | Action | Résultat |
|---|---|---|
| 1 | Fermer OpenPresenter (la fenêtre de console) | sauvegarde de l'état de session |
| 2 | Copier **le dossier entier** sur une clé USB | — |
| 3 | Sur le PC de la salle, double-cliquer sur `OpenPresenter.bat` | le lanceur détecte ou propose Node |
| 4 | — | `✓ Projet project/ (3 bibles · 84 chants · 213 médias)` |
| 5 | — | le navigateur s'ouvre, tout est identique : profils, événements, looks, sorties |

**Postconditions** : aucune ré-importation, aucune reconfiguration, liens OBS identiques.

**Variante — cache navigateur vidé** : aucun effet, les données ne sont pas dans le navigateur (P2, D-02).

---

## CU-08 — Culte complet sans Internet

**Acteur** : PE-6

| # | Action | Résultat |
|---|---|---|
| 1 | Débrancher le câble réseau / couper le Wi-Fi | — |
| 2 | Double-cliquer sur `OpenPresenter.sh` | démarrage nominal |
| 3 | Ouvrir le studio | fonctionnement complet |
| 4 | Diffuser verset, chant, média, plan | tout fonctionne |
| 5 | Régie → accueil → ouvrir un lien OBS | fonctionne (le LAN local n'a pas besoin d'Internet) |
| 6 | Ouvrir le catalogue | `Aucune connexion Internet détectée. Le catalogue est indisponible — le reste du logiciel n'est pas affecté.` |

**Postconditions** : aucun événement du culte n'a été empêché par l'absence de réseau.

**Critère mesurable** : capture réseau pendant tout le scénario → **0** requête vers un hôte externe.

---

## CU-09 — Le bénévole remplaçant

**Acteur** : PE-1, qui n'a jamais préparé ce culte

| # | Action | Résultat |
|---|---|---|
| 1 | Double-clic | navigateur sur l'accueil |
| 2 | — | l'événement du jour est **déjà** sélectionné, le profil aussi, le plan est chargé |
| 3 | Clic sur `OUVRIR LE STUDIO UNIFIÉ` | studio, module Plan actif |
| 4 | `Espace` | le culte avance |
| 5 | En cas de doute : `?` | aide clavier du contexte |

**Postconditions** : il n'a eu à comprendre **aucune** notion technique.

---

## CU-10 — Créer un profil d'église réutilisable

**Acteur** : PE-4

| # | Action | Résultat |
|---|---|---|
| 1 | Configurer sorties, looks et réglages pour l'église | — |
| 2 | Profils → `Enregistrer la configuration actuelle comme profil` | formulaire nommée |
| 3 | Nom `ICC Pahou — Culte`, type `Église`, couleur, icône | profil créé |
| 4 | Profils → `Exporter` → `.opprofile.json` | fichier autonome |
| 5 | Une autre église importe ce fichier | les sorties, looks et réglages sont recréés |
| 6 | Cette église applique le profil | configuration identique, un clic |

---

## CU-11 — Importer une nouvelle Bible

**Acteur** : PE-2

| # | Action | Résultat |
|---|---|---|
| 1 | Bible → `+ Importer` → choisir `FrenchBDSBible.xml` | détection automatique |
| 2 | — | `Bible détectée : Beblia XML · 66 livres · 1 189 chapitres · 31 102 versets` |
| 3 | Nommer `Bible du Semeur`, abréviation `BDS` | — |
| 4 | `Valider` | fichier copié dans `assets/bibles/`, indexation, version disponible |
| 5 | Définir comme version par défaut | — |
| 6 | Cocher `2 versions`, choisir `LSG` en secondaire | affichage côte à côte |

---

## CU-12 — Créer un habillage d'intervenant

**Acteur** : PE-2

| # | Action | Résultat |
|---|---|---|
| 1 | Habillages → `+ Nouveau` → disposition `classic` | formulaire |
| 2 | Titre `Pasteur Jean Dossou`, sous-titre `Prédicateur` | — |
| 3 | Logo → importer `logo-icc.png` | copié dans `assets/logos/` |
| 4 | Animation entrée `slide-left`, 400 ms, sortie `slide-left` | — |
| 5 | `Enregistrer` → `Diffuser` sur la sortie transparente | bandeau affiché ; un verset en cours n'est **pas** masqué |
| 6 | `Couper l'habillage` | le bandeau disparaît, le verset reste |

---

## CU-13 — Régler le minuteur de prédication

| # | Action | Résultat |
|---|---|---|
| 1 | Minuteurs → `Prédication` → `countdown` → 35 min | — |
| 2 | Seuils : orange à 5 min, rouge à 1 min | — |
| 3 | `Démarrer` | le minuteur apparaît sur la vue scène |
| 4 | À 5 min restantes | passage en orange |
| 5 | À 1 min | passage en rouge, clignotement doux |
| 6 | Envoyer le message `Il reste 5 min` ton `important` | s'affiche en grand sur la vue scène |
| 7 | Recharger la page de la vue scène | le temps continue correctement |

---

## CU-14 — Diffuser un PowerPoint

| # | Action | Résultat |
|---|---|---|
| 1 | Médias → `+ Importer` → `predication.pptx` | copié, converti |
| 2 | — | `18 diapositives` détectées |
| 3 | Si des polices manquent → `2 polices du fichier sont absentes et ont été remplacées.` | — |
| 4 | `Diffuser` | diapositive 1 à l'écran |
| 5 | `→` ×4 | diapositive 5, indicateur `page 5 / 18` |

---

## CU-15 — Rejouer un culte de l'année dernière

| # | Action | Résultat |
|---|---|---|
| 1 | Événements → `Passés` → `Saint-Valentin 2026` | événement en lecture seule |
| 2 | `Dupliquer` → date `14/02/2027` | nouveau plan identique, historique non copié |
| 3 | Le look de l'époque est toujours disponible | — |
| 4 | Appliquer le look | scènes restaurées |

---

## CU-16 — Partager un look avec une autre église

| # | Action | Résultat |
|---|---|---|
| 1 | Looks → `Saint-Valentin` → `Exporter` | `.oplook.json` avec fond encodé (si ≤ 5 Mo) |
| 2 | Envoi par messagerie | — |
| 3 | L'autre église importe le fichier | look créé, fond restauré |
| 4 | Applique le look à sa sortie | mêmes couleurs, mêmes calques |

---

## CU-17 — Récupérer après une coupure de courant

| # | Action | Résultat |
|---|---|---|
| 1 | Le courant est coupé en pleine diffusion | — |
| 2 | Le courant revient, double-clic | démarrage nominal |
| 3 | — | `✓ Dernière session restaurée : Culte du 26/10, étape 4 « Offrande »` |
| 4 | `Espace` | reprend à l'étape 5 |

**Postconditions** : aucun fichier corrompu (écriture atomique), aucune sauvegarde manuelle nécessaire.

---

## CU-18 — Ajouter un second écran en cours de culte

| # | Action | Résultat |
|---|---|---|
| 1 | Sorties → `+ Créer une sortie` → `Retour scène`, `1280×720` | sortie créée |
| 2 | Réglages → `Reçoit` : Bible ✓, Chants ✓, reste ✗ | — |
| 3 | Copier le lien `Bible` | `…/o/out_stage?kind=bible` |
| 4 | Ouvrir ce lien sur le second PC | affiche le verset en cours, en direct |
| 5 | Diffuser un média | le second écran **ne change pas** |

---

## 19.2 Matrice cas d'utilisation × exigences

| Cas | Exigences couvertes |
|---|---|
| CU-01 | EF-03, EF-04, EF-30 |
| CU-02 | EF-05, EF-15, EF-22, EF-23 |
| CU-03 | EF-09, EF-10, EF-13 |
| CU-04 | EF-07, EF-08 |
| CU-05 | EF-12, EF-13, EF-23 |
| CU-06 | ENF-20 → ENF-25 |
| CU-07 | EF-01, EF-02 |
| CU-08 | ENF-01 → ENF-04 |
| CU-09 | EF-05, EF-20, EF-22 |
| CU-10 | EF-20 |
| CU-11 | EF-11 |
| CU-12 | EF-19 |
| CU-13 | EF-18 |
| CU-14 | EF-16 |
| CU-15 | EF-22, EF-10 |
| CU-16 | EF-10, EF-26 |
| CU-17 | ENF-22, ENF-23 |
| CU-18 | EF-07, EF-08 |
