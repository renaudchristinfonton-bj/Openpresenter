// ============================================================
//  SceneEditor — éditeur visuel WYSIWYG de scène (réutilisable
//  par Bible / Paroles / Annonces). Le même éditeur est appelé
//  pour tous les modules ; seules les bindings d'exemple
//  (texte affiché) et les presets par défaut changent.
// ============================================================
import Engine from '../core/engine.mjs';

export function openSceneEditor({ kind, scene, onSave, sampleBindings }) {
  const modal = buildModal();
  document.body.appendChild(modal);
  const state = JSON.parse(JSON.stringify(scene));
  let currentPreset = state.preset || 'full';
  let selected = null;
  let history = [JSON.parse(JSON.stringify(state))];
  let hIdx = 0;

  const $ = (s) => modal.querySelector(s);
  const canvas = $('#se-canvas');
  const canvasInner = $('#se-canvas-inner');
  const layersList = $('#se-layers');
  const propsPanel = $('#se-props');
  const presetTabs = $('#se-presets');

  function pushHistory() {
    history = history.slice(0, hIdx+1);
    history.push(JSON.parse(JSON.stringify(state)));
    hIdx = history.length-1;
    if (history.length>50){history.shift();hIdx--;}
  }
  function undo(){ if(hIdx<=0)return; hIdx--; Object.assign(state, JSON.parse(JSON.stringify(history[hIdx]))); render(); }

  const PRESETS = [
    {id:'full',label:'Plein'},
    {id:'screen80',label:'80%'},
    {id:'bottom',label:'Bas'},
    {id:'bottom-right',label:'Droite'},
    {id:'lowerthird',label:'Lower ⅓'},
  ];

  function render() {
    // Presets tabs
    presetTabs.innerHTML = PRESETS.map(p=>`<button class="se-tab ${p.id===currentPreset?'active':''}" data-p="${p.id}">${p.label}</button>`).join('');
    presetTabs.querySelectorAll('.se-tab').forEach(b=>{
      b.onclick = () => {
        pushHistory();
        currentPreset = b.dataset.p;
        const preset = Engine.defaultScene(currentPreset, kind);
        // Conserver l'image de fond et les customisations couleurs si elles existent
        preset.bgImage = state.bgImage;
        preset.accentColor = state.accentColor;
        preset.textColor = state.textColor;
        preset.transparent = state.transparent;
        Object.keys(state).forEach(k => { if(!['layers','preset','name'].includes(k)) preset[k]=state[k]; });
        Object.assign(state, preset);
        render();
      };
    });

    // Canvas (moteur)
    const scale = canvas.clientWidth/1920;
    state.preset = currentPreset;
    canvasInner.innerHTML = '';
    const rect = () => ({ w: canvasInner.clientWidth, h: canvasInner.clientHeight });
    const root = Engine.render(state, canvasInner, sampleBindings, {
      interactive: true,
      selected,
      containerRect: rect,
      onSelectLayer: (id) => { selected = id; render(); },
      onChange: () => { // pendant drag/resize, rendu en direct
        canvasInner.innerHTML='';
        Engine.render(state, canvasInner, sampleBindings, { interactive:true, selected, containerRect:rect, onSelectLayer:(id)=>{selected=id;}, onChange:()=>{}, onCommit:()=>{} });
        renderProps(); renderLayers();
      },
      onCommit: () => { pushHistory(); render(); }
    });
    if(root){root.classList.add('se-root');}

    renderLayers();
    renderProps();
  }

  function renderLayers() {
    layersList.innerHTML = '';
    state.layers.slice().reverse().forEach(l => {
      const row = document.createElement('div');
      row.className = 'se-layer' + (selected===l.id?' active':'');
      if(!l.visible) row.classList.add('hidden');
      row.innerHTML = `
        <span class="se-eye" data-a="vis">${l.visible?'👁':'🙈'}</span>
        <span class="se-name">${l.name} <span class="se-type">${l.type}</span></span>
        <span class="se-lock">${l.locked?'🔒':''}</span>
      `;
      row.onclick = () => { selected = l.id; render(); };
      row.querySelector('[data-a=vis]').onclick = (e) => { e.stopPropagation(); l.visible=!l.visible; pushHistory(); render(); };
      layersList.appendChild(row);
    });
  }

  function renderProps() {
    if(!selected){
      propsPanel.innerHTML = `<div class="se-empty">
        <h4>Propriétés globales</h4>
        <div class="se-row"><label>Accent</label><input type="color" id="p-accent"></div>
        <div class="se-row"><label>Texte</label><input type="color" id="p-text"></div>
        <div class="se-row"><label>Fond</label><input type="color" id="p-bg"></div>
        <div class="se-row"><label>Opacité</label><input type="range" id="p-opacity" min="0" max="100"><span id="p-opacity-v"></span></div>
        <div class="se-row"><label>Rayon</label><input type="number" id="p-radius" min="0" max="80" step="1"><span>px</span></div>
        <label class="se-check"><input type="checkbox" id="p-transparent"> Fond transparent</label>
        <label class="se-check"><input type="file" id="p-img-file" accept="image/*" style="display:none"><button class="se-btn" id="p-img">📷 Image de fond</button> <button class="se-btn" id="p-img-clear">Retirer</button></label>
        <hr style="border-color:#222;margin:12px 0">
        <h4>Texte long</h4>
        <select id="p-split" class="se-select">
          <option value="none">Affichage complet</option>
          <option value="auto">Découper automatiquement</option>
        </select>
        <div class="se-row" style="margin-top:8px;"><label>Car./partie</label><input type="range" id="p-split-chars" min="60" max="360" step="10"><span id="p-split-chars-v"></span></div>
        <p class="se-empty-note">Sélectionne un calque pour éditer sa position et sa typographie.</p>
      </div>`;
      // Bind
      const bindColor=(id,key,onChange)=>{const el=document.getElementById(id);el.value=Engine.rgbToHex(state[key]||'#000');el.oninput=e=>{state[key]=Engine.hexToRgba(e.target.value,(state.bgOpacity!=null?state.bgOpacity:92)/100);if(key==='bgColor'||key==='bgOpacity'){}if(onChange)onChange();render();};};
      bindColor('p-accent','accentColor');
      bindColor('p-text','textColor');
      document.getElementById('p-bg').value=Engine.rgbToHex(state.bgColor||'#000');
      document.getElementById('p-bg').oninput=e=>{state.bgColor=Engine.hexToRgba(e.target.value,(state.bgOpacity!=null?state.bgOpacity:92)/100);render();};
      const op=document.getElementById('p-opacity');op.value=state.bgOpacity||92;document.getElementById('p-opacity-v').innerText=(state.bgOpacity||92)+'%';
      op.oninput=e=>{state.bgOpacity=+e.target.value;state.bgColor=Engine.hexToRgba(Engine.rgbToHex(state.bgColor),e.target.value/100);document.getElementById('p-opacity-v').innerText=e.target.value+'%';render();};
      document.getElementById('p-radius').value=state.shapeRadius||0;document.getElementById('p-radius').oninput=e=>{state.shapeRadius=+e.target.value;render();};
      document.getElementById('p-transparent').checked=!!state.transparent;document.getElementById('p-transparent').onchange=e=>{state.transparent=e.target.checked;render();};
      document.getElementById('p-img').onclick=()=>document.getElementById('p-img-file').click();
      document.getElementById('p-img-file').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{state.bgImage=ev.target.result;pushHistory();render();};r.readAsDataURL(f);};
      document.getElementById('p-img-clear').onclick=()=>{state.bgImage=null;pushHistory();render();};
      const sp=document.getElementById('p-split');sp.value=state.splitMode||'none';sp.onchange=e=>{state.splitMode=e.target.value;render();};
      const spc=document.getElementById('p-split-chars');spc.value=state.splitChars||180;document.getElementById('p-split-chars-v').innerText=state.splitChars||180;
      spc.oninput=e=>{state.splitChars=+e.target.value;document.getElementById('p-split-chars-v').innerText=e.target.value;render();};
      return;
    }
    // Bloc sélectionné
    const layer = state.layers.find(l=>l.id===selected);
    if(!layer){propsPanel.innerHTML='<p class="se-empty-note">Calque introuvable.</p>';return;}
    const s = layer.style || {};
    propsPanel.innerHTML = `
      <h4>${layer.name} <span class="se-type">${layer.type}</span></h4>
      <div class="se-toolbar">
        <button class="se-tbtn" data-cmd="bold" title="Gras"><b>B</b></button>
        <button class="se-tbtn" data-cmd="italic" title="Italique"><i>I</i></button>
        <button class="se-tbtn" data-cmd="underline" title="Souligné">U</button>
        <button class="se-tbtn" data-cmd="strike" title="Barré">S</button>
        <span style="width:1px;background:#333;margin:0 4px"></span>
        <button class="se-tbtn" data-align="left" title="Gauche">⯇</button>
        <button class="se-tbtn" data-align="center" title="Centre">≡</button>
        <button class="se-tbtn" data-align="right" title="Droite">⯈</button>
      </div>
      ${layer.type==='text' ? `
      <div class="se-row"><label>Couleur</label><input type="color" id="p-color"></div>
      <div class="se-row"><label>Police</label><select id="p-font" class="se-select">
        <option>Cinzel</option><option>Merriweather</option><option>Poppins</option><option>Inter</option><option>Montserrat</option><option>Georgia</option><option>Arial</option>
      </select></div>
      <div class="se-row"><label>Taille</label><input type="range" id="p-size" min="14" max="120"><span id="p-size-v"></span></div>
      <div class="se-row"><label>Graisse</label><select id="p-weight" class="se-select">
        <option value="300">Light</option><option value="400">Regular</option><option value="600">Semibold</option>
        <option value="700">Bold</option><option value="800">Black</option>
      </select></div>
      <div class="se-row"><label>Crénage</label><input type="range" id="p-spacing" min="0" max="20"><span id="p-spacing-v"></span></div>
      <div class="se-row"><label>Ombre</label><input type="range" id="p-shadow" min="0" max="24"><span id="p-shadow-v"></span></div>
      ` : ''}
      <hr style="border-color:#222;margin:10px 0">
      <h4>Position (%)</h4>
      <div class="se-row"><label>X</label><input type="number" id="p-x" step="0.5" min="0" max="100"><span>%</span></div>
      <div class="se-row"><label>Y</label><input type="number" id="p-y" step="0.5" min="0" max="100"><span>%</span></div>
      <div class="se-row"><label>Largeur</label><input type="number" id="p-w" step="0.5" min="1" max="100"><span>%</span></div>
      <div class="se-row"><label>Hauteur</label><input type="number" id="p-h" step="0.5" min="1" max="100"><span>%</span></div>
    `;
    const bind = (id, set, get) => { const el=document.getElementById(id); if(!el)return; if(get)get(el); el.oninput=e=>{set(e.target.value);pushHistory();render();}; };
    if(layer.type==='text'){
      document.getElementById('p-color').value=Engine.rgbToHex(s.color||'#fff');
      document.getElementById('p-color').oninput=e=>{s.color=e.target.value;render();};
      document.getElementById('p-font').value=s.fontFamily||'Merriweather';
      document.getElementById('p-font').onchange=e=>{s.fontFamily=e.target.value;pushHistory();render();};
      const sz=document.getElementById('p-size');sz.value=s.fontSize||50;document.getElementById('p-size-v').innerText=s.fontSize||50;sz.oninput=e=>{s.fontSize=+e.target.value;document.getElementById('p-size-v').innerText=e.target.value;render();};
      document.getElementById('p-weight').value=s.weight||600;document.getElementById('p-weight').onchange=e=>{s.weight=+e.target.value;s.bold=+e.target.value>=700;pushHistory();render();};
      const sp=document.getElementById('p-spacing');sp.value=s.letterSpacing||0;document.getElementById('p-spacing-v').innerText=s.letterSpacing||0;sp.oninput=e=>{s.letterSpacing=+e.target.value;document.getElementById('p-spacing-v').innerText=e.target.value;render();};
      const sh=document.getElementById('p-shadow');sh.value=s.shadow||0;document.getElementById('p-shadow-v').innerText=s.shadow||0;sh.oninput=e=>{s.shadow=+e.target.value;document.getElementById('p-shadow-v').innerText=e.target.value;render();};
      document.querySelectorAll('[data-cmd]').forEach(b=>b.classList.toggle('active', !!(s[b.dataset.cmd]==='bold'?s.bold:s[b.dataset.cmd])));
      document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{const c=b.dataset.cmd;if(c==='bold'){s.bold=!s.bold;s.weight=s.bold?700:(s.weight>=700?600:s.weight);}else s[c]=!s[c];pushHistory();render();});
      document.querySelectorAll('[data-align]').forEach(b=>b.classList.toggle('active',b.dataset.align===(s.align||'center')));
      document.querySelectorAll('[data-align]').forEach(b=>b.onclick=()=>{s.align=b.dataset.align;pushHistory();render();});
    }
    document.getElementById('p-x').value=Math.round(layer.x*10)/10;document.getElementById('p-x').oninput=e=>{layer.x=+e.target.value;render();};
    document.getElementById('p-y').value=Math.round(layer.y*10)/10;document.getElementById('p-y').oninput=e=>{layer.y=+e.target.value;render();};
    document.getElementById('p-w').value=Math.round(layer.w*10)/10;document.getElementById('p-w').oninput=e=>{layer.w=+e.target.value;render();};
    const hi=document.getElementById('p-h');hi.value=layer.h?Math.round(layer.h*10)/10:'';hi.oninput=e=>{layer.h=e.target.value?+e.target.value:null;render();};
  }

  // Boutons
  $('#se-undo').onclick = undo;
  $('#se-reset').onclick = () => { if(!confirm('Réinitialiser ce preset ?'))return; Object.assign(state, Engine.defaultScene(currentPreset, kind)); pushHistory(); render(); };
  $('#se-cancel').onclick = () => modal.remove();
  $('#se-apply').onclick = () => { modal.remove(); onSave(JSON.parse(JSON.stringify(state))); };

  // Raccourcis
  const keyHandler = (e) => {
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;
    if(e.key==='Escape'){modal.remove();return;}
    if(!selected)return;
    const layer=state.layers.find(l=>l.id===selected);if(!layer)return;
    const step=e.shiftKey?5:1;
    if(e.key==='ArrowLeft'){layer.x=Math.max(layer.w/2,layer.x-step);render();e.preventDefault();}
    else if(e.key==='ArrowRight'){layer.x=Math.min(100-layer.w/2,layer.x+step);render();e.preventDefault();}
    else if(e.key==='ArrowUp'){layer.y=Math.max((layer.h||10)/2,layer.y-step);render();e.preventDefault();}
    else if(e.key==='ArrowDown'){layer.y=Math.min(100-(layer.h||10)/2,layer.y+step);render();e.preventDefault();}
    else if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')){undo();e.preventDefault();}
    else if(e.key==='Delete'||e.key==='Backspace'){layer.visible=false;selected=null;pushHistory();render();e.preventDefault();}
  };
  document.addEventListener('keydown',keyHandler);
  new MutationObserver(()=>{}).observe(modal,{childList:false});
  modal._cleanup = ()=>document.removeEventListener('keydown',keyHandler);
  modal.addEventListener('remove',modal._cleanup);

  requestAnimationFrame(render);
  return modal;
}

function buildModal() {
  const d = document.createElement('div');
  d.className = 'se-modal';
  d.innerHTML = `
    <div class="se-topbar">
      <div class="se-title">✨ Éditeur visuel <span id="se-kind" style="color:#c4b5fd;font-weight:500;font-size:12px;margin-left:8px;"></span></div>
      <div class="se-presets" id="se-presets"></div>
      <div class="se-actions">
        <button class="se-btn ghost" id="se-undo">↶ Annuler</button>
        <button class="se-btn danger" id="se-reset">⟲ Reset</button>
        <button class="se-btn ghost" id="se-cancel">Annuler</button>
        <button class="se-btn primary" id="se-apply">✨ Appliquer</button>
      </div>
    </div>
    <div class="se-body">
      <aside class="se-left">
        <div class="se-panel">
          <h5>Calques</h5>
          <div id="se-layers" class="se-layers"></div>
          <p class="se-hint">👁 pour masquer · clique pour sélectionner</p>
        </div>
      </aside>
      <main class="se-canvas-wrap">
        <div class="se-canvas checker-bg" id="se-canvas">
          <div id="se-canvas-inner" style="position:absolute;inset:0;"></div>
          <div class="se-hint-bottom">Glissez les blocs · Poignées aux coins · Flèches = 1% (Shift = 5%) · Ctrl+Z</div>
        </div>
      </main>
      <aside class="se-right" id="se-props"></aside>
    </div>`;
  // Injecter le CSS si pas déjà fait
  if (!document.getElementById('se-style')) {
    const s = document.createElement('style'); s.id='se-style';
    s.textContent = `
    .se-modal{position:fixed;inset:0;z-index:1000;background:rgba(5,8,15,.94);backdrop-filter:blur(14px);display:flex;flex-direction:column;color:#f1f5f9;font-family:Inter,system-ui,sans-serif;}
    .se-topbar{background:linear-gradient(90deg,#1e1b4b,#312e81);padding:10px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,.1);}
    .se-title{font-size:14px;font-weight:800;color:#fff;}
    .se-presets{display:flex;gap:4px;flex:1;margin-left:20px;}
    .se-tab{padding:5px 14px;background:#1e1b4b;border:1px solid #4c1d95;color:#c4b5fd;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:.3px;}
    .se-tab.active{background:linear-gradient(90deg,#8b5cf6,#a78bfa);color:#fff;border-color:#a78bfa;}
    .se-actions{display:flex;gap:8px;}
    .se-btn{padding:6px 14px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid transparent;}
    .se-btn.primary{background:linear-gradient(90deg,#8b5cf6,#a78bfa);color:#fff;}.se-btn.primary:hover{box-shadow:0 0 15px rgba(139,92,246,.5);}
    .se-btn.ghost{background:#1e1b4b;color:#c4b5fd;border-color:#4c1d95;}
    .se-btn.danger{background:transparent;color:#fca5a5;border-color:#7f1d1d;}
    .se-body{flex:1;display:grid;grid-template-columns:240px 1fr 280px;gap:0;overflow:hidden;}
    .se-left,.se-right{padding:12px;overflow-y:auto;background:#0d0d14;border-right:1px solid #1a1a24;}
    .se-right{border-right:none;border-left:1px solid #1a1a24;}
    .se-canvas-wrap{display:flex;align-items:center;justify-content:center;padding:20px;overflow:hidden;}
    .se-canvas{position:relative;aspect-ratio:16/9;width:100%;max-width:100%;max-height:100%;border-radius:6px;box-shadow:0 30px 80px rgba(0,0,0,.7);overflow:hidden;}
    #se-canvas-inner{transform-origin:center center;}
    .se-panel{background:#15151f;border:1px solid #1d1d2b;border-radius:8px;padding:10px 12px;}
    .se-panel h5{font-size:10px;font-weight:800;color:#c4b5fd;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;}
    .se-layer{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:4px;font-size:12px;color:#cbd5e1;cursor:pointer;margin-bottom:2px;}
    .se-layer:hover{background:#1d1d2b;}
    .se-layer.active{background:rgba(139,92,246,.15);color:#c4b5fd;}
    .se-layer.hidden{opacity:.4;}
    .se-eye,.se-lock{width:20px;text-align:center;cursor:pointer;font-size:12px;}
    .se-name{flex:1;}
    .se-type{font-size:9px;color:#64748b;margin-left:4px;text-transform:uppercase;font-weight:800;}
    .se-hint{font-size:10px;color:#475569;margin-top:8px;}
    .se-row{display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:11px;color:#cbd5e1;}
    .se-row label{flex:1;color:#94a3b8;}
    .se-row input[type=number]{width:55px;background:#0b0b12;border:1px solid #2a2a3c;color:#fff;border-radius:3px;padding:3px 5px;font-size:11px;}
    .se-row input[type=range]{flex:1;accent-color:#a78bfa;}
    .se-row span{width:36px;text-align:right;color:#c4b5fd;font-size:10px;font-variant-numeric:tabular-nums;}
    .se-row input[type=color]{width:26px;height:22px;border:none;background:transparent;padding:0;}
    .se-select{width:100%;background:#0b0b12;border:1px solid #2a2a3c;color:#fff;padding:4px 6px;border-radius:3px;font-size:11px;margin-bottom:4px;}
    .se-toolbar{display:flex;gap:2px;padding:4px;background:#0b0b12;border-radius:4px;margin-bottom:10px;}
    .se-tbtn{width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:#cbd5e1;border-radius:3px;cursor:pointer;font-weight:700;font-size:12px;}
    .se-tbtn:hover{background:#1d1d2b;}
    .se-tbtn.active{background:#a78bfa;color:#000;}
    .se-check{display:flex;align-items:center;gap:8px;font-size:11px;color:#cbd5e1;margin-top:8px;}
    .se-empty h4{font-size:11px;font-weight:800;color:#c4b5fd;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;}
    .se-empty-note{font-size:11px;color:#64748b;margin-top:14px;line-height:1.5;}
    .se-hint-bottom{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:10px;color:#334155;font-family:monospace;background:rgba(0,0,0,.5);padding:3px 10px;border-radius:4px;pointer-events:none;z-index:20;}
    .handle{background:#c4b5fd!important;}
    .blk.selected{outline:2px solid #c4b5fd!important;outline-offset:2px;}
    hr{border:none;border-top:1px solid #1d1d2b;margin:8px 0;}
    `;
    document.head.appendChild(s);
  }
  return d;
}

export default { openSceneEditor };
