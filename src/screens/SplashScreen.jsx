// File: src/screens/SplashScreen.jsx
import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';

export default function SplashScreen({ message = 'Učitavanje…' }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Image
        source={require('../assets/images/logo.jpg')}
        style={{ width: 96, height: 96, marginBottom: 16 }}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" />
      <Text style={{ color: '#fff', marginTop: 12, opacity: 0.8 }}>{message}</Text>
    </View>
  );
}
