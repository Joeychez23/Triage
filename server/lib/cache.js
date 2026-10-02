// Small in-memory LRU cache with a time-to-live. Used for fit results and as
// the storage layer in guest mode.
const crypto = require("crypto");

class LruCache {
  constructor({ max = 5000, ttlMs = 6 * 60 * 60 * 1000 } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
  }

  delete(key) {
    this.map.delete(key);
  }

  values() {
    const now = Date.now();
    return [...this.map.values()].filter((h) => h.expires > now).map((h) => h.value);
  }

  get size() {
    return this.map.size;
  }
}

const hashKey = (...parts) => crypto.createHash("sha256").update(parts.join("␟")).digest("base64url");

module.exports = { LruCache, hashKey };
