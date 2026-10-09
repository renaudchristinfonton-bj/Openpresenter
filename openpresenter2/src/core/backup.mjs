const FORMAT = 'openpresenter-backup';
const VERSION = 1;
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 24 * 1024 * 1024;

function zipConstructor(explicit) {
  const JSZip = explicit || globalThis.JSZip;
  if (!JSZip) throw new Error('Le module ZIP local est absent. Rechargez OpenPresenter puis réessayez.');
  return JSZip;
}

function safeExtension(name, type) {
  const ext = String(name || '').match(/\.([a-z0-9]{1,8})$/i)?.[1];
  if (ext) return `.${ext.toLowerCase()}`;
  const mime = String(type || '').toLowerCase();
  const known = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'video/mp4': '.mp4', 'audio/mpeg': '.mp3' };
  return known[mime] || '.bin';
}

export async function createBackupZip(database, JSZipClass) {
  const JSZip = zipConstructor(JSZipClass);
  const data = await database.exportData();
  const zip = new JSZip();
  const assetFiles = [];
  const assets = data.assets || [];
  data.assets = [];
  for (let index = 0; index < assets.length; index += 1) {
    const { blob, ...record } = assets[index];
    if (!blob || typeof blob !== 'object') continue;
    const filename = `assets/${String(index + 1).padStart(5, '0')}${safeExtension(record.name, record.type)}`;
    zip.file(filename, blob, { binary: true, date: new Date(record.createdAt || Date.now()) });
    assetFiles.push({ ...record, path: filename });
  }
  const stores = Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'meta' && key !== 'assets'));
  const manifest = {
    format: FORMAT, version: VERSION,
    meta: { application: 'OpenPresenter 2', schema: 1, exportedAt: new Date().toISOString() },
    stores, assets: assetFiles,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function importBackupZip(file, database, JSZipClass, { replace = false } = {}) {
  if (!file || Number(file.size) > MAX_ARCHIVE_BYTES) throw new Error('Archive trop volumineuse (maximum 512 Mo).');
  const JSZip = zipConstructor(JSZipClass);
  const zip = await JSZip.loadAsync(file, { checkCRC32: true, createFolders: false });
  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry || manifestEntry._data?.uncompressedSize > MAX_MANIFEST_BYTES) throw new Error('Manifeste de sauvegarde absent ou trop volumineux.');
  let manifest;
  try { manifest = JSON.parse(await manifestEntry.async('string')); }
  catch { throw new Error('Le manifeste de sauvegarde n’est pas un JSON valide.'); }
  if (manifest?.format !== FORMAT || manifest?.version !== VERSION || manifest?.meta?.application !== 'OpenPresenter 2') {
    throw new Error('Cette archive n’est pas une sauvegarde OpenPresenter 2 compatible.');
  }
  const data = { ...(manifest.stores || {}), meta: manifest.meta, assets: [] };
  let totalAssetSize = 0;
  for (const asset of Array.isArray(manifest.assets) ? manifest.assets : []) {
    if (!asset || typeof asset.path !== 'string' || !/^assets\/\d{5,}\.[a-z0-9]{1,8}$/i.test(asset.path)) {
      throw new Error('Chemin de média non autorisé dans la sauvegarde.');
    }
    const entry = zip.file(asset.path);
    if (!entry) throw new Error(`Média manquant dans l’archive : ${asset.name || asset.path}`);
    const size = Number(entry._data?.uncompressedSize || 0);
    totalAssetSize += size;
    if (size > 256 * 1024 * 1024 || totalAssetSize > MAX_ARCHIVE_BYTES) throw new Error('Les médias de cette sauvegarde dépassent la limite autorisée.');
    const blob = await entry.async('blob');
    data.assets.push({ ...asset, blob });
    delete data.assets[data.assets.length - 1].path;
  }
  await database.importData(data, { replace });
  return { imported: Object.fromEntries(Object.entries(data).filter(([key, value]) => key !== 'meta' && Array.isArray(value)).map(([key, value]) => [key, value.length])) };
}

export { FORMAT as BACKUP_FORMAT, VERSION as BACKUP_VERSION };
