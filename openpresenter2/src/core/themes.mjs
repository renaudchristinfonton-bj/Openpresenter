export const THEMES = [
  { id: 'cinema', name: 'Cinéma', accent: '#f5b942', bg1: '#05060a', bg2: '#19131a', panel: 'rgba(6,8,14,.55)', text: '#fff' },
  { id: 'warm', name: 'Chaleureux', accent: '#e99b56', bg1: '#160d08', bg2: '#382015', panel: 'rgba(25,14,8,.76)', text: '#fff8ed' },
  { id: 'modern', name: 'Moderne', accent: '#38bdf8', bg1: '#030712', bg2: '#0b1c2b', panel: 'rgba(3,11,22,.78)', text: '#f0f9ff' },
  { id: 'minimal', name: 'Minimal', accent: '#e2e8f0', bg1: '#030405', bg2: '#111318', panel: 'rgba(5,6,8,.68)', text: '#fff' },
  { id: 'neon', name: 'Néon', accent: '#e879f9', bg1: '#0b0312', bg2: '#20092a', panel: 'rgba(15,3,23,.82)', text: '#fff' },
];

export function getTheme(id = 'cinema') {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
}

export function applyThemeToScene(scene, id = 'cinema') {
  const theme = getTheme(id);
  const oldAccent = scene.accentColor;
  scene.themeId = theme.id;
  scene.accentColor = theme.accent;
  scene.textColor = theme.text;
  scene.bgColor = theme.bg1;
  for (const layer of scene.layers || []) {
    if (layer.type === 'background' && layer.source?.kind === 'gradient') {
      layer.source.color1 = theme.bg1;
      layer.source.color2 = theme.bg2;
    }
    if (layer.type === 'overlay') {
      layer.bg = theme.panel;
      if (layer.border?.width) layer.border.color = theme.accent;
    }
    if (layer.type === 'text') {
      const binding = layer.bind;
      const name = String(layer.name || '').toLowerCase();
      if (binding === 'ref' || name.includes('titre') || name.includes('référence')) layer.style.color = theme.accent;
      else if (binding === 'badge' || binding === 'section') {
        layer.style.bg = theme.accent;
        layer.style.color = '#101116';
      } else if (layer.style?.color === oldAccent) layer.style.color = theme.accent;
    }
  }
  return scene;
}
