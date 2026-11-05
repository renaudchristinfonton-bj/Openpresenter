#!/usr/bin/env bash
# OpenPresenter - diagnostic (double-clic depuis le Finder).
cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" || exit 10
exec ./Diagnostic.sh
read -r -p "Appuyez sur Entree pour fermer…" _ || true
