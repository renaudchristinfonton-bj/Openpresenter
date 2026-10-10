export function buildObsOutputUrl(baseUrl, output) {
  if (!output || !/^[\w.-]{1,100}$/.test(String(output.id || ''))) throw new TypeError('Sortie OBS invalide.');
  const width = Number(output.width);
  const height = Number(output.height);
  if (!Number.isInteger(width) || width < 320 || width > 8192 || !Number.isInteger(height) || height < 180 || height > 8192) {
    throw new RangeError('La résolution OBS doit être comprise entre 320×180 et 8192×8192.');
  }
  const fit = ['contain', 'cover', 'stretch'].includes(output.fit) ? output.fit : 'contain';
  const url = new URL('./obs/output.html', baseUrl);
  url.searchParams.set('scene', output.id);
  url.searchParams.set('res', `${width}x${height}`);
  url.searchParams.set('fit', fit);
  // No forced lockMode: the editor scene is the exact scene OBS renders.
  return url.toString();
}
