// Identifiants courts, sans dépendance : utilisable côté Node **et** navigateur.
// Aucun import `node:*` ici, sinon les modules partagés ne se chargent plus dans
// la page de sortie (ENF-42 : un seul code pour les deux vues).

const HEX = '0123456789abcdef';

/** N octets aléatoires en hexadécimal (2N caractères). */
export function randomHex(bytes = 6) {
  const buffer = new Uint8Array(bytes);
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(buffer);
  } else {
    // Repli non cryptographique : l'identifiant n'a aucune valeur de sécurité.
    for (let i = 0; i < bytes; i++) buffer[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < buffer.length; i++) out += HEX[buffer[i] >> 4] + HEX[buffer[i] & 15];
  return out;
}

export function newLayerId() {
  return `lyr_${randomHex(6)}`;
}
