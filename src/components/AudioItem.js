// src/components/AudioItem.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';

// Očekuje prop: title, previewUrl
export default function AudioItem({ title, previewUrl, style }) {
  const soundRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | playing | paused

  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
    });
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  const toggle = async () => {
    try {
      if (!soundRef.current) {
        setStatus('loading');
        const { sound } = await Audio.Sound.createAsync(
          { uri: previewUrl },
          { shouldPlay: true, progressUpdateIntervalMillis: 500 }
        );
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate(s => {
          if (!s.isLoaded) return;
          if (s.didJustFinish) {
            setStatus('idle');
            sound.unloadAsync().catch(() => {});
            soundRef.current = null;
          } else if (s.isPlaying) setStatus('playing');
          else setStatus('paused');
        });
      } else {
        const s = soundRef.current;
        const st = await s.getStatusAsync();
        if (st.isPlaying) {
          await s.pauseAsync();
          setStatus('paused');
        } else {
          await s.playAsync();
          setStatus('playing');
        }
      }
    } catch (e) {
      setStatus('idle');
    }
  };

  return (
    <View style={[styles.row, style]}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <TouchableOpacity onPress={toggle} style={styles.btn} disabled={status === 'loading'}>
        {status === 'loading' ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.btnText}>{status === 'playing' ? 'Pause' : 'Preview'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#111', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#fff', flex: 1, marginRight: 12 },
  btn: { backgroundColor: '#1f1b3a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
});
