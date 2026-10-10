#!/usr/bin/env bash
cd "$(dirname "$0")"

PORT="${PORT:-8788}"
export PORT
APP_URL="http://localhost:${PORT}/openpresenter2/"

printf '%s\n' '========================================================' '  OpenPresenter 2 - démarrage' '========================================================' ''
printf '%s\n' 'Vérification de Node.js...'
if ! command -v node >/dev/null 2>&1; then
  printf '\n[ERREUR] Node.js 20 ou plus récent n’est pas installé.\n'
  printf '%s\n\n' 'Téléchargez la version LTS depuis https://nodejs.org/ puis relancez ce fichier.'
  if [ -t 0 ]; then read -r -p 'Appuyez sur Entrée pour fermer...' _; fi
  exit 1
fi

NODE_VERSION="$(node -v 2>/dev/null)"
NODE_MAJOR="${NODE_VERSION#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
if ! [[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] || (( NODE_MAJOR < 20 )); then
  printf '\n[ERREUR] OpenPresenter 2 nécessite Node.js 20 ou plus récent.\n'
  printf 'Version détectée : %s\n' "${NODE_VERSION:-inconnue}"
  printf '%s\n\n' 'Téléchargez la version LTS depuis https://nodejs.org/ puis relancez ce fichier.'
  if [ -t 0 ]; then read -r -p 'Appuyez sur Entrée pour fermer...' _; fi
  exit 1
fi

printf '  OK - Node.js détecté (version %s)\n\n' "$NODE_VERSION"
printf 'Application : %s\n' "$APP_URL"
printf '%s\n' 'Laissez cette fenêtre ouverte pendant l’utilisation.'
printf '%s\n\n' 'Pour arrêter le serveur, appuyez sur Ctrl+C.'
node server.mjs
STATUS=$?
if [ "$STATUS" -ne 0 ]; then
  printf '\nLe serveur s’est arrêté avec une erreur. Vérifiez si le port %s est déjà utilisé.\n' "$PORT"
fi
if [ -t 0 ]; then read -r -p 'Appuyez sur Entrée pour fermer...' _; fi
exit "$STATUS"
