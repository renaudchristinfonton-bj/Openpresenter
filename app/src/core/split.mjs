// Découpage lisible (EF-13, ch. 09 § 9.5) — algorithme **normatif et déterministe**.
//
// Règles non négociables :
//   - jamais de coupure dans un mot ; les guillemets restent collés au contenu,
//     les nombres restent collés à leur unité, les espaces insécables sont respectées ;
//   - coupe prioritaire sur `;` `:` `,` `—` `–` puis sur un espace, dans la fenêtre
//     45 % → 100 % de la limite ;
//   - aucune partie de moins de `minWordsPerPart` mots si elle peut être fusionnée ;
//   - même texte + mêmes réglages ⇒ même résultat (A-07j).

export const DEFAULT_SETTINGS = {
  splitMode: 'auto',        // none | auto
  splitBy: 'words',         // words | chars | lines
  maxWordsPerScreen: 25,
  maxCharsPerScreen: 165,
  maxLinesPerScreen: 3,
  minWordsPerPart: 3,
  balanceParts: true
};

const NO_BREAK_BEFORE = /^[,;:!?»)\]]/;
const NO_BREAK_AFTER = /^[«(\[]/;
const NUMBER_UNIT = /^\d+$/;

/** Dépassement toléré de la limite pour éviter une partie orpheline (15 %). */
const OVERSHOOT = 1.15;

/**
 * Tokenise un texte en unités insécables.
 * Un jeton = un mot avec la ponctuation qui lui appartient.
 * @returns {{text: string, start: number, end: number, breaksAfter: boolean}[]}
 */
export function tokenize(text) {
  const tokens = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    tokens.push({ text: raw, start: m.index, end: m.index + raw.length });
  }

  // Fusion des jetons qui ne doivent jamais être séparés.
  const merged = [];
  for (const token of tokens) {
    const prev = merged[merged.length - 1];
    const shouldMerge = prev && (
      NO_BREAK_BEFORE.test(token.text) ||                       // « mot , » → « mot, »
      NO_BREAK_AFTER.test(prev.text) ||                          // « « mot » → « « mot »
      /[\u00a0\u202f]$/.test(prev.text) ||                       // espace insécable finale
      (NUMBER_UNIT.test(prev.text) && /^(\d|[a-zà-ÿ]{1,2}$)/i.test(token.text)) || // 1 000, 3 h
      (NUMBER_UNIT.test(prev.text) && /^\d{3}$/.test(token.text))
    );
    if (shouldMerge) {
      prev.text = `${prev.text} ${token.text}`;
      prev.end = token.end;
    } else {
      merged.push({ ...token });
    }
  }

  // Un saut de ligne d'origine après un jeton est un point de coupe prioritaire.
  for (const token of merged) {
    token.breaksAfter = /[;:,—–]$/.test(token.text) ? 'punctuation' : /[\n\r]/.test(text.slice(token.end)) ? 'newline' : 'space';
  }
  for (const token of merged) {
    token.lastChar = token.text.slice(-1);
    token.endsWithBreak = /[;:,—–]/.test(token.lastChar);
  }
  return merged;
}

/** Nombre de caractères « mots » d'un texte, sans accents parasites. */
export function countWords(text) {
  return tokenize(text).length;
}

/**
 * Découpe un texte en parties affichables.
 * @param {string} text
 * @param {object} options voir DEFAULT_SETTINGS
 * @returns {{parts: string[], meta: object}}
 */
export function splitText(text, options = {}) {
  const opts = { ...DEFAULT_SETTINGS, ...options };
  const clean = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return { parts: [], meta: { reason: 'empty', count: 0 } };
  if (opts.splitMode === 'none') {
    return { parts: [clean], meta: { reason: 'mode-none', count: 1 } };
  }

  if (opts.splitBy === 'lines') {
    const groups = groupLines(clean.split('\n'), opts.maxLinesPerScreen);
    return finish(groups.map((g) => g.join('\n')), opts, 'lines');
  }

  const tokens = tokenize(clean);
  if (!tokens.length) return { parts: [], meta: { reason: 'empty', count: 0 } };

  const limit = opts.splitBy === 'chars'
    ? charsToWordLimit(tokens, opts.maxCharsPerScreen)
    : Math.max(1, Math.trunc(opts.maxWordsPerScreen) || 25);

  if (tokens.length <= limit) {
    return { parts: [joinTokens(tokens, 0, tokens.length)], meta: { reason: 'fits', count: 1 } };
  }

  const parts = [];
  let index = 0;
  while (index < tokens.length) {
    const remaining = tokens.length - index;
    if (remaining <= limit) {
      parts.push(joinTokens(tokens, index, tokens.length));
      break;
    }

    let cut = findCut(tokens, index, Math.min(index + limit, tokens.length));
    cut = enforceMinimum(tokens, index, cut, opts.minWordsPerPart);

    if (opts.balanceParts) {
      cut = balance(tokens, index, cut, limit, opts.minWordsPerPart);
    }

    // Jamais de partie vide ; si la coupe est absurde, on avance d'un mot.
    if (cut <= index) cut = index + 1;

    // Dernier garde-fou : si le reste est trop court pour être une partie, on le
    // rattache — mais jamais au prix d'un dépassement franc de la limite (A-07c
    // exige la fusion à 27 mots pour 25 ; une partie de 2 mots est préférable à
    // une partie de 27 mots quand l'écart devient visible).
    const tail = tokens.length - cut;
    if (tail > 0 && tail < opts.minWordsPerPart) {
      const merged = cut - index + tail;
      if (merged <= Math.ceil(limit * OVERSHOOT)) {
        parts.push(joinTokens(tokens, index, tokens.length));
        break;
      }
    }

    parts.push(joinTokens(tokens, index, cut));
    index = cut;
  }

  const balanced = balanceLastTwo(parts, opts);
  return finish(balanced, opts, opts.splitBy);
}

function charsToWordLimit(tokens, maxChars) {
  let chars = 0;
  let count = 0;
  for (const token of tokens) {
    const next = chars + token.text.length + (count ? 1 : 0);
    if (next > maxChars) break;
    chars = next;
    count++;
  }
  return Math.max(1, count);
}

function groupLines(lines, maxLines) {
  const limit = Math.max(1, maxLines || 3);
  const groups = [];
  for (let i = 0; i < lines.length; i += limit) groups.push(lines.slice(i, i + limit));
  return groups;
}

/**
 * Cherche la meilleure coupe dans [from, to).
 * Retourne l'index du **premier jeton de la partie suivante**.
 */
export function findCut(tokens, from, to) {
  const span = to - from;
  const minIndex = from + Math.max(1, Math.ceil(span * 0.45));

  // P1 → P4 : ponctuation forte, de la fin vers le début de la fenêtre.
  for (const test of [
    (t) => t.lastChar === ';' || t.lastChar === ':',
    (t) => t.lastChar === ',',
    (t) => t.lastChar === '—' || t.lastChar === '–'
  ]) {
    for (let i = to - 1; i >= minIndex; i--) {
      if (test(tokens[i]) && i + 1 > from) return i + 1;
    }
  }

  // Un saut de ligne d'origine est prioritaire sur un simple espace (EF-13.11).
  for (let i = to - 1; i >= minIndex; i--) {
    if (tokens[i].breaksAfter === 'newline' && i + 1 > from) return i + 1;
  }

  // P5 : dernier espace de la fenêtre.
  for (let i = to - 1; i >= minIndex; i--) {
    if (i + 1 > from) return i + 1;
  }
  return to;
}

function enforceMinimum(tokens, from, cut, minWords) {
  const minimum = Math.max(1, minWords || 1);
  if (cut - from >= minimum) return cut;
  const adjusted = from + minimum;
  return Math.min(adjusted, tokens.length);
}

/**
 * Répartition équilibrée (EF-13 « balanceParts ») : si les mots restants tiennent
 * en deux parties, on déplace la coupe vers le milieu le plus proche **sans
 * casser une contrainte de ponctuation plus forte**.
 */
function balance(tokens, from, cut, limit, minWords) {
  const remaining = tokens.length - from;
  if (remaining > limit * 2) return cut;
  const ideal = from + Math.round(remaining / 2);
  if (ideal - from < minWords || tokens.length - ideal < minWords) return cut;

  // On accepte la coupe idéale seulement si elle ne tombe pas juste après une
  // ponctuation faible isolée : priorité à la coupe naturelle si elle est proche.
  const distance = Math.abs(ideal - cut);
  const tolerance = Math.max(1, Math.floor(limit * 0.15));
  if (distance <= tolerance) return ideal;

  // Sinon on cherche la ponctuation la plus proche du milieu.
  for (let delta = 1; delta <= tolerance; delta++) {
    for (const candidate of [ideal + delta, ideal - delta]) {
      if (candidate - from < minWords || tokens.length - candidate < minWords) continue;
      if (tokens[candidate - 1]?.endsWithBreak) return candidate;
    }
  }
  return cut;
}

/** EF-13.6 : jamais une dernière partie d'un seul mot si l'avant-dernière peut l'absorber. */
function balanceLastTwo(parts, opts) {
  if (!parts.length) return parts;
  const out = parts.slice();
  const last = out[out.length - 1];
  const prev = out[out.length - 2];
  if (prev === undefined) return out;
  const wordsLast = countWords(last);
  const wordsPrev = countWords(prev);
  const limit = Math.ceil((opts.maxWordsPerScreen || 25) * OVERSHOOT);
  const tooShort = wordsLast < Math.max(2, opts.minWordsPerPart);
  if (wordsLast > 0 && tooShort && wordsPrev + wordsLast <= limit) {
    out.splice(out.length - 2, 2, `${prev} ${last}`);
  }
  return out;
}

function joinTokens(tokens, from, to) {
  return tokens.slice(from, to).map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim();
}

function finish(parts, opts, unit) {
  const cleaned = parts
    .map((p) => p.replace(/[ \t]+$/gm, '').trim())
    .filter((p) => p.length > 0)
    .map((p) => (parts.expected ? p : p));
  return {
    parts: cleaned,
    meta: {
      reason: 'split',
      count: cleaned.length,
      unit,
      limit: unit === 'words' ? opts.maxWordsPerScreen
        : unit === 'chars' ? opts.maxCharsPerScreen
          : opts.maxLinesPerScreen,
      minWordsPerPart: opts.minWordsPerPart,
      balanceParts: opts.balanceParts,
      wordCounts: cleaned.map(countWords)
    }
  };
}

// ---------------------------------------------------------------------------
// Report des annotations (EF-13.13)
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'mark', 'span', 'br']);

/** Assainit un balisage d'annotation : seules les balises de mise en forme passent. */
export function sanitizeAnnotationHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*([a-z][a-z0-9]*)[^>]*>/gi, (match, tag) => {
      const name = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return '';
      if (name === 'br') return '<br>';
      const closing = /^<\s*\//.test(match);
      return closing ? `</${name}>` : `<${name}>`;
    })
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/** Convertit un balisage simple en marqueurs de plage sur le texte brut. */
function collectMarks(html) {
  const marks = [];
  const stack = [];
  const re = /<\s*(\/?)\s*(b|strong|i|em|u|mark|span)\s*>|<\s*br\s*\/?>/gi;
  let plain = '';
  let lastIndex = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    plain += html.slice(lastIndex, m.index);
    lastIndex = re.lastIndex;
    if (m[0].toLowerCase().startsWith('<br')) { plain += '\n'; continue; }
    const closing = Boolean(m[1]);
    const tag = m[2].toLowerCase();
    if (!closing) {
      stack.push({ tag, start: plain.length });
    } else {
      const open = [...stack].reverse().find((s) => s.tag === tag);
      if (open) {
        marks.push({ tag, start: open.start, end: plain.length });
        stack.splice(stack.indexOf(open), 1);
      }
    }
  }
  plain += html.slice(lastIndex);
  for (const open of stack) marks.push({ tag: open.tag, start: open.start, end: plain.length });
  return { plain, marks };
}

/**
 * Découpe du texte annoté : on découpe le **texte brut**, puis chaque partie est
 * reconstituée avec le balisage qui lui revient (EF-13.13, A-07i).
 */
export function splitAnnotationHtml(html, options = {}) {
  const safe = sanitizeAnnotationHtml(html);
  if (!safe) return { parts: [], meta: { reason: 'empty', count: 0 } };
  const { plain, marks } = collectMarks(safe);
  const result = splitText(plain, options);
  if (!result.parts.length) return result;

  let cursor = 0;
  const annotated = result.parts.map((part) => {
    const start = plain.indexOf(part, cursor);
    const from = start < 0 ? cursor : start;
    const to = from + part.length;
    cursor = to;

    const cuts = marks
      .filter((mk) => mk.start < to && mk.end > from)
      .sort((a, b) => a.start - b.start || a.end - b.end);

    if (!cuts.length) return part;

    let out = '';
    let pos = from;
    for (const mk of cuts) {
      const openAt = Math.max(from, mk.start);
      const closeAt = Math.min(to, mk.end);
      if (openAt > pos) out += escapeHtml(plain.slice(pos, openAt));
      out += `<${mk.tag}>${escapeHtml(plain.slice(openAt, closeAt))}</${mk.tag}>`;
      pos = closeAt;
    }
    if (pos < to) out += escapeHtml(plain.slice(pos, to));
    return out;
  });

  return { ...result, parts: annotated, meta: { ...result.meta, annotated: true } };
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
