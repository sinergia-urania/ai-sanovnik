// File: src/media/useSupabaseAudioPlayer.js
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
// ✅ SDK 54: legacy FS API da zadržimo getInfoAsync/downloadAsync
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabaseClient';
import { MEDIA, byId } from './catalogSafe';

// --- Keš podešavanja ---
const CACHE_DIR = `${FileSystem.cacheDirectory}audio/`;
const INDEX_PATH = `${CACHE_DIR}index.json`;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dana
const CACHE_CAP_BYTES = 250 * 1024 * 1024;    // 250 MB

// Minimalni TTL za long stream (3h)
const LONG_STREAM_MIN_SEC = 3 * 60 * 60; // 10800

export function useSupabaseAudioPlayer() {
  const { t } = useTranslation();

  const [player, setPlayer]   = useState(null);
  const [nowPlaying, setNow]  = useState(null);
  const [status, setStatus]   = useState({ playing: false });
  const [error, setError]     = useState(null);

  // ---------- Player lifecycle ----------
  useEffect(() => {
    // iOS: pusti i kad je hardware mute uključen
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const p = createAudioPlayer(null);
    setPlayer(p);
    return () => { try { p?.remove?.(); } catch {} };
  }, []);

  // ---------- Keš helperi ----------
  async function ensureCacheDir() {
    try { await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }); } catch {}
  }

  const extFromPath = (path) => (/\.\w+$/.exec(path || '')?.[0]) || '.mp3';

  function localPathFor(meta) {
    if (!meta || !meta.id) throw new Error(t('audio.errors.invalidMeta'));
    const id  = meta.id;
    const ver = meta.version ? `-v${meta.version}` : '';
    const pth = meta.path ?? meta.storage?.path;
    const ext = extFromPath(pth);
    return `${CACHE_DIR}${id}${ver}${ext}`;
  }

  async function readIndex() {
    try {
      const txt = await FileSystem.readAsStringAsync(INDEX_PATH);
      return JSON.parse(txt || '{}');
    } catch { return {}; }
  }

  async function writeIndex(idx) {
    await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(idx));
  }

  async function fileInfo(path) {
    const info = await FileSystem.getInfoAsync(path);
    return {
      exists:  info.exists,
      size:    info.exists ? (info.size ?? 0) : 0,
      mtimeMs: info.exists ? (info.modificationTime || 0) * 1000 : 0,
    };
  }

  async function markAccess(path) {
    const idx = await readIndex();
    const { size } = await fileInfo(path);
    idx[path] = { lastAccess: Date.now(), size };
    await writeIndex(idx);
  }

  async function cleanupExpired() {
    const idx = await readIndex();
    let changed = false;

    for (const [path, meta] of Object.entries(idx)) {
      const { exists, mtimeMs, size } = await fileInfo(path);
      if (!exists) { delete idx[path]; changed = true; continue; }
      const ageMs = Date.now() - Math.max(meta?.lastAccess || 0, mtimeMs);
      if (ageMs > CACHE_TTL_MS) {
        try { await FileSystem.deleteAsync(path, { idempotent: true }); } catch {}
        delete idx[path]; changed = true;
      } else if (meta.size !== size) {
        idx[path].size = size; changed = true;
      }
    }
    if (changed) await writeIndex(idx);
  }

  async function enforceCap() {
    let idx = await readIndex();
    let total = Object.values(idx).reduce((s, e) => s + (e?.size || 0), 0);
    if (total <= CACHE_CAP_BYTES) return;

    const entries = Object.entries(idx).sort(
      (a, b) => (a[1]?.lastAccess || 0) - (b[1]?.lastAccess || 0)
    );
    for (const [path, meta] of entries) {
      if (total <= CACHE_CAP_BYTES) break;
      try { await FileSystem.deleteAsync(path, { idempotent: true }); } catch {}
      total -= (meta?.size || 0);
      delete idx[path];
    }
    await writeIndex(idx);
  }

  // ✅ Nova verzija: minimalni TTL kroz minExpSec
  async function signedUrl(meta, minExpSec = 900) {
    const expFromMeta = meta.storage?.expiresIn ?? meta.expiresIn ?? 900;
    const exp = Math.max(expFromMeta, minExpSec); // garantuj minimum
    const bucket = meta.storage?.bucket ?? meta.bucket;
    const path   = meta.storage?.path   ?? meta.path;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, exp);
    if (error) throw error;
    return data.signedUrl;
  }

  async function getLocalUri(meta) {
    await ensureCacheDir();
    await cleanupExpired();

    const localPath = localPathFor(meta);
    const info = await fileInfo(localPath);

    if (!info.exists) {
      const url = await signedUrl(meta); // default minExpSec = 900
      await FileSystem.downloadAsync(url, localPath);
    }

    await markAccess(localPath);
    await enforceCap();

    return localPath; // "file://..."
  }

  // ---- NOVO: instant play + background cache za kratke fajlove ----
  async function playUri(uri) {
    player.replace(uri);
    player.seekTo(0);
    await player.play();
  }

  const bgDownloads = new Map(); // dedupe po id-u
  async function streamThenCache(meta) {
    const url = await signedUrl(meta, 900); // 15 min sasvim dosta
    await playUri(url);                      // ⟵ odmah kreće

    const local = localPathFor(meta);
    const info = await fileInfo(local);
    if (info.exists) return;                 // već keširano

    if (!bgDownloads.has(meta.id)) {
      const p = (async () => {
        try {
          await ensureCacheDir();
          await FileSystem.downloadAsync(url, local);
          await markAccess(local);
          await enforceCap();
        } catch {}
      })().finally(() => bgDownloads.delete(meta.id));
      bgDownloads.set(meta.id, p);
    }
  }

  // ---------- Javni API ----------
  async function playById(id) {
    setError(null);
    if (!player) return;

    const meta =
      (byId && typeof byId === 'object' && byId[id]) ||
      (Array.isArray(MEDIA) ? MEDIA.find((m) => m && m.id === id) : null);

    if (!meta) { setError(t('audio.errors.unknownId', { id })); return; }

    try {
      const streamLong = meta.group === 'long';

      if (streamLong) {
        // Dugi fajlovi: direkt stream (instant), TTL 3h
        const url = await signedUrl(meta, LONG_STREAM_MIN_SEC);
        await playUri(url);
      } else {
        // Kratki: lokalno ako postoji; ako ne — stream sada, keširaj u pozadini
        const local = localPathFor(meta);
        const info = await fileInfo(local);
        if (info.exists) {
          await markAccess(local);
          await playUri(local);
        } else {
          await streamThenCache(meta); // ⟵ instant start + background cache
        }
      }

      setNow(id);
      setStatus({ playing: true });
    } catch (e) {
      console.warn('Audio error:', e);
      setError(e?.message || t('audio.errors.playback'));
      setNow(null);
      setStatus({ playing: false });
    }
  }

  const pause  = () => { try { player?.pause?.(); setStatus({ playing: false }); } catch {} };
  const resume = () => { try { player?.play?.();  setStatus({ playing: true  }); } catch {} };
  const stop   = async () => {
    try { player?.pause?.(); } catch {}
    try { await player?.seekTo?.(0); } catch {}
    setNow(null);
    setStatus({ playing: false });
  };

  // Prefetch (npr. na Wi-Fi)
  async function prefetch(id) {
    const meta =
      (byId && typeof byId === 'object' && byId[id]) ||
      (Array.isArray(MEDIA) ? MEDIA.find((m) => m && m.id === id) : null);
    if (!meta) return;

    if (meta.group === 'long') return; // long se streamuje, ne preuzimamo
    try { await getLocalUri(meta); } catch {}
  }

  // Ručno brisanje
  async function clearItem(id) {
    const meta =
      (byId && typeof byId === 'object' && byId[id]) ||
      (Array.isArray(MEDIA) ? MEDIA.find((m) => m && m.id === id) : null);
    if (!meta) return;
    const lp = localPathFor(meta);
    try { await FileSystem.deleteAsync(lp, { idempotent: true }); } catch {}
    const idx = await readIndex();
    delete idx[lp];
    await writeIndex(idx);
  }

  async function clearAll() {
    try { await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true }); } catch {}
    await ensureCacheDir();
    await writeIndex({});
  }

  return useMemo(() => ({
    playById, pause, resume, stop,
    prefetch, clearItem, clearAll,
    nowPlaying: nowPlaying,
    status, error,
  }), [player, nowPlaying, status, error]);
}
