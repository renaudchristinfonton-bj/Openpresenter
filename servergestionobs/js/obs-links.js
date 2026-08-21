// ============================================================
// js/obs-links.js — Module partagé (refactor, axe E)
// ============================================================
// Construit le panneau "liens OBS" (lien général + liens à mode fixe) et gère la
// copie dans le presse-papier. Auparavant dupliqué dans Bible, Paroles et Lower Third.
//
// + Sorties personnalisées (axe A) : résolution d'écran de sortie LIBRE (WxH)
//   et MODE D'ADAPTATION, pour que TOUT soit toujours visible et s'adapte à
//   n'importe quel écran — y compris étiré (ratio différent de 16:9).
//   - getOutputResolution()/setOutputResolution() : choix persisté (localStorage
//     ET dossier data/ via OpenStore — suit la portabilité du projet).
//   - resQuery() : suffixe '&res=WxH' (+ '&fit=...' si mode non par défaut).
//   - initResolutionPanel() : branche largeur×hauteur, mode d'adaptation,
//     lien et bouton copier.
//   - applyObsResolution() : en mode OBS (?res=WxH), dimensionne body et met
//     le rendu interne 1920×1080 à l'échelle selon le mode d'adaptation :
//       fit     → tout afficher (par défaut ; bandes noires si ratio différent)
//       fill    → remplir (peut rogner les bords)
//       stretch → étirer (remplit EXACTEMENT un écran au ratio différent)
(function () {
    'use strict';

    const DEFAULT_RES = { w: 1920, h: 1080, fit: 'fit' };
    const RES_KEY = 'output_res', RES_NS = 'settings';
    const FITS = ['fit', 'fill', 'stretch'];

    // ---- Résolution de sortie (persistée : localStorage + dossier data/) ----
    function getOutputResolution() {
        let r = null;
        try {
            if (window.OpenStore) r = window.OpenStore.get(RES_NS, RES_KEY, null);
            else r = JSON.parse(localStorage.getItem(RES_NS + ':' + RES_KEY) || 'null');
        } catch (e) { r = null; }
        if (!r || !r.w || !r.h) return { w: DEFAULT_RES.w, h: DEFAULT_RES.h, fit: DEFAULT_RES.fit };
        return {
            w: Math.round(r.w), h: Math.round(r.h),
            fit: FITS.indexOf(r.fit) >= 0 ? r.fit : DEFAULT_RES.fit
        };
    }

    function setOutputResolution(w, h, fit) {
        const val = {
            w: Math.round(w), h: Math.round(h),
            fit: FITS.indexOf(fit) >= 0 ? fit : DEFAULT_RES.fit
        };
        try {
            if (window.OpenStore) window.OpenStore.set(RES_NS, RES_KEY, val); // local + serveur (non bloquant)
            else localStorage.setItem(RES_NS + ':' + RES_KEY, JSON.stringify(val));
        } catch (e) { /* silencieux */ }
    }

    // Suffixe d'URL pour la résolution choisie ('' si résolution par défaut).
    function resQuery() {
        const r = getOutputResolution();
        let q = '';
        if (r.w !== DEFAULT_RES.w || r.h !== DEFAULT_RES.h) q += '&res=' + r.w + 'x' + r.h;
        if (q && r.fit !== DEFAULT_RES.fit) q += '&fit=' + r.fit;
        return q;
    }

    // Construit le lien général (qui suit le mode en direct) et un lien par mode fixe
    // (screen80, bottom, bottom-right, full, scrolling) à coller dans OBS sur d'autres
    // scènes. Se base sur les options déjà présentes dans le sélecteur de style, pour
    // rester toujours synchronisé si la liste de modes change un jour.
    // Tous ces liens embarquent la résolution de sortie choisie (&res=WxH).
    function initObsLinksPanel() {
        const base = window.location.origin + window.location.pathname;
        const generalUrl = base + '?obs=true' + resQuery();

        const generalEl = document.querySelector('[data-link-role="general"]');
        if (generalEl) generalEl.innerText = generalUrl;
        const generalBtn = document.querySelector('[data-copy-role="general"]');
        if (generalBtn && !generalBtn.__obpBound) {
            generalBtn.__obpBound = true;
            generalBtn.addEventListener('click', () => copyToClipboard(generalUrl, generalBtn));
        }

        const fixedContainer = document.getElementById('obs-fixed-links');
        const modeSelect = document.getElementById('obs-mode-select');
        if (!fixedContainer || !modeSelect) return;

        fixedContainer.innerHTML = '';
        Array.from(modeSelect.options).forEach(opt => {
            const url = base + '?obs=true&lockMode=' + encodeURIComponent(opt.value) + resQuery();
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between gap-2';
            row.innerHTML = `
                <div class="min-w-0">
                    <p class="text-[9px] text-slate-500">${opt.text}</p>
                    <p class="text-[10px] text-slate-300 truncate font-mono">${url}</p>
                </div>
                <button type="button" class="shrink-0 text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded" data-copy-url="${url}">Copier</button>
            `;
            fixedContainer.appendChild(row);
        });
        if (!fixedContainer.__obpBound) {
            fixedContainer.__obpBound = true;
            fixedContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-copy-url]');
                if (!btn) return;
                copyToClipboard(btn.getAttribute('data-copy-url'), btn);
            });
        }
    }

    // ---- Panneau largeur × hauteur + adaptation + lien personnalisé + copier ----
    // Options : { obsParam: '?obs=true' (défaut) ou '?obs=1' (Lower Third) }
    function initResolutionPanel(options) {
        const opts = options || {};
        const wEl = document.querySelector('[data-res-role="w"]');
        const hEl = document.querySelector('[data-res-role="h"]');
        if (!wEl || !hEl) return;

        const fitEl = document.querySelector('[data-res-role="fit"]');
        const linkEl = document.querySelector('[data-res-role="link"]');
        const copyBtn = document.querySelector('[data-res-role="copy"]');
        const obsParam = opts.obsParam || '?obs=true';

        const buildLink = () => (window.location.origin + window.location.pathname) + obsParam + resQuery();

        const refresh = () => {
            if (linkEl) linkEl.innerText = buildLink();
            try { if (window.initObsLinksPanel) initObsLinksPanel(); } catch (e) { /* silencieux */ }
        };

        const cur = getOutputResolution();
        wEl.value = cur.w; hEl.value = cur.h;
        if (fitEl) fitEl.value = cur.fit;

        const onChange = () => {
            let w = parseInt(wEl.value, 10), h = parseInt(hEl.value, 10);
            if (!w || w < 64 || w > 7680) { w = DEFAULT_RES.w; wEl.value = w; }
            if (!h || h < 64 || h > 4320) { h = DEFAULT_RES.h; hEl.value = h; }
            setOutputResolution(w, h, fitEl ? fitEl.value : undefined);
            refresh();
        };
        if (!wEl.__obpBound) { wEl.__obpBound = true; wEl.addEventListener('change', onChange); }
        if (!hEl.__obpBound) { hEl.__obpBound = true; hEl.addEventListener('change', onChange); }
        if (fitEl && !fitEl.__obpBound) { fitEl.__obpBound = true; fitEl.addEventListener('change', onChange); }
        if (copyBtn && !copyBtn.__obpBound) {
            copyBtn.__obpBound = true;
            copyBtn.addEventListener('click', () => copyToClipboard(buildLink(), copyBtn));
        }
        refresh();
    }

    // ---- En mode OBS : applique ?res=WxH (et ?fit=…) au rendu ----
    // Le rendu interne est conçu en 1920×1080 ; on dimensionne body à la taille
    // demandée (--cw/--ch) et on met le conteneur à l'échelle selon le mode
    // d'adaptation. Sans ?res= : rien ne change (1920×1080 en haut à gauche).
    function applyObsResolution() {
        try {
            const p = new URLSearchParams(window.location.search);
            const res = p.get('res');
            if (!res) return false;
            const m = String(res).match(/^(\d{2,5})x(\d{2,5})$/);
            if (!m) return false;
            const w = Math.max(64, Math.min(7680, parseInt(m[1], 10)));
            const h = Math.max(64, Math.min(4320, parseInt(m[2], 10)));
            const fitParam = p.get('fit');
            const fit = FITS.indexOf(fitParam) >= 0 ? fitParam : DEFAULT_RES.fit;

            const body = document.body;
            body.style.setProperty('--cw', w + 'px');
            body.style.setProperty('--ch', h + 'px');

            const sx = w / 1920, sy = h / 1080;
            let kx, ky;
            if (fit === 'stretch') { kx = sx; ky = sy; }        // écran étiré : remplissage exact
            else if (fit === 'fill') { kx = ky = Math.max(sx, sy); } // remplit, peut rogner
            else { kx = ky = Math.min(sx, sy); }                // tout afficher (défaut)
            body.style.setProperty('--obs-sx', String(kx));
            body.style.setProperty('--obs-sy', String(ky));
            body.style.setProperty('--obs-scale', String(Math.min(kx, ky)));
            body.classList.add('res-custom');
            return true;
        } catch (e) { return false; }
    }

    // Copie un lien dans le presse-papier, avec repli si l'API clipboard n'est pas
    // disponible (ex: page ouverte en file:// dans certains navigateurs).
    function copyToClipboard(text, btn) {
        const done = () => {
            if (!btn) return;
            const original = btn.innerText;
            btn.innerText = 'Copié !';
            setTimeout(() => { btn.innerText = original; }, 1200);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopyToClipboard(text, done));
        } else {
            fallbackCopyToClipboard(text, done);
        }
    }

    function fallbackCopyToClipboard(text, done) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* ignoré */ }
        document.body.removeChild(ta);
        if (done) done();
    }

    window.initObsLinksPanel = initObsLinksPanel;
    window.initResolutionPanel = initResolutionPanel;
    window.applyObsResolution = applyObsResolution;
    window.getOutputResolution = getOutputResolution;
    window.setOutputResolution = setOutputResolution;
    window.resQuery = resQuery;
    window.copyToClipboard = copyToClipboard;
    window.fallbackCopyToClipboard = fallbackCopyToClipboard;
})();
