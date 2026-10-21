# 26 — Annexe : traçabilité

> **But :** répondre à trois questions sans jamais relire 30 fichiers :
> *où est spécifiée cette exigence ? où est-elle testée ? quelle maquette la montre ?*
> **Règle :** une exigence sans test est un vœu ; un test sans exigence est du bruit.
> Ce tableau est la **seule** source de vérité sur les liens entre les trois.

---

## 26.1 Comment lire ce chapitre

| Colonne | Sens |
|---|---|
| **EF** | exigence fonctionnelle de haut niveau (CDC § 2) |
| **Spécifiée dans** | chapitres qui contiennent au moins un `EF-nn.m` de ce domaine |
| **Testée par** | blocs de tests de `20-tests-acceptation.md` |
| **Maquette** | capture de référence, si l'exigence est visible |

**AN-26.1** — Une exigence modifiée doit faire passer au rouge au moins un test de ce
tableau. Une exigence nouvelle sans test ne peut pas entrer dans une phase (chapitre 21).

---

## 26.2 Couverture par chapitre

| Chapitre | EF couvertes | Tests cités | Maquettes | Lignes |
|---|---|---|---|---|
| `01-vision-personas.md` | 8 (03, 05, 07, 08, 09, 20, 23, 27) | 1 | — | 207 |
| `02-architecture.md` | 6 (01, 03, 04, 07, 08, 11) | 3 | — | 282 |
| `03-lanceur.md` | 1 (03) | 6 | 02 | 583 |
| `04-projet-et-donnees.md` | 9 (01, 02, 03, 11, 15, 22, 23, 26, 27) | 6 | — | 549 |
| `05-accueil.md` | 4 (05, 07, 20, 22) | 5 | 01 | 232 |
| `06-studio.md` | 1 (06) | 5 | 03, 04 | 197 |
| `07-sorties-et-liens.md` | 2 (07, 08) | 7 | 06 | 418 |
| `08-editeur-scene.md` | 2 (09, 10) | 8 | 05 | 536 |
| `09-bible.md` | 4 (11, 12, 13, 14) | 11 | 03 | 643 |
| `10-chants.md` | 1 (15) | 5 | 04 | 189 |
| `11-medias.md` | 2 (02, 16) | 6 | — | 146 |
| `12-annonces-minuteurs-habillages.md` | 4 (07, 17, 18, 19) | 5 | — | 150 |
| `13-profils.md` | 1 (20) | 5 | 07 | 234 |
| `14-organisations-evenements-plans.md` | 4 (05, 21, 22, 23) | 6 | 08 | 278 |
| `15-scene-et-telecommande.md` | 4 (04, 15, 24, 25) | 5 | 09 | 166 |
| `16-sauvegarde-export.md` | 1 (26) | 6 | — | 219 |
| `17-catalogue.md` | 2 (03, 27) | 5 | — | 197 |
| `18-clavier-accessibilite.md` | 1 (29) | 8 | — | 159 |
| `19-cas-utilisation.md` | — (voir 26.5) | 0 | — | 382 |
| `20-tests-acceptation.md` | 2 (20, 30) | 115 | — | 306 |
| `21-plan-livraison.md` | 4 (01, 08, 12, 26) | 35 | — | 159 |
| `22-risques-hors-perimetre.md` | 8 (02, 03, 07, 09, 11, 26, 27, 29) | 6 | — | 99 |
| `23-journal-diagnostic.md` | 4 (01, 06, 28, 30) | 10 | 02, 10 | 407 |
| `24-annexe-schemas.md` | 6 (02, 04, 09, 11, 15, 24) | 4 | — | 1240 |
| `25-annexe-textes.md` | 3 (08, 25, 29) | 1 | — | 978 |
| `99-glossaire.md` | 1 (02) | 0 | — | 239 |

> `26-annexe-tracabilite.md` (ce fichier) et `27-atlas-ecrans.md` sont volontairement
> absents du tableau : ils **décrivent** la traçabilité, ils ne portent pas d'exigence
> nouvelle.

---

## 26.3 Où chaque exigence est spécifiée

| EF | Intitulé | Spécifiée dans (chapitres) |
|---|---|---|
| **EF-01** | Dossier de projet auto-porteur | `02`, `04`, `21`, `23` |
| **EF-02** | Copie automatique des ressources | `04`, `11`, `22`, `24`, `99` |
| **EF-03** | Lanceur universel | `01`, `02`, `03`, `04`, `17`, `22` |
| **EF-04** | Serveur local embarqué | `02`, `15`, `24` |
| **EF-05** | Page d'accueil | `01`, `05`, `14` |
| **EF-06** | Studio unifié | `06`, `23` |
| **EF-07** | Sorties multiples | `01`, `02`, `05`, `07`, `12`, `22` |
| **EF-08** | Matrice de liens | `01`, `02`, `07`, `21`, `25` |
| **EF-09** | Éditeur WYSIWYG | `01`, `08`, `22`, `24` |
| **EF-10** | Looks / thèmes | `08` |
| **EF-11** | Bible : import et recherche | `02`, `04`, `09`, `22`, `24` |
| **EF-12** | Bible : saisie clavier | `09`, `21` |
| **EF-13** | Bible : découpage lisible | `09` |
| **EF-14** | Bible : multi-versions | `09` |
| **EF-15** | Chants | `04`, `10`, `15`, `24` |
| **EF-16** | Médias | `11` |
| **EF-17** | Annonces | `12` |
| **EF-18** | Minuteurs | `12` |
| **EF-19** | Habillages | `12` |
| **EF-20** | Profils | `01`, `05`, `13`, `20` |
| **EF-21** | Organisations et lieux | `14` |
| **EF-22** | Événements | `04`, `05`, `14` |
| **EF-23** | Plan de déroulement | `01`, `04`, `14` |
| **EF-24** | Vue scène | `15`, `24` |
| **EF-25** | Télécommande | `15`, `25` |
| **EF-26** | Sauvegarde / export | `04`, `16`, `21`, `22` |
| **EF-27** | Catalogue en ligne | `01`, `04`, `17`, `22` |
| **EF-28** | Journal | `23` |
| **EF-29** | Accessibilité et i18n | `18`, `22`, `25` |
| **EF-30** | Diagnostic | `20`, `23` |

**Aucune EF de 01 à 30 n'est orpheline.** C'était le principal trou de la version
précédente : EF-28 et EF-30 n'étaient décrites que dans le CDC, sans chapitre opposable ;
elles sont désormais spécifiées par `23-journal-diagnostic.md`.

---

## 26.4 Où chaque bloc de tests trouve son exigence

| Bloc | Intitulé | Exigences | Niveau d'exécution |
|---|---|---|---|
| **A-01** | Hors-ligne absolu | EF-01, EF-02, EF-04, EF-27 | navigateur, réseau coupé |
| **A-02 → A-02f** | Lanceur, six environnements | EF-03, EF-04 | manuel + script |
| **A-03, A-03b** | Dossier = projet, migration | EF-01, EF-26 | manuel |
| **A-04, A-05** | Copie à l'import, déduplication | EF-02, EF-16 | unitaire + manuel |
| **A-06 → A-06g** | Saisie Bible au clavier | EF-12 | navigateur |
| **A-07 → A-07j** | Découpage lisible | EF-13 | **unitaire** (10 cas) |
| **A-08 → A-08g** | Navigation versets et parties | EF-14 | navigateur |
| **A-09 → A-09g** | Matrice de liens | EF-07, EF-08 | navigateur |
| **A-10 → A-10h** | Éditeur WYSIWYG, rendu identique | EF-09, EF-10 | capture comparée |
| **A-11 → A-11i** | Profils et accueil | EF-20, EF-05 | navigateur |
| **A-12 → A-12k** | Studio, plan, raccourcis | EF-05, EF-06, EF-23 | navigateur |
| **A-13 → A-13i** | Export, restauration, médias | EF-26, EF-16 | manuel + unitaire |
| **A-14 → A-14h** | Annonces, minuteurs, habillages, chants | EF-15, EF-17, EF-18, EF-19 | navigateur |
| **A-15 → A-15f** | Résilience, vue scène, télécommande | EF-24, EF-25, EF-26 | manuel |
| **A-16 → A-16d** | Catalogue et absence réseau | EF-27, EF-04 | manuel + capture réseau |
| **A-17 → A-17g** | Clavier, accessibilité, i18n | EF-29, EF-12 | manuel + audit |
| **A-18 → A-18k** | Journal, diagnostic, intégrité | EF-28, EF-30, EF-01 | manuel + analyse de rapport |
| **P-01 → P-10** | Performance | ENF-10 → ENF-15 | automatisé |

**Répartition** : 7 blocs de recette fonctionnelle (A → G) et 10 tests de performance
(P-01 → P-10), soit **115 identifiants de recette** dont 103 également cités dans les
chapitres de spécification. Chaque identifiant est défini une seule fois, dans
`20-tests-acceptation.md`.

---

## 26.5 Cas d'utilisation → exigences

Le chapitre 19 ne porte pas d'`EF` : il **éprouve** celles des autres chapitres. Sa propre
matrice (19.2) est reproduite ici, complétée par le test qui l'automatise quand il existe.

| CU | Parcours | Exigences éprouvées | Test(s) |
|---|---|---|---|
| CU-01 | Premier lancement sur un PC vierge | EF-03, EF-04, EF-30 | A-02, A-18 |
| CU-02 | Préparer un culte du dimanche | EF-05, EF-15, EF-22, EF-23 | A-12, A-11 |
| CU-03 | Événement Saint-Valentin de A à Z | EF-09, EF-10, EF-13 | A-10b |
| CU-04 | Live stream avec overlays sélectifs | EF-07, EF-08 | A-09 |
| CU-05 | Conduire le culte en direct au clavier | EF-12, EF-13, EF-23 | A-06, A-08 |
| CU-06 | Dépannage pendant le culte | ENF-20 → ENF-25 | A-18b, A-18i |
| CU-07 | Transférer le projet sur un autre PC | EF-01, EF-02 | A-03, A-13 |
| CU-08 | Culte complet sans Internet | ENF-01 → ENF-04 | A-01, A-16 |
| CU-09 | Le bénévole remplaçant | EF-05, EF-20, EF-22 | A-12e, A-17 |
| CU-10 | Créer un profil d'église réutilisable | EF-20 | A-11, A-11g |
| CU-11 | Importer une nouvelle Bible | EF-11 | A-16b, P-02 |
| CU-12 | Créer un habillage d'intervenant | EF-19 | A-14d |
| CU-13 | Régler le minuteur de prédication | EF-18 | A-14b |
| CU-14 | Diffuser un PowerPoint | EF-16 | A-13g |
| CU-15 | Rejouer un culte de l'année dernière | EF-22, EF-10 | A-12k |
| CU-16 | Partager un look avec une autre église | EF-10, EF-26 | A-11h, A-13 |
| CU-17 | Récupérer après une coupure de courant | ENF-22, ENF-23 | A-15, A-18c |
| CU-18 | Ajouter un second écran en cours de culte | EF-07, EF-08 | A-09, A-12d |

**Aucun des 18 cas d'utilisation n'est sans test.** Les cas CU-05, CU-09 et CU-18 sont
également couverts par la recette clavier (A-17) et par la matrice de liens (A-09).

---

## 26.6 Faiblesses identifiées et fermées dans cette révision

| # | Faiblesse | Correction |
|---|---|---|
| 1 | `EF-28` (journal) et `EF-30` (diagnostic) sans chapitre | chapitre `23-journal-diagnostic.md` (407 lignes) |
| 2 | MAQ-04 et MAQ-10 annoncées dans l'index mais absentes du disque | maquettes écrites |
| 3 | `A-02b` → `A-02f` et `A-11b` → `A-11e` cités sans définition | définis dans le chapitre 20 |
| 4 | `ENF-15.5` renvoyait à un test inexistant (`A-16b`) | renvoie désormais à `P-09` et `A-18e` |
| 5 | Schémas non validables (JSON commenté) | annexe 24 : 16 schémas JSON Schema |
| 6 | 99 chaînes d'interface dispersées | annexe 25 : catalogue `TXT-001` → `TXT-099` |
| 7 | Caractères CJK parasites insérés par erreur dans deux chapitres | nettoyés |
| 8 | Aucune table de correspondance écran → URL → maquette | annexe 27 |

---

## 26.7 Contrôles automatisés de cette annexe

`npm run trace:check` exécute quatre vérifications et **échoue** si l'une est fausse.

| Contrôle | Règle | Sortie attendue |
|---|---|---|
| **T1** | Chaque fichier de `docs/spec/` figure dans l'index `00-index.md` | `0 fichier non indexé` |
| **T2** | Chaque `EF-nn.m` cité existe dans sa forme canonique, et chaque `EF-nn` est couvert par au moins un chapitre ; les exigences d'annexe utilisent le préfixe `AN-nn.m` | `0 EF orpheline` |
| **T3** | Chaque identifiant de test cité (`A-xx`, `P-xx`) possède une définition unique dans le chapitre 20 | `0 test non défini` |
| **T4** | Chaque `MAQ-xx` cité correspond à un fichier `docs/maquettes/maq-xx-*.html` existant | `0 maquette manquante` |

```text
$ npm run trace:check
T1 index............ OK   29 fichiers
T2 exigences........ OK   613 identifiants, 30 domaines, 33 AN
T3 tests............ OK   115 identifiants, 0 orphelin
T4 maquettes........ OK   12 références, 12 fichiers
Traçabilité : conforme.
```

**AN-26.2** — Le script est exécuté en CI à chaque modification de `docs/` et bloque la
publication du cahier des charges si un contrôle échoue.

### 26.7.1 Algorithme attendu (spécification du script)

```text
pour chaque fichier de docs/spec/ :
    lire l'entête « Exigences couvertes » → ensemble EF
    lire les identifiants EF-… et A-… du corps
    vérifier que les EF de l'entête existent au moins une fois dans le corps
    vérifier que l'entête mentionne au moins une EF (sauf 00, 19, 26, 27, 99)
pour chaque « A-xx » trouvé dans docs/ :
    compter ses définitions dans 20-tests-acceptation.md (tableaux compris)
    si 0 → erreur « test non défini »
pour chaque « MAQ-xx » trouvé dans docs/ :
    chercher docs/maquettes/maq-xx-*.html
    si absent → erreur « maquette manquante »
compter les lignes de chaque fichier et comparer à la colonne du tableau 26.2
    si écart > 0 → avertissement « tableau périmé » (mise à jour manuelle)
```

---

## 26.8 Règle de mise à jour

Toute modification du cahier des charges suit cet ordre **obligatoire** :

1. modifier le chapitre concerné et y ajouter l'`EF` ;
2. ajouter ou adapter le test dans le chapitre 20 ;
3. mettre à jour les tableaux 26.2 → 26.5 de ce fichier ;
4. lancer `npm run trace:check` ;
5. si une maquette change, la régénérer et incrémenter sa date dans `docs/maquettes/index.html`.

**AN-26.3** — Une *pull request* qui touche `docs/spec/` sans ligne modifiée dans ce
fichier est refusée par la revue.
