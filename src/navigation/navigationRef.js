// File: src/navigation/navigationRef.js
import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

function isReady() {
  try { return navigationRef.isReady?.() === true; } catch { return false; }
}

function getRootStateSafe() {
  try { return navigationRef.getRootState?.() || null; } catch { return null; }
}

function getRouteNames() {
  const state = getRootStateSafe();
  return Array.isArray(state?.routeNames) ? state.routeNames : [];
}

function hasRoute(name) {
  try {
    const list = getRouteNames();
    return list.includes(name);
  } catch {
    return false;
  }
}

function validateResetStatePayload(stateObj) {
  // Dozvoljavamo "minimalni" reset bez provere
  if (!stateObj || typeof stateObj !== 'object') return true;

  // Ako payload nema routes – nema šta da validiramo
  if (!Array.isArray(stateObj.routes) || stateObj.routes.length === 0) return true;

  // Svaka ruta u payload-u mora da postoji u AKTUELNOM root navigatoru
  for (const r of stateObj.routes) {
    const rn = r?.name;
    if (typeof rn === 'string' && !hasRoute(rn)) {
      console.warn('[nav] reset payload rejected: route not in current navigator:', rn, 'available=', getRouteNames());
      return false;
    }
  }
  return true;
}

export function navigate(name, params) {
  if (!isReady()) {
    console.warn('[nav] navigate ignored: nav not ready');
    return;
  }
  // Ne crash-uj ako je neko pozvao na rutu koja trenutno ne postoji (Auth vs App)
  if (!hasRoute(name)) {
    console.warn('[nav] navigate noop: route not in current navigator:', name, 'available=', getRouteNames());
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
    // React Navigation dozvoljava funkciju kao argument
    if (typeof state === 'function') {
      const curr = getRootStateSafe();
      const next = state(curr);
      if (!validateResetStatePayload(next)) return;
      navigationRef.resetRoot(next);
      return;
    }

    // Standardni objekat
    if (!validateResetStatePayload(state)) return;
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
    console.warn('[nav] resetTo noop: route not in current navigator:', name, 'available=', getRouteNames());
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
