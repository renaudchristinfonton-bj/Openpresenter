#!/usr/bin/env bash
# ============================================================
# check-syntax.sh — Vérifie la syntaxe JS de tous les blocs
# <script> inline des pages HTML de servergestionobs.
# Usage : bash tests/check-syntax.sh
# ============================================================
set -u
cd "$(dirname "$0")/.."
FAIL=0
for f in *.html; do
    [ -f "$f" ] || continue
    # Extrait chaque bloc <script> sans attribut src et le vérifie avec node
    node -e '
        const fs = require("fs");
        const file = process.argv[1];
        const html = fs.readFileSync(file, "utf8");
        const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
        let m, i = 0, bad = 0;
        while ((m = re.exec(html)) !== null) {
            i++;
            const code = m[1];
            if (!code.trim()) continue;
            try { new Function(code); } catch (e) {
                bad++;
                console.error(`  ✗ ${file} — bloc script #${i} : ${e.message}`);
            }
        }
        process.exitCode = bad ? 1 : 0;
    ' "$f" || FAIL=1
    echo "  ✓ $f vérifié"
done
if [ "$FAIL" -ne 0 ]; then echo "ÉCHEC : au moins un bloc script est invalide."; exit 1; fi
echo "Tous les blocs script sont syntaxiquement valides."
