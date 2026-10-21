# 05 — Page d'accueil

> **Exigences couvertes :** EF-05, EF-20.9, EF-22.4, principe P3
> **Maquette :** MAQ-01 (page d'accueil)
> **URL :** `/` (racine du serveur)

---

## 5.1 Le rôle de cette page

C'est la page ouverte par le lanceur. Elle doit répondre en **un coup d'œil**, sans
défilement, à trois questions :

1. **Qu'est-ce qui passe en ce moment, et où ?**
2. **Sur quel profil et quel événement suis-je ?**
3. **Comment j'ouvre le studio ?**

Tout le reste est secondaire et se trouve sous la ligne de flottaison.

**EF-05.9** — Les actions essentielles (état live, sélecteurs, bouton Studio, couper)
tiennent dans **100 vh** sur un écran 1366×768.

---

## 5.2 Disposition normative

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ▌ZONE 1 — BARRE D'ÉTAT (hauteur 56 px, fixe)                             │
│  ● OP   ICC Pahou                    ● EN DIRECT · Jean 3:16    ⏹ Tout couper │
│                                        → Plein écran · Bas centré         │
├──────────────────────────────────────────────────────────────────────────┤
│ ▌ZONE 2 — CONTEXTE (hauteur 72 px)                                       │
│  Profil  [ICC Pahou — Culte du dimanche ▾]   Événement [Culte 26/10 ▾]    │
│  ⏱ 00:42:18 depuis le début          ⌚ 18:04          📶 LAN 4F2K [QR]   │
├──────────────────────────────────────────────────────────────────────────┤
│ ▌ZONE 3 — SORTIES (le reste de l'écran, grille adaptative)                     │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌────────────────┐  │
│  │ ● PLEIN ÉCRAN — SALLE │ │ ● BAS CENTRÉ — STREAM │ │ ＋ AJOUTER     │  │
│  │   1920×1080 · contain │ │   1920×1080 · alpha   │ │   UNE SORTIE   │  │
│  │ ┌───────────────────┐ │ │ ┌───────────────────┐ │ │                │  │
│  │ │  aperçu en direct │ │ │ │  aperçu en direct │ │ │                │  │
│  │ └───────────────────┘ │ │ └───────────────────┘ │ │                │  │
│  │ Liens : Bible Chants  │ │ Liens : Bible Chants  │ │                │  │
│  │  Médias Annonces Hab. │ │  Annonces Habillage   │ │                │
│  │ [Copier tout] [QR]    │ │ [Copier tout] [QR]    │ │                │
│  │ [Modifier les scènes] │ │ [Modifier les scènes] │ │                │
│  └───────────────────────┘ └───────────────────────┘ └────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│ ▌ZONE 4 — ACTION PRINCIPALE (hauteur 96 px, fixe en bas)                 │
│         ┌──────────────────────────────────────────────┐                 │
│         │        🎬  OUVRIR LE STUDIO UNIFIÉ           │                 │
│         └──────────────────────────────────────────────┘                 │
│   Vues : Vue scène · Télécommande · Mur des sorties · Diagnostic          │
└──────────────────────────────────────────────────────────────────────────┘
   (sous la ligne de flottaison : profils disponibles, derniers événements,
    bibliothèque en bref, export du projet)
```

---

## 5.3 Zone 1 — Barre d'état

| Élément | Contenu | Comportement |
|---|---|---|
| Marque | `● OP` + nom du projet | clic → réglages du projet |
| État live | `● EN DIRECT · <référence ou titre>` en rouge, ou `○ Rien à l'antenne` en gris | cliquable → ouvre le studio sur le module concerné |
| Cibles | liste des sorties qui reçoivent actuellement | — |
| Horloge de diffusion | durée depuis la première diffusion de la session | — |
| **Tout couper** | bouton rouge, `KBD Échap` | vide toutes les sorties en < 100 ms (EF-07.21) |

**EF-05.4** — Le bouton « Tout couper » est **toujours visible**, même quand rien ne passe
(dans ce cas il est désactivé mais présent, pour ne pas déplacer l'interface).

**Confirmation** — aucune : couper est une action d'urgence, réversible en une touche.

---

## 5.4 Zone 2 — Contexte

### 5.4.1 Sélecteur de profil

```
  Profil  [ICC Pahou — Culte du dimanche ▾]
          ├─ ICC Pahou — Culte du dimanche      ✓
          ├─ ICC Pahou — Réunion de prière
          ├─ Conférence
          ├─ Stream live
          ├────────────────────────────
          ├─ ⚙ Gérer les profils…
          └─ 💾 Enregistrer la configuration actuelle comme profil…
```

| ID | Exigence |
|---|---|
| EF-05.5 | Changer de profil demande confirmation si quelque chose est à l'antenne |
| EF-20.2 | Le changement applique sorties, looks et réglages en **une** action |
| EF-05.5b | Confirmation : `TXT: Appliquer le profil « Conférence » ? Les sorties, les looks et le plan type vont être remplacés. Ce qui est à l'antenne sera coupé.` |

### 5.4.2 Sélecteur d'événement

```
  Événement  [Culte du 26/10/2026 ▾]
             ├─ ● Aujourd'hui
             │    Culte du 26/10/2026 · 08:30 · Temple principal
             ├─ ● À venir
             │    Réunion de prière · 29/10 · Salle annexe
             │    Saint-Valentin · 14/02/2027 · Temple principal
             ├─ ● Passés
             │    Culte du 19/10/2026
             ├────────────────────────────
             ├─ ＋ Nouvel événement…
             └─ ⚙ Gérer les événements…
```

**EF-22.4** — L'événement **du jour** est sélectionné automatiquement au lancement s'il
existe.
**EF-05.6** — Sélectionner un événement charge son plan de déroulement et son profil
associé (avec confirmation si le profil diffère du profil actif).

### 5.4.3 Indicateurs

| Indicateur | Contenu |
|---|---|
| `⏱` | durée écoulée depuis la première diffusion de la session |
| `⌚` | heure locale, mise à jour chaque seconde |
| `📶` | adresse LAN + code d'accès + bouton QR |
| `🖥` | nombre de pages de sortie connectées (`2 sorties en ligne`) |

**EF-05.7** — L'état de connexion du serveur et des sorties est visible **en permanence**
dans cette zone, pas seulement dans une page de diagnostic.

---

## 5.5 Zone 3 — Cartes de sortie

Une carte par sortie activée, plus une carte « Ajouter ».

### 5.5.1 Contenu d'une carte

| Élément | Détail |
|---|---|
| Pastille d'état | verte = une page de sortie est connectée · grise = aucune · orange = sortie désactivée |
| Nom | nom de la sortie, modifiable en place au clic |
| Caractéristiques | `1920×1080 · contain` et `· alpha` si transparente |
| **Aperçu en direct** | rendu réel de ce que la sortie affiche, à l'échelle, mis à jour en direct |
| Liste des liens | une puce par type de contenu **autorisé** (`receives`) |
| Actions | `Copier tout` · `QR` · `Modifier les scènes` · `⚙` |

**EF-05.2** — L'aperçu utilise `render()` avec l'état courant (ENF-42).
**EF-05.3** — Chaque puce de lien : clic = copier l'URL · clic droit = menu (QR, ouvrir,
couper ce lien).
**EF-05.3b** — Les types **non autorisés** n'apparaissent pas comme puces ; un petit
`ℹ` explique : `TXT: Cette sortie ne reçoit pas les médias. Modifiez-le dans ⚙.`

### 5.5.2 Comportement de l'aperçu

| ID | Règle |
|---|---|
| EF-05.2b | L'aperçu se met à jour en moins de 200 ms après une diffusion |
| EF-05.2c | L'aperçu d'une sortie transparente est posé sur un damier gris, pour montrer l'alpha |
| EF-05.2d | Rien à l'antenne → l'aperçu affiche le fond de la scène et le texte d'exemple à 25 % d'opacité |
| EF-05.2e | Cliquer sur l'aperçu ouvre un agrandissement plein écran de cette sortie |

---

## 5.6 Zone 4 — Action principale

**EF-05.1** — Le bouton **« Ouvrir le Studio Unifié »** est le plus grand élément
cliquable de la page : hauteur 64 px, pleine largeur du conteneur central (max 720 px),
couleur d'accent, libellé en 20 px.

Vues secondaires, en lien texte sous le bouton :

| Lien | Cible |
|---|---|
| Vue scène | `/stage.html` |
| Télécommande | `/remote.html` (ouvre le QR en grand) |
| Mur des sorties | toutes les sorties côte à côte |
| Diagnostic | `/diagnostic.html` |

---

## 5.7 Sous la ligne de flottaison

| Bloc | Contenu |
|---|---|
| **Profils disponibles** | vignettes avec aperçu du look par défaut |
| **Derniers événements** | 5 derniers, avec date et plan |
| **Bibliothèque en bref** | `3 bibles · 84 chants · 213 médias · 6 looks` — cliquable vers le studio |
| **Projet** | `📦 Exporter le projet` · `🔄 Restaurer` · `🧹 Intégrité` · `📁 Ouvrir le dossier` |
| **Aide** | `LISEZ-MOI` · raccourcis clavier · à propos |

**EF-05.8** — L'adresse LAN, le code d'accès et le QR code sont affichés **dans la zone 2**
(donc au-dessus de la ligne de flottaison), pas seulement ici.

---

## 5.8 États particuliers

| État | Affichage |
|---|---|
| Première utilisation | bandeau d'assistant : `TXT: Bienvenue. Choisissez un profil pour commencer →` |
| Aucune sortie connectée | pastilles grises + `TXT: Aucune sortie en ligne. Ouvrez les liens dans OBS.` |
| Aucune Bible importée | la carte Bible n'apparaît pas ; assistant : `TXT: Importez une Bible pour pouvoir diffuser des versets.` |
| Mode lecture seule | bandeau permanent orange (EF-03, § 3.5.2) |
| Serveur injoignable | page entière remplacée par `TXT: Serveur déconnecté — relancez OpenPresenter.` |
| Événement en cours | liseré de la couleur de l'événement autour de la zone 2 |

---

## 5.9 Accessibilité et responsive

| ID | Règle |
|---|---|
| EF-05.10 | Tous les éléments interactifs sont atteignables au clavier, dans un ordre logique |
| EF-05.11 | `aria-label` sur les boutons icônes (couper, QR, copier) |
| EF-05.12 | Contraste ≥ 4,5:1 pour les textes, ≥ 3:1 pour les éléments d'interface |
| EF-05.13 | En dessous de 1024 px de large, les cartes de sortie passent en colonne unique |
| EF-05.14 | En dessous de 640 px, la zone 4 devient une barre fixe et les puces de liens sont masquées derrière un bouton |

---

## 5.10 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-11** | Changer de profil depuis l'accueil | sorties, looks et liens changent en une action |
| **A-11b** | Diffuser puis revenir à l'accueil | l'aperçu montre le contenu en moins de 200 ms |
| **A-11c** | Tout couper depuis l'accueil | toutes les sorties vides en < 100 ms |
| **A-11d** | Écran 1366×768 | les 4 zones sont visibles sans défilement |
| **A-11e** | Navigation clavier uniquement | atteindre « Ouvrir le Studio » en ≤ 5 tabulations |
