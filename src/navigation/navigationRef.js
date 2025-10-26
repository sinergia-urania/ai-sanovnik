// File: src/navigation/navigationRef.js
import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

function isReady() {
  try { return navigationRef.isReady?.() === true; } catch { return false; }
}

function hasRoute(name) {
  try {
    const state = navigationRef.getRootState?.();
    const list = Array.isArray(state?.routeNames) ? state.routeNames : [];
    return list.includes(name);
  } catch {
    return false;
  }
}

export function navigate(name, params) {
  if (!isReady()) {
    console.warn('[nav] navigate ignored: nav not ready');
    return;
  }
  try {
    navigationRef.navigate(name, params);
  } catch (e) {
    console.warn('[nav] navigate error:', e?.message || e);
  }
}

export function resetRoot(state) {
  if (!isReady()) {
    console.warn('[nav] resetRoot ignored: nav not ready');
    return;
  }
  try {
    navigationRef.resetRoot(state);
  } catch (e) {
    console.warn('[nav] resetRoot error:', e?.message || e);
  }
}

export function resetTo(name, params) {
  if (!isReady()) {
    console.warn('[nav] resetTo ignored: nav not ready');
    return;
  }
  // ⛔️ Ako trenutni stack nema traženu rutu, preskačemo reset
  if (!hasRoute(name)) {
    console.warn('[nav] resetTo noop: route not in current navigator:', name);
    return;
  }
  try {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name, params }],
      })
    );
  } catch (e) {
    console.warn('[nav] resetTo error:', e?.message || e);
  }
}

export function goBack() {
  if (!isReady()) {
    console.warn('[nav] goBack ignored: nav not ready');
    return;
  }
  try {
    if (navigationRef.canGoBack()) navigationRef.goBack();
  } catch (e) {
    console.warn('[nav] goBack error:', e?.message || e);
  }
}
