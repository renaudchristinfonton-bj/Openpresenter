// ============================================================
// js/obs-links.js — Module partagé (refactor, axe E)
// ============================================================
// Construit le panneau "liens OBS" (lien général + liens à mode fixe) et gère la
// copie dans le presse-papier. Auparavant dupliqué dans Bible, Paroles et Lower Third.
(function () {
    'use strict';

    // Construit le lien général (qui suit le mode en direct) et un lien par mode fixe
    // (screen80, bottom, bottom-right, full, scrolling) à coller dans OBS sur d'autres
    // scènes. Se base sur les options déjà présentes dans le sélecteur de style, pour
    // rester toujours synchronisé si la liste de modes change un jour.
    function initObsLinksPanel() {
        const base = window.location.origin + window.location.pathname;
        const generalUrl = base + '?obs=true';

        const generalEl = document.querySelector('[data-link-role="general"]');
        if (generalEl) generalEl.innerText = generalUrl;
        const generalBtn = document.querySelector('[data-copy-role="general"]');
        if (generalBtn) generalBtn.addEventListener('click', () => copyToClipboard(generalUrl, generalBtn));

        const fixedContainer = document.getElementById('obs-fixed-links');
        const modeSelect = document.getElementById('obs-mode-select');
        if (!fixedContainer || !modeSelect) return;

        fixedContainer.innerHTML = '';
        Array.from(modeSelect.options).forEach(opt => {
            const url = base + '?obs=true&lockMode=' + encodeURIComponent(opt.value);
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
        fixedContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-copy-url]');
            if (!btn) return;
            copyToClipboard(btn.getAttribute('data-copy-url'), btn);
        });
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
    window.copyToClipboard = copyToClipboard;
    window.fallbackCopyToClipboard = fallbackCopyToClipboard;
})();
