// File: src/App.js
import React from 'react';
import { SafeAreaView, StatusBar, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import RootNavigator from './navigation/index';
import './i18n';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#000000',
    card: '#0a0a0a',
    text: '#ffffff',
    border: '#111',
    primary: '#9b87f5',
  },
};

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <NavigationContainer theme={navTheme}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flex: 1 }}>
            <RootNavigator />
          </View>
        </SafeAreaView>
      </NavigationContainer>
    </I18nextProvider>
  );
}
