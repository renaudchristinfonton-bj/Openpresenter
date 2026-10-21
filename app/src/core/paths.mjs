// Résolution des chemins du projet.
// Règle P2 : tout vit dans le dossier du projet ; rien hors de lui, sauf logs système
// temporaires explicitement prévus par le lanceur.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Racine du dossier OpenPresenter (celui qui contient app/ et project/). */
export const ROOT = path.resolve(HERE, '..', '..', '..');
export const APP_DIR = path.resolve(ROOT, 'app');
export const WEB_DIR = path.join(APP_DIR, 'web');

/** Dossier de données : OPENPRESENTER_PROJECT sinon <racine>/project. */
export function projectDir() {
  const fromEnv = process.env.OPENPRESENTER_PROJECT;
  return fromEnv ? path.resolve(fromEnv) : path.join(ROOT, 'project');
}

export const FORMAT_VERSION = 3;
export const APP_VERSION = '3.0.0';

/** Sous-dossiers essentiels (EF-01.5). */
export const ESSENTIAL_DIRS = [
  'library', 'library/bibles', 'library/songs', 'library/looks',
  'library/announcements', 'library/timers', 'library/lowerthirds',
  'assets', 'assets/bibles', 'assets/songs', 'assets/media',
  'assets/backgrounds', 'assets/logos', 'assets/fonts',
  'outputs', 'scenes', 'profiles', 'orgs', 'events'
];

/** Sous-dossiers reconstruisibles (EF-01.4). */
export const CACHE_DIRS = ['cache', 'cache/thumb', 'cache/browser'];

export const LOG_DIR = 'logs';
export const BACKUP_DIR = 'backups';

export function todayStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function timeStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${todayStamp(d)}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Adresses IPv4 privées de la machine, pour l'affichage LAN (ENF-30). */
export function lanAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal && isPrivate(a.address)) {
        out.push({ iface: name, address: a.address });
      }
    }
  }
  return out;
}

function isPrivate(ip) {
  return ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('169.254.');
}
