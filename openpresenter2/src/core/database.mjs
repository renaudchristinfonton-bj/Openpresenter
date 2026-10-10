// IndexedDB persistence for the web-first application.
// Binary assets remain Blobs in IDB; scenes only keep stable asset IDs.
const DB_NAME = 'openpresenter2';
const DB_VERSION = 3;
const STORES = {
  settings: { keyPath: 'key' },
  bibles: { keyPath: 'id' },
  songs: { keyPath: 'id' },
  media: { keyPath: 'id' },
  announcements: { keyPath: 'id' },
  scenes: { keyPath: 'id' },
  assets: { keyPath: 'id' },
  notes: { keyPath: 'id' },
};

function copy(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch { /* browser fallback below */ }
  }
  return JSON.parse(JSON.stringify(value));
}

export class OpenPresenterDB {
  constructor(name = DB_NAME) {
    this.name = name;
    this._dbPromise = null;
    this._memory = new Map(Object.keys(STORES).map((store) => [store, new Map()]));
    this._assetURLs = new Map();
    this.persistent = typeof globalThis.indexedDB !== 'undefined';
  }

  async ready() {
    if (!this.persistent) return false;
    try { return !!(await this._open()); }
    catch { this.persistent = false; return false; }
  }

  _open() {
    if (!this.persistent) return Promise.resolve(null);
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(this.name, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        for (const [store, config] of Object.entries(STORES)) {
          if (!database.objectStoreNames.contains(store)) {
            database.createObjectStore(store, { keyPath: config.keyPath });
          }
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => reject(request.error || new Error('Impossible d’ouvrir IndexedDB.'));
      request.onblocked = () => reject(new Error('La base OpenPresenter est bloquée par un autre onglet.'));
    }).catch((error) => {
      this.persistent = false;
      this._dbPromise = null;
      throw error;
    });
    return this._dbPromise;
  }

  async _request(storeName, mode, makeRequest) {
    if (!STORES[storeName]) throw new TypeError(`Magasin inconnu : ${storeName}`);
    const database = await this._open().catch(() => null);
    if (!database) return null;
    return new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = database.transaction(storeName, mode);
        const request = makeRequest(transaction.objectStore(storeName));
        request.onsuccess = () => resolve(copy(request.result));
        request.onerror = () => reject(request.error || new Error('Erreur IndexedDB.'));
        transaction.onabort = () => reject(transaction.error || new Error('Transaction IndexedDB annulée.'));
      } catch (error) { reject(error); }
    });
  }

  async get(store, key) {
    const database = await this._open().catch(() => null);
    if (!database) return copy(this._memory.get(store)?.get(key));
    return this._request(store, 'readonly', (objectStore) => objectStore.get(key));
  }

  async put(store, value) {
    if (!STORES[store]) throw new TypeError(`Magasin inconnu : ${store}`);
    const key = value?.[STORES[store].keyPath];
    if (key == null) throw new TypeError(`L’enregistrement ${store} doit contenir « ${STORES[store].keyPath} ».`);
    const database = await this._open().catch(() => null);
    if (!database) {
      this._memory.get(store).set(key, copy(value));
      return copy(value);
    }
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(store, 'readwrite');
      transaction.objectStore(store).put(value);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Échec de sauvegarde IndexedDB.'));
      transaction.onabort = () => reject(transaction.error || new Error('Sauvegarde IndexedDB annulée.'));
    });
    return copy(value);
  }

  async delete(store, key) {
    const database = await this._open().catch(() => null);
    if (!database) return this._memory.get(store)?.delete(key) || false;
    return this._request(store, 'readwrite', (objectStore) => objectStore.delete(key));
  }

  async all(store) {
    if (!STORES[store]) throw new TypeError(`Magasin inconnu : ${store}`);
    const database = await this._open().catch(() => null);
    if (!database) return [...this._memory.get(store).values()].map(copy);
    return this._request(store, 'readonly', (objectStore) => objectStore.getAll());
  }

  async getSetting(key, fallback = null) {
    const record = await this.get('settings', key);
    return record ? record.value : fallback;
  }

  async setSetting(key, value) {
    return this.put('settings', { key, value });
  }

  async saveScene(id, scene) {
    return this.put('scenes', { ...copy(scene), id, updatedAt: Date.now() });
  }

  async saveBible(bible) {
    return this.put('bibles', { ...copy(bible), updatedAt: Date.now() });
  }

  async saveSong(song) {
    return this.put('songs', { ...copy(song), updatedAt: Date.now() });
  }

  async saveMedia(item) {
    return this.put('media', { ...copy(item), updatedAt: Date.now() });
  }

  async saveAsset(file, id = `asset_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`) {
    if (!file || typeof file !== 'object') throw new TypeError('Fichier image invalide.');
    const record = {
      id, name: file.name || 'image', type: file.type || 'application/octet-stream',
      size: Number(file.size) || 0, blob: file, createdAt: Date.now(),
    };
    return this.put('assets', record);
  }

  async assetURL(id) {
    if (!id) return null;
    if (this._assetURLs.has(id)) return this._assetURLs.get(id);
    const asset = await this.get('assets', id);
    if (!asset?.blob || typeof URL?.createObjectURL !== 'function') return null;
    const url = URL.createObjectURL(asset.blob);
    this._assetURLs.set(id, url);
    return url;
  }

  async hydrateScene(scene) {
    const hydrated = copy(scene);
    for (const layer of hydrated?.layers || []) {
      if (layer.assetId) layer.src = await this.assetURL(layer.assetId);
      if (layer.source?.assetId) layer.source.image = await this.assetURL(layer.source.assetId);
    }
    return hydrated;
  }

  releaseAssetURLs() {
    for (const url of this._assetURLs.values()) URL.revokeObjectURL(url);
    this._assetURLs.clear();
  }

  async exportData() {
    const result = {};
    for (const store of Object.keys(STORES)) result[store] = await this.all(store);
    result.meta = { schema: DB_VERSION, application: 'OpenPresenter 2', exportedAt: new Date().toISOString() };
    return result;
  }

  async importData(data, { replace = false } = {}) {
    if (!data || typeof data !== 'object' || data.meta?.application !== 'OpenPresenter 2') {
      throw new TypeError('Fichier de sauvegarde OpenPresenter invalide.');
    }
    if (replace) {
      for (const store of Object.keys(STORES)) {
        const records = await this.all(store);
        for (const record of records) await this.delete(store, record[STORES[store].keyPath]);
      }
    }
    for (const store of Object.keys(STORES)) {
      for (const record of Array.isArray(data[store]) ? data[store] : []) await this.put(store, record);
    }
  }
}

const database = new OpenPresenterDB();
export default database;
