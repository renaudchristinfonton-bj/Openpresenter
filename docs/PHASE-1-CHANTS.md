# Phase 1 — Les chants (EF-15)

Le module Chants est utilisable de bout en bout : **importer, ordonner, diffuser,
naviguer**. Comme la Bible, il n'a qu'une implémentation, partagée entre le serveur et
le navigateur (`/shared/songs/…`).

```
coller / déposer un fichier  →  aperçu  →  Importer  →  conducteur  →  sortie
```

## Ce qui est livré

| Où | Quoi |
|---|---|
| `app/src/core/songs/parser.mjs` | détection de format, ChordPro, OpenSong XML, CCLI, texte brut, sections, accords |
| `app/src/core/songs/arrangement.mjs` | découpage, sélection plate, navigation, arrangements, transposition |
| `app/web/studio.html` | onglets Bible/Chants, recherche, conducteur, boutons rapides, dialogue d'import |
| `app/server.mjs` | `POST /api/songs/parse` (aperçu), `POST /api/songs/import`, `GET /api/songs/<id>/selection`, `POST /api/songs/samples` |

Les chants sont des fichiers `project/library/songs/<id>.json` conformes à
`song.schema.json` (ch. 24 § 24.5). Le fichier d'origine est copié dans
`assets/songs/` (EF-15.2) : on peut toujours revenir à la source.

## Décisions de lecture (import)

Elles sont toutes déterministes, pour qu'un même fichier donne toujours le même chant.

| Cas | Règle |
|---|---|
| Détection de format | `<song>` → OpenSong · `{title:}` / `{soc}` / `[G]` → ChordPro · `CCLI Song #` → CCLI · sinon texte |
| En-têtes de section | `Couplet`, `Refrain`, `Pont`, `Pré-refrain`, `Intro`, `Fin`, `Tag`, `V1`, `C`, `B`… un qualificatif (`Refrain final`, `Couplet 2 (final)`) est conservé |
| Ligne de paroles | jamais prise pour un en-tête : longueur, ponctuation et mots inconnus l'excluent |
| Lignes vides | ferment une section **sans en-tête** ; dans une section nommée, elles sont conservées (strophe interne, EF-15.7) |
| Accords | retirés du texte, mémorisés par section en **décalage de caractères** (AN-24.4) |
| OpenSong | les accords posés au-dessus des paroles sont convertis en ChordPro, puis suivent le même chemin |
| Titre | directive `{title:}`, balise `<title>`, sinon première ligne ; l'en-tête n'est jamais chanté |

## Conducteur (§ 10.2.3)

| Geste | Effet |
|---|---|
| `→` `↓` `Espace` `PageDown` | partie suivante |
| `←` `↑` `PageUp` | précédent |
| `Maj + →` / `Maj + ←` | section suivante / précédente |
| `1`…`9` | aller à la n-ième étape de l'arrangement |
| `Entrée` | rediffuser l'élément courant |
| `Échap` | couper (dans la recherche : vide le champ d'abord) |
| `＋ Refrain à la fin` · `↻ Répéter` · `⤼ Sauter` | modifient l'arrangement, appliqué immédiatement |

À la fin de l'arrangement, `→` ne dépasse pas : un message annonce
`Fin du chant « … ».` (EF-15.15). Changer d'arrangement en cours de diffusion garde la
position : au refrain, on reste sur un refrain (EF-15.12).

## Tests

| Test | Ce qu'il vérifie |
|---|---|
| A-12f (chants) | un ChordPro donne titre, 6 sections et les accords |
| A-12h (chants) | changement d'arrangement au refrain : la position reste un refrain |
| A-12i (chants) | `→` jusqu'à la fin : message de fin, aucun dépassement |
| EF-15.1 → EF-15.7 | détection, source copiée, en-têtes, lignes vides, renommage, duplication |
| EF-15.8 → EF-15.16 | arrangement par défaut, sections répétées, navigation, découpage |
| EF-15.24 → EF-15.27 | accords positionnés, jamais projetés, transposition sans toucher la source |
| API | aperçu sans écriture, import sur disque, sélection, diffusion, liste blanche `/shared` |

```
npm test            # 212 tests
```

## Points ouverts (assumés)

- **Numérotation des tests** : le cahier des charges utilise `A-12f` → `A-12j` **deux
  fois** — une fois pour les chants (ch. 10 § 10.7), une fois pour les événements
  (ch. 14) — alors que l'annexe de traçabilité décrit `A-12 → A-12k` comme « Studio,
  plan, raccourcis ». Les tests portent donc la mention `(chants)` en attendant un
  arbitrage : soit renuméroter les chants (`A-12s1` → `A-12s5`), soit renuméroter les
  événements.
- Vue scène avec accords et transposition : la donnée est prête
  (`chordLinesForSection`, `transposeSectionChords`), l'écran viendra avec le module
  Vue scène (phase 3).
- Organisation par dossiers/étiquettes (EF-15.18 → EF-15.23) : la recherche et le tri
  sont là, les dossiers restent à faire.
- PowerPoint/PDF et médias : module suivant.
