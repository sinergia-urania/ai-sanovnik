// File: src/components/GradientOverlay.js
import React from 'react';
import { View } from 'react-native';
// TODO: Replace with expo-linear-gradient if needed

export default function GradientOverlay({ style }) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0, right: 0, bottom: 0, height: 120,
          backgroundColor: 'rgba(0,0,0,0.65)',
        },
        style,
      ]}
    />
  );
}