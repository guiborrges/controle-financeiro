const fs = require('fs');

function loadInitial(pathname) {
  try {
    if (!pathname || !fs.existsSync(pathname)) return new Map();
    const raw = fs.readFileSync(pathname, 'utf8');
    const parsed = JSON.parse(raw);
    const map = new Map();
    Object.entries(parsed || {}).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') return;
      const count = Number(value.count || 0);
      const expiresAt = Number(value.expiresAt || 0);
      if (!key || !Number.isFinite(count) || !Number.isFinite(expiresAt)) return;
      map.set(key, { count, expiresAt });
    });
    return map;
  } catch {
    return new Map();
  }
}

function persist(pathname, map) {
  if (!pathname) return;
  const parent = pathname.replace(/[/\\][^/\\]+$/, '');
  if (parent) fs.mkdirSync(parent, { recursive: true });
  const out = {};
  map.forEach((value, key) => {
    out[key] = {
      count: Number(value?.count || 0),
      expiresAt: Number(value?.expiresAt || 0)
    };
  });
  fs.writeFile(pathname, JSON.stringify(out), 'utf8', () => {
    // no-op
  });
}

function createPersistentRateLimitStore(pathname) {
  const map = loadInitial(pathname);
  let dirty = false;
  let flushTimer = null;
  const flush = () => {
    if (!dirty) return;
    dirty = false;
    persist(pathname, map);
  };

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, 2000);
    if (typeof flushTimer.unref === 'function') flushTimer.unref();
  };

  return {
    get(key) {
      return map.get(key);
    },
    set(key, value) {
      map.set(key, value);
      dirty = true;
      scheduleFlush();
      return this;
    },
    delete(key) {
      const result = map.delete(key);
      if (result) {
        dirty = true;
        scheduleFlush();
      }
      return result;
    },
    has(key) {
      return map.has(key);
    },
    clear() {
      map.clear();
      dirty = true;
      scheduleFlush();
    },
    get size() {
      return map.size;
    },
    flush
  };
}

module.exports = {
  createPersistentRateLimitStore
};
