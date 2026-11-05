# 06 — Studio unifié

> **Exigences couvertes :** EF-06, EF-23, principe P8
> **Maquettes :** MAQ-03 (module Bible), MAQ-04 (module Chants)
> **URL :** `/studio.html`

---

## 6.1 Principe

**Une seule fenêtre** réunit tous les outils. Pas d'iframe par outil (le défaut de la V1,
où `cue_list.html` chargeait 4 pages en iframes cachées) : un seul état applicatif,
une seule connexion au relais, une seule mémoire.

---

## 6.2 Disposition normative

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ▌ENTÊTE (52 px)                                                               │
│  ● OP  ICC Pahou   [🔍 Tout chercher…           ]   ⌚18:04  ⏱00:42  ●LIVE    │
│                                     [Vue scène] [Télécommande] [⚙]            │
├──────────┬──────────────────────────────────────────────┬─────────────────────┤
│ ▌NAV     │ ▌CONTENU                                     │ ▌INSPECTEUR         │
│ (200 px) │                                              │ (320 px, repliable) │
│          │  Bibliothèque        │  Aperçu                │                     │
│ ● Plan   │  ┌────────────────┐  │  ┌──────────────────┐  │  Scène              │
│   Bible  │  │ Genèse         │  │  │                  │  │  [Bas centré ▾]     │
│   Chants │  │ Exode          │  │  │   aperçu         │  │  [Modifier…]        │
│   Médias │  │ …              │  │  │   en direct      │  │                     │
│   Annonc.│  │ Jean      ←    │  │  │                  │  │  Découpage          │
│   Minuteur│ └────────────────┘  │  └──────────────────┘  │   25 mots           │
│   Habill.│                      │                        │                     │
│ ─────── │  Chapitres 1 2 [3]   │  Parties 2/3   ◀ ▶     │  Cibles             │
│   Sorties│                      │                        │  [✓] Plein écran    │
│   Profils│  Versets             │                        │  [✓] Bas centré     │
│   Événem.│  ┌────────────────┐  │                        │                     │
│   Réglag.│  │ 16 Car Dieu…  ★│  │                        │  [DIFFUSER]         │
│          │  └────────────────┘  │                        │  [Aperçu] [Couper]  │
├──────────┴──────────────────────┴────────────────────────┴─────────────────────┤
│ ▌BARRE DE PLAN (88 px, fixe en bas)                                            │
│  ‹  [3] Jean 3:16  ›   │   En cours : Jean 3:16  ·  Suivant : Offrande (7 min)  │
│  ⏱ 00:42:18            │   ⏮  ⏭  ■                       [Espace] pour avancer │
└───────────────────────────────────────────────────────────────────────────────┘
```

| ID | Exigence |
|---|---|
| EF-06.1 | La navigation est un volet de 200 px, repliable à 56 px (icônes seules) |
| EF-06.2 | L'inspecteur est repliable ; sa largeur est mémorisée |
| EF-06.3 | La barre de plan est **toujours visible**, quel que soit le module actif |
| EF-06.4 | Le module actif est mémorisé entre les sessions (`localStorage`) |
| EF-06.5 | Aucun iframe : un seul document, un seul état |

---

## 6.3 Navigation — les 13 modules

| Module | Icône | Rôle | Chapitre |
|---|---|---|---|
| **Plan** | 📋 | conduite du déroulé | 14 |
| **Bible** | 📖 | versets | 09 |
| **Chants** | 🎤 | paroles | 10 |
| **Médias** | 🖼️ | images, vidéos, PDF, PPTX | 11 |
| **Annonces** | 📢 | textes et visuels d'annonce | 12 |
| **Minuteur** | ⏱ | chronos et comptes à rebours | 12 |
| **Habillages** | 🏷️ | lower thirds | 12 |
| **Sorties** | 🖥️ | sorties et matrice de liens | 07 |
| **Profils** | 🎚️ | profils réutilisables | 13 |
| **Événements** | 📅 | organisations, événements | 14 |
| **Bibliothèque** | 📚 | vue transversale de tous les contenus | — |
| **Intégrité** | 🧹 | maintenance du projet | 04 |
| **Réglages** | ⚙ | préférences | — |

**EF-06.6** — Chaque module a un raccourci `KBD Alt + 1 … 9` pour les 9 premiers.
**EF-06.7** — Changer de module **ne coupe pas** ce qui est à l'antenne.

---

## 6.4 Recherche unifiée (EF-06.8 → EF-06.16)

Reprend la « recherche unifiée » déjà présente en V1 (`studio_unifie.html`) et V2
(`index.html`), en fusionnant les deux implémentations.

```
┌────────────────────────────────────────────────────────────┐
│ 🔍  gra                                             [Échap] │
├────────────────────────────────────────────────────────────┤
│  CHANTS (3)                                                 │
│   🎤 Grâce infinie              Traditionnel · Couplet 1    │
│   🎤 Grâce infinie (anglais)    Amazing Grace               │
│   🎤 La grâce de Dieu           …                           │
│  VERSETS (12)                                               │
│   📖 Jean 1:16  LSG   « Et nous avons tous reçu de sa grâce…»│
│   📖 2 Cor 8:9  LSG   « …afin que par sa grâce vous soyez…»  │
│  MÉDIAS (1)                                                 │
│   🖼️ visuel-grace.jpeg          1920×1080                   │
│  ANNONCES (0)                                               │
└────────────────────────────────────────────────────────────┘
  ↑↓ naviguer · Entrée diffuser le premier · Maj+Entrée aperçu · Échap fermer
```

| ID | Règle |
|---|---|
| EF-06.8 | Un seul champ, ouvert par `KBD Ctrl/Cmd + K` depuis n'importe où |
| EF-06.9 | Résultats groupés par type, avec le compte par groupe |
| EF-06.10 | `↑` / `↓` déplacent la sélection **tous groupes confondus** |
| EF-06.11 | `Entrée` diffuse l'élément en surbrillance (le premier par défaut) |
| EF-06.12 | `Maj + Entrée` met en aperçu sans diffuser |
| EF-06.13 | `Échap` ferme et rend le focus à l'élément précédent |
| EF-06.14 | La recherche porte sur : titres et paroles de chants, noms de livres et texte des versets, noms de fichiers médias, titres d'annonces, noms de looks |
| EF-06.15 | Insensible à la casse et aux accents |
| EF-06.16 | Débouncée à **120 ms** ; 50 résultats maximum par groupe |
| EF-06.17 | La recherche s'exécute **uniquement** sur l'index local : aucune requête réseau |
| EF-06.18 | Les types de contenu sont filtrables par puces (`chants` `versets` `médias` …) |

---

## 6.5 Barre de diffusion (commune à tous les modules de contenu)

```
  Diffuser vers :  [✓] Plein écran — Salle   [✓] Bas centré — Stream
                   [ ] Lower third Intro
                   ⚠ « Lower third Intro » ne reçoit pas les versets

                              [Aperçu]   [ DIFFUSER ]   [Couper]
```

| ID | Règle |
|---|---|
| EF-06.19 | Les cibles pré-cochées suivent `targetByDefault` de chaque sortie |
| EF-06.20 | Une sortie qui ne reçoit pas ce type de contenu est **grisée** avec infobulle |
| EF-06.21 | La sélection des cibles est mémorisée pour la session |
| EF-06.22 | `KBD Entrée` = Diffuser · `KBD Maj + Entrée` = Aperçu · `KBD Échap` = Couper |
| EF-06.23 | Diffuser avec **aucune** cible cochée affiche : `TXT: Aucune sortie sélectionnée.` |

---

## 6.6 Barre de plan

Toujours visible en bas, quel que soit le module.

| Élément | Comportement |
|---|---|
| `⏮` | cue précédent (`KBD ←`) |
| numéro + libellé | cue courant, cliquable pour ouvrir l'éditeur de plan |
| `⏭` | cue suivant (`KBD →` ou `Espace`) |
| `■` | couper (`KBD Échap`) |
| En cours / Suivant | libellés, avec la durée estimée du suivant |
| Horloge de session | durée depuis la première diffusion |

**EF-06.24** — La barre de plan affiche toujours le cue **suivant**, pour que l'opérateur
sache ce qui arrive.
**EF-06.25** — Cliquer sur un libellé ouvre le module Plan positionné sur ce cue.

---

## 6.7 Aperçu

| ID | Règle |
|---|---|
| EF-06.26 | L'aperçu suit la **sortie sélectionnée** dans un sélecteur en tête d'aperçu |
| EF-06.27 | L'aperçu est rendu à l'échelle dans un cadre 16:9, avec le damier si la sortie est transparente |
| EF-06.28 | L'aperçu utilise `render()` (ENF-42) : jamais de rendu simplifié |
| EF-06.29 | Un bouton `1:1` ouvre l'aperçu en pleine résolution dans un onglet |
| EF-06.30 | Les flèches de navigation de parties sont cliquables dans l'aperçu |

---

## 6.8 Notifications (toasts)

| Type | Couleur | Durée | Exemple |
|---|---|---|---|
| succès | vert | 2,5 s | `TXT: Jean 3:16 diffusé sur 2 sorties` |
| info | bleu | 3 s | `TXT: Profil « Conférence » appliqué` |
| avertissement | orange | 5 s | `TXT: « Lower third » ne reçoit pas les médias — sortie ignorée` |
| erreur | rouge | 8 s, fermable | `TXT: Import impossible : ce fichier n'est pas une Bible reconnue.` |

| ID | Règle |
|---|---|
| EF-06.31 | Au plus **3** toasts empilés ; le plus ancien disparaît |
| EF-06.32 | Les toasts n'interrompent **jamais** la diffusion en cours |
| EF-06.33 | Un toast d'erreur est copiable (bouton `⧉`) et journalisé |
| EF-06.34 | Un mode « silencieux » désactive les toasts de succès |

---

## 6.9 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-12** | `Ctrl+K`, taper `gra`, `Entrée` | le premier chant est diffusé |
| **A-12b** | `Alt+3` | le module Médias s'ouvre |
| **A-12c** | Changer de module pendant une diffusion | la diffusion continue |
| **A-12d** | Diffuser sans cible cochée | message d'erreur, rien n'est diffusé |
| **A-12e** | Écran 1366×768 | les 3 colonnes + la barre de plan sont utilisables |
