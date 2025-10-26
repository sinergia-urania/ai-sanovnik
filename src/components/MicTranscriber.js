// File: src/components/MicTranscriber.js
import { Feather } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabaseClient';

export default function MicTranscriber({
  // i18n-ready labele
  lang = 'en',
  labelSpeak = 'Speak',
  labelListening = 'Listening…',

  // callbacks
  onInsert,
  onError,
  onStateChange,

  // kontrola i prikaz
  controlRef,            // ⇐ spoljašnji ref: { start(), stop(), isListening() }
  variant = 'default',   // 'default' | 'invisible'
  style,
}) {
  // AAC/MP4, manji bitrate/rate (dovoljno za STT + manji fajlovi)
  const recorder = useAudioRecorder(
    Platform.select({
      ios: {
        ...RecordingPresets.HIGH_QUALITY, // AAC/M4A
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
      },
      android: {
        ...RecordingPresets.HIGH_QUALITY, // koristi AAC/MP4
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
      },
      default: RecordingPresets.HIGH_QUALITY,
    })
  );

  const state = useAudioRecorderState(recorder);
  const [uploading, setUploading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          onError?.('Microphone permission denied');
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      } catch (e) {
        onError?.(String(e?.message || e));
      }
    })();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Obavesti parent kada se stanje promijeni (npr. da oboji STOP dugme)
  useEffect(() => {
    onStateChange?.(!!state.isRecording);
  }, [state.isRecording, onStateChange]);

  const start = async () => {
    if (uploading) return;
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) {
      onError?.(String(e?.message || e));
    }
  };

  const resolveUri = () => {
    // različite verzije hook-a: probaj više polja
    return (
      recorder?.uri ||
      state?.recording?.getURI?.() ||
      state?.recording?.uri ||
      null
    );
  };

  const stopAndTranscribe = async () => {
    try {
      await recorder.stop();
    } catch {
      // ignoriši
    }
    const uri = resolveUri();
    if (!uri) {
      onError?.('No audio URI from recorder');
      return;
    }

    try {
      setUploading(true);

      // Multipart form (ne setuj Content-Type ručno)
      const form = new FormData();
      const filePart = { uri, name: 'voice.m4a', type: 'audio/mp4' }; // m4a/mp4 (AAC)
      form.append('audio', filePart);
      form.append('file', filePart); // server prihvata oba imena
      form.append('lang', lang);

      // Izvedi base URL iz supabase klijenta (https://<ref>.supabase.co)
      const restUrl = supabase.rest?.['url'] || '';
      const baseUrl = restUrl.replace(/\/rest\/v1\/?$/, '');
      const fnUrl = `${baseUrl}/functions/v1/stt`;

      // Authorization: Bearer <jwt>
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token || '';

      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const bodyText = await res.text();
      if (!res.ok) {
        const msg = `${res.status} ${bodyText || 'STT failed'}`;
        console.warn('STT error:', msg);
        onError?.(msg);
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        parsed = { text: bodyText };
      }
      const text = parsed?.text || '';
      if (text) onInsert?.(text);
      else onError?.('Empty transcription');
    } catch (e) {
      onError?.(String(e?.message || e));
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  };

  // Public kontrola preko controlRef-a (bez forwardRef komplikacija)
  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = {
      start,
      stop: stopAndTranscribe,
      isListening: () => !!state.isRecording,
    };
    // cleanup da se ne ostavi stale ref
    return () => {
      if (controlRef.current) controlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlRef, state.isRecording]);

  const toggle = () => {
    if (uploading) return;
    if (state.isRecording) stopAndTranscribe();
    else start();
  };

  // Nevidljiv režim — koristi se kada parent prikazuje START/STOP
  if (variant === 'invisible') {
    return null;
  }

  return (
    <View style={[styles.row, style]}>
      <TouchableOpacity
        onPress={toggle}
        disabled={uploading}
        style={[styles.pill, state.isRecording && styles.active]}
      >
        <Feather name="mic" size={16} color="#fff" />
        <Text style={styles.txt}>{state.isRecording ? labelListening : labelSpeak}</Text>
      </TouchableOpacity>
      {uploading ? <ActivityIndicator style={{ marginLeft: 8 }} /> : null}
    </View>
  );
}

const COLORS = {
  pillBg: 'rgba(0,0,0,0.35)',
  pillBorder: '#333',
  activeBg: 'rgba(0,200,83,0.25)', // zelena providna
  activeBorder: '#00C853',         // zelena ivica
  text: '#fff',
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.pillBg,
    borderWidth: 1,
    borderColor: COLORS.pillBorder,
  },
  active: { backgroundColor: COLORS.activeBg, borderColor: COLORS.activeBorder },
  txt: { color: COLORS.text, fontWeight: '700', fontSize: 12 },
});
