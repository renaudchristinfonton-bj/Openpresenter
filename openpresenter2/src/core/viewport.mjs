export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;
export const FIT_MODES = Object.freeze(['contain', 'cover', 'stretch']);

export function computeViewport(width, height, fit = 'contain', canvasWidth = CANVAS_WIDTH, canvasHeight = CANVAS_HEIGHT) {
  const viewportWidth = Number(width);
  const viewportHeight = Number(height);
  const designWidth = Number(canvasWidth);
  const designHeight = Number(canvasHeight);
  if (![viewportWidth, viewportHeight, designWidth, designHeight].every(Number.isFinite)
    || viewportWidth <= 0 || viewportHeight <= 0 || designWidth <= 0 || designHeight <= 0) {
    throw new RangeError('Les dimensions du canevas doivent être des nombres positifs.');
  }
  const scaleX = viewportWidth / designWidth;
  const scaleY = viewportHeight / designHeight;
  const mode = FIT_MODES.includes(fit) ? fit : 'contain';
  if (mode === 'stretch') {
    return { scaleX, scaleY, offsetX: 0, offsetY: 0, viewportWidth, viewportHeight, mode };
  }
  const scale = mode === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  return {
    scaleX: scale,
    scaleY: scale,
    offsetX: (viewportWidth - designWidth * scale) / 2,
    offsetY: (viewportHeight - designHeight * scale) / 2,
    viewportWidth,
    viewportHeight,
    mode,
  };
}

export function resolveBrowserSourceViewport(cssWidth, cssHeight, sourceResolution) {
  const width = Number(cssWidth);
  const height = Number(cssHeight);
  // Layout and transforms run in CSS pixels. A high-DPI CEF viewport can report
  // 960×540 CSS px for a 1920×1080 Browser Source; promoting it to physical
  // pixels makes the 1920×1080 canvas twice as large and clips it to the
  // top-left quarter. Keep every valid CSS viewport as reported.
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return { width, height };
  const sourceWidth = Number(sourceResolution?.width);
  const sourceHeight = Number(sourceResolution?.height);
  if (Number.isFinite(sourceWidth) && Number.isFinite(sourceHeight) && sourceWidth > 0 && sourceHeight > 0) {
    return { width: sourceWidth, height: sourceHeight };
  }
  return { width: 1, height: 1 };
}

export function applyViewport(element, width, height, fit = 'contain') {
  const viewport = computeViewport(width, height, fit);
  element.style.width = `${CANVAS_WIDTH}px`;
  element.style.height = `${CANVAS_HEIGHT}px`;
  // Use explicit offsets and a top-left transform origin. Combining percentage
  // translations with a centered transform origin is browser/CEF-sensitive and
  // can leave a 1920×1080 canvas scaled into the top-left quarter of OBS.
  element.style.left = `${viewport.offsetX}px`;
  element.style.top = `${viewport.offsetY}px`;
  element.style.transformOrigin = 'top left';
  element.style.transform = `scale(${viewport.scaleX}, ${viewport.scaleY})`;
  element.dataset.fit = viewport.mode;
  element.dataset.scaleX = String(viewport.scaleX);
  element.dataset.scaleY = String(viewport.scaleY);
  element.dataset.offsetX = String(viewport.offsetX);
  element.dataset.offsetY = String(viewport.offsetY);
  return viewport;
}
