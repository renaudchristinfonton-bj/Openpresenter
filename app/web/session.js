// Session LAN — un seul endroit qui connaît le code d'accès du réseau.
//
// Le serveur protège les écritures (et les WebSockets) par un jeton à 4
// caractères dès qu'on n'est pas sur la machine elle-même. Sans ce module,
// chaque page devrait répéter la même logique — et l'oublier quelque part,
// ce qui donnait une régie muette depuis un second poste.
//
// Il n'ouvre rien : il ne fait que **transporter** le jeton déjà présent dans
// l'URL (`?t=XXXX`), puis le conserver pour la navigation interne.

const hasWindow = typeof window !== 'undefined';
const search = hasWindow ? location.search : '';

/** Jeton de l'URL, ou celui gardé en mémoire de session pour la navigation. */
export const TOKEN = (() => {
  const fromUrl = new URLSearchParams(search).get('t') || '';
  if (fromUrl || !hasWindow) return fromUrl;
  try { return sessionStorage.getItem('op.token') || ''; } catch { return ''; }
})();

/**
 * Ajoute le jeton à une URL interne, sans jamais doubler un `t=` existant.
 * Les URL externes (`https://…`, `//cdn…`, `data:`) ne sont pas touchées.
 */
export function withToken(url, token = TOKEN) {
  if (!token || typeof url !== 'string') return url;
  if (!url.startsWith('/')) return url;
  if (/[?&]t=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;
}

/** Vrai pour les appels d'API et le relais temps réel (les seuls protégés). */
export function needsToken(value) {
  if (typeof value !== 'string') return false;
  return value.startsWith('/api/') || value.startsWith('/ws') ||
    /^[a-z]+:\/\/[^/]+\/api\//i.test(value) || /^[a-z]+:\/\/[^/]+\/ws\b/i.test(value);
}

function patchFetch() {
  const original = window.fetch;
  if (!original || original.__opPatched) return;
  const patched = (input, init) => {
    try {
      if (typeof input === 'string' && input.startsWith('/')) {
        return original(withToken(input), init);
      }
      if (input instanceof Request && needsToken(input.url)) {
        const next = new Request(withToken(input.url.replace(location.origin, '')), input);
        return original(next, init);
      }
    } catch { /* on retombe sur l'appel d'origine */ }
    return original(input, init);
  };
  patched.__opPatched = true;
  window.fetch = patched;
}

function patchWebSocket() {
  const Native = window.WebSocket;
  if (!Native || Native.__opPatched) return;
  const Patched = function (url, protocols) {
    try {
      const parsed = new URL(String(url), location.href);
      if (parsed.pathname === '/ws' && !parsed.searchParams.has('t')) {
        parsed.searchParams.set('t', TOKEN);
        return protocols === undefined ? new Native(parsed.toString()) : new Native(parsed.toString(), protocols);
      }
    } catch { /* URL inhabituelle : on la passe telle quelle */ }
    return protocols === undefined ? new Native(url) : new Native(url, protocols);
  };
  Patched.prototype = Native.prototype;
  Patched.CONNECTING = Native.CONNECTING;
  Patched.OPEN = Native.OPEN;
  Patched.CLOSING = Native.CLOSING;
  Patched.CLOSED = Native.CLOSED;
  Patched.__opPatched = true;
  window.WebSocket = Patched;
}

/** Les liens internes gardent le code : changer d'écran ne déconnecte pas. */
function decorateLinks(root = document) {
  if (!TOKEN) return;
  for (const link of root.querySelectorAll('a[href^="/"]')) {
    const href = link.getAttribute('href');
    if (href) link.setAttribute('href', withToken(href));
  }
}

if (hasWindow && TOKEN) {
  try { sessionStorage.setItem('op.token', TOKEN); } catch { /* stockage refusé */ }
  patchFetch();
  patchWebSocket();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => decorateLinks(), { once: true });
  } else {
    decorateLinks();
  }
}
