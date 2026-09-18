//// Neoffice — added file (no upstream equivalent).
////
//// WHY THIS EXISTS: Node 25 ships its own `localStorage` global. Started
//// without `--localstorage-file` it is an object with NO methods, and it wins
//// over happy-dom's — `window.localStorage` IS that same empty object under
//// vitest. The store reads `localStorage.getItem` at module scope, so 34 test
//// files died at import with "localStorage.getItem is not a function": a
//// broken ENVIRONMENT that reads as a broken store, and a pre-push suite
//// nobody can run on a recent Node.
////
//// In a DOM test file, hand the global happy-dom's own Storage rather than a
//// stand-in of ours: the tests that spy on `Storage.prototype.setItem` then
//// count the writes they are there to count. A plain node test file has no
//// Storage class at all, so it gets the small implementation below — the
//// modules it imports only ever read and write keys.
////
//// Each test file starts with an empty storage, which is what all of them
//// already assumed. Nothing here ships to a browser. Remove it the day Node's
//// web storage can be turned off per environment.
class MemoryStorage {
  #map = new Map()
  get length() { return this.#map.size }
  key(i) { return [...this.#map.keys()][i] ?? null }
  getItem(k) { return this.#map.has(String(k)) ? this.#map.get(String(k)) : null }
  setItem(k, v) { this.#map.set(String(k), String(v)) }
  removeItem(k) { this.#map.delete(String(k)) }
  clear() { this.#map.clear() }
}

for (const key of ['localStorage', 'sessionStorage']) {
  const current = globalThis[key]
  if (current && typeof current.getItem === 'function') continue
  //: Node ships a `Storage` class too, and ITS constructor is illegal to call
  //: ("Illegal constructor"): the class being there says nothing about whether
  //: an instance can be made, so try it rather than test for it.
  let storage
  try { storage = new globalThis.Storage() } catch { storage = new MemoryStorage() }
  Object.defineProperty(globalThis, key, { value: storage, configurable: true, writable: true })
  //: happy-dom makes `window` the global object under vitest; assign it anyway
  //: so a test reading `window.localStorage` sees the same storage.
  if (typeof window !== 'undefined' && window !== globalThis) window[key] = storage
}
