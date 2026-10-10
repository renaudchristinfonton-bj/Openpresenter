export const THEMES = [
  { id: 'cinema', name: 'Cinéma', accent: '#f5b942', bg1: '#05060a', bg2: '#19131a', panel: 'rgba(6,8,14,.55)', text: '#fff', radius: 22 },
  { id: 'warm', name: 'Chaleureux', accent: '#e99b56', bg1: '#160d08', bg2: '#382015', panel: 'rgba(25,14,8,.76)', text: '#fff8ed', radius: 20 },
  { id: 'modern', name: 'Moderne', accent: '#38bdf8', bg1: '#030712', bg2: '#0b1c2b', panel: 'rgba(3,11,22,.78)', text: '#f0f9ff', radius: 18 },
  { id: 'minimal', name: 'Minimal', accent: '#e2e8f0', bg1: '#030405', bg2: '#111318', panel: 'rgba(5,6,8,.68)', text: '#fff', radius: 2 },
  { id: 'neon', name: 'Néon', accent: '#e879f9', bg1: '#0b0312', bg2: '#20092a', panel: 'rgba(15,3,23,.82)', text: '#fff', radius: 20 },
  { id: 'sobre', name: 'Sobre', accent: '#f59e0b', bg1: '#0f172a', bg2: '#1e293b', panel: 'rgba(15,23,42,.95)', text: '#ffffff', radius: 20 },
  { id: 'festif', name: 'Festif', accent: '#facc15', bg1: '#4c1d95', bg2: '#1e1b4b', panel: 'rgba(76,29,149,.95)', text: '#ffffff', radius: 32 },
  { id: 'careme', name: 'Carême', accent: '#94a3b8', bg1: '#020617', bg2: '#0f172a', panel: 'rgba(2,6,23,.96)', text: '#e2e8f0', radius: 0 },
  { id: 'noel', name: 'Noël', accent: '#ef4444', bg1: '#022c22', bg2: '#064e3b', panel: 'rgba(2,44,34,.95)', text: '#ffffff', radius: 24 },
  { id: 'aube', name: 'Aube', accent: '#b45309', bg1: '#faf8f2', bg2: '#f1e9dc', panel: 'rgba(250,248,242,.96)', text: '#1e293b', radius: 28 },
  { id: 'mission', name: 'Mission', accent: '#2dd4bf', bg1: '#042f2e', bg2: '#134e4a', panel: 'rgba(4,47,46,.95)', text: '#ffffff', radius: 16 },
];

export function getTheme(id = 'cinema') {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
}

export function applyThemeToScene(scene, id = 'cinema') {
  const theme = getTheme(id);
  scene.themeId = theme.id;
  scene.accentColor = theme.accent;
  scene.textColor = theme.text;
  scene.bgColor = theme.bg1;
  scene.shapeRadius = theme.radius ?? scene.shapeRadius ?? 20;
  for (const layer of scene.layers || []) {
    if (layer.type === 'background' && layer.source?.kind === 'gradient') {
      layer.source.color1 = theme.bg1;
      layer.source.color2 = theme.bg2;
    }
    if (layer.type === 'overlay') {
      layer.bg = theme.panel;
      if (theme.radius !== undefined) layer.radius = theme.radius;
      if (layer.border?.width) layer.border.color = theme.accent;
    }
    if (layer.type === 'text') {
      const binding = layer.bind;
      const name = String(layer.name || '').toLowerCase();
      if (binding === 'ref' || name.includes('titre') || name.includes('référence')) layer.style.color = theme.accent;
      else if (binding === 'badge' || binding === 'section') {
        layer.style.bg = theme.accent;
        layer.style.color = '#101116';
      } else layer.style.color = theme.text;
    }
  }
  return scene;
}
