// File: src/media/catalogSafe.js

// Sirovi unos (tvoje stavke) — dodaj/menjaj ovde po potrebi:
export const MEDIA_RAW = [
  // dogovorene tri
  { id: 'alpha_relax_10m',  title: 'Alpha Relax — 10 min',  bucket: 'media_premium', path: 'alpha_relax_10m.m4a',  group: 'short' },
  { id: 'alpha_relax_15m',  title: 'Alpha Relax — 15 min',  bucket: 'media_premium', path: 'alpha_relax_15m.m4a',  group: 'short' },
  { id: 'focus_pre_wild_12m', title: 'Focus pre-WILD — 12 min', bucket: 'media_premium', path: 'focus_pre_wild_12m.m4a', group: 'binaural' },

  // nove
  { id: 'morning_forest_ambience_4hz_bb', title: 'Morning Forest Ambience — 4 Hz (binaural)', bucket: 'media_premium', path: 'morning_forest_ambience_4hz_bb.m4a', group: 'binaural' },

  { id: 'relaxing_music_with_bird_sound_30min', title: 'Relaxing music with bird sound — 30 min', bucket: 'media_premium', path: 'relaxing_music_with_bird_sound_30min.m4a', group: 'long' },

  { id: 'native_american_flute_and_water_drop_2hz_30min', title: 'Native American flute + water drop — 2 Hz · 30 min', bucket: 'media_premium', path: 'native_american_flute_and_water_drop_2hz_30min.m4a', group: 'long' },

  { id: 'rain_heavy_loud_and_thunderstorm_30min', title: 'Rain (heavy) + thunderstorm — 30 min', bucket: 'media_premium', path: 'rain_heavy_loud_and_thunderstorm_30min.m4a', group: 'long' },

  { id: 'earth_gong_for_relaxation_30min', title: 'Earth Gong — 30 min', bucket: 'media_premium', path: 'earth_gong_for_relaxation_30min.m4a', group: 'long' },

  { id: 'om_chanting_with_flute_12min_4hz', title: 'Om Chanting with flute — 4 Hz · 12 min', bucket: 'media_premium', path: 'om_chanting_with_flute_12min_4hz.m4a', group: 'binaural' },
];

// Sanitizacija — nikad ne pristupamo .id dok ne proverimo
function sanitize(items) {
  return (items || [])
    .filter((m) => !!m && typeof m === 'object')
    .map((m, i) => {
      if (!m.id || !m.group) {
        console.warn(`[MEDIA] preskačem stavku #${i} (nema id ili group):`, m);
        return null;
      }
      return m;
    })
    .filter(Boolean);
}

// Stabilna lista i mapa
export const MEDIA = sanitize(MEDIA_RAW);

export const byId = MEDIA.reduce((acc, m) => {
  try {
    if (m && m.id) acc[m.id] = m;
  } catch {}
  return acc;
}, Object.create(null));

// Bezbedan getter (fallback i kad mapa ne vrati)
export function getById(id) {
  if (!id) return null;
  return byId[id] || MEDIA.find((m) => m && m.id === id) || null;
}
