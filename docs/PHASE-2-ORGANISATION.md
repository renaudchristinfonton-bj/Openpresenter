# Phase 2 · Organisation : profils, événements et plan

> Tranches livrées : **profils** (chapitre 13), **organisations et événements**
> (chapitre 14, EF-21 et EF-22) et **plan de déroulement** (EF-23).
> Recette associée : A-11 → A-11i, A-12f → A-12k.

---

## 1. Ce que l'opérateur peut faire

```
/                 → accueil : profil actif, événement du jour, sorties
/events.html      → organisations, lieux, événements
/plan.html?event= → conduite du déroulé, une touche à la fois
/studio.html      → régie
```

Le parcours complet d'un dimanche :

1. accueil → choisir le profil **Église** (ou **Conférence**, ou **Stream live**) ;
2. `/events.html` → créer « Culte du dimanche », lieu, profil, récurrence ;
3. `/plan.html?event=…` → coller le déroulé (`Accueil`, chant, `Jean 3:16-18`, `# Offrande`…) ;
4. **Espace** fait avancer d'une étape, **Échap** coupe.

---

## 2. Profils — EF-20

| Élément | Exigence | Ce qui est livré |
|---|---|---|
| Trois profils | EF-20.13 | **Église** (2 sorties, 2 looks), **Conférence** (3 sorties, 3 looks), **Stream live** (3 sorties, 2 looks) |
| Vignettes | EF-20.1 | nom, type, couleur, nombre de sorties et de looks, badge « actif » |
| Application | EF-20.2, EF-20.16 | `POST /api/profiles/:id/apply`, atomique : l'état précédent est restauré en cas d'erreur |
| Confirmation | EF-20.2 | si quelque chose est à l'antenne → `409 LIVE_CONFIRM` avec le texte du § 13.5.2 ; `force: true` après accord |
| Édition | EF-20.3 | dialogue `#profileDlg` : nom, type, couleur, description, sorties, looks |
| Capture | EF-20.4 | « ＋ Enregistrer cette configuration » → `POST /api/profiles/capture` |
| Duplication | EF-20.5 | `POST /api/profiles/:id/duplicate` → « X (copie) » |
| Export / import | EF-20.6 → EF-20.8 | `.opprofile.json` sans binaire ; import `copy` (à côté) ou `merge` (mise à jour) |
| Références absentes | EF-20.11 | rapport `missing.looks / scenes / bibles`, aucune erreur bloquante |
| Sorties non citées | EF-20.14 | désactivées (`enabled:false`) avec une note, jamais supprimées |
| Scènes des looks | EF-20.15 | copiées dans `project/scenes` à l'application |

**Looks livrés** : Sobre, Festif, Moderne, Minimal, Cinéma, Néon. Ils sont disponibles
immédiatement (`GET /api/looks`) mais **ne sont pas écrits** dans un projet neuf : un projet
vide reste vide. Un look livré s'applique tel quel ; le studio le copie dans les scènes de
la sortie quand on l'applique.

**Choix assumé** : les profils livrés ne sont matérialisés dans `project/profiles/` qu'à la
première modification (édition, duplication, capture, import). Ils restent éditables et
exportables sans cela — et un projet vierge ne contient aucun fichier superflu.

---

## 3. Organisations et lieux — EF-21

| Besoin | Exigence | Réalisation |
|---|---|---|
| Organisation éditable | EF-21.4 | nom, type (`church`, `association`, `school`, `company`, `other`), coordonnées, logo (`logoAssetId`) |
| N lieux | EF-21.5 | `places[]` avec `id`, nom, capacité, écrans, notes |
| Écrans nommés | EF-21.6 | libellés conservés et affichés (« Temple principal (Projecteur salle, Retour scène) ») |
| Aucun niveau obligatoire | EF-21.1, EF-21.2 | un événement peut n'avoir ni organisation ni lieu |
| Suppression | EF-21.3 | les événements sont **détachés**, jamais supprimés (`detachedEvents` dans la réponse) |

Routes : `GET|POST /api/orgs`, `GET|PUT|DELETE /api/orgs/:id`.

---

## 4. Événements — EF-22

| Besoin | Exigence | Réalisation |
|---|---|---|
| Création | EF-22.1 | nom, début, fin, organisation, lieu, profil, couleur, description |
| Récurrence | EF-22.2 | `daily`, `weekly` (+ jours), `monthly`, avec date de fin |
| Occurrences | EF-22.3 | matérialisées à la demande (`POST …/occurrences`, 24 au maximum) |
| Duplication | EF-22.4, A-12j | plan et couleur copiés, **historique vidé** |
| Aujourd'hui | EF-22.5 | `GET /api/events` → `{today, upcoming, past}` ; bloc sur l'accueil |
| Historique | EF-22.6 | append-only, alimenté par chaque diffusion quand un événement est ouvert |
| Export CSV | EF-22.7 | `GET /api/events/:id/history.csv` |
| Événement passé | EF-22.8 | `409 PAST_EVENT` avec le texte du contrat ; « Modifier quand même » = `force: true` |
| Suppression | EF-22.9 | `409 DELETE_CONFIRM` nommant le nombre d'étapes |
| Sans plan | EF-22.10 | `plan.cues = []` est valide |

Un événement **ouvert** (`POST /api/events/:id/open`) devient l'événement actif du projet :
son profil est proposé, et les diffusions suivantes entrent dans son historique.

---

## 5. Plan de déroulement — EF-23

| Besoin | Exigence | Réalisation |
|---|---|---|
| Référence machine | EF-23.1 | `43-3-16..43-3-18`, la forme lisible n'est jamais stockée |
| Une touche en direct | EF-23.3 | `Espace` / `→` avance, `←` recule, `Échap` coupe |
| Panneaux | EF-23.4 | En cours / Suivant / Après toujours visibles |
| Durées | EF-23.5 | par étape et total, les étapes sautées ne comptent pas |
| Réordonnancement | EF-23.6 | `PUT …/plan` remplace la liste ordonnée (glisser-déposer dans une itération suivante) |
| Étape sautée | EF-23.7 | `skipped` : franchie automatiquement, barrée dans la liste |
| Note | EF-23.8 | libellé affiché dans le studio (`plan:note`), **aucune sortie touchée** |
| Reculer | EF-23.9, A-12i | rejoue le contenu de l'étape précédente |
| Fin de plan | EF-23.10 | ne dépasse pas, message `TXT: Fin du plan.` |
| Lié à l'événement | EF-23.11 | `event.plan.cues`, un fichier par événement |
| Rechargement | EF-23.13, A-12k | position dans `session-state.json` (`plan.index`, `-1` = pas commencé) |
| Import CSV / texte | EF-23.14, A-12g | analyse ligne par ligne + rapport, remplacement ou ajout |
| Planning Center | EF-23.15 → EF-23.17 | export JSON, appariement par titre, aucune connexion réseau |
| Impression | EF-23.18 | `GET /api/events/:id/plan/print` en `text/plain` |

### Reconnaissance d'une ligne importée

| Ligne | Type | Détail |
|---|---|---|
| `# Offrande`, `// Prière` | `note` | marqueur explicite |
| `Jean 3:16-18` | `bible` | machine à états du chapitre 9, version active du projet |
| `Grâce infinie` | `song` | correspondance **exacte** de titre, accents et casse ignorés |
| `Prédication` | `note` | repère, avec « aucun élément correspondant » dans le rapport |
| ligne vide | — | ignorée |

---

## 6. Tests

| Fichier | Ce qui est vérifié |
|---|---|
| `app/tests/profiles.test.mjs` | 3 profils, application complète (A-11), confirmation hors antenne (A-11i), références absentes (A-11f), capture/duplication/export/import, profil actif protégé, looks livrés, accueil |
| `app/tests/events.test.mjs` | organisations et lieux, détachement à la suppression (EF-21.3), récurrence et occurrences, duplication sans historique, historique CSV, lecture seule des événements passés, accueil, page Événements |
| `app/tests/plan.test.mjs` | import texte (A-12g), Planning Center, panneaux et durées, impression, avance/recul (A-12h, A-12i), restauration de position (A-12k), prévisualisation d'import, page Plan |

Commande : `npm test` — **261 tests**, `npm run schema:check`, `npm run trace:check`.

---

## 7. Dettes assumées

| Point | État |
|---|---|
| Réordonnancement par glisser-déposer (EF-23.6) | l'API est prête (`PUT …/plan`), l'interface liste les étapes sans glisser |
| Télécommande et vue scène pilotant le plan (EF-23.12) | phase 3 (EF-24, EF-25) |
| Logo d'organisation (EF-21.7) | champ `logoAssetId` présent, écran de dépôt à venir |
| Médias complets (EF-16) | phase 2.6 |
| Habillages, minuteurs (EF-18, EF-19) | phase 3 |
| Lier un événement à un profil d'organisation par défaut | règle posée (§ 13.6), interface à compléter |
