import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.env.PKG_TARGET || 'node22-win-x64';
const outputName = target.includes('win') ? 'OpenPresenter.exe' : `OpenPresenter-${target}`;
const output = path.join(here, 'dist', outputName);
mkdirSync(path.dirname(output), { recursive: true });

const result = spawnSync('pkg', [
    'desktop-launcher.js',
    '--targets', target,
    '--output', output,
    '--compress', 'GZip'
], {
    cwd: here,
    stdio: 'inherit',
    shell: process.platform === 'win32'
});

if (result.error) {
    console.error('Impossible de lancer pkg. Installez les dépendances avec npm ci dans servergestionobs/.');
    process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
console.log(`\nBuild créé : ${output}`);
