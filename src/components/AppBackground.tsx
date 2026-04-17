import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradientStops } from '../theme/colors';

export function AppBackground({ children }: PropsWithChildren) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={gradientStops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <View pointerEvents="none" style={[styles.glow, styles.glowTop]} />
      <View pointerEvents="none" style={[styles.glow, styles.glowMiddle]} />
      <View pointerEvents="none" style={[styles.glow, styles.glowBottom]} />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.gradientTop,
  },
  glow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 250,
    opacity: 0.25,
  },
  glowTop: {
    right: -70,
    top: -40,
    backgroundColor: colors.accentRose,
  },
  glowMiddle: {
    left: -90,
    top: '35%',
    backgroundColor: colors.accentOrange,
  },
  glowBottom: {
    right: -70,
    bottom: -80,
    backgroundColor: colors.accentMint,
  },
});