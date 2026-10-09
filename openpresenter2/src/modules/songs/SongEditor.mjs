import { parseSongFile } from './parser.mjs';

function chordProSource(song) {
  if (song?.rawText && !/^\s*</.test(song.rawText)) return song.rawText;
  if (!song?.sections?.length) return '[Verse 1]\nÉcrivez vos paroles ici…\n\n[Chorus]\nAjoutez le refrain';
  return song.sections.map((section) => {
    const lines = section.lines.map((line, index) => {
      let result = String(line || '');
      const chords = section.chordLines?.[index] || [];
      for (const chord of [...chords].sort((a, b) => b.at - a.at)) {
        const at = Math.max(0, Math.min(result.length, Number(chord.at) || 0));
        result = result.slice(0, at) + `[${chord.chord}]` + result.slice(at);
      }
      return result;
    });
    return `[${section.name}]\n${lines.join('\n')}`;
  }).join('\n\n');
}
function escapeMeta(value) { return String(value || '').replace(/[{}\r\n]/g, ' ').trim(); }

export function openSongEditor({ song = null, onSave = () => {} } = {}) {
  const originalId = song?.id || null;
  const modal = document.createElement('div'); modal.className = 'song-editor-modal';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', song ? 'Modifier un chant' : 'Créer un chant');
  modal.innerHTML = `
    <section class="song-editor-window">
      <header class="song-editor-head">
        <div class="song-editor-mark">♪</div><div class="song-editor-heading"><strong>${song ? 'Studio du chant' : 'Nouveau chant'}</strong><small>ChordPro · OpenSong · texte simple</small></div>
        <div class="song-editor-spacer"></div><button type="button" class="song-editor-button quiet" id="song-edit-close">Fermer</button><button type="button" class="song-editor-button primary" id="song-edit-save">Enregistrer</button>
      </header>
      <div class="song-editor-content">
        <div class="song-editor-fields">
          <label>Titre<input id="song-edit-title" maxlength="120" autocomplete="off" placeholder="Titre du chant"></label>
          <label>Auteur / artiste<input id="song-edit-artist" maxlength="120" autocomplete="off" placeholder="Facultatif"></label>
        </div>
        <div class="song-editor-workspace">
          <section class="song-editor-source">
            <div class="song-editor-toolbar"><span>PAROLES & SECTIONS</span>
              <button type="button" data-insert="[Verse 1]\n">＋ Couplet</button><button type="button" data-insert="[Chorus]\n">＋ Refrain</button><button type="button" data-insert="[Bridge]\n">＋ Pont</button>
            </div>
            <textarea id="song-edit-source" spellcheck="true" aria-label="Paroles ChordPro" placeholder="[Verse 1]&#10;Écrivez vos paroles…&#10;&#10;[Chorus]&#10;Ajoutez le refrain"></textarea>
            <div class="song-editor-hint">Les accords ChordPro comme <code>[G]</code> sont conservés. Les sections peuvent s’écrire <code>[Verse 1]</code>, <code>[Chorus]</code>, <code>[Bridge]</code> ou <code>[Refrain]</code>.</div>
          </section>
          <section class="song-editor-preview"><div class="song-editor-preview-head"><span>APERÇU DES SECTIONS</span><span id="song-edit-count">—</span></div><div id="song-edit-preview" class="song-editor-preview-list"></div><div id="song-edit-error" class="song-editor-error" aria-live="polite"></div></section>
        </div>
      </div>
      <footer class="song-editor-foot"><span>Ctrl + Entrée pour enregistrer</span><span>Votre chant reste stocké sur cet appareil.</span></footer>
    </section>`;
  document.body.appendChild(modal);

  const $ = (selector) => modal.querySelector(selector);
  const title = $('#song-edit-title'); const artist = $('#song-edit-artist'); const source = $('#song-edit-source');
  title.value = song?.title || ''; artist.value = song?.artist || ''; source.value = chordProSource(song);
  let closed = false; let debounce;
  function close() {
    if (closed) return; closed = true; clearTimeout(debounce); document.removeEventListener('keydown', keydown); modal.remove();
  }
  function updatePreview() {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const preview = $('#song-edit-preview'); preview.replaceChildren();
      try {
        const parsed = parseSongFile(source.value, 'chant.pro');
        if (title.value.trim()) parsed.title = title.value.trim();
        $('#song-edit-error').textContent = '';
        $('#song-edit-count').textContent = `${parsed.sections.length} section${parsed.sections.length === 1 ? '' : 's'}`;
        parsed.sections.forEach((section) => {
          const card = document.createElement('article'); card.className = 'song-editor-preview-card';
          const heading = document.createElement('h3'); heading.textContent = section.name;
          const lines = document.createElement('p'); lines.textContent = section.lines.join('\n');
          card.append(heading, lines); preview.appendChild(card);
        });
      } catch (error) {
        $('#song-edit-count').textContent = '—';
        $('#song-edit-error').textContent = error.message;
        const empty = document.createElement('div'); empty.className = 'song-editor-preview-empty'; empty.textContent = 'Ajoutez au moins une ligne de paroles pour obtenir un aperçu.'; preview.appendChild(empty);
      }
    }, 80);
  }
  async function save() {
    try {
      const name = title.value.trim() || 'Chant sans titre';
      const artistName = artist.value.trim();
      const metadata = `{title: ${escapeMeta(name)}}${artistName ? `\n{artist: ${escapeMeta(artistName)}}` : ''}`;
      const parsed = parseSongFile(`${source.value}\n${metadata}`, `${name}.pro`);
      parsed.id = originalId || parsed.id; parsed.title = name; parsed.artist = artistName;
      parsed.source = song?.source || 'ChordPro'; parsed.updatedAt = Date.now();
      await onSave(parsed); close();
    } catch (error) {
      $('#song-edit-error').textContent = error.message;
      source.focus();
    }
  }
  function keydown(event) {
    if (event.key === 'Escape') { close(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); save(); }
  }
  $('#song-edit-close').onclick = close; $('#song-edit-save').onclick = save;
  title.addEventListener('input', updatePreview); source.addEventListener('input', updatePreview);
  modal.querySelectorAll('[data-insert]').forEach((button) => button.onclick = () => {
    const insertion = button.dataset.insert;
    const start = source.selectionStart; const end = source.selectionEnd;
    source.setRangeText(`${start > 0 && source.value[start - 1] !== '\n' ? '\n\n' : ''}${insertion}`, start, end, 'end');
    source.focus(); updatePreview();
  });
  document.addEventListener('keydown', keydown);
  updatePreview();
  requestAnimationFrame(() => title.focus());
  injectStyles();
  return modal;
}

function injectStyles() {
  if (document.getElementById('openpresenter-song-editor-style')) return;
  const style = document.createElement('style'); style.id = 'openpresenter-song-editor-style';
  style.textContent = `
    .song-editor-modal{position:fixed;inset:0;z-index:950;display:flex;align-items:center;justify-content:center;padding:3vh 3vw;background:rgba(3,4,8,.86);backdrop-filter:blur(9px);font-family:Inter,system-ui,sans-serif;color:#e6e8ee}
    .song-editor-window{display:flex;flex-direction:column;width:min(1100px,100%);height:min(850px,94vh);overflow:hidden;background:#0f1118;border:1px solid #2a2e3a;border-radius:12px;box-shadow:0 30px 100px #000b}
    .song-editor-head{display:flex;align-items:center;gap:10px;flex:none;padding:12px 15px;border-bottom:1px solid #282c37;background:#151721}.song-editor-mark{display:grid;place-items:center;width:31px;height:31px;border-radius:8px;background:#292039;color:#d7bdff;font-size:20px}.song-editor-heading strong{display:block;color:#f3f4f6;font-size:12px}.song-editor-heading small{display:block;color:#7e8697;font-size:8px;margin-top:3px}.song-editor-spacer{flex:1}.song-editor-button{padding:7px 12px;border:1px solid #333846;border-radius:5px;background:#1d202a;color:#c9cdd6;font-size:10px;cursor:pointer}.song-editor-button.primary{border-color:transparent;background:linear-gradient(135deg,#a78bfa,#8b5cf6);color:#120d1c;font-weight:850}
    .song-editor-content{flex:1;min-height:0;display:flex;flex-direction:column;padding:13px 15px;gap:11px}.song-editor-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px}.song-editor-fields label{display:flex;flex-direction:column;gap:5px;color:#939aaa;font-size:9px;font-weight:700}.song-editor-fields input{width:100%;padding:8px 9px;border:1px solid #303543;border-radius:5px;background:#151821;color:#f0f1f4;font-size:11px}.song-editor-workspace{min-height:0;flex:1;display:grid;grid-template-columns:1fr .85fr;gap:10px}.song-editor-source,.song-editor-preview{min-height:0;display:flex;flex-direction:column;border:1px solid #292d39;border-radius:7px;background:#12151d;overflow:hidden}.song-editor-toolbar,.song-editor-preview-head{height:35px;flex:none;display:flex;align-items:center;gap:5px;padding:0 8px;border-bottom:1px solid #292d39;color:#929aab;font-size:8px;font-weight:900;letter-spacing:.8px}.song-editor-toolbar span,.song-editor-preview-head span:first-child{flex:1}.song-editor-toolbar button{padding:5px 7px;border:1px solid #343847;border-radius:4px;background:#191d27;color:#c6cbd5;font-size:8px;cursor:pointer}.song-editor-source textarea{flex:1;min-height:0;width:100%;resize:none;padding:13px;border:0;outline:none;background:#0c0e14;color:#e2e5eb;font:12px/1.75 ui-monospace,SFMono-Regular,Consolas,monospace;tab-size:2}.song-editor-hint{flex:none;padding:8px 10px;color:#71798a;font-size:8px;line-height:1.5;border-top:1px solid #242833}.song-editor-hint code{color:#d0b7ff}.song-editor-preview-head{justify-content:space-between}.song-editor-preview-list{flex:1;min-height:0;overflow:auto;padding:9px}.song-editor-preview-card{padding:9px;margin-bottom:7px;border:1px solid #252a36;border-radius:5px;background:#171a23}.song-editor-preview-card h3{margin-bottom:5px;color:#cdb6ff;font-size:9px;text-transform:uppercase;letter-spacing:.5px}.song-editor-preview-card p{white-space:pre-wrap;color:#d8dbe2;font-size:10px;line-height:1.6}.song-editor-preview-empty{padding:12px;color:#747c8c;font-size:10px;line-height:1.5}.song-editor-error{flex:none;padding:0 10px;color:#ff9d9d;font-size:9px}.song-editor-foot{display:flex;justify-content:space-between;padding:7px 15px;border-top:1px solid #252a35;color:#71798a;font-size:8px}
    @media(max-width:700px){.song-editor-modal{padding:0}.song-editor-window{height:100dvh;border-radius:0}.song-editor-workspace{grid-template-columns:1fr;grid-template-rows:1fr .75fr}.song-editor-fields{grid-template-columns:1fr}.song-editor-foot{display:none}}
  `;
  document.head.appendChild(style);
}

export default { openSongEditor };
