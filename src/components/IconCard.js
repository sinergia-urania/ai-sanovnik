// File: src/components/IconCard.js
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';
import { useSound } from '../providers/SoundProvider';

const GOLD = '#D4AF37';

export default function IconCard({
  title,
  onPress,
  image,
  size = 150,          // ceo prečnik kruga
  ringColor = GOLD,
  ringWidth = 1,
  imageScale = 0.66,   // koliki deo kruga zauzima ikona (0.62–0.72 lepo izgleda)
  locked = false,      // 🔒 novo: vizuelni overlay za zaključano
  style,
}) {
  const { playClick } = useSound();

  // geometrija kruga
  const cx = size / 2;
  const cy = size / 2;
  const r  = cx - ringWidth / 2;

  // putanja za tekst (gornji polukrug, blago unutra od prstena)
  const textPad = 6;               // udalji tekst od ivice prstena
  const arcR    = r - textPad;     // radijus putanje za tekst
  const leftX   = cx - arcR;
  const rightX  = cx + arcR;
  const arcId   = `arc-${(title || '').replace(/\s+/g, '-')}-${size}`;

  // dužina polukruga
  const arcLen = Math.PI * arcR;

  // koliko luka koristimo za naslov (kraće da ne kači ivice)
  const tlen = (title || '').length;
  const fitRatio = tlen > 22 ? 0.80 : tlen > 18 ? 0.83 : 0.85;
  const fitLen = arcLen * fitRatio;

  // start offset u pikselima: centriraj tekst (ne "%")
  const startOffsetPx = (arcLen - fitLen) / 2;

  // font skaliranje po dužini
  const baseFont = Math.max(10, Math.floor(size * 0.12));
  const fontSize =
    tlen > 22 ? Math.floor(baseFont * 0.85) :
    tlen > 18 ? Math.floor(baseFont * 0.90) :
    tlen > 14 ? Math.floor(baseFont * 0.95) :
    baseFont;

  // gornji luk slijeva nadesno (sweep=0)
  const dTopArc = `M ${leftX} ${cy} A ${arcR} ${arcR} 0 0 0 ${rightX} ${cy}`;

  // veličina ikonice
  const imgSize = Math.round(size * imageScale);

  // 🔒 overlay dimenzije (manje od celog, da prsten ostane vidljiv)
  const overlaySize = Math.max(0, size - ringWidth * 2);
  const lockIconSize = Math.max(18, Math.floor(size * 0.16));

  return (
    <TouchableOpacity
      onPress={() => {
        try { playClick?.(); } catch {}
        onPress?.();
      }}
      style={[styles.wrap, style, { width: size }]}
      activeOpacity={0.85}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* zlatni prsten */}
          <Circle cx={cx} cy={cy} r={r} stroke={ringColor} strokeWidth={ringWidth} fill="transparent" />

          {/* putanja za tekst */}
          <Defs><Path id={arcId} d={dTopArc} /></Defs>

          {/* naslov po luku – auto-fit bez sečenja slova */}
          <SvgText
            fill={ringColor}
            fontSize={fontSize}
            fontWeight="600"
            textLength={fitLen}
            lengthAdjust="spacing"   // prilagođava RAZMAKE, ne širinu slova
          >
            <TextPath href={`#${arcId}`} startOffset={startOffsetPx}>
              {title}
            </TextPath>
          </SvgText>
        </Svg>

        {/* ikona savršeno u centru */}
        <View style={StyleSheet.absoluteFillObject}>
          <View style={styles.center}>
            <Image
              source={image}
              style={{ width: imgSize, height: imgSize }}
              contentFit="contain"
            />
          </View>
        </View>

        {/* 🔒 vizuelni lock overlay — ne blokira dodir (guard radi navigaciju/toast) */}
        {locked && (
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <View
              style={{
                width: overlaySize,
                height: overlaySize,
                borderRadius: overlaySize / 2,
                backgroundColor: 'rgba(0,0,0,0.45)',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                top: ringWidth,
              }}
            >
              <Feather name="lock" size={lockIconSize} color={GOLD} />
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
