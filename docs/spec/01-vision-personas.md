# 01 — Vision, personas et parcours

> **Couvre :** la partie « pourquoi » du cahier des charges. Aucune exigence technique ici :
> ce chapitre sert d'**arbitre** en cas de désaccord sur une fonctionnalité.

---

## 1.1 La vision en une phrase

> **Un dossier que l'on double-clique, et la régie est prête — avec ou sans Internet.**

Tout le reste en découle. Si une idée de fonctionnalité oblige l'utilisateur à installer
quelque chose, à créer un compte, ou à dépendre d'un service distant pour conduire un
culte, elle est **refusée**.

---

## 1.2 Ce que le logiciel doit rendre possible le dimanche matin

| Moment | Ce qui doit marcher | Principe |
|---|---|---|
| 07 h 45 — le bénévole arrive | Double-clic, le navigateur s'ouvre, tout est déjà là | P3, P2 |
| 07 h 50 — vérification | Il voit en un coup d'œil ce qui est en ligne et ce qui passe | EF-05 |
| 08 h 00 — le culte commence | `Espace` pour avancer, rien d'autre à comprendre | P8 |
| 08 h 30 — le pasteur prêche | L'écran de scène affiche le texte suivant et le chrono | EF-24 |
| 09 h 15 — le stream | Les versets sont en bas, les médias plein écran **ne passent pas** sur le stream | P6 |
| 09 h 40 — une vidéo ne charge pas | Un message s'affiche, rien ne se fige | P10 |
| 10 h 00 — on range | On ferme la fenêtre. Rien à sauvegarder : tout est déjà écrit | P2 |
| La semaine d'après, sur un autre PC | On recopie le dossier, tout est identique | P2 |

---

## 1.3 Personas

### PE-1 — Le bénévole régie

| Attribut | Détail |
|---|---|
| Qui | Membre de l'église, 20 à 70 ans, bonne volonté, aucune formation technique |
| Fréquence | Un dimanche sur quatre ; peut changer d'une semaine à l'autre |
| Matériel | Le PC de la salle, qu'il n'a pas installé |
| Ce qu'il sait faire | Ouvrir un navigateur, cliquer, taper au clavier |
| Ce qu'il ne sait pas faire | Ouvrir un terminal, lire une stack trace, configurer un réseau |
| **Son critère de succès** | « Je n'ai rien cassé et le culte s'est bien affiché » |

**Conséquences de conception**

| # | Conséquence |
|---|---|
| 1 | Un seul geste : double-clic (EF-03) |
| 2 | Aucun message technique brut ; toujours une cause + un remède (EF-03.7) |
| 3 | La page d'accueil répond à « qu'est-ce qui passe ? » sans défilement (EF-05.9) |
| 4 | Les réglages dangereux sont protégés par une confirmation nommant l'objet |
| 5 | Le profil et l'événement sont **déjà choisis** : il n'a rien à décider (CU-08) |
| 6 | `Espace` suffit à conduire le plan (EF-23.3) |

---

### PE-2 — L'opérateur confirmé

| Attribut | Détail |
|---|---|
| Qui | Responsable technique, prépare le culte la veille |
| Fréquence | Chaque semaine, 1 à 3 h de préparation |
| Ce qu'il veut | Aller vite, tout contrôler au clavier, ne pas refaire deux fois le même travail |
| **Son critère de succès** | « J'ai préparé en 20 minutes et je peux tout piloter sans souris » |

**Conséquences de conception**

| # | Conséquence |
|---|---|
| 1 | Saisie Bible en 6 frappes (EF-12) |
| 2 | Table de raccourcis complète et cohérente (`18-clavier-accessibilite.md`) |
| 3 | Looks et profils pour ne jamais repartir de zéro (EF-10, EF-20) |
| 4 | Éditeur WYSIWYG complet, pas un formulaire de réglages (EF-09) |
| 5 | Duplication partout : sorties, scènes, événements, chants |
| 6 | Historique d'annulation profond (EF-09.47) |

---

### PE-3 — Le pasteur / intervenant

| Attribut | Détail |
|---|---|
| Qui | Prédicateur, chanteur, intervenant de conférence |
| Matériel | Un écran de retour face à lui, parfois une tablette |
| Ce qu'il veut | Lire sans effort, savoir ce qui vient, voir le temps qui reste |
| Ce qu'il ne veut pas | Toucher à la régie, être distrait par une interface |
| **Son critère de succès** | « Je n'ai jamais eu à demander où on en était » |

**Conséquences de conception**

| # | Conséquence |
|---|---|
| 1 | Texte **très grand**, fond noir, aucun élément d'interface (`15-scene-et-telecommande.md`) |
| 2 | Texte courant **et** suivant affichés |
| 3 | Minuteur visible avec alerte progressive (vert → orange → rouge) |
| 4 | Messages de la régie avec niveau d'urgence, ajustement automatique de la taille (repris de V1) |
| 5 | Horloge locale |
| 6 | Zéro interaction requise ; les boutons sont optionnels |

---

### PE-4 — Le responsable de profil

| Attribut | Détail |
|---|---|
| Qui | Configure une fois pour toute l'équipe |
| Fréquence | Rare — quelques fois par an |
| Ce qu'il veut | Un gabarit fiable que les bénévoles appliquent sans réfléchir |
| **Son critère de succès** | « Les bénévoles n'ont plus rien à configurer » |

**Conséquences** : profils complets et éditables (EF-20), gabarits de plan (EF-20.10),
export d'un profil avec ses médias pour le partager (EF-20.7).

---

### PE-5 — Le responsable stream

| Attribut | Détail |
|---|---|
| Qui | Gère OBS ou vMix, compose ses scènes |
| Ce qu'il veut | Des liens stables, un overlay qui ne prend **que** ce qu'il faut, de la transparence |
| Ce qu'il déteste | Coller 12 URL à la main, voir un média plein écran partir sur le stream |
| **Son critère de succès** | « Mes scènes OBS sont prêtes en 2 minutes et ne bougent plus » |

**Conséquences** : matrice de liens (EF-08), `id` stables au renommage (EF-07.6),
transparence native (EF-07), assistant OBS 1 clic (EF-08.16), bloc « Tout copier »
(EF-08.14).

---

### PE-6 — Le site sans Internet

| Attribut | Détail |
|---|---|
| Qui | Salle sans connexion, ou connexion coupée en plein évènement |
| **Son critère de succès** | « Personne ne s'est rendu compte qu'il n'y avait pas de réseau » |

**Conséquences** : P1 absolu, ENF-01 → ENF-04, test A-01, catalogue désactivé par défaut
(EF-27.1).

---

## 1.4 Anti-personas (ce que le logiciel ne cherche pas à servir)

| Profil | Pourquoi il est hors cible |
|---|---|
| L'utilisateur qui veut monter une vidéo | Ce n'est pas un outil de montage (§ 13 du CDC) |
| L'équipe qui veut des comptes et des permissions | Hors périmètre : pas d'authentification multi-utilisateurs |
| Celui qui veut diffuser en RTMP depuis le logiciel | OBS et vMix le font déjà, mieux |
| Celui qui veut une app mobile native | La PWA couvre le besoin, sans store |
| Celui qui veut un hébergement cloud de sa bibliothèque | Contredit P9 |

---

## 1.5 Les trois parcours qui valident la conception

### Parcours A — « Premier contact » (PE-1)

```
Double-clic  →  console  →  navigateur  →  accueil
                                            │
                                            ├─ profil déjà choisi
                                            ├─ événement du jour affiché
                                            └─ [OUVRIR LE STUDIO]
```

**Critère de réussite** : moins de **60 secondes** entre le double-clic et la première
projection, sans lire la documentation.

### Parcours B — « Préparation » (PE-2)

```
Studio → créer l'événement → appliquer le profil
       → importer les chants → choisir les passages
       → créer/choisir le look → construire le plan
       → vérifier les deux sorties dans l'aperçu → fermer
```

**Critère de réussite** : un culte complet préparé en **moins de 30 minutes**,
et retrouvé intact le lendemain.

### Parcours C — « Direct » (PE-1 + PE-3 + PE-5)

```
Accueil → [OUVRIR LE STUDIO] → le plan est chargé
        → Espace, Espace, Espace…
        → la scène affiche le texte suivant
        → le stream affiche le bandeau
        → Échap pour tout couper
```

**Critère de réussite** : **une seule touche** pour avancer, aucune erreur visible du
public, et le stream ne reçoit jamais ce qu'il ne doit pas recevoir.

---

## 1.6 Les cinq règles d'or de l'interface

| # | Règle | Application concrète |
|---|---|---|
| 1 | **Un seul geste pour l'essentiel** | `Espace` avance, `Échap` coupe, `Entrée` diffuse |
| 2 | **Jamais de question technique** | Pas de « port », « WebSocket » ou « index » dans les dialogues utilisateur ; ces mots restent dans le journal |
| 3 | **Toujours dire quoi faire** | Chaque erreur = cause + action proposée |
| 4 | **Ne jamais perdre le travail** | Écriture immédiate, sauvegarde auto, annulation profonde |
| 5 | **Le rendu est sacré** | Ce que l'éditeur montre est ce que la sortie affiche, au pixel près (ENF-42) |
