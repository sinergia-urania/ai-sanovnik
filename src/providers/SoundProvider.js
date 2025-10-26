// File: src/providers/SoundProvider.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Local asset for click SFX
const CLICK_SRC = require('../assets/sfx/hover-click.mp3');

const STORE_KEYS = {
  volume: 'settings:volume', // "0..100"
  muted:  'settings:muted',  // "0" | "1"
};

const DEFAULT_VOL_01 = 0.8;

const SoundCtx = createContext({
  playClick: () => {},
  setMuted: () => {},
  setVolume: () => {},
  muted: false,
  volume: DEFAULT_VOL_01, // 0..1
});

// --- Singleton player lives for entire app lifetime ---
const clickPlayer = createAudioPlayer(CLICK_SRC);
clickPlayer.loop = false;

function applyGainTo(player, muted, volume01) {
  try {
    if (!player) return;
    player.muted = !!muted;            // <— canonical mute flag
    player.volume = muted ? 0 : volume01; // <— 0..1
  } catch {}
}

export function SoundProvider({ children }) {
  // allow audio in iOS silent switch
  useEffect(() => {
    (async () => {
      try { await setAudioModeAsync({ playsInSilentMode: true }); } catch {}
    })();
  }, []);

  const [volume, setVolume01] = useState(DEFAULT_VOL_01); // 0..1
  const [muted, setMutedState] = useState(false);

  // Load persisted prefs once
  useEffect(() => {
    (async () => {
      try {
        const [v, m] = await Promise.all([
          AsyncStorage.getItem(STORE_KEYS.volume),
          AsyncStorage.getItem(STORE_KEYS.muted),
        ]);
        const vol01 = Math.max(0, Math.min(1, (Number(v) || 80) / 100));
        const isMuted = (m ?? '0') === '1';
        setVolume01(vol01);
        setMutedState(isMuted);
        applyGainTo(clickPlayer, isMuted, vol01);
      } catch {}
    })();
  }, []);

  // Re-apply whenever state changes
  useEffect(() => {
    applyGainTo(clickPlayer, muted, volume);
  }, [muted, volume]);

  const setVolume = async (v01) => {
    const clamped = Math.max(0, Math.min(1, Number(v01) || 0));
    setVolume01(clamped);
    try { await AsyncStorage.setItem(STORE_KEYS.volume, String(Math.round(clamped * 100))); } catch {}
    applyGainTo(clickPlayer, muted, clamped);
  };

  const setMuted = async (next) => {
    const val = !!next;
    setMutedState(val);
    try { await AsyncStorage.setItem(STORE_KEYS.muted, val ? '1' : '0'); } catch {}
    applyGainTo(clickPlayer, val, volume);
  };

  const playClick = () => {
    try {
      applyGainTo(clickPlayer, muted, volume); // ensure latest props
      clickPlayer.seekTo(0);
      clickPlayer.play();
    } catch {}
  };

  const value = useMemo(
    () => ({ playClick, setMuted, setVolume, muted, volume }),
    [muted, volume]
  );

  return <SoundCtx.Provider value={value}>{children}</SoundCtx.Provider>;
}

export const useSound = () => useContext(SoundCtx);
