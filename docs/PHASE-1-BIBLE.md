# Phase 1 — première tranche verticale : la Bible, de la frappe à l'écran

> **État : livré et vérifié par 138 tests automatisés** (`npm test`), `npm run schema:check`,
> `npm run trace:check`. Le studio s'ouvre à la racine du serveur.

Cette tranche traverse toute la pile sur **un seul parcours**, celui qui a motivé la refonte :
taper une référence au clavier et la voir apparaître sur la sortie, découpée en morceaux
lisibles, avec navigation aux flèches. C'est le chemin le plus exigeant du cahier des charges,
donc celui qui valide l'architecture.

---

## 1. Le parcours, de bout en bout

```
  j e Entrée 3 Espace 1 6 Entrée
        │
        ├─► app/src/core/bible/reference.mjs   machine à états LIVRE → CHAPITRE → VERSET
        ├─► app/src/core/books.mjs             66 livres, abréviations, accents, casse
        ├─► GET /api/bible/selection           versets lus sur disque
        ├─► app/src/core/split.mjs             découpage 25 mots, ponctuation respectée
        ├─► app/web/studio.html                aperçu + liste des parties
        ├─► POST /api/live/show                filtre `receives`, état d'antenne
        └─► app/web/output.html                rendu plein écran ou bandeau (WebSocket)
```

**Une seule implémentation par règle.** Les modules purs (`books.mjs`, `split.mjs`,
`bible/reference.mjs`, `bible/navigation.mjs`) sont exécutés **tels quels** par Node dans les
tests et par le navigateur via `/shared/…`. Il n'y a pas de copie côté client : ce qui est
testé est exactement ce qui tourne à l'écran.

---

## 2. Ce qui fonctionne

| Domaine | Contenu | Fichiers |
|---|---|---|
| **Saisie clavier** | machine à états déterministe, 8 suggestions maximum, insensible aux accents et à la casse, `↑↓`, `Échap` qui recule d'un état, `Tab` = `Entrée` | `bible/reference.mjs` |
| **Références collées** | `Jean 3:16`, `1 Corinthiens 13:4-7`, `Jn 3 16`, `Ps 23`, `ésaïe 40:31` | idem |
| **Messages d'erreur** | livre inconnu, chapitre manquant, chapitre hors bornes, verset hors bornes, plage > 200 versets, plage tronquée — les textes du catalogue `TXT-056`→`TXT-064` | `reference.mjs` |
| **Découpage lisible** | algorithme normatif du § 9.5 : ponctuation `;` `:` `,` `—`, fenêtre 45–100 %, équilibrage, jamais d'orphelin, guillemets et nombres insécables, annotations reportées | `split.mjs` |
| **Navigation** | liste plate, `→ ← ↑ ↓ Espace PageUp/Down`, `Maj+flèches` par verset, `Ctrl+flèches` par chapitre, `Début/Fin`, `1…9`, clicker USB, touches inactives dans un champ | `bible/navigation.mjs` |
| **Studio** | champ unique avec jeton de livre non éditable, liste de suggestions, liste des parties, aperçu 16:9, choix des sorties cibles, boutons ⇤ couper / diffuser | `app/web/studio.html` |
| **Sorties** | `/o/<id>?kind=<type>` — plein écran ou bandeau transparent, mise à l'échelle 1920×1080, ajustement automatique de la taille, reconnexion avec le dernier état | `app/web/output.html` |
| **Diffusion** | filtre `receives` appliqué côté serveur, deux sorties créées avec le projet, état d'antenne écrit dans `session-state.json` | `src/core/live.mjs` |
| **Bible d'exemple** | Louis Segond 1910 (domaine public) : Psaumes 23, Ésaïe 40, Jean 3 — installée au premier lancement pour essayer immédiatement | `app/data/sample-bible*.json` |

---

## 3. Tests de recette couverts

| Test | Vérification |
|---|---|
| **A-06** | `j e Entrée 3 Espace 1 6 Entrée` → Jean 3:16, **sans souris** |
| **A-06b** | `jn Entrée` → Jean (abréviation) |
| **A-06c** | `ésa Entrée 40 Espace 31 Entrée` → Ésaïe 40:31 |
| **A-06d** | collage de `1 Corinthiens 13:4-7` → plage diffusée |
| **A-06e** | `xyz Entrée` → message, **champ non vidé** |
| **A-06f** | `je ↓ Entrée` → deuxième livre de la liste |
| **A-06g** | `Jean Entrée 99` → « Jean compte 21 chapitres. », frappe non bloquée |
| **A-07** | 60 mots / 3 virgules → 3 parties coupées sur les virgules |
| **A-07b** | 60 mots sans ponctuation → 3 parties (25 / 25 / 10) |
| **A-07c** | 27 mots → **1 seule partie** |
| **A-07d** | 52 mots → 2 parties équilibrées |
| **A-07e** | saut de ligne au mot 20 → coupe sur le saut de ligne |
| **A-07f** | guillemets jamais séparés de leur contenu |
| **A-07g** | 500 mots → 20 parties, aucune vide |
| **A-07h** | aucune partie orpheline quand la fusion reste raisonnable |
| **A-07i** | gras à cheval → balisage reporté sur les deux parties |
| **A-07j** | deux exécutions → résultat identique |
| **A-08** | `→` traverse toutes les parties puis le verset suivant |
| **A-08b** | clicker USB (`PageUp`/`PageDown`) sans configuration |
| **A-08c/d** | `Maj+→` / `Maj+←` par verset |
| **A-08e** | aux bornes, la navigation ne fait rien |
| **A-08f** | touches inactives dans un champ ou un éditeur |
| **A-08g** | deux versions : découpage indépendant, indice borné |
| **A-09 / A-09e** | `receives` bloque une sortie filtrée ; une sortie reconnectée reçoit le dernier état |
| **A-01** | aucune ressource distante dans les trois pages, modules partagés whitelistés |

---

## 4. Ce qui reste dans la phase 1

- **A-10** — éditeur de scène WYSIWYG et rendu **pixel-identique** entre l'éditeur et la sortie :
  c'est le prochain morceau. Le rendu actuel est volontairement minimal (texte centré, bandeau),
  il deviendra un moteur de calques partagé.
- **Looks** — palettes, polices, fonds, ombres, alignements (§ 8.5) : aujourd'hui une seule
  apparence par preset.
- **Modules chants, médias, annonces** — la Bible est le premier des cinq modules de contenu ;
  l'architecture (objets disque, `/api/live/show`, sortie unique) est déjà en place pour les autres.
- **Import de bibles XML** (Beblia, Zefania) — seule la version d'exemple est livrée.
- **Télécommande et vue scène** (phase 4) — le canal `op_studio` et le relais sont prêts.

---

## 5. Comment essayer

```bash
./OpenPresenter.sh          # ou OpenPresenter.command / OpenPresenter.bat
```

1. Le navigateur s'ouvre sur le **Studio**.
2. Tapez `j e Entrée 3 Espace 1 6 Entrée` — la référence se construit dans le champ,
   la liste des parties et l'aperçu se remplissent.
3. Cliquez sur **↗ lien** à côté d'une sortie pour ouvrir la page de sortie dans un onglet
   (ou une fenêtre OBS/vMix sur `http://127.0.0.1:8788/o/out_bottom?kind=bible`).
4. `→` / `←` parcourent les parties, `Maj+→` saute au verset suivant, `Entrée` rediffuse,
   `Échap` (champ vide) coupe les sorties.
5. `http://127.0.0.1:8788/socle.html` reste l'état du socle : diagnostic, sauvegarde, export, journal.
