#!/bin/bash
cd "$(dirname "$0")"

RELAY_PORT="${PORT:-8787}"

echo "========================================================"
echo "  Serveur relais OBS - démarrage"
echo "========================================================"
echo ""

# -----------------------------------------------------------
# 1/4 - Node.js est-il installé ?
# -----------------------------------------------------------
echo "[1/4] Vérification de Node.js..."
if ! command -v node &> /dev/null; then
    echo ""
    echo "  [ERREUR] Node.js n'est pas installé, ou pas accessible."
    echo "  -> Installez la version LTS depuis : https://nodejs.org/"
    if [[ "$OSTYPE" == "darwin"* ]] && command -v brew &> /dev/null; then
        echo "  Ou, si vous utilisez Homebrew :  brew install node"
    fi
    echo ""
    read -p "Appuyez sur Entrée pour fermer..."
    exit 1
fi
echo "  OK - Node.js détecté (version $(node -v))"
echo ""

# -----------------------------------------------------------
# 2/4 - Droits d'exécution du script
# -----------------------------------------------------------
echo "[2/4] Vérification des droits du script..."
if [ ! -x "$0" ]; then
    echo "  [INFO] Ce fichier n'est pas encore marqué exécutable."
    echo "  Tentative de correction automatique : chmod +x \"$0\""
    chmod +x "$0" 2>/dev/null
fi
if [ "$(id -u)" -eq 0 ]; then
    echo "  [INFO] Vous exécutez ce script en tant que root/administrateur."
    echo "  Ce n'est normalement PAS nécessaire sur Mac/Linux pour ce"
    echo "  serveur (port $RELAY_PORT). Vous pouvez relancer sans 'sudo'"
    echo "  si vous n'avez pas de raison particulière de l'utiliser."
else
    echo "  OK - Droits normaux, pas besoin de root pour le port $RELAY_PORT."
fi
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  [INFO macOS] Si une fenêtre de sécurité bloque l'ouverture de ce"
    echo "  fichier, faites un clic droit dessus -> \"Ouvrir\", puis confirmez."
fi
echo ""

# -----------------------------------------------------------
# 3/4 - Le port est-il déjà utilisé ?
# -----------------------------------------------------------
echo "[3/4] Vérification du port $RELAY_PORT..."
PORT_BUSY=""
if command -v lsof &> /dev/null; then
    PORT_BUSY="$(lsof -nP -iTCP:"$RELAY_PORT" -sTCP:LISTEN 2>/dev/null | tail -n +2)"
fi
if [ -n "$PORT_BUSY" ]; then
    echo "  [INFO] Le port $RELAY_PORT semble déjà utilisé :"
    echo "$PORT_BUSY" | sed 's/^/    /'
    echo "  C'est peut-être un serveur relais déjà lancé ailleurs : vous"
    echo "  pouvez alors simplement ouvrir http://localhost:$RELAY_PORT/"
    echo "  dans votre navigateur sans relancer de deuxième serveur."
    echo "  Sinon, changez de port avec :  PORT=9000 ./demarrer-mac-linux.command"
    echo ""
    read -p "Continuer et essayer de démarrer quand même ? (o/N) " REPLY
    if [[ ! "$REPLY" =~ ^[oOyY]$ ]]; then
        echo "Annulé."
        read -p "Appuyez sur Entrée pour fermer..."
        exit 1
    fi
else
    echo "  OK - Port $RELAY_PORT disponible."
fi
echo ""

# -----------------------------------------------------------
# 4/4 - Démarrage du serveur
# -----------------------------------------------------------
echo "[4/4] Démarrage du serveur relais..."
echo "(Laissez cette fenêtre ouverte tant que vous diffusez)"
echo ""
node sync-relay-server.js
read -p "Appuyez sur Entrée pour fermer..."
