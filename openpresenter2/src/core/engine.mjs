// ============================================================
//  OPENPRESENTER ENGINE
//  Moteur de rendu de scène à calques — WYSIWYG garanti.
//  Le même objet "scene" est rendu à l'identique dans :
//    • l'éditeur visuel (avec poignées de sélection/resize)
//    • la preview du contrôleur
//    • la sortie OBS (obs/output.html)
//    • la vue pasteur/stage
//  Le rendu produit des éléments DOM natifs (pas de innerHTML),
//  il n'y a donc JAMAIS de décalage entre les contextes.
// ============================================================

const Engine = (() => {

  // --- Création d'un calque par type ---
  function createLayer(type, opts = {}) {
    const base = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'l_' + Math.random().toString(36).slice(2, 9),
      type, visible: true, locked: false, opacity: 1,
      x: 50, y: 50, w: 80, h: 20, rotate: 0, anchor: 'center-center',
      name: type,
    };
    if (type === 'background') Object.assign(base, {
      name: 'Fond', x: 50, y: 50, w: 100, h: 100, anchor: 'center-center',
      source: { kind: 'gradient', color1: '#0a0a0f', color2: '#1a1a24', image: null, video: null, blur: 0, cover: true },
    });
    if (type === 'overlay') Object.assign(base, {
      name: 'Cadre', x: 50, y: 50, w: 95, h: 90, anchor: 'center-center',
      bg: 'rgba(10,10,15,0.88)', border: { width: 0, color: '#f59e0b', sides: [] }, radius: 24,
    });
    if (type === 'text') Object.assign(base, {
      name: 'Texte',
      x: 50, y: 55, w: 80, h: 60, anchor: 'center-center',
      bind: 'verse', // 'verse' | 'ref' | 'badge' | 'title' | 'section' | 'lyrics' | 'custom'
      customText: '',
      style: {
        fontFamily: 'Merriweather', fontSize: 64, weight: 600, color: '#ffffff',
        align: 'center', letterSpacing: 0, lineHeight: 1.35,
        italic: false, bold: false, underline: false, strike: false,
        shadow: 6, padding: 0, bg: null,
      },
      autoFit: { min: 20, max: 110, scaleDown: true },
    });
    if (type === 'image') Object.assign(base, {
      name: 'Image', x: 50, y: 50, w: 100, h: 100, anchor: 'center-center',
      src: null, fit: 'cover', opacity: 1,
    });
    return Object.assign(base, opts);
  }

  // --- Création d'un preset de scène (mode) par défaut ---
  function defaultScene(preset, kind /* 'bible' | 'songs' */) {
    const accent = kind === 'songs' ? '#a78bfa' : '#f59e0b';
    const bodyFont = kind === 'songs' ? 'Poppins' : 'Merriweather';
    const titleFont = 'Cinzel';
    const titleColor = accent;
    const titleText = kind === 'songs' ? '🎵 Titre du chant' : '📖 Jean 3:16';
    const bodyText = kind === 'songs'
      ? 'Quel ami fidèle et tendre,\nQue de se reposer sur Toi !'
      : '« Car Dieu a tant aimé le monde qu\'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu\'il ait la vie éternelle. »';
    const badgeText = kind === 'songs' ? 'Refrain' : 'LSG';
    const badgeBind = kind === 'songs' ? 'section' : 'badge';
    const titleBind = kind === 'songs' ? 'title' : 'ref';
    const bodyBind = kind === 'songs' ? 'lyrics' : 'verse';

    if (preset === 'full') return {
      name: 'Plein écran', preset: 'full', kind,
      bgColor: 'rgba(10,10,15,0.95)', accentColor: accent, textColor: '#ffffff',
      shapeRadius: 24, bgOpacity: 95, transparent: false, bgCover: false,
      splitMode: 'none', splitChars: 220, splitByLines: true,
      bgImage: null,
      layers: [
        createLayer('background', { name:'Fond', w:100, h:100 }),
        createLayer('overlay',    { name:'Cadre', w:96, h:92, bg:'rgba(10,10,15,0.88)', border:{width:2,color:accent,sides:['top','bottom']}, radius:24 }),
        createLayer('text',       { name:'Titre', bind:titleBind, x:50, y:10, w:80, h:8, style:{fontFamily:titleFont,fontSize:44,weight:800,color:titleColor,align:'center',shadow:2} }),
        createLayer('text',       { name:'Badge', bind:badgeBind, x:62, y:10, w:14, h:5, style:{fontFamily:'Inter',fontSize:22,weight:800,color:'#000',align:'center',bg:accent,shadow:0,padding:8} }),
        createLayer('text',       { name:'Contenu', bind:bodyBind, x:50, y:56, w:82, h:65, style:{fontFamily:bodyFont,fontSize:kind==='songs'?68:72,weight:600,color:'#fff',align:'center',shadow:6,lineHeight:1.35} }),
      ]
    };
    if (preset === 'screen80') return {
      name: '80% écran', preset: 'screen80', kind,
      bgColor: 'rgba(10,10,15,0.92)', accentColor: accent, textColor: '#ffffff',
      shapeRadius: 20, bgOpacity: 92, transparent: false, bgCover: false,
      splitMode: 'none', splitChars: 200, splitByLines: true,
      bgImage: null,
      layers: [
        createLayer('background', { w:100, h:100 }),
        createLayer('overlay',    { x:50, y:50, w:80, h:80, bg:'rgba(10,10,15,0.92)', border:{width:6,color:accent,sides:['top','bottom']}, radius:20 }),
        createLayer('text',       { bind:titleBind, x:50, y:12, w:80, h:8, style:{fontFamily:titleFont,fontSize:40,weight:800,color:titleColor,align:'center',shadow:2} }),
        createLayer('text',       { bind:badgeBind, x:62, y:12, w:14, h:5, style:{fontFamily:'Inter',fontSize:20,weight:800,color:'#000',align:'center',bg:accent} }),
        createLayer('text',       { bind:bodyBind, x:50, y:56, w:82, h:68, style:{fontFamily:bodyFont,fontSize:kind==='songs'?58:62,weight:600,color:'#fff',align:'center',shadow:6} }),
      ]
    };
    if (preset === 'bottom') return {
      name: 'Bandeau bas', preset: 'bottom', kind,
      bgColor: 'rgba(10,10,15,0.92)', accentColor: accent, textColor: '#ffffff',
      shapeRadius: 16, bgOpacity: 92, transparent: false, bgCover: false,
      splitMode: 'auto', splitChars: kind==='songs'?100:160, splitByLines: true,
      bgImage: null,
      layers: [
        createLayer('background', { w:100, h:100 }),
        createLayer('overlay',    { x:50, y:87, w:80, h:22, bg:'rgba(10,10,15,0.92)', border:{width:8,color:accent,sides:['left']}, radius:16 }),
        createLayer('text',       { bind:titleBind, x:50, y:96, w:70, h:6, style:{fontFamily:'Poppins',fontSize:18,weight:600,color:'#94a3b8',align:'center',shadow:1,letterSpacing:1} }),
        createLayer('text',       { bind:badgeBind, x:16, y:80, w:20, h:14, style:{fontFamily:'Inter',fontSize:18,weight:700,color:'#fff',align:'center',bg:accent} }),
        createLayer('text',       { bind:bodyBind, x:50, y:87, w:72, h:16, style:{fontFamily:bodyFont,fontSize:kind==='songs'?38:42,weight:600,color:'#fff',align:kind==='songs'?'center':'left',shadow:4,lineHeight:1.3} }),
      ]
    };
    if (preset === 'bottom-right') return {
      name: 'Bandeau droite', preset: 'bottom-right', kind,
      bgColor: 'rgba(10,10,15,0.92)', accentColor: accent, textColor: '#ffffff',
      shapeRadius: 16, bgOpacity: 92, transparent: false, bgCover: false,
      splitMode: 'auto', splitChars: kind==='songs'?100:160, splitByLines: true,
      bgImage: null,
      layers: [
        createLayer('background', { w:100, h:100 }),
        createLayer('overlay',    { x:78, y:87, w:42, h:22, bg:'rgba(10,10,15,0.92)', border:{width:8,color:accent,sides:['right']}, radius:16 }),
        createLayer('text',       { bind:titleBind, x:78, y:96, w:40, h:6, style:{fontFamily:'Poppins',fontSize:18,weight:600,color:'#94a3b8',align:'right',shadow:1} }),
        createLayer('text',       { bind:badgeBind, x:58, y:80, w:12, h:14, style:{fontFamily:'Inter',fontSize:18,weight:700,color:'#fff',align:'center',bg:accent} }),
        createLayer('text',       { bind:bodyBind, x:78, y:87, w:40, h:16, style:{fontFamily:bodyFont,fontSize:kind==='songs'?36:40,weight:600,color:'#fff',align:'right',shadow:4} }),
      ]
    };
    if (preset === 'lowerthird') return {
      name: 'Lower third', preset: 'lowerthird', kind,
      bgColor: 'rgba(0,0,0,0)', accentColor: accent, textColor: '#ffffff',
      shapeRadius: 8, bgOpacity: 0, transparent: true, bgCover: false,
      splitMode: 'none', splitChars: 160, splitByLines: false,
      bgImage: null,
      layers: [
        createLayer('background', { visible:false, w:100, h:100 }),
        createLayer('overlay',    { x:28, y:90, w:50, h:14, bg:'rgba(0,0,0,0.75)', border:{width:4,color:accent,sides:['left']}, radius:8 }),
        createLayer('text',       { bind:titleBind, x:30, y:93, w:45, h:5, style:{fontFamily:'Inter',fontSize:20,weight:700,color:accent,align:'left',shadow:0} }),
        createLayer('text',       { bind:bodyBind, x:30, y:90, w:45, h:10, visible:false, style:{fontFamily:bodyFont,fontSize:0} }),
      ]
    };
    return defaultScene('full', kind);
  }

  // --- Conversion de chaînes de couleur ---
  function hexToRgba(hex, a){
    if (!hex) return `rgba(0,0,0,${a})`;
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    let h=hex.replace('#',''); if(h.length===3)h=h.split('').map(c=>c+c).join('');
    const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function rgbToHex(col){
    if(!col)return'#000000';if(col.startsWith('#'))return col;
    const m=col.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(!m)return'#000000';
    return '#'+[m[1],m[2],m[3]].map(n=>{const h=parseInt(n).toString(16);return h.length===1?'0'+h:h;}).join('');
  }

  // --- Rendu de la scène dans un conteneur DOM ---
  // bindings : objet { verse: "...", ref: "...", badge: "...", ... } selon le module
  // options : { selected, onSelectLayer, onDrag, onResize, scale }
  function render(scene, container, bindings = {}, options = {}) {
    if (!container) return;
    container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'scene-root';
    root.dataset.preset = scene.preset || '';
    root.style.setProperty('--bg-color', scene.transparent ? 'transparent' : scene.bgColor);
    root.style.setProperty('--accent-color', scene.accentColor);
    root.style.setProperty('--text-color', scene.textColor);
    root.style.setProperty('--shape-radius', (scene.shapeRadius||0) + 'px');
    if (scene.transparent) root.classList.add('obs-transparent');
    if (scene.bgCover) root.classList.add('has-bg-cover');
    if (bindings.parts && bindings.parts.length > 1 && scene.splitMode==='auto') root.classList.add('has-parts');
    container.appendChild(root);

    scene.layers.forEach((layer) => {
      if (!layer.visible) return;
      const el = buildLayer(layer, bindings, options, scene);
      if (el) root.appendChild(el);
    });

    // Auto-fit du texte après rendu
    requestAnimationFrame(() => autoFitText(root));
    return root;
  }

  function buildLayer(layer, bindings, options, scene) {
    let el;
    if (layer.type === 'background') {
      el = document.createElement('div');
      el.className = 'layer-bg-image';
      const src = scene.bgImage || (layer.source && layer.source.image);
      if (src) {
        el.style.backgroundImage = `url('${src}')`;
        el.style.backgroundSize = (layer.source && layer.source.cover) || scene.bgCover ? 'cover' : 'contain';
        el.style.backgroundPosition = 'center';
        el.style.filter = `blur(${(layer.source && layer.source.blur) || 0}px)`;
      } else {
        el.style.background = `linear-gradient(135deg, ${layer.source.color1}, ${layer.source.color2})`;
      }
      el.style.opacity = layer.opacity;
    }
    else if (layer.type === 'overlay') {
      el = document.createElement('div');
      el.className = 'layer-overlay';
      el.style.background = layer.bg;
      el.style.borderRadius = (layer.radius||0) + 'px';
      if (layer.border && layer.border.width > 0) {
        const sides = layer.border.sides || [];
        ['top','right','bottom','left'].forEach(s=>{
          if(sides.includes(s)) el.style['border'+s[0].toUpperCase()+s.slice(1)] = `${layer.border.width}px solid ${layer.border.color}`;
        });
      }
    }
    else if (layer.type === 'image') {
      if (!layer.src) return null;
      el = document.createElement('div');
      el.className = 'layer-image';
      el.style.backgroundImage = `url('${layer.src}')`;
      el.style.backgroundSize = layer.fit === 'cover' ? 'cover' : 'contain';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.opacity = layer.opacity;
      positionLayer(el, layer);
    }
    else if (layer.type === 'text') {
      el = document.createElement('div');
      const s = layer.style || {};
      el.className = 'blk blk-text blk-align-' + (s.align||'center');
      // Texte à afficher
      let text = layer.customText || '';
      if (layer.bind && bindings[layer.bind] != null) text = bindings[layer.bind];
      if (text == null) text = '';
      // Multi-lignes
      const lines = String(text).split('\n').filter(l=>l.length>0);
      el.innerHTML = lines.map(l => `<span class="line">${escapeHtml(l)}</span>`).join('');
      applyTextStyle(el, s);
      positionLayer(el, layer);
    }
    if (!el) return null;
    el.dataset.layerId = layer.id;
    el.style.opacity = layer.opacity;
    // Sélection / édition (éditeur)
    if (options.interactive) installInteraction(el, layer, options);
    if (options.selected === layer.id) {
      el.classList.add('selected');
      addHandles(el, layer, options);
    }
    return el;
  }

  function positionLayer(el, layer) {
    el.style.left = layer.x + '%';
    el.style.top  = layer.y + '%';
    el.style.width = layer.w + '%';
    if (layer.h) el.style.height = layer.h + '%';
    else el.style.height = 'auto';
  }

  function applyTextStyle(el, s) {
    el.style.fontFamily = `'${s.fontFamily||'Merriweather'}', serif`;
    el.style.fontSize = (s.fontSize||48) + 'px';
    el.style.fontWeight = s.bold ? 700 : (s.weight||400);
    el.style.color = s.color||'#fff';
    el.style.textAlign = s.align||'center';
    el.style.letterSpacing = (s.letterSpacing||0) + 'px';
    el.style.lineHeight = s.lineHeight||1.35;
    const sh = s.shadow||0;
    el.style.textShadow = sh>0 ? `0 ${sh/2}px ${sh}px rgba(0,0,0,${0.3+sh/30})` : 'none';
    el.style.fontStyle = s.italic ? 'italic' : 'normal';
    el.style.textDecoration = [s.underline?'underline':'',s.strike?'line-through':''].filter(Boolean).join(' ') || 'none';
    el.style.padding = (s.padding||0) + 'px';
    if (s.bg) { el.style.background = s.bg; el.style.borderRadius = '999px'; el.style.padding = `${(s.fontSize||48)*0.25}px ${(s.fontSize||48)*0.9}px`; }
    // flex enfant : lignes
    el.style.display = 'flex'; el.style.flexDirection='column'; el.style.alignItems = alignItems(s.align); el.style.justifyContent='center';
  }
  function alignItems(a){ return a==='left'?'flex-start':a==='right'?'flex-end':'center'; }

  function escapeHtml(str){return String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  // Auto-downscale du bloc texte si son contenu dépasse
  function autoFitText(root) {
    root.querySelectorAll('.blk-text').forEach(blk=>{
      blk.style.transform = 'translate(-50%,-50%)';
      const need = blk.scrollHeight, have = blk.clientHeight;
      if (need > have * 1.01 && have > 0) {
        const s = Math.max(0.35, have/need);
        blk.style.transform = `translate(-50%,-50%) scale(${s})`;
      }
    });
  }

  // --- Interaction (drag/resize dans l'éditeur) ---
  function installInteraction(el, layer, options) {
    if (layer.locked) return;
    el.style.cursor = 'move';
    el.addEventListener('mousedown', (e)=>{
      if (e.target.classList.contains('handle')) return;
      if (options.onSelectLayer) options.onSelectLayer(layer.id);
      startDrag(e, layer, options, 'move');
    });
  }
  function addHandles(el, layer, options) {
    ['nw','ne','sw','se'].forEach(dir=>{
      const h = document.createElement('div');
      h.className = 'handle ' + dir;
      h.dataset.dir = dir;
      h.addEventListener('mousedown',(e)=>{e.stopPropagation();startDrag(e,layer,options,'resize',dir);});
      el.appendChild(h);
    });
  }
  let dragCtx = null;
  function startDrag(e, layer, options, kind, dir) {
    e.preventDefault();
    dragCtx = { kind, dir, layer, startX: e.clientX, startY: e.clientY, startLayer: {...layer} };
    const move = (ev)=>{
      const rect = options.containerRect();
      const dx = (ev.clientX - dragCtx.startX)/rect.w*100;
      const dy = (ev.clientY - dragCtx.startY)/rect.h*100;
      if (kind==='move') {
        layer.x = clamp(dragCtx.startLayer.x + dx, layer.w/2, 100-layer.w/2);
        layer.y = clamp(dragCtx.startLayer.y + dy, (layer.h||10)/2, 100-(layer.h||10)/2);
      } else {
        if (dir.includes('e')) layer.w = clamp(dragCtx.startLayer.w + dx*2, 5, 98);
        if (dir.includes('s')) layer.h = clamp((dragCtx.startLayer.h||20) + dy*2, 3, 95);
      }
      if (options.onChange) options.onChange();
    };
    const up = ()=>{ window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up); dragCtx=null; if(options.onCommit)options.onCommit(); };
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

  return {
    createLayer,
    defaultScene,
    render,
    hexToRgba, rgbToHex,
    // Split intelligent à la ponctuation
    splitSmart(text, maxChars) {
      text = String(text||'').trim(); if(!text||text.length<=maxChars)return[text];
      const punct=/[.!?,;:—–\-/]/g;const parts=[];let rest=text;
      while(rest.length>maxChars){let cut=-1;const w=rest.slice(0,maxChars);let m;
        punct.lastIndex=Math.floor(maxChars*0.4);
        while((m=punct.exec(w))!==null){if(m.index>maxChars*0.4)cut=m.index+1;}
        if(cut<0)cut=w.lastIndexOf('\n');
        if(cut<0)cut=w.lastIndexOf(' ');
        if(cut<maxChars*0.4)cut=maxChars;
        parts.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trim();}
      if(rest)parts.push(rest);return parts;
    }
  };
})();

// Le rendu DOM des calques nécessite ces classes :
// Injection CSS seulement en contexte navigateur
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
style.textContent = `
.scene-root{position:absolute;inset:0;overflow:hidden;}
.scene-root[data-preset="full"] .layer-overlay{position:absolute;top:3.7%;left:2.08%;width:95.84%;height:92.6%;}
.scene-root[data-preset="screen80"] .layer-overlay{position:absolute;top:10%;left:10%;width:80%;height:80%;}
.scene-root[data-preset="bottom"] .layer-overlay{position:absolute;bottom:5.56%;left:10%;width:80%;height:25%;}
.scene-root[data-preset="bottom-right"] .layer-overlay{position:absolute;bottom:5.56%;right:3%;width:42%;height:25%;}
.scene-root[data-preset="lowerthird"] .layer-overlay{position:absolute;}
.scene-root:not([data-preset]) .layer-overlay{position:absolute;inset:0;}
.scene-root.obs-transparent .layer-overlay{background:transparent!important;border-color:transparent!important;}
.scene-root.has-bg-cover .layer-bg-image{position:absolute;inset:0;z-index:0;}
.scene-root:not(.has-bg-cover) .layer-bg-image{position:absolute;}
.layer-bg-image{position:absolute;inset:0;z-index:0;background-size:cover;background-position:center;}
.layer-overlay{z-index:1;pointer-events:none;}
.layer-image{position:absolute;transform:translate(-50%,-50%);z-index:2;}
.blk{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);margin:0;box-sizing:border-box;z-index:3;white-space:pre-line;}
.blk .line{display:block;}.blk .line + .line{margin-top:.35em;}
.blk.selected{outline:2px solid #fbbf24;outline-offset:2px;}
.handle{position:absolute;width:10px;height:10px;background:#fbbf24;border:1px solid #000;border-radius:2px;z-index:10;}
.handle.nw{left:-5px;top:-5px;cursor:nwse-resize;}
.handle.ne{right:-5px;top:-5px;cursor:nesw-resize;}
.handle.sw{left:-5px;bottom:-5px;cursor:nesw-resize;}
.handle.se{right:-5px;bottom:-5px;cursor:nwse-resize;}
.scene-root.has-parts::before,.scene-root.has-parts::after{content:'';position:absolute;top:0;width:18%;height:100%;z-index:5;pointer-events:none;opacity:0;}
.scene-root.has-parts::before{left:0;background:linear-gradient(90deg,rgba(251,191,36,.25),transparent);}
.scene-root.has-parts::after{right:0;background:linear-gradient(-90deg,rgba(251,191,36,.25),transparent);}
.parts-hint{position:absolute;top:0;bottom:0;width:16%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.2);font-size:48px;font-weight:800;pointer-events:none;opacity:0;transition:opacity .2s;z-index:6;}
.parts-hint.left{left:0;}.parts-hint.right{right:0;}
.scene-root.has-parts:hover ~ .parts-hint,.scene-root.has-parts + .parts-hint{opacity:1;}
.has-parts:hover .parts-hint{opacity:1;}
`;
  document.head.appendChild(style);
}

export default Engine;
