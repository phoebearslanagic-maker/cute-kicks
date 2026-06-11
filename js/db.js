// Minimal promise wrapper over IndexedDB. Two object stores:
//   events   — keyPath "id", one record per logged movement event
//   settings — out-of-line keys, a single record under the key "settings"

const DB_NAME = 'kick';
const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

function withStore(name, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    let result;
    try {
      result = fn(tx.objectStore(name));
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const idb = {
  get: (store, key) => withStore(store, 'readonly', (s) => s.get(key)),
  getAll: (store) => withStore(store, 'readonly', (s) => s.getAll()),
  count: (store) => withStore(store, 'readonly', (s) => s.count()),
  put: (store, value, key) => withStore(store, 'readwrite', (s) => s.put(value, key)),
  delete: (store, key) => withStore(store, 'readwrite', (s) => s.delete(key)),
  clear: (store) => withStore(store, 'readwrite', (s) => s.clear()),
  bulkPut: (store, values) => withStore(store, 'readwrite', (s) => {
    for (const v of values) s.put(v);
    return values.length;
  }),
};
