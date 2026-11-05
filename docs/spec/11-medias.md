# 11 — Médias

> **Exigences couvertes :** EF-16, EF-02 (copie des assets)
> **Modules repris :** `openpresenter2/src/modules/media/library.mjs`,
> `openpresenter2/src/modules/media/pptx.mjs`, `vendor/js/pdf.min.js` (V1 et V2)

---

## 11.1 Types acceptés

| Type | Extensions | MIME | Traitement |
|---|---|---|---|
| Image | `png` `jpg` `jpeg` `webp` `gif` `svg` `avif` | `image/*` | affichage + miniature |
| Vidéo | `mp4` `webm` `mov` `m4v` | `video/*` | lecture + vignette d'affiche |
| PDF | `pdf` | `application/pdf` | rendu page à page via `pdf.js` vendu |
| Présentation | `pptx` | `…presentationml.presentation` | conversion en SVG par le parseur maison |
| Ancien PowerPoint | `ppt` | — | **non supporté** : message explicite |

**EF-16.1** — Un fichier d'un type non supporté affiche :
```
TXT: « presentation.ppt » n'est pas pris en charge.
     Enregistrez-le au format .pptx ou exportez-le en PDF.
```
**EF-16.2** — `ppt` et `key` (Keynote) ne sont **pas** acceptés : aucune conversion
approximative n'est proposée.

---

## 11.2 Import

| ID | Exigence |
|---|---|
| EF-16.3 | Import par bouton, par **glisser-déposer** sur la bibliothèque, ou par sélection multiple |
| EF-16.4 | Chaque fichier est **copié** dans `assets/media/` selon la procédure du § 4.4.1 |
| EF-16.5 | Une barre de progression affiche fichier par fichier : `3 / 12 · offrande.jpg` |
| EF-16.6 | Un import interrompu peut être **repris** (les fichiers déjà copiés sont sautés) |
| EF-16.7 | Le groupe de destination est sélectionnable **avant** l'import |
| EF-16.8 | Un fichier identique déjà présent est signalé : `TXT: « fond.jpg » est identique à un fichier déjà importé (réutilisation).` |
| EF-16.9 | Une miniature est générée pour chaque image, vidéo et PDF (première page) |

### 11.2.1 Rapport d'import

```
TXT: Import terminé

     12 fichiers traités
      9 importés          18,4 Mo
      2 déjà présents     (réutilisés, 0 octet écrit)
      1 refusé            presentation.ppt (format non pris en charge)

     [Voir les fichiers]   [Fermer]
```

---

## 11.3 Bibliothèque

```
┌──────────────────────────────────────────────────────────────┐
│  MÉDIAS                        [+ Importer]  [Groupe ▾] [🔍] │
├──────────────────────────────────────────────────────────────┤
│  Groupes          │  ┌────────┐ ┌────────┐ ┌────────┐        │
│  ● Tous (213)     │  │ ▣ img  │ │ ▣ img  │ │ ▶ vid  │        │
│  ○ Visuels culte  │  │ fond.jpg│ │offrande│ │intro.mp4│       │
│  ○ Fond d'écran   │  └────────┘ └────────┘ └────────┘        │
│  ○ Louange        │  ┌────────┐ ┌────────┐ ┌────────┐        │
│  ○ Annonces       │  │ ▤ pdf  │ │ ▣ pptx │ │ ▣ img  │        │
│  [+ Groupe]       │  └────────┘ └────────┘ └────────┘        │
│                    │                                          │
│  Type : [Tous ▾]   │  Tri : [Nom ▾]     Taille : [M ▾]       │
└──────────────────────────────────────────────────────────────┘
```

| ID | Exigence |
|---|---|
| EF-16.10 | **Groupes** dossiers nommés, cumulables (`un média peut être dans plusieurs groupes`) |
| EF-16.11 | Vue grille et vue liste |
| EF-16.12 | Filtre par type |
| EF-16.13 | Tri par nom, date, taille, dernier usage |
| EF-16.14 | Taille de vignette réglable (S / M / L) |
| EF-16.15 | Les assets `linked` (non copiés) sont marqués en **orange** (EF-02.7) |
| EF-16.16 | Un média utilisé par une scène l'indique : `Utilisé dans : Bas centré — Fond` |
| EF-16.17 | Suppression avec confirmation nommant les usages |

---

## 11.4 Lecture des vidéos

| Contrôle | Règle |
|---|---|
| Lecture / pause | `KBD L` ou bouton |
| Muet | `KBD M`, **muet par défaut** |
| Boucle | `KBD B`, activée par défaut pour les fonds |
| Point d'entrée | réglable à 0,1 s près |
| Vitesse | 0,25× → 4× |
| Aller à | champ `mm:ss`, `KBD Entrée` valide |

**EF-16.18** — La lecture démarre **synchronisée** sur toutes les sorties ciblées : un
fichier `startAtMs` et un `ts` commun sont envoyés, chaque page calcule sa position.
**EF-16.19** — Une dérive supérieure à **120 ms** provoque un recalage automatique.
**EF-16.20** — Mettre en pause depuis le Studio met en pause toutes les sorties.
**EF-16.21** — `preload="metadata"` avant diffusion, `auto` pendant.

---

## 11.5 PDF et présentations

| ID | Exigence |
|---|---|
| EF-16.22 | Navigation page par page avec `←` / `→` |
| EF-16.23 | Un PDF peut être diffusé **en continu** (toutes les pages) ou **page par page** |
| EF-16.24 | Un PPTX est converti en SVG par le parseur maison (repris de V2) : textes, formes, images, positions |
| EF-16.25 | Les polices manquantes dans un PPTX sont remplacées et **signalées** : `TXT: 2 polices du fichier sont absentes et ont été remplacées.` |
| EF-16.26 | Un PPTX dont la conversion échoue affiche le message d'erreur et propose le PDF |
| EF-16.27 | Le nombre de pages est affiché : `page 4 / 18` |

---

## 11.6 File de lecture

| ID | Exigence |
|---|---|
| EF-16.28 | Enchaîner plusieurs médias automatiquement, avec une durée par média |
| EF-16.29 | Avancer / reculer manuellement dans la file |
| EF-16.30 | Une image peut rester affichée **indéfiniment** (pas d'avance automatique) |

---

## 11.7 Média comme fond de scène

**EF-16.31** — Un média peut être affecté au calque `background` d'une scène, avec
liaison `bind: "backgroundMedia"` pour qu'il suive le média diffusé.
**EF-16.32** — Le passage d'un média à un autre fond se fait avec la transition de la scène.

---

## 11.8 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-04** | Importer depuis `/tmp`, supprimer la source | le média s'affiche toujours ; aucun chemin absolu dans les fichiers du projet |
| **A-05** | Importer deux fois le même fichier | un seul binaire dans `assets/` |
| **A-13b** | Vidéo diffusée sur 2 sorties | dérive < 120 ms |
| **A-13c** | PPTX de 18 diapositives | conversion fidèle, navigation page à page |
| **A-13d** | Fichier `.ppt` | refus explicite avec la solution |
| **A-13e** | Média supprimé pendant la diffusion | placeholder `Média indisponible`, sortie non figée |
