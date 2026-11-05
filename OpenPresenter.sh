#!/usr/bin/env bash
# OpenPresenter — lanceur Linux (coquille fine, cf. docs/spec/03-lanceur.md § 3.2).
# Résout le dossier, trouve un runtime Node.js 20+, puis délègue à app/launcher/launch.mjs.

set -u
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" || exit 10

ROOT="$PWD"

hold() {
  # Terminal ouvert par un double-clic : ne pas le refermer avant qu'on ait lu.
  [ -t 0 ] || return 0
  printf 'Appuyez sur Entrée pour fermer cette fenêtre... '
  read -r _ || true
  printf '\n'
}
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
  hold
  exit 70
fi

VERSION="$("$NODE" -e 'process.stdout.write(process.versions.node)')"
MAJOR="${VERSION%%.*}"

if [ "${MAJOR:-0}" -lt 20 ]; then
  printf '\nOpenPresenter nécessite Node.js 20 ou plus récent.\nVersion détectée : %s\n\nTéléchargez la version « LTS » sur https://nodejs.org/fr, puis relancez.\n\n' "$VERSION"
  hold
  exit 70
fi

# Le lanceur gère lui-même l'attente ; on la lui délègue pour ne pas
# demander deux fois la même touche, et on garde la fenêtre si le
# lanceur disparaît sans dire pourquoi.
export OPENPRESENTER_SHELL_HOLD=1
"$NODE" "$ROOT/app/launcher/launch.mjs" "$@"
CODE=$?
[ "$CODE" -eq 0 ] || hold
exit "$CODE"
