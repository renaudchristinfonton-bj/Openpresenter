#!/usr/bin/env bash
# OpenPresenter — lanceur macOS (double-clic depuis le Finder).
# Au premier lancement, macOS peut demander : clic droit → Ouvrir.

set -u
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" || exit 10

ROOT="$PWD"
NODE=""

candidates=(
  "$ROOT/runtime/node/bin/node"
  "$(command -v node 2>/dev/null || true)"
  "/opt/homebrew/bin/node"
  "/usr/local/bin/node"
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

Installation manuelle de Node.js

Option A — installateur :
  1. Ouvrez https://nodejs.org/fr
  2. Téléchargez la version « LTS » (macOS Installer .pkg)
  3. Lancez l'installateur
  4. Relancez OpenPresenter.command

Option B — Homebrew (si installé) :
  brew install node

Option C — sans installation système :
  téléchargez l'archive « macOS Binaries (.tar.gz) », décompressez-la,
  puis copiez le dossier bin/ dans :
  runtime/

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
