# 99 — Glossaire

> Les termes ci-dessous sont utilisés avec **ce sens précis** dans toute la spécification
> et dans l'interface. Un terme qui prête à confusion est défini ici, pas ailleurs.

---

## A

**Aimant (snapping)**
Mécanisme d'accrochage automatique d'un calque aux bords, au centre, aux tiers du canevas
ou aux autres calques pendant un déplacement. Seuil : 0,8 % du canevas.

**Aperçu**
Rendu d'une sortie dans l'interface de régie, à l'échelle. Utilise la **même** fonction
`render()` que la sortie réelle (ENF-42). À distinguer de la **projection**.

**Arrangement** (chant)
Suite ordonnée de sections d'un chant (`Couplet 1 · Refrain · Couplet 2 · Refrain…`).
Un chant peut avoir plusieurs arrangements. Modifiable **en direct**.

**Asset**
Fichier binaire du projet (image, vidéo, PDF, XML, police). Adressé par son empreinte
SHA-256, stocké dans `project/assets/`, **jamais** référencé par son chemin d'origine.

**Asset lié** (`linked`)
Asset volontairement **non copié** dans le projet (fichier > 500 Mo, choix explicite).
Signalé en orange partout : il ne sera pas exporté.

---

## B

**Bandeau**
Disposition de sortie en bas de l'écran, généralement transparente, destinée à un stream.
Voir *preset* `bottom`.

**Bible (version)**
Une traduction importée (LSG, BDS, KJV…). Identifiée par un `id` stable, un nom et une
abréviation qui sert de badge à l'antenne.

**Bind / Liaison**
Champ de données qui alimente un calque texte : `ref`, `verse`, `lyrics`, `title`,
`timer`… Un calque est **soit libre** (`custom`), **soit lié**.

---

## C

**Calque**
Élément d'une scène. Quatre types : `background`, `overlay`, `text`, `image`, plus
`group`. Positionné en **pourcentage** d'un canevas 1920×1080, par son centre.

**Canevas**
Le plan de travail normalisé **1920×1080** sur lequel toutes les scènes sont conçues,
quelle que soit la résolution réelle de la sortie.

**Cible (de diffusion)**
Sortie cochée pour recevoir le contenu diffusé. Réglée par `targetByDefault` et modifiable
pour la session.

**Code d'accès LAN**
Code de 4 caractères (`[A-Z2-9]`) affiché au lancement, requis par les pages ouvertes
depuis un autre appareil du réseau (ENF-32).

**Cue**
Voir *étape de plan*.

---

## D

**Découpage** (`split`)
Fragmentation d'un texte long en **parties** affichables séparément. Mode par défaut :
`words`, 25 mots par écran pour un bandeau. Voir EF-13.

**Déduplication**
Réutilisation d'un asset déjà présent plutôt que création d'une copie, sur la base du
SHA-256. Voir EF-02.3.

**Diffusion**
Action d'envoyer un contenu vers une ou plusieurs sorties. À distinguer de *projection*
(l'acte matériel d'afficher) et d'*aperçu* (le rendu dans l'interface).

---

## E

**Éditeur de scène**
Interface WYSIWYG de composition des calques. Une scène est propre à un couple
**(sortie, type de contenu)**.

**Étape de plan / cue**
Un élément du plan de déroulement. Types : `note`, `bible`, `song`, `media`,
`announcement`, `lowerthird`, `timer`, `blank`.

**Événement**
Occurrence datée (culte, conférence, concert) rattachée à un lieu, un profil et un plan.

---

## F

**Fit / Cadrage**
Manière d'adapter le canevas 1920×1080 à la résolution réelle : `contain` (tout visible),
`cover` (remplit, rogne), `stretch` (déforme).

---

## K

**Kind / Type de contenu**
Famille de contenu diffusé : `bible`, `songs`, `media`, `announcements`, `lowerthird`,
`timer`, `plan`. Sert de filtre dans les liens OBS et de clé dans `scenesByKind`.

---

## L

**Lien**
URL d'une sortie, éventuellement restreinte à un type de contenu :
`/o/<outputId>?kind=<kind>`. C'est ce qu'on colle dans OBS ou vMix.

**Look**
Jeu de scènes nommé et réutilisable couvrant plusieurs types de contenu. **Embarque une
copie** des scènes : modifier l'original ne modifie pas le look.

**Lower third**
Habillage en bas de l'écran affichant un nom et une fonction. Voir *habillage*.

---

## M

**Matrice de liens**
Le tableau croisant les **sorties** (lignes) et les **types de contenu** (colonnes), chaque
cellule donnant une URL.

**Migration**
Transformation des données d'une version antérieure (V1, V2) vers le format courant.
Toujours précédée d'une sauvegarde.

**Miniature** (`thumb`)
Image WebP générée pour un asset, stockée dans `project/cache/thumb/`. Reconstructible.

**Moteur de scène**
L'unique implémentation du rendu (`engine.mjs`). Utilisée par le contrôleur, l'éditeur, la
sortie et la vue scène. Toute duplication est interdite (ENF-42).

---

## O

**Organisation**
Entité propriétaire : église, association, école. Contient des **lieux**. Optionnelle.

**Output / Sortie**
Destination d'affichage : `id` stable, nom, résolution, cadrage, `receives`, scènes par type.
Consommée via une URL.

---

## P

**Partie**
Fragment d'un texte long produit par le découpage. Unité de navigation :
`→` passe d'une partie à la suivante, puis au verset suivant.

**Plan de déroulement** (cue list)
Liste ordonnée d'étapes conduite en direct. Une touche (`Espace`) pour avancer.

**Preset** (disposition)
Modèle de géométrie d'une scène : `full`, `screen80`, `bottom`, `bottom-right`,
`lowerthird`, `custom`.

**Profil**
Gabarit complet et réutilisable : sorties, looks, bibles, réglages de scène, gabarit de plan.
Ne contient **aucun binaire**.

**Projection**
Acte d'afficher sur un écran matériel. Se fait via une **sortie**.

**Projet**
Le **dossier complet** contenant le logiciel (`app/`, `runtime/`) et les données (`project/`).
Copier ce dossier suffit à tout transposer.

---

## R

**receives** (filtre de contenu)
Objet, par sortie, déclarant quels types de contenu elle accepte. Un type à `false` n'est
jamais affiché sur cette sortie, même via son URL directe.

**Relais**
Serveur WebSocket local (`/ws`) qui synchronise régie, sorties, vue scène et télécommande.

**render()**
La fonction unique qui transforme une scène + des liaisons en DOM.

---

## S

**Scène**
Composition à calques. Propriété d'un couple (sortie, type de contenu). Sérialisée en JSON.

**Section** (chant)
Bloc de paroles : couplet, refrain, pont, intro, fin, tag.

**Sortie**
Voir *output*.

**Split** / **Découpage**
Voir *découpage*.

**Station / Vue scène**
Écran de confiance destiné aux intervenants : texte courant et suivant, minuteur, messages.
Jamais vu par le public.

---

## T

**Thème**
Jeu de couleurs et de rayons appliqué à une scène. Ne modifie **jamais** la géométrie.

**Type de contenu**
Voir *kind*.

---

## V

**Version biblique**
Voir *bible*.

**Vue scène**
Voir *station*.
