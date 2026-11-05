#!/usr/bin/env bash
# OpenPresenter — diagnostic macOS/Linux.
# Reproduit en clair ce que le lanceur voit : Node.js, ports, verrou, journal.

set -u
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" || exit 10
ROOT="$PWD"

echo
echo "============================================================"
echo "   OpenPresenter - diagnostic"
echo "============================================================"
echo
echo "Dossier : $ROOT"
echo "Date    : $(date)"
echo

echo "--- Node.js ---"
NODE=""
for c in "$ROOT/runtime/node/bin/node" "$ROOT/runtime/bin/node" "$(command -v node 2>/dev/null || true)" \
         "/opt/homebrew/bin/node" "/usr/local/bin/node" "/usr/bin/node"; do
  if [ -n "$c" ] && [ -x "$c" ]; then NODE="$c"; break; fi
done
if [ -n "$NODE" ]; then
  echo "  binaire : $NODE"
  "$NODE" -v
else
  echo "  node introuvable — installez Node.js 20+ : https://nodejs.org/fr"
fi
echo

echo "--- Ports 8788 a 8792 ---"
if command -v ss >/dev/null 2>&1; then
  ss -ltn 2>/dev/null | grep -E ':87(8[89]|9[0-2])\b' || echo "  aucun de ces ports n'écoute"
elif command -v netstat >/dev/null 2>&1; then
  netstat -ltn 2>/dev/null | grep -E '\.87(8[89]|9[0-2])\b' || echo "  aucun de ces ports n'écoute"
else
  echo "  ni ss ni netstat disponibles"
fi
echo

echo "--- Verrou du projet (.lock) ---"
if [ -f "$ROOT/project/.lock" ]; then
  cat "$ROOT/project/.lock"
  PID=$(sed -n 's/.*"pid": *\([0-9]\+\).*/\1/p' "$ROOT/project/.lock" | head -1)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "  -> le processus $PID tourne encore : une régie est probablement ouverte."
  else
    echo "  -> le processus ${PID:-?} n'existe plus : ce verrou est obsolète."
    echo "     Il sera repris automatiquement au prochain démarrage."
  fi
else
  echo "  aucun verrou : le prochain démarrage est libre"
fi
echo

echo "--- Dernier journal ---"
LOG=$(ls -1t "$ROOT/project/logs"/*.log 2>/dev/null | head -1 || true)
if [ -n "$LOG" ]; then
  echo "  $LOG"
  tail -20 "$LOG" | sed 's/^/    /'
else
  echo "  aucun journal pour l'instant"
fi
echo
echo "============================================================"
echo "   Copiez ce texte si vous demandez de l'aide."
echo "============================================================"
echo

# Double-clic depuis un gestionnaire de fichiers : la fenêtre se fermerait
# avant qu'on ait pu lire. On attend une touche, seulement dans un terminal.
if [ -t 0 ]; then
  printf 'Appuyez sur Entrée pour fermer cette fenêtre... '
  read -r _ || true
  echo
fi
