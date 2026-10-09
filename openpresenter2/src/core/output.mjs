import Engine from './engine.mjs';

const clone = (value) => structuredClone(value);

// A lock mode fixes the preset geometry without replacing user typography or color.
// If the scene already uses that preset, it is intentionally returned untouched:
// edited layer positions then remain exactly WYSIWYG across the controller and OBS.
export function applyLockedPreset(scene, preset) {
  if (!scene || !preset || preset === scene.preset) return scene;
  const layout = Engine.defaultScene(preset, scene.kind || 'bible');
  for (const property of ['themeId', 'accentColor', 'textColor', 'bgColor', 'shapeRadius', 'bgOpacity', 'transparent', 'bgCover', 'splitMode', 'splitChars', 'splitByLines']) {
    if (scene[property] !== undefined) layout[property] = scene[property];
  }
  const matchedSources = new Set();
  for (const layer of layout.layers) {
    const source = (scene.layers || []).find((item) => item.type === layer.type && item.name === layer.name && !matchedSources.has(item));
    if (!source) continue;
    matchedSources.add(source);
    // Only geometry is locked; all other per-layer properties follow the theme.
    for (const key of ['visible', 'locked', 'opacity', 'style', 'bind', 'customText', 'bg', 'border', 'radius']) {
      if (source[key] !== undefined) layer[key] = clone(source[key]);
    }
    if (layer.type === 'background' && source.source) layer.source = clone(source.source);
    if (layer.type === 'image') {
      for (const key of ['src', 'assetId', 'fit', 'alt']) if (source[key] !== undefined) layer[key] = source[key];
    }
  }
  // Keep decorative logos/images independently movable by the author, but do not
  // append built-in image layers a second time after their locked preset counterpart.
  for (const image of (scene.layers || []).filter((layer) => layer.type === 'image' && !matchedSources.has(layer))) {
    layout.layers.push(clone(image));
  }
  return layout;
}

export default { applyLockedPreset };
