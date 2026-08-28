# Audit OpenPresenter — état des lieux & feuille de route
**Date : 28/08/2026** · Base : dépôt `servergestionobs/` (branche `arena/01a02459-openpresenter`, PR #1)

> Question posée : *qu'améliorer pour égaler FreeShow / FreePresenter / ProPresenter
> en gardant simplicité, portabilité, offline et rapidité ?*

---

## 1. État réel du projet (chiffres mesurés)

| Indicateur | Valeur | Commentaire |
|---|---|---|
| Lignes de code | ~10 000 | 8 pages HTML + 5 modules js + serveur Node pur |
| Dépendances serveur | **0** (Node stdlib) | atout majeur : `node sync-relay-server.js` suffit |
| Dépendances CDN **au runtime** | **15 références** (Tailwind ×4, Google Fonts ×6, cdnjs ×3, Unsplash ×2) | ⚠️ **bloque l'offline** + lenteur 1ʳᵉ ouverture + vie privée |
| Pages les plus lourdes | Bible 131 Ko, Paroles 105 Ko, LT 98 Ko | HTML monolithiques (parseur PPTX inline, etc.) |
| Tests automatisés | 59 intégration + 14 unitaires + 2 gardes (syntaxe, régression) | aucun concurrent open-source de la catégorie n'a ça |
| Portabilité | tout dans `data/` (git-ignoré), export/import global | ✅ validé par les tests |
| Sorties | libres WxH ×4 outils, 4 modes d'adaptation (dont « Adapter ») | ✅ supérieur à FreeShow sur ce point précis |
| Fonctions récentes | exclusion mutuelle 3 outils, 2 versions, annotations + contraste auto, découpage versets longs | ✅ |

**Verdict : le socle est sain et testé. Les 3 vrais retards sont : dépendance Internet (CDN), absence de stage display, absence de thèmes/looks globaux.**

---

## 2. Comparaison honnête avec les concurrents

Sources : documentation FreeShow 1.3.x (open source, ChurchApps), freepresenter.com, features ProPresenter 7.

| Fonctionnalité | OpenPresenter | FreeShow | FreePresenter | ProPresenter |
|---|---|---|---|---|
| Sans installation (navigateur) | ✅ **unique** | ❌ (app 100 Mo) | ❌ (app) | ❌ |
| Zéro dépendance / dossier copiable | ✅ | ❌ | ❌ | ❌ |
| Pilotage multi-PC (relais WS) | ✅ | ✅ (stage/remote) | ❌ | ✅ (network) |
| **100 % offline aujourd'hui** | ❌ CDN | ✅ | ✅ | ✅ |
| Sorties à résolution libre + adaptation | ✅ | partiel | ✅ (layouts/outputs) | ✅ |
| **Stage display** (écran scène) | ❌ | ✅ (+ vues multiples) | ✅ | ✅ (référence) |
| Thèmes / Looks globaux 1 clic | ❌ (réglages par outil) | ✅ templates | ✅ layouts | ✅ |
| Transitions entre slides | basiques | catalogue | catalogue | catalogue |
| Chrono / compte à rebours / annonces | ❌ | ✅ | ✅ (calendar) | ✅ |
| Plan de culte / file | cue_list (basique) | ✅ schedule | ✅ planner + calendar | ✅ + Planning Center |
| Recherche instantanée tout-terrain | Bible ✅ / chants ✅ / séparés | ✅ | ✅ (cœur du produit) | ✅ |
| Médias (img/vidéo/PDF/PPTX) | ✅ (PPTX maison) | ✅ | 🚧 | ✅ |
| NDI / DeckLink / sortie matérielle | via OBS (indirect) | ✅ NDI | ✅ NDI+DeckLink | ✅ |
| Remote mobile dédiée | page responsive | ✅ app + clicker | ❌ | ✅ app payante |
| Streaming (RTMP/WebRTC) | via OBS | ✅ intégré | ❌ | ✅ |
| MIDI / StreamDeck / lumière | ❌ | ✅ MIDI | 🚧 StreamDeck | ✅ |
| Sondages / quiz / TTS | ❌ | ✅ | ❌ | ❌ |
| Tests automatisés anti-régression | ✅ **unique** | ❌ | ❌ | n/a |

**Lecture :** on ne les rattrapera pas (et on ne doit pas) en copiant NDI/RTMP/MIDI — OBS fait déjà tout ça gratuitement et notre intégration OBS est le cœur. On les rattrape en livrant **les 3 manques visibles chaque dimanche** : offline, stage display, looks — puis chrono et plan de culte.

---

## 3. Les 4 impératifs (décisions structurantes)

1. **Simplicité (novice)** → pas de build, pas de framework SPA, pas de migration. Tout ajout = un fichier de plus servi tel quel.
2. **Portabilité (dossier = la régie)** → toute donnée/pola/media passe par `data/` (OpenStore). Rien dans le cloud obligatoire.
3. **Offline total** → **tuer les 15 références CDN**. C'est le seul vrai chantier bloquant ; tout le reste est déjà local.
4. **Rapidité** → pages < 150 Ko servies **gzippées** + cache navigateur + chargement à la demande des gros modules (PPTX/PDF).

⚠️ Note : les commandes `eas-cli` (Expo/React Native) collées dans le chat **ne s'appliquent pas** — ce projet n'est pas une app React Native. La voie « mobile » ici = **PWA** (manifest + service worker) : installable sur Android/iOS depuis le navigateur, offline, zéro store, zéro réécriture.

---

## 4. Plan priorisé

### P0 — Fondations (1 à 2 semaines d'effort, impact immédiat)
| # | Chantier | Détail | Effort |
|---|---|---|---|
| P0.1 | **Offline total** | Vendoring : Tailwind → un `css/tailwind.local.css` généré une fois (ou CSS maison équivalent pour les pages), polices → `fonts/*.woff2` locales + `@font-face`, jszip/pdf.js → `js/vendor/`, remplacer les 2 images Unsplash par un fond local. Test : couper Internet → tout doit marcher. | M |
| P0.2 | **PWA installable** | `manifest.webmanifest` + service worker (cache-first sur fichiers statiques, network sur `/data` et `/ws`) + icônes. → « app » sur téléphone/tablette, remplace EAS. | S |
| P0.3 | **Vitesse de service** | gzip (zlib) sur .html/.js/.css dans `sync-relay-server.js`, en-têtes `Cache-Control`, `defer` sur les scripts lourds, charger jszip/pdf.js uniquement à l'usage. | S |
| P0.4 | **Stage display** | `stage_display.html` : paroles **actuelle + suivante** + référence + **chrono** + horloge + message, piloté par le relais (canal `obs_lyrics_channel` déjà émis). Sortie pleine page, fond noir, très gros caractères. Réutilise les liens `?res=` existants. | M |

### P1 — Niveau « église pro » (2 à 4 semaines)
| # | Chantier | Détail |
|---|---|---|
| P1.1 | **Looks / habillage global 1 clic** | un look = {couleurs, police, forme, fond} nommé, stocké `data/looks/`, appliqué en direct aux 4 outils via un canal relais `looks_channel` ; palette par défaut « sobre / festif / carême »… |
| P1.2 | **Chrono & compte à rebours + annonces** | brique « timers » (lower third plein écran + bandeau), déclenchable depuis le Command Center et la file. |
| P1.3 | **Plan de culte réel** | étendre `cue_list.html` : import CSV/JSON (dont export Planning Center), réordonnancement glisser, « go » envoie l'élément au bon outil, timers attachés. |
| P1.4 | **Recherche unifiée instantanée** | un seul champ (studio) : chants + versets + médias mélangés, entrée = affiche. C'est le cœur de FreePresenter, on l'a déjà morceau par morceau. |
| P1.5 | **Médias un par fichier + miniatures** | `data/media/item/<id>.json` (fini le `items.json` monolithique), miniatures générées, dossiers = groupes. |
| P1.6 | Allègement des pages | extraire le parseur PPTX dans `js/pptx.js` (chargé à la demande), viser < 80 Ko/page. |

### P2 — Avancé (plus tard, seulement si besoin réel)
- Accords & transposition dans les paroles (parseur chords `[Am]`, transpose ±n).
- StreamDeck/MIDI : page « mappage » qui traduit les boutels vers les canaux relais (via un petit pont local).
- Sondages/quiz simples (canal relais + page projection).
- Binaire autonome : `pkg`/Node SEA dans le repo GitHub Releases (le .bat/.command restent la voie simple).
- NDI/RTMP : **ne pas coder** — documenter le pipeline OBS (OBS fait NDI/RTMP gratuitement).

### À ne PAS faire (garde-fous)
- ❌ React/Vue/build webpack, ❌ réécriture en Electron/Tauri lourd, ❌ base de données externe, ❌ compte en ligne obligatoire, ❌ cloud par défaut, ❌ copier les 300 options de ProPresenter — chaque écran reste compréhensible par un novice en 30 s.

---

## 5. Sprint proposé (ordre exact)
1. P0.1 Offline (2 j) — *validé par : mode avion complet, tests rejoués sans stubs CDN*
2. P0.3 gzip/cache (0,5 j) — *mesuré : pages < 40 Ko transférés*
3. P0.2 PWA (1 j) — *installable, lance le studio hors ligne*
4. P0.4 Stage display (2 j) — *testé comme les autres outils (contexte séparé)*
5. P1.1 Looks (2 j) puis P1.3 Plan de culte (2 j)

**KPI de succès** : démarrage complet sans Internet < 2 s · dossier copié sur un autre PC = 100 % fonctionnel · ajout média < 1 s quelle que soit la bibliothèque · 0 régression (`npm test` à chaque étape — déjà 73 vérifications).

---

## 6. Positionnement (une phrase)
> **OpenPresenter = la régie 100 % locale, sans installation ni abonnement, pilotable depuis n'importe quel navigateur du réseau — on ne concurrence pas OBS ou FreeShow sur le matériel, on rend le dimanche plus simple.**
