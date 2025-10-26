import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function BgImage({
  source,
  children,
  style,
  imageStyle,
  contentFit = 'cover',
  ...imgProps
}) {
  return (
    <View style={style}>
      {/* Ako nema source, samo prikaži decu (bez slike) */}
      {source ? (
        <Image
          source={source}
          style={[StyleSheet.absoluteFillObject, imageStyle]}
          contentFit={contentFit}
          cachePolicy="disk"
          transition={150}
          {...imgProps}
        />
      ) : null}
      {children}
    </View>
  );
}
