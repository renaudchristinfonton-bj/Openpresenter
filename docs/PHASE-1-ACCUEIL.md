# Phase 1 · Accueil, studio unifié et recherche

> Tranche livrée : **accueil** (chapitre 05), **studio unifié** (chapitre 06), **recherche
> unifiée** (§ 6.4), puis les compléments **annonces** (EF-17), **looks** (EF-10) et
> **import de Bible** (EF-11).
> Recette associée : A-06 → A-10, A-12b → A-12e, plus les tests dédiés de cette tranche.

---

## 1. Ce que voit l'opérateur

```
http://localhost:8787/           → accueil : l'état de la régie en un écran
http://localhost:8787/studio.html → régie : Bible · Chants · Annonces
http://localhost:8787/scene.html  → éditeur de scène (looks)
http://localhost:8787/o/<id>      → une sortie (OBS, vMix, projecteur)
```

L'accueil et le studio sont deux pages distinctes du **même** serveur : aucune
installation, aucun compte, aucun appel réseau sortant.

---

## 2. Accueil — EF-05.1 → EF-05.9

| Zone | Exigence | Ce qui est livré |
|---|---|---|
| Barre d'état | EF-05.2 | pastille d'antenne (`#livePill`), texte d'état (`#liveText`), horloge (`#clock`), LAN (`#lan`), état en ligne (`#online`), durée (`#elapsed`) |
| Contexte | EF-05.3 | nom du projet, port, jeton réseau, compte des ressources (`#counts`) |
| Cartes de sortie | EF-05.4 → EF-05.6 | une carte par sortie : aperçu **WYSIWYG** de la scène réellement diffusée (`mountScene`), opacité 0,25 hors antenne, damier si fond transparent, bouton « copier le lien » (`copyLink`) |
| Actions | EF-05.7 | « Tout couper » (`#clearAll` → `POST /api/live/clear`), « Ouvrir le studio » (`#openStudio`) |
| Blocs sous la flottaison | EF-05.8 | raccourcis clavier, dernières activités, diagnostic express |

L'aperçu de l'accueil n'est **pas** une image générée à part : c'est le même moteur
(`/shared/render/engine.mjs`) que la sortie, donc la même image. Un aperçu est
**lecture seule** : cliquer dessus ne diffuse rien (aucune surprise en direct).

**Rafraîchissement** : WebSocket `op_project` + repli par interrogation toutes les 4 s si la
connexion temps réel tombe.

---

## 3. Studio unifié — EF-06.1 → EF-06.18

| Élément | Exigence | Détail |
|---|---|---|
| Onglets | EF-06.5 | `Alt+1` Bible, `Alt+2` Chants, `Alt+3` Annonces |
| Mémorisation | EF-06.4 | `localStorage.op.studio.mode` ; un onglet inconnu retombe sur Bible |
| Choix des sorties | EF-08 | bandeau `#outputs` : chaque sortie se coche, l'état est conservé |
| Aperçu | EF-09 | scène de la sortie cible, rendue par le moteur partagé |
| Palette | EF-06.8 → EF-06.18 | `Ctrl/Cmd+K` |

### 3.1 Recherche unifiée

| Contrat | Valeur |
|---|---|
| Route | `GET /api/search?q=<≥2 caractères>&kinds=songs,bibles,media,announcements,looks` |
| Normalisation | NFD sans accents, minuscules (`grâce` = `grace` = `GRACE`) |
| Groupes | `{kind, label, count, items[]}` — `label ∈ {Chants, Versets, Médias, Annonces, Looks}` |
| Borne | 50 résultats par groupe, `count === items.length` |
| Verset | `payload {bibleId, bookNum, bookName, chapter, verse, text}`, `title` = « Jean 3:16 » |
| Chant | `detail` = première ligne contenant le terme cherché |

Dans la palette : filtres par type, débogage de frappe à **120 ms**, `↑`/`↓` pour naviguer,
`Entrée` pour diffuser, `Maj+Entrée` pour l'aperçu **sans diffuser**, `Échap` pour fermer et
rendre le focus. Une réponse tardive est ignorée (`paletteSequence`) : taper vite ne fait
jamais atterrir le résultat d'une requête périmée.

---

## 4. Annonces — EF-17

| Geste | Effet |
|---|---|
| `Alt+3` | ouvre le module Annonces |
| Clic sur une annonce | l'affiche sur les sorties cochées |
| `＋ Nouvelle` | titre + texte, enregistré immédiatement sur disque |
| `✕` | supprime après confirmation |
| Champ de recherche | filtre local, insensible aux accents |

Les annonces sont des fichiers `project/library/announcements/<id>.json` : elles se
retrouvent dans la recherche unifiée et dans l'export du projet.

---

## 5. Looks — EF-10

- `scene.html` : **« ＋ Look »** enregistre les scènes de la sortie courante dans
  `project/library/looks/<id>.json` ; la liste « Looks… » applique un look à la sortie.
- Un look **embarque une copie** des scènes (`structuredClone`) : retoucher la scène
  d'origine ne change jamais un look déjà enregistré (test A-10f).
- Appliquer un look crée une scène **indépendante**, avec un identifiant neuf ; les autres
  types de contenu de la sortie sont conservés.
- Appliquer un look ne diffuse rien et marque l'éditeur modifié : c'est l'opérateur qui
  enregistre quand il est prêt.

---

## 6. Import d'une version biblique — EF-11.1 → EF-11.10

| Étape | Où | Détail |
|---|---|---|
| 1 | studio → « ＋ Bible » | fichier `.xml` choisi ou déposé |
| 2 | `POST /api/bible/import/preview` | **aucune écriture** : format, nom, langue, livres, chapitres, versets, taille, aperçu |
| 3 | dialogue | nom affiché, abréviation (2 à 6 caractères), licence |
| 4 | `POST /api/bible/import` | copie dans `assets/bibles/`, index `library/bibles/<id>.verses.json` |
| 5 | projet | la première version importée devient la version par défaut |

| Format | Détection |
|---|---|
| Beblia | `<XMLBIBLE>` + `<BIBLEBOOK>` |
| Zefania | `<XMLBIBLE>` + `<BIBLEVERSIONS>` ou `<BOOK>` |
| OSIS | `<osis>` / `<osisText>`, `div type="book"` |
| USFX | `<usfx>`, `<book id>`, `<c id/>`, `<v id/>` |

Un fichier illisible renvoie le texte exact du § 9.2.1 (`TXT:` sur plusieurs lignes),
jamais une trace technique. Réimporter le même fichier ne crée pas de doublon : l'empreinte
identifie la version et le serveur répond `200` avec `created:false`.

**Alignement des versets** : une source qui commence à `Jean 3:16` conserve sa numérotation ;
les trous sont comblés par un texte neutre qui n'est jamais compté comme un verset.

---

## 7. Tests de la tranche

| Fichier | Ce qui est vérifié |
|---|---|
| `app/tests/accueil-search.test.mjs` | accueil servi sur `/`, éléments d'état, aperçus, recherche unifiée (accents, bornes, payloads) |
| `app/tests/looks-announcements.test.mjs` | look figé sur disque, scène indépendante, cycle de vie d'une annonce, présence des éléments d'interface |
| `app/tests/bible-import.test.mjs` | les 4 formats, aperçu sans écriture, copie de la source, sélection utilisable, doublons, renommage, suppression, message du § 9.2.1 |
| `app/tests/web.test.mjs` | pages servies, garde anti-duplication du moteur, balises équilibrées |

Commande : `npm test` (suite complète), `npm run schema:check`, `npm run trace:check`.

---

## 8. Dettes assumées

| Point | État |
|---|---|
| Médias (EF-16) | index et recherche déjà là ; vue média du studio à venir (phase 2.6) |
| Profils, événements, plan de déroulement (EF-20 → EF-23) | phase 2, non commencés |
| Dossiers par type de fichier (EF-15.18 → EF-23) | phase 2 |
| Vue scène / pasteur (EF-24) | phase 3 |
| Télécommande (EF-25), minuteurs (EF-18), habillages (EF-19) | phase 3 |
