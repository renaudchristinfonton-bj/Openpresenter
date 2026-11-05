# Audit comparatif — OpenPresenter face aux meilleurs logiciels de streaming & de régie

**Date :** 2026-08-14
**Objet :** mesurer OpenPresenter (régie de projection + sortie OBS) face aux références du marché — OBS Studio, vMix, Wirecast, ProPresenter, EasyWorship, Resolume, CasparCG — et dégager un plan pour viser le niveau "pro".

---

## 1. Le positionnement

OpenPresenter n'est **pas** un encodeur de streaming (il ne fait pas le rendu RTMP) : c'est une **régie de contenu** (Bible, paroles, médias, titres) qui s'appuie sur **OBS Studio** pour l'encodage et la diffusion. Cette architecture est un atout : on ne refait pas OBS. Mais elle oblige à **comparer sur deux plans** :

- **Régie / projection** (le "cœur" d'OpenPresenter) → comparer à ProPresenter, EasyWorship, Resolume, CasparCG.
- **Intégration diffusion** (comment le contenu sort vers OBS/stream) → comparer à OBS, vMix, Wirecast.

---

## 2. Comparatif par capacité

Légende : 🟢 natif/solide · 🟡 partiel/possible · 🔴 absent/limite

### 2.1 Régie de contenu

| Capacité | OpenPresenter | ProPresenter | EasyWorship | Resolume | CasparCG |
|----------|:---:|:---:|:---:|:---:|:---:|
| Paroles plein écran | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| Bible multi-traductions | 🟢 (import XML) | 🟢 (125) | 🟢 | 🔴 | 🟡 |
| Médias (img/vidéo/PDF/PPTX) | 🟢 | 🟢 | 🟢 | 🟢 | 🟡 |
| Lower thirds animés | 🟢 | 🟢 | 🟡 | 🟢 | 🟡 |
| Anti-débordement texte auto | 🟢 | 🟢 | 🟡 | 🟡 | 🔴 |
| Arrangement chant réordonnable en direct | 🟡 (sections) | 🟢 | 🟢 | 🔴 | 🔴 |
| Stage display (écran scène : paroles suivantes + chrono) | 🔴 | 🟢 | 🟢 | 🟡 | 🔴 |
| "Looks" / habillage global par clic | 🟡 (par outil) | 🟢 | 🟡 | 🟢 | 🟡 |
| Macros / séquences d'actions | 🔴 | 🟢 | 🟡 | 🟢 | 🟢 |
| File de déroulement (ordre de service) | 🟢 (cue list) | 🟢 | 🟢 | 🟡 | 🟢 |

### 2.2 Sorties & diffusion

| Capacité | OpenPresenter (+OBS) | OBS | vMix | Wirecast | ProPresenter |
|----------|:---:|:---:|:---:|:---:|:---:|
| Sorties multiples (public/scène/stream) | 🟡 (modes OBS) | 🟢 | 🟢 | 🟢 | 🟢 |
| Sortie alpha (transparence réelle, keying) | 🟢 (Source Navigateur transparente) | 🟡 (chroma) | 🟢 | 🟢 | 🟢 |
| Encodage & streaming RTMP | 🟢 (via OBS) | 🟢 | 🟢 | 🟢 | 🟡 |
| Sources caméras / capture | 🟢 (via OBS) | 🟢 | 🟢 | 🟢 | 🟡 |
| NDI (sortie réseau pro) | 🔴 | 🟡 (plugin) | 🟢 | 🟢 | 🟢 |
| Multi-caméra avec cut/transition | 🟢 (via OBS) | 🟢 | 🟢 | 🟢 | 🟡 |
| Contrôle à distance (mobile/tablette) | 🟢 | 🟡 (docks) | 🟢 | 🟡 | 🟢 |

### 2.3 Expérience & configuration

| Capacité | OpenPresenter | ProPresenter | EasyWorship | OBS | vMix |
|----------|:---:|:---:|:---:|:---:|:---:|
| Installation sans compétence technique | 🟡 (exige Node.js) | 🔴 (payant) | 🟢 | 🟢 | 🟡 |
| Fonctionne hors-ligne (aucun CDN) | 🟡 (UI dépend du CDN) | 🟢 | 🟢 | 🟢 | 🟢 |
| Assistant de configuration | 🟢 (nouveau) | 🟡 | 🟢 | 🟡 | 🟢 |
| Modèles / contenus de démo | 🟡 | 🟢 | 🟢 | 🟢 | 🟢 |
| Documentation débutant | 🟡 | 🟢 | 🟢 | 🟢 | 🟢 |
| Coût | 🟢 (gratuit) | 🔴 (payant) | 🟡 | 🟢 | 🟡 |

---

## 3. Les 5 axes où OpenPresenter peut gagner le plus

Classés par **impact "pro"** et **faisabilité sans tout casser** :

### A. Stage display (écran scène) — 🔴 → 🟢
Le plus gros manque. ProPresenter et EasyWorship le citent comme **l'élément qui change tout** : un écran face à la scène montre les **paroles actuelles + les prochaines** + un **chrono**, pour que les musiciens ne perdent jamais le fil.
**Faisabilité :** modérée. Réutilise le canal de diffusion existant. C'est une **page additionnelle** (non cassant).

### B. Hors-ligne total (retirer les CDN) — 🟡 → 🟢
L'interface contrôleur charge encore **Tailwind + polices Google** depuis le CDN. En salle sans internet, ça casse. OBS, vMix, etc. fonctionnent 100% hors-ligne.
**Faisabilité :** technique mais isolée (embarquer CSS/polices). Ne change aucune logique.

### C. "Looks" & Macros (habillage global + séquences) — 🟡 → 🟢
Un bouton "Look : Culte / Annonces / Sermon" qui applique un habillage global à tous les outils, et des macros ("début de culte", "annonces").
**Faisabilité :** moyenne. Règle de presets globaux + application par outil.

### D. Sortie alpha (transparence réelle) — déjà 🟢, à documenter & amplifier
**Correction :** OpenPresenter a **déjà** la sortie alpha. En mode OBS, `body.mode-obs { background: transparent !important; }` rend la Source Navigateur transparente : posée au-dessus de la caméra dans OBS, elle superpose paroles/versets/titres en transparence — exactement le "alpha-channel keying" de ProPresenter, **sans fond vert**. (Le fond vert est une technique ancienne, inutile ici.)
**Action :** documenter ce flux (Source Navigateur au-dessus des caméras), et éventuellement ajouter un "mode stream" prédéfini qui suggère ce montage. Aucun développement de rendu nécessaire.

### E. Emballage sans Node.js manuel — 🟡 → 🟢
Un **binaire autonome** (Windows/Mac) qui embarque Node, se lance au double-clic et ouvre le navigateur. Supprime le principal obstacle novice.
**Faisabilité :** technique, mais le serveur est zéro-dépendance → très réalisable (`pkg`/`nexe`).

---

## 4. Points où OpenPresenter est déjà au niveau pro

Il faut le reconnaître pour ne pas tout réécrire :
- **Rendu du texte** : l'anti-débordement automatique (aucun débordement, jamais) est supérieur à beaucoup d'outils.
- **File de déroulement** et **pilotage mobile** : déjà en place et fluide.
- **Lower thirds** : animation, logo, presets — très proche de ProPresenter.
- **Sauvegardes globales** et **données centralisées** : au-dessus de la moyenne.
- **Coût & simplicité de licence** : gratuit, open-source, 100% local — un vrai avantage.

---

## 5. Recommandation priorisée (phase réaliste, sans casser)

| Priorité | Action | Impact | Effort | Risque |
|----------|--------|--------|--------|--------|
| 1 | **A. Stage display** (écran scène paroles suivantes + chrono) | Très haut | Moyen | Faible |
| 2 | **B. Hors-ligne total** (retirer CDN) | Haut | Moyen | Faible |
| 3 | **E. Binaire autonome** (install sans Node) | Très haut | Moyen-élevé | Moyen |
| 4 | **C. Looks & Macros** | Moyen | Moyen | Moyen |

> La **sortie alpha (transparence)** est **déjà fonctionnelle** (mode OBS transparent) — voir section D. Aucune priorité de développement, seulement de la documentation.

---

## 6. Conclusion

OpenPresenter n'a **pas besoin de réinventer un encodeur** : OBS couvre déjà le streaming, et la **sortie alpha** (superposition transparente au-dessus des caméras) est **déjà en place** — un vrai avantage broadcast. Pour se mesurer aux meilleurs, il reste 3 trous qui définissent la "régie pro" : le **stage display**, l'**hors-ligne total**, et l'**installation sans compétence**. Ce sont les 3 actions du haut du tableau — chacune réalisable **sans casser l'existant** (pages et options ajoutées, pas supprimées).
