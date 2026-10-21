// Résolution des liaisons d'une scène (ch. 08 § 8.4.4).
// Une liaison sans contenu disponible n'affiche **rien** (EF-09.16) : jamais
// « undefined », jamais un texte d'exemple à l'antenne.

export const BINDS = [
  'custom', 'ref', 'badge', 'verse', 'title', 'section', 'lyrics',
  'announcement', 'timer', 'image', 'media', 'clock', 'planLabel'
];

/** Contenu d'exemple réaliste par type (EF-09.51) : jamais du faux-texte. */
export const SAMPLE_CONTENT = {
  bible: {
    verse: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu'il ait la vie éternelle.",
    reference: 'Jean 3:16',
    badge: 'LSG',
    partIndex: 0,
    partCount: 2,
    short: { verse: 'Jésus pleura.', reference: 'Jean 11:35', badge: 'LSG', partIndex: 0, partCount: 1 },
    long: {
      verse: "L'Éternel est mon berger : je ne manquerai de rien. Il me fait reposer dans de verts pâturages, il me dirige près des eaux paisibles. Il restaure mon âme, il me conduit dans les sentiers de la justice, à cause de son nom. Quand je marche dans la vallée de l'ombre de la mort, je ne crains aucun mal, car tu es avec moi : ta houlette et ton bâton me rassurent.",
      reference: 'Psaumes 23:1-4',
      badge: 'LSG',
      partIndex: 0,
      partCount: 3
    }
  },
  songs: {
    title: 'Que ma bouche chante ta louange',
    section: 'Refrain',
    lyrics: 'Que ma bouche chante ta louange, que mon cœur te dise merci ; pour toujours je veux te louer, mon Sauveur et mon Roi.',
    partIndex: 0,
    partCount: 2,
    badge: 'Chants'
  },
  announcements: {
    title: 'Annonces du dimanche',
    announcement: 'Réunion de prière mercredi à 18 h 30. La chorale répète samedi à 16 h. Inscriptions pour le camp ouvertes jusqu’au 15 novembre.',
    badge: 'Annonces'
  },
  media: { media: '', badge: 'Média' },
  lowerthird: { announcement: 'Pasteur Jean Koffi — Prédicateur', title: 'Jean Koffi', badge: '' },
  timer: { timer: '09:42', badge: 'Minuteur' },
  plan: { planLabel: 'Culte du dimanche', badge: 'Plan' }
};

/** Horloge locale, au format `HH:MM`. */
export function clockText(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(date.getHours())}:${p(date.getMinutes())}`;
}

function clean(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return text === 'undefined' || text === 'null' ? '' : text;
}

/**
 * Valeur textuelle d'une liaison.
 * @param {string} bind
 * @param {object} layer
 * @param {object} content contexte de diffusion
 */
export function resolveBind(bind, layer = {}, content = {}) {
  switch (bind) {
    case 'custom':
      return clean(layer.customText);
    case 'ref':
      return clean(content.reference ?? content.ref);
    case 'badge':
      return clean(content.badge ?? content.versionName ?? content.bibleName);
    case 'verse':
      return clean(content.verse ?? content.text);
    case 'title':
      return clean(content.title);
    case 'section':
      return clean(content.section);
    case 'lyrics':
      return clean(content.lyrics ?? content.text);
    case 'announcement':
      return clean(content.announcement ?? content.body ?? content.text);
    case 'timer':
      return clean(content.timer ?? formatDuration(content.remainingMs));
    case 'clock':
      return clockText(content.now instanceof Date ? content.now : new Date());
    case 'planLabel':
      return clean(content.planLabel ?? content.cue ?? content.title);
    case 'image':
    case 'media':
      return clean(content.mediaName ?? content.title);
    default:
      return '';
  }
}

/** `3 720 000` ms → `01:02:00`, `42 000` → `00:42`. */
export function formatDuration(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '';
  const total = Math.max(0, Math.round(Number(ms) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** Contexte d'aperçu pour l'éditeur : exemple réaliste selon le type de scène. */
export function sampleFor(kind, variant = 'normal') {
  const base = SAMPLE_CONTENT[kind] || SAMPLE_CONTENT.bible;
  if (variant !== 'normal' && base[variant]) return { ...base, ...base[variant] };
  return { ...base };
}

/**
 * Convertit un message de diffusion (`payload` du ch. 07) en contexte de scène.
 * Le studio envoie `{ text, reference, badge, partIndex, partCount }` quel que
 * soit le type ; la scène, elle, attend des clés nommées. Cette fonction est le
 * seul endroit où la traduction se fait (ENF-42).
 * @param {object} payload
 * @param {string} [kind]
 */
export function contentFromPayload(payload = {}, kind = 'bible') {
  const text = clean(payload.text ?? payload.body);
  const base = {
    ...payload,
    reference: clean(payload.reference ?? payload.ref),
    badge: clean(payload.badge ?? payload.versionName ?? payload.bibleName),
    partIndex: Number(payload.partIndex) || 0,
    partCount: Number(payload.partCount) || 0
  };
  switch (kind) {
    case 'bible': return { ...base, verse: text };
    case 'songs': return { ...base, lyrics: text };
    case 'announcements': return { ...base, announcement: text };
    case 'lowerthird': return { ...base, announcement: text, title: clean(payload.title) };
    default: return { ...base, title: clean(payload.title), mediaName: clean(payload.mediaName) };
  }
}

/** Indique si la scène contient au moins un texte réellement affichable. */
export function hasRenderableText(scene, content) {
  return (scene?.layers || []).some((layer) =>
    layer.type === 'text' && layer.visible !== false && resolveBind(layer.bind, layer, content).length > 0);
}
