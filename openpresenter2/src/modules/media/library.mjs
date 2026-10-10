export const MEDIA_TYPES = Object.freeze(['image', 'video', 'pdf', 'pptx']);
export const MEDIA_ACCEPT = 'image/*,video/*,application/pdf,.pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation';

export function detectMediaType(file) {
  const name = String(file?.name || '').trim();
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|webm|ogv|mov|m4v)$/i.test(name)) return 'video';
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
  if (mime.includes('presentationml') || /\.pptx$/i.test(name)) return 'pptx';
  return null;
}

export function normalizeMediaGroup(value) {
  return String(value || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60);
}

export function createMediaRecord(file, group = '', makeId = defaultMediaId) {
  const type = detectMediaType(file);
  if (!type) throw new TypeError(`Format média non pris en charge : ${file?.name || 'fichier inconnu'}`);
  const name = String(file.name || 'Média importé').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 180) || 'Média importé';
  return {
    id: makeId(), name, type, mime: file.type || '', size: Number(file.size) || 0,
    group: normalizeMediaGroup(group) || null, addedAt: Date.now(), assetId: null,
    cursor: 0, fit: 'contain', muted: true, loop: true,
  };
}

export function groupMediaItems(items, groups = []) {
  const names = [...new Set(groups.map(normalizeMediaGroup).filter(Boolean))];
  const buckets = new Map(names.map((name) => [name, []]));
  buckets.set('', []);
  for (const item of items || []) {
    const key = names.includes(normalizeMediaGroup(item.group)) ? normalizeMediaGroup(item.group) : '';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }
  return [...buckets.entries()].filter(([, records]) => records.length > 0);
}

export function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}

function color(value, fallback = '#000000') {
  return /^#[\da-f]{3,8}$/i.test(String(value || '')) ? String(value) : fallback;
}

export function pptxSlideToSvg(data, slide) {
  const width = Number(data?.widthEMU) || 12192000;
  const height = Number(data?.heightEMU) || 6858000;
  const background = color(slide?.background, '#ffffff');
  const shapes = (slide?.shapes || []).map((shape) => {
    const x = Number(shape.x) || 0; const y = Number(shape.y) || 0;
    const w = Math.max(0, Number(shape.w) || 0); const h = Math.max(0, Number(shape.h) || 0);
    const rotation = Number(shape.rot) || 0;
    const transform = rotation ? ` transform="rotate(${rotation} ${x + w / 2} ${y + h / 2})"` : '';
    if (shape.type === 'image' && /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(shape.dataUrl || '')) {
      return `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(shape.dataUrl)}"${transform}/>`;
    }
    const fill = color(shape.background, 'none');
    const rect = fill === 'none' ? '' : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${transform}/>`;
    const lines = String(shape.text || '').split('\n');
    const anchor = shape.align === 'center' ? 'middle' : shape.align === 'right' ? 'end' : 'start';
    const textX = shape.align === 'center' ? x + w / 2 : shape.align === 'right' ? x + w - Math.max(12000, w * .015) : x + Math.max(12000, w * .015);
    const fontSize = Math.max(1, Number(shape.fontSizePt) || 18) * 12700;
    const spans = lines.map((line, index) => `<tspan x="${textX}" dy="${index ? fontSize * 1.2 : 0}">${escapeXml(line)}</tspan>`).join('');
    const text = shape.text ? `<text x="${textX}" y="${y + fontSize}" fill="${color(shape.color)}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="${shape.bold ? '700' : '400'}" text-anchor="${anchor}"${transform}>${spans}</text>` : '';
    return rect + text;
  }).join('');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${background}"/>${shapes}</svg>`)}`;
}

export function mediaTypeLabel(type) {
  return ({ image: 'Image', video: 'Vidéo', pdf: 'PDF', pptx: 'PowerPoint' })[type] || 'Média';
}

function defaultMediaId() {
  return `media_${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`}`;
}
