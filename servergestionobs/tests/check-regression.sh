#!/usr/bin/env bash
# ============================================================
# check-regression.sh — Garde anti-régression structurelle.
# Compare les fonctions déclarées dans chaque page avec la
# version git HEAD : un edit ne doit JAMAIS faire disparaître
# une fonction existante (règle « ne rien casser »).
# Usage : bash tests/check-regression.sh [HEAD|<commit>]
# ============================================================
set -u
cd "$(dirname "$0")/.."
REF="${1:-HEAD}"
FAIL=0
for f in *.html; do
    [ -f "$f" ] || continue
    if ! git cat-file -e "$REF:servergestionobs/$f" 2>/dev/null; then continue; fi
    D=$(diff <(git show "$REF:servergestionobs/$f" | grep -oE "function [a-zA-Z0-9_]+" | sort -u) \
             <(grep -oE "function [a-zA-Z0-9_]+" "$f" | sort -u) | grep "^<" || true)
    if [ -n "$D" ]; then
        echo "✗ $f — fonctions disparues par rapport à $REF :"
        echo "$D"
        FAIL=1
    else
        echo "✓ $f — aucune fonction perdue"
    fi
done
[ "$FAIL" -ne 0 ] && { echo "ÉCHEC : régression structurelle détectée."; exit 1; }
echo "Aucune régression structurelle."
