// src/utils/quotaBus.js
// Super light JS event bus (bez NativeEventEmitter)
// Služi da Header refrešuje brojčanik posle kupovine/consumaa

const listeners = new Set();

export function onQuotaRefresh(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function triggerQuotaRefresh() {
  listeners.forEach((fn) => {
    try { fn(); } catch {}
  });
}
