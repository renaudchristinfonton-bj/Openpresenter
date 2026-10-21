#!/usr/bin/env bash
# OpenPresenter — lanceur Linux (coquille fine, cf. docs/spec/03-lanceur.md § 3.2).
# Résout le dossier, trouve un runtime Node.js 20+, puis délègue à app/launcher/launch.mjs.

set -u
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" || exit 10

ROOT="$PWD"
NODE=""

candidates=(
  "$ROOT/runtime/node/bin/node"
  "$ROOT/runtime/bin/node"
  "$(command -v node 2>/dev/null || true)"
  "/usr/local/bin/node"
  "/usr/bin/node"
  "/snap/bin/node"
  "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)/bin/node"
)

for c in "${candidates[@]}"; do
  if [ -n "$c" ] && [ -x "$c" ]; then NODE="$c"; break; fi
done

if [ -z "$NODE" ]; then
  cat <<'TXT'
╔══════════════════════════════════════════════════════════╗
║    OpenPresenter                                         ║
╚══════════════════════════════════════════════════════════╝

Node.js est introuvable sur cet ordinateur.

OpenPresenter a besoin de Node.js 20 ou plus récent pour fonctionner.
Voici comment l'installer, une seule fois :

  1. Ouvrez https://nodejs.org/fr dans un navigateur
  2. Téléchargez la version « LTS »
  3. Installez-la (paquet .deb, .rpm ou archive .tar.xz)
  4. Relancez ./OpenPresenter.sh

Si cet ordinateur n'a pas Internet, préparez une clé USB depuis un autre poste,
ou placez un runtime portable dans le dossier runtime/ :

  runtime/node/bin/node   ← exécutable Node.js décompressé

Aucune installation n'est faite sans votre accord.
TXT
  exit 70
fi

VERSION="$("$NODE" -e 'process.stdout.write(process.versions.node)')"
MAJOR="${VERSION%%.*}"

if [ "${MAJOR:-0}" -lt 20 ]; then
  printf '\nOpenPresenter nécessite Node.js 20 ou plus récent.\nVersion détectée : %s\n\nTéléchargez la version « LTS » sur https://nodejs.org/fr, puis relancez.\n\n' "$VERSION"
  exit 70
fi

exec "$NODE" "$ROOT/app/launcher/launch.mjs" "$@"
