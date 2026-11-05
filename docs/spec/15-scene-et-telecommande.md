# 15 — Vue scène et télécommande

> **Exigences couvertes :** EF-24, EF-25, ENF-13
> **Repris de :** V1 `vue_pasteur.html`, `pasteur_control.html`, `stage_display.html` ;
> V2 `app/stage.html`, `app/remote.html`
> **Maquettes :** MAQ-09 (vue scène)

---

## 15.1 Vue scène (EF-24)

### 15.1.1 Le principe

La **vue scène** est l'écran regardé par les intervenants, jamais par le public.
Elle doit être lisible **sans effort**, à plusieurs mètres, dans une salle sombre.

**EF-24.1** — Fond **noir absolu**, texte blanc, aucun élément décoratif.
**EF-24.2** — Le texte courant est affiché **en très grand** (ajustement automatique,
repris de V1 « messages au pasteur en très grand — ajustement auto précis »).
**EF-24.3** — Aucune interaction n'est requise : les boutons sont optionnels et discrets.
**EF-24.4** — La vue est utilisable en plein écran (`F11`) sans perte d'information.

### 15.1.2 Disposition

```
┌───────────────────────────────────────────────────────────────────────────┐
│  OP  Vue scène      ● EN DIRECT · Jean 3:16              18:04:22  [⚙]   │
├──────────────────────────────────────────┬────────────────────────────────┤
│                                          │  RÉFÉRENCE                     │
│          ┌────────────────────────────┐  │  Jean 3:16 · LSG               │
│          │                            │  │                                │
│          │   Car Dieu a tant aimé     │  │  TEXTE                         │
│          │   le monde qu'il a donné   │  │  Car Dieu a tant aimé le monde │
│          │   son Fils unique,         │  │  qu'il a donné son Fils…       │
│          │                            │  │                                │
│          └────────────────────────────┘  │  PARTIE                        │
│           aperçu de la sortie suivie     │  Actuelle  2 / 3               │
│                                          │  Suivante  « afin que… »       │
│  Sortie suivie : Plein écran — Salle     │                                │
│  ← / → pour naviguer                     │  MINUTEUR · Prédication        │
│                                          │  ┌──────────────────────────┐  │
│                                          │  │        12:41             │  │
│                                          │  │ ███████████░░░░░░░  72 % │  │
│                                          │  └──────────────────────────┘  │
│                                          │                                │
│                                          │  MESSAGE DE LA RÉGIE           │
│                                          │  « Il reste 5 min »            │
│                                          │  Régie · 18:02 · important     │
├──────────────────────────────────────────┴────────────────────────────────┤
│        [‹ Précédent]        [■ ÉCRAN NOIR]        [Suivant ›]              │
└───────────────────────────────────────────────────────────────────────────┘
```

### 15.1.3 Exigences détaillées

| ID | Exigence |
|---|---|
| EF-24.5 | Choix de la sortie suivie (par défaut : la première sortie `targetByDefault`) |
| EF-24.6 | Affichage du texte **courant** et de la partie **suivante** |
| EF-24.7 | Minuteur avec libellé, valeur et barre de progression |
| EF-24.8 | Horloge locale en permanence |
| EF-24.9 | Messages de la régie avec ton (`info` / `important` / `urgent`) et auteur |
| EF-24.10 | Historique des 5 derniers messages |
| EF-24.11 | Boutons Précédent / Suivant / Écran noir synchronisés avec la régie |
| EF-24.12 | Taille de texte réglable depuis l'écran lui-même (3 crans : normal, grand, très grand) |
| EF-24.13 | Accords de chant affichables si le profil l'autorise (EF-15.24) |
| EF-24.14 | L'aperçu de la sortie est **optionnel** (masquable pour ne garder que le texte) |

### 15.1.4 Messages de la régie

```jsonc
{ "t": "stageMessage",
  "text": "Il reste 5 minutes",
  "tone": "important",          // info | important | urgent
  "author": "Régie",
  "ts": 1792600000000 }
```

| Ton | Rendu |
|---|---|
| `info` | texte gris clair, bordure neutre |
| `important` | texte ambre, bordure ambre |
| `urgent` | texte rouge, **inverse** (fond rouge, texte blanc), clignotement doux |

**EF-24.15** — Un message `urgent` s'affiche **au-dessus** de tout le reste, en très grand.
**EF-24.16** — Un message se retire après 60 s, ou par action explicite.
**EF-24.17** — Le message est diffusé **instantanément** (< 200 ms).

---

## 15.2 Télécommande (EF-25)

### 15.2.1 Accès

**EF-25.1** — La télécommande s'ouvre par QR code depuis le Studio ou l'accueil.
**EF-25.2** — Si le studio est ouvert sur `localhost`, l'utilisateur **choisit** l'adresse
Wi-Fi à encoder (repris de V2 : plusieurs interfaces possibles).
**EF-25.3** — Le code d'accès LAN est inclus dans l'URL du QR (`&t=4F2K`).
**EF-25.4** — La page est une **PWA** : après le premier chargement, elle fonctionne
hors-ligne sur le téléphone.

### 15.2.2 Contenu

```
┌─────────────────────────────┐
│  ● ICC Pahou      18:04     │
│  EN COURS · Jean 3:16       │
│  « Car Dieu a tant aimé… »  │
├─────────────────────────────┤
│  ⏱ 12:41 · Prédication      │
├─────────────────────────────┤
│  SUIVANT                    │
│  Tu es saint · Couplet 1    │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │                       │  │
│  │     ▶  AVANCER        │  │  ← 60 % de la hauteur
│  │                       │  │
│  └───────────────────────┘  │
├─────────────────────────────┤
│  [◀ Reculer]  [■ Couper]    │
├─────────────────────────────┤
│  🔍 Recherche Bible         │
│  📋 Voir le plan            │
└─────────────────────────────┘
```

| ID | Exigence |
|---|---|
| EF-25.5 | Bouton **Avancer** très grand (au moins 60 % de la hauteur utile) |
| EF-25.6 | Reculer, Couper accessibles sans défilement |
| EF-25.7 | Recherche Bible depuis le téléphone (même machine à états que le § 9.3) |
| EF-25.8 | Affichage du plan complet, navigation directe vers une étape |
| EF-25.9 | Retour haptique sur les boutons (si supporté) |
| EF-25.10 | Écran maintenu allumé pendant l'utilisation (`Wake Lock API` si disponible) |
| EF-25.11 | Reconnexion automatique au relais en cas de perte de Wi-Fi |

### 15.2.3 Contrôle de la vue scène

**EF-25.12** — La vue scène propose un panneau « Contrôle » (discret, en bas à droite)
permettant de : démarrer / mettre en pause / réinitialiser le minuteur, régler les
minutes, envoyer un message, passer à l'étape suivante du plan.

---

## 15.3 Latence et synchronisation

| ID | Exigence |
|---|---|
| ENF-13 | Contrôleur → sortie OBS : **< 120 ms** sur réseau local |
| EF-25.13 | Régie → vue scène : **< 200 ms** |
| EF-25.14 | Vue scène → régie (bouton Suivant) : **< 200 ms** |
| EF-25.15 | Une reconnexion resynchronise l'état complet en **< 1 s** |
| EF-25.16 | Un message plus ancien que l'état courant est ignoré (EF-04.8) |

---

## 15.4 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-15b** | Message `urgent` envoyé | affiché en moins de 200 ms, au-dessus de tout |
| **A-15c** | Téléphone sur le même Wi-Fi, QR scanné | télécommande fonctionnelle |
| **A-15d** | Wi-Fi coupé puis rétabli | reconnexion automatique, état resynchronisé |
| **A-15e** | Vue scène en plein écran à 5 m | texte lisible, aucune information manquante |
| **A-15f** | Trois crans de taille de texte | le texte s'ajuste sans débordement |
