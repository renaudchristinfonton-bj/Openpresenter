# 16 — Sauvegarde, export et import

> **Exigences couvertes :** EF-26, ENF-22, ENF-23, principes P2 et P4
> **Repris de :** V1 `/api/export` + `/api/import` ; V2 `src/core/backup.mjs`

---

## 16.1 Trois niveaux de protection

| Niveau | Mécanisme | Fréquence | Portée |
|---|---|---|---|
| **1 — Écriture immédiate** | chaque modification est écrite sur disque | instantané | l'objet modifié |
| **2 — Sauvegarde automatique** | archive dans `project/backups/` | au plus 1×/60 s | données sans binaires |
| **3 — Export manuel** | archive `.openpresenter.zip` | à la demande | **tout**, binaires compris |

**EF-26.0** — Le niveau 1 rend le niveau 2 presque redondant, mais le niveau 2 protège
contre une **erreur de manipulation** (suppression, écrasement), pas contre une panne.

> **Point clé de P2** : copier le dossier **suffit**. L'export n'est **pas** nécessaire
> pour transférer un projet. Il sert à archiver, partager, ou envoyer par messagerie.

---

## 16.2 Écriture immédiate

| ID | Règle |
|---|---|
| EF-26.1 | Toute modification passe par l'API et est écrite en moins de 500 ms |
| EF-26.2 | Une modification de scène pendant un drag n'écrit **qu'à la fin du geste** |
| EF-26.3 | Un champ de texte est écrit au `blur` ou après 800 ms d'inactivité |
| EF-26.4 | L'écriture est atomique (ENF-22) |
| EF-26.5 | Un indicateur discret en bas du Studio montre l'état : `✓ Enregistré · 18:04:12` / `… Enregistrement` / `⚠ Échec — [Réessayer]` |

---

## 16.3 Sauvegarde automatique

| Paramètre | Valeur par défaut |
|---|---|
| `autoBackup` | `true` |
| `autoBackupKeep` | `10` |
| `autoBackupIncludeMedia` | `false` |
| Fréquence minimale | 60 s entre deux sauvegardes |
| Déclencheur | après une écriture significative (création, suppression, édition de scène) |

**EF-26.6** — Une sauvegarde qui échoue produit un avertissement **non bloquant** et une
entrée dans le journal.
**EF-26.7** — Les archives sont nommées `auto-<AAAA-MM-JJ-HHmm>.zip` ; au-delà de
`autoBackupKeep`, la plus ancienne est supprimée.
**EF-26.8** — L'écran « Projet » liste les sauvegardes avec date, taille et contenu, et
permet **restaurer** ou **supprimer**.

---

## 16.4 Export complet

### 16.4.1 Contenu de l'archive

```
OpenPresenter-ICC-Pahou-2026-10-21.zip
├── manifest.json          { format, version, createdAt, appVersion, projectId, counts }
├── project.json
├── library/
├── assets/                (optionnel — inclus par défaut dans l'export manuel)
├── outputs/
├── scenes/
├── profiles/
├── orgs/
└── events/
```

**EF-26.9** — L'export manuel inclut **les binaires par défaut** (c'est son intérêt).
**EF-26.10** — Une option « sans les médias » produit une archive légère pour partager
uniquement la structure.
**EF-26.11** — Les assets `linked` (non copiés) sont **signalés** dans `manifest.json` :
```jsonc
"linkedMissing": [ { "originalName": "Concert.mp4", "absolutePath": "E:\\…" } ]
```

### 16.4.2 `manifest.json`

```jsonc
{
  "format": "openpresenter-project",
  "formatVersion": 3,
  "appVersion": "3.0.0",
  "createdAt": "2026-10-21T18:04:00.000Z",
  "projectId": "prj_7f3c1a9e2b4d",
  "projectName": "ICC Pahou",
  "includesMedia": true,
  "counts": { "bibles": 3, "songs": 84, "media": 213, "scenes": 22,
              "profiles": 4, "events": 31, "assets": 320 },
  "checksums": { "library/bibles/bible_lsg.json": "sha256:…" },
  "linkedMissing": []
}
```

**EF-26.12** — Le manifeste contient une empreinte par fichier JSON, vérifiée à l'import.
**EF-26.13** — Le nom de l'archive est `OpenPresenter-<nom du projet>-<date>.zip`, avec les
caractères non autorisés remplacés.

### 16.4.3 Progression

```
TXT: Export du projet

     Préparation…            ✓
     Données                 ✓   4,2 Mo
     Médias (213)            67 %  2,1 Go / 3,1 Go
     Finalisation…

     [Annuler]
```

**EF-26.14** — L'export n'interrompt **pas** la diffusion en cours.
**EF-26.15** — Un export interrompu ne laisse aucune archive partielle (écriture en `.part`).

---

## 16.5 Import / restauration

### 16.5.1 Analyse préalable

```
TXT: Restaurer un projet

     Archive    OpenPresenter-ICC-Pahou-2026-10-21.zip
     Créée le   21/10/2026 à 18:04
     Version    format v3 (application 3.0.0)
     Taille     3,1 Go

     Contenu
       Bibles        3
       Chants       84
       Médias      213   dont 2 vidéos > 500 Mo
       Scènes       22
       Profils       4
       Événements   31

     ⚠ 1 média lié manquant : Concert.mp4

     Mode
       (•) Remplacer le projet actuel
       ( ) Fusionner avec le projet actuel
           Les éléments identiques (même id ou même empreinte)
           seront conservés, les autres ajoutés.

     [R] Restaurer      [Annuler]
```

| ID | Exigence |
|---|---|
| EF-26.16 | L'analyse est **obligatoire** avant toute restauration |
| EF-26.17 | Le contrôle d'intégrité vérifie les empreintes du manifeste |
| EF-26.18 | Une archive d'un `formatVersion` supérieur est **refusée** (même logique que § 3.5.5) |
| EF-26.19 | Le mode « Remplacer » crée d'abord une sauvegarde de sécurité de l'état actuel |
| EF-26.20 | Le mode « Fusionner » déduplique par `id` puis par empreinte pour les assets |
| EF-26.21 | Un rapport détaillé est produit à la fin |
| EF-26.22 | La restauration est **atomique** : en cas d'échec, l'état précédent est restauré |

### 16.5.2 Rapport

```
TXT: Restauration terminée

     Bibles        3 importées
     Chants       84 importés      2 doublons fusionnés
     Médias      211 importés      2 manquants
     Scènes       22 importées
     Profils       4 importés
     Événements   31 importés

     [Télécharger le rapport]     [Fermer]
```

---

## 16.6 Export d'un élément seul

| Élément | Format | Extension |
|---|---|---|
| Chant | JSON | `.opsong.json` |
| Scène | JSON | `.opscene.json` |
| Look | JSON (+ fond encodé si petit) | `.oplook.json` |
| Profil | JSON ou ZIP avec médias | `.opprofile.json` / `.opprofile.zip` |
| Bible | XML d'origine, ou JSON de l'index | `.xml` / `.opbible.json` |
| Événement | JSON avec son plan | `.opevent.json` |

**EF-26.23** — L'export d'un élément seul utilise **le même format** que dans le projet :
il est réimportable tel quel.
**EF-26.24** — Un look exporté embarque son fond jusqu'à **5 Mo** ; au-delà, le fond est
détaché et signalé.

---

## 16.7 Migration depuis V1 et V2

Voir `04-projet-et-donnees.md` § 4.11 pour la spécification complète.

| ID | Exigence |
|---|---|
| EF-26.25 | Migration depuis `.openpresenter.zip` (V2), sauvegarde JSON (V1), ou dossier `data/` (V1) |
| EF-26.26 | Analyse et rapport **avant** écriture |
| EF-26.27 | Idempotente : relancer ne crée pas de doublons |
| EF-26.28 | Journal de migration téléchargeable |
| EF-26.29 | Testée sur la sauvegarde réelle du dépôt (`openpresenter-sauvegarde-2026-08-09.json`, 2,5 Mo) |

---

## 16.8 Tests d'acceptation liés

| Test | Scénario | Critère |
|---|---|---|
| **A-13** | Exporter, décompresser sur une autre machine, ouvrir | tout fonctionne, y compris les médias |
| **A-13b** | Restaurer en mode « Fusionner » deux fois de suite | aucun doublon |
| **A-13c** | Archive avec un média manquant | signalé à l'analyse, restauration possible |
| **A-13d** | Archive d'un format plus récent | refus explicite, aucune écriture |
| **A-13e** | Coupure pendant l'export | aucune archive partielle |
| **A-03b** | Migration d'une vraie sauvegarde V1 | aucun élément perdu |
