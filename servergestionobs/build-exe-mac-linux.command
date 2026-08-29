#!/bin/bash
# ---------------------------------------------------------------
# Construction de l'exécutable autonome macOS / Linux (openpresenter)
# Nécessite Node.js (LTS) — une seule fois, à la construction.
# L'exécutable obtenu démarre tout seul, sans Node à l'usage.
# ---------------------------------------------------------------
set -e
cd "$(dirname "$0")"

echo "========================================================"
echo "  Construction de l'exécutable autonome OpenPresenter"
echo "========================================================"

if ! command -v node >/dev/null 2>&1; then
    echo "[ERREUR] Node.js est requis pour construire l'exécutable."
    echo "  -> Installez la version LTS : https://nodejs.org/ puis relancez."
    exit 1
fi

echo "[1/4] Préparation du paquet applicatif..."
node --experimental-sea-config sea-config.json

echo "[2/4] Copie du moteur Node..."
NODE_BIN="$(command -v node)"
cp -f "$NODE_BIN" openpresenter
chmod +x openpresenter

echo "[3/4] Injection du serveur dans l'exécutable..."
# postject est invoqué via npx (une connexion Internet est nécessaire une
# seule fois ; vous pouvez aussi l'installer globalement : npm i -g postject).
npx --yes postject openpresenter NODE_SEA_BLOB sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

echo "[4/4] Nettoyage..."
rm -f sea-prep.blob

echo ""
echo "========================================================"
echo "  OK : openpresenter créé dans ce dossier."
echo "  Lancez-le : ./openpresenter"
echo "  Le navigateur s'ouvre tout seul (OPEN=1)."
echo "  Gardez le dossier complet (pages, js, vendor...) à côté"
echo "  de l'exécutable : c'est lui, la régie portable."
echo "========================================================"
