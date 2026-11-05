// Accès en prévisualisation / démonstration (voir README, « Aperçu »).
//
// Sur une machine de la salle, le serveur protège les écritures par un **jeton
// réseau** (EF-04.6) : un poste du Wi-Fi doit présenter `?t=<jeton>` pour agir.
// Dans un environnement de prévisualisation, toutes les requêtes arrivent d'une
// adresse non locale (le proxy de l'hébergeur) et ne peuvent pas porter ce jeton :
// la page serait inaccessible.
//
// `OPENPRESENTER_PREVIEW=1` autorise donc **uniquement** les requêtes dont l'hôte
// (ou l'origine) est celui du proxy de prévisualisation. Le jeton reste exigé pour
// tout le reste, y compris l'adresse IP de la machine sur le réseau local.
// Ce mode n'est jamais actif par défaut.

export const PREVIEW_ENV = 'OPENPRESENTER_PREVIEW';

export function isPreviewMode(env = process.env) {
  return String(env[PREVIEW_ENV] || '') === '1';
}

/** Extrait le nom d'hôte d'une valeur `Host` ou d'une `Origin` complète. */
function hostnameOf(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`);
    return url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return '';
  }
}

/**
 * Vrai si l'hôte appartient à un proxy de prévisualisation.
 * Volontairement strict : `evil-e2b.app.attacker.tld` n'est pas accepté.
 */
export function isPreviewHost(value) {
  const host = hostnameOf(value);
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  if (host === 'e2b.app') return true;
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.e2b\.app$/.test(host);
}

/**
 * Décide si une requête peut être traitée sans jeton réseau.
 * @param {Record<string, string|string[]|undefined>} headers en-têtes HTTP
 * @param {{mode?: boolean}} [options]
 */
export function previewRequestAllowed(headers = {}, { mode = isPreviewMode() } = {}) {
  if (!mode) return false;
  const candidates = [
    headers['x-forwarded-host'],
    headers.host,
    headers.origin,
    headers.referer
  ].map((value) => (Array.isArray(value) ? value[0] : value));
  return candidates.some((value) => isPreviewHost(value));
}
