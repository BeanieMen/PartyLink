import { Image } from 'expo-image';
import { useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOut, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: INITIAL_SCALE_FACTOR }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  return (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.backgroundSolidColor}
    >
      <Animated.View entering={FadeInDown.delay(120).duration(520)} exiting={FadeOut.duration(160)} style={styles.splashCard}>
        <View style={styles.bubbleRow}>
          <View style={[styles.bubble, styles.bubblePeach]} />
          <View style={[styles.bubble, styles.bubbleHoney]} />
          <View style={[styles.bubble, styles.bubbleLavender]} />
        </View>
        <Text style={styles.splashTitle}>PARTYLINK</Text>
        <Text style={styles.splashText}>warming up the night</Text>
      </Animated.View>
    </Animated.View>
  );
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: INITIAL_SCALE_FACTOR }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
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

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.background} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    zIndex: 100,
  },
  image: {
    position: 'absolute',
    width: 76,
    height: 71,
  },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  backgroundSolidColor: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#fff8f0',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffdf8',
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#f0ded8',
    shadowColor: '#d95d77',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
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
    fontFamily: 'AvenirNext-Heavy',
    letterSpacing: 0,
  },
  splashText: {
    color: '#7f6f78',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 6,
  },
});
