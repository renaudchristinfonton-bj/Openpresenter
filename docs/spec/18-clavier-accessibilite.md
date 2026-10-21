# 18 — Clavier, accessibilité, internationalisation

> **Exigences couvertes :** EF-29, ENF-41, ENF-44, principe P8
> **Origine :** *« l'utilisateur doit pouvoir passer d'un verset à un autre en utilisant les
> touches de direction »* → le clavier n'est pas un confort, c'est le mode de conduite.

---

## 18.1 Table des raccourcis — normative

### 18.1.1 Globaux (partout)

| Raccourci | Action | Contexte bloquant |
|---|---|---|
| `Ctrl/Cmd + K` | recherche unifiée | — |
| `Ctrl/Cmd + B` | champ de saisie Bible | — |
| `Espace` | diffuser / avancer dans le plan | champ de saisie actif |
| `Échap` | couper toutes les sorties | modale ouverte (ferme la modale) |
| `Ctrl/Cmd + .` | écran noir immédiat | — |
| `F11` | plein écran du contrôleur | — |
| `Alt + 1…9` | modules 1 à 9 | champ de saisie actif |
| `Ctrl/Cmd + S` | forcer l'enregistrement | — |
| `Ctrl/Cmd + Z` / `Maj + Z` | annuler / rétablir (éditeur) | — |
| `?` | aide clavier contextuelle | champ de saisie actif |

### 18.1.2 Bible et chants

| Raccourci | Action |
|---|---|
| `→` `↓` `PageDown` | élément suivant (partie, puis verset/section) |
| `←` `↑` `PageUp` | élément précédent |
| `Maj + →` / `Maj + ←` | verset/section suivant/précédent (ignore les parties) |
| `Ctrl + →` / `Ctrl + ←` | chapitre suivant/précédent (Bible) |
| `Début` / `Fin` | premier / dernier élément de la sélection |
| `Entrée` | rediffuser l'élément courant |
| `1`…`9` | aller à l'élément n |
| `V` | basculer l'affichage 2 versions |
| `F` | favori du verset courant |
| `N` | annoter le verset courant |

### 18.1.3 Médias

| Raccourci | Action |
|---|---|
| `→` / `←` | page suivante / précédente (PDF, PPTX) |
| `L` | lecture / pause vidéo |
| `M` | muet |
| `B` | boucle |
| `J` / `K` | reculer / avancer de 5 s |

### 18.1.4 Plan

| Raccourci | Action |
|---|---|
| `Espace` / `→` | étape suivante |
| `←` | étape précédente |
| `Début` / `Fin` | première / dernière étape |
| `Échap` | couper |

### 18.1.5 Éditeur de scène

| Raccourci | Action |
|---|---|
| `Suppr` | supprimer le calque |
| `Ctrl/Cmd + D` | dupliquer |
| `Ctrl/Cmd + C` / `V` | copier / coller |
| Flèches | déplacer de 1 % |
| `Maj + flèches` | déplacer de 0,1 % |
| `Ctrl + flèches` | redimensionner de 1 % |
| `[` / `]` | niveau inférieur / supérieur |
| `Ctrl + [` / `Ctrl + ]` | arrière-plan / premier plan |
| `L` | verrouiller |
| `H` | masquer |
| `G` / `Maj + G` | grouper / dégrouper |
| `Ctrl/Cmd + A` | tout sélectionner |
| `Échap` | désélectionner |

### 18.1.6 Règles de résolution

| ID | Règle |
|---|---|
| EF-29.1 | Les raccourcis **globaux** sont ignorés quand le focus est dans `input`, `textarea`, `[contenteditable]`, sauf `Échap` et `Ctrl/Cmd + K` |
| EF-29.2 | Les raccourcis de navigation Bible/chant sont ignorés dans un champ de saisie |
| EF-29.3 | `Espace` ne provoque **jamais** de défilement de page (`preventDefault`) |
| EF-29.4 | Un conflit est résolu par ordre de priorité : modale > éditeur > module > global |
| EF-29.5 | Les raccourcis sont **remappables** (profil clavier), stockés dans `project.json` |
| EF-29.6 | Un conflit de remappage est signalé : `TXT: « L » est déjà utilisé pour « Verrouiller ».` |
| EF-29.7 | Un clicker USB (flèches / `PageUp` / `PageDown`) fonctionne sans configuration |
| EF-29.8 | Sur macOS, `Cmd` remplace `Ctrl` partout où c'est l'usage |

### 18.1.7 Aide clavier contextuelle

`KBD ?` ouvre un panneau listant **uniquement** les raccourcis du contexte courant
(module actif, modale active), avec un bouton « Tous les raccourcis ».

---

## 18.2 Accessibilité

| ID | Exigence | Vérification |
|---|---|---|
| EF-29.9 | Tout élément interactif est atteignable au clavier | parcours complet sans souris |
| EF-29.10 | Ordre de tabulation logique et stable | — |
| EF-29.11 | Focus visible en permanence (contour 2 px, contraste ≥ 3:1) | — |
| EF-29.12 | `aria-label` sur tous les boutons icônes | audit automatisé |
| EF-29.13 | `role` et `aria-live` sur les toasts et les états | — |
| EF-29.14 | Contraste texte ≥ 4,5:1, interface ≥ 3:1 | mesure automatisée |
| EF-29.15 | Respect de `prefers-reduced-motion` : transitions désactivées | test manuel |
| EF-29.16 | Zoom navigateur jusqu'à 200 % sans perte de fonction | test manuel |
| EF-29.17 | Aucune information portée par la **couleur seule** (ajouter une icône ou un texte) | revue |
| EF-29.18 | Les modales piègent le focus et se ferment par `Échap` | — |
| EF-29.19 | Le texte des sorties n'est pas concerné par les règles d'interface, mais le contraste texte/fond doit rester ≥ 4,5:1 par défaut dans les scènes livrées | test A-10e |

---

## 18.3 Internationalisation

| ID | Exigence |
|---|---|
| EF-29.20 | Toutes les chaînes d'interface vivent dans `app/data/i18n/<lang>.json` |
| EF-29.21 | Aucune chaîne affichée n'est codée en dur dans le HTML ou le JS |
| EF-29.22 | Le français est livré complet ; l'anglais est préparé (clés présentes, traductions partielles acceptées) |
| EF-29.23 | La langue suit `project.json` → `language`, avec un réglage par navigateur |
| EF-29.24 | Les formats de date et de nombre suivent `Intl` |
| EF-29.25 | Une clé manquante affiche la clé entre crochets **en développement**, et le texte français en production |
| EF-29.26 | Les noms de livres bibliques viennent de la **version importée**, pas de l'interface |
| EF-29.27 | Une Bible `rtl` bascule la direction du texte des calques concernés |
| EF-29.28 | Les polices vendues couvrent latin et latin-ext (accents français complets) |

### 18.3.1 Structure d'un fichier de traduction

```jsonc
{
  "app.name": "OpenPresenter",
  "nav.plan": "Plan",
  "nav.bible": "Bible",
  "bible.searchPlaceholder": "Tapez quelques lettres du livre…",
  "bible.error.noBook": "Aucun livre ne correspond à « {query} ».",
  "bible.error.noChapter": "{book} ne contient pas de chapitre {n} (1 à {max}).",
  "outputs.link.copied": "Lien copié pour « {name} »."
}
```

**EF-29.29** — Les variables sont des `{jetons}` ; aucun texte n'est construit par
concaténation dans le code.

---

## 18.4 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-17** | Conduire un culte complet sans souris | aucune action nécessitant la souris |
| **A-17b** | `Échap` dans un champ de saisie | ne coupe pas la diffusion, vide le champ |
| **A-17c** | Clicker USB (PageUp/PageDown) | navigation fonctionnelle |
| **A-17d** | Remapper un raccourci en conflit | message explicite, remappage refusé |
| **A-17e** | Zoom 200 % | aucune fonction inaccessible |
| **A-17f** | `prefers-reduced-motion` actif | aucune transition animée |
| **A-17g** | Clé de traduction manquante en production | texte français affiché, pas de `[clé]` |
