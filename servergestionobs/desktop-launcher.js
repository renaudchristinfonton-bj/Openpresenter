'use strict';

// Petit lanceur Windows : démarre le serveur local puis ouvre l'interface dans le
// navigateur par défaut. Les URL OBS restent celles du serveur (port 8787).
const { spawn } = require('child_process');
const { server, PORT } = require('./sync-relay-server.js');

const url = `http://localhost:${PORT}/`;

function openBrowser() {
    console.log(`OpenPresenter est prêt : ${url}`);
    if (process.env.OPENPRESENTER_NO_BROWSER === '1') return;

    let command;
    let args;
    if (process.platform === 'win32') {
        command = 'cmd.exe';
        args = ['/c', 'start', '', url];
    } else if (process.platform === 'darwin') {
        command = 'open';
        args = [url];
    } else {
        command = 'xdg-open';
        args = [url];
    }

    try {
        const browser = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
        browser.on('error', () => console.log(`Ouvrez manuellement ${url} dans votre navigateur.`));
        browser.unref();
    } catch (_) {
        console.log(`Ouvrez manuellement ${url} dans votre navigateur.`);
    }
}

server.once('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
        console.error(`Le port ${PORT} est déjà utilisé. Fermez l'autre instance d'OpenPresenter ou changez PORT.`);
    } else {
        console.error('Impossible de démarrer le serveur OpenPresenter :', error && error.message || error);
    }
    process.exitCode = 1;
});

if (server.listening) setTimeout(openBrowser, 250);
else server.once('listening', () => setTimeout(openBrowser, 250));
