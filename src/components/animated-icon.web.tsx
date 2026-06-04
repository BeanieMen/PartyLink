import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Keyframe, Easing, FadeInDown } from 'react-native-reanimated';

// @ts-ignore
import classes from './animated-icon.module.css';
const DURATION = 300;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(false), 900);
    return () => clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.webSplash}>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.splashCard}>
        <View style={styles.bubbleRow}>
          <View style={[styles.bubble, styles.bubblePeach]} />
          <View style={[styles.bubble, styles.bubbleHoney]} />
          <View style={[styles.bubble, styles.bubbleLavender]} />
        </View>
        <Text style={styles.splashTitle}>PARTYLINK</Text>
      </Animated.View>
    </View>
  );
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: 0 }],
  },
  60: {
    transform: [{ scale: 1.2 }],
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(1.2),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    opacity: 0,
  },
  60: {
    transform: [{ scale: 1.2 }],
    opacity: 0,
    easing: Easing.elastic(1.2),
  },
  100: {
    transform: [{ scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(1.2),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '-180deg' }, { scale: 0.8 }],
    opacity: 0,
  },
  [DURATION / 1000]: {
    transform: [{ rotateZ: '0deg' }, { scale: 1 }],
    opacity: 1,
    easing: Easing.elastic(0.7),
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View style={styles.background} entering={keyframe.duration(DURATION)}>
        <div className={classes.expoLogoBackground} />
      </Animated.View>

      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    zIndex: 1000,
    position: 'absolute',
    top: 128 / 2 + 138,
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
  },
  image: {
    position: 'absolute',
    width: 76,
    height: 71,
  },
  background: {
    width: 128,
    height: 128,
    position: 'absolute',
  },
  webSplash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff8f0',
  },
  splashCard: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#f0ded8',
  },
  bubbleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  bubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  bubblePeach: {
    backgroundColor: '#ffb8a3',
  },
  bubbleHoney: {
    backgroundColor: '#ffe69b',
  },
  bubbleLavender: {
    backgroundColor: '#b9a7ff',
  },
  splashTitle: {
    color: '#3b2f38',
    fontSize: 30,
    fontWeight: '900',
  },
});
