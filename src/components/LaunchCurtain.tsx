import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '../theme/typography';

interface LaunchCurtainProps {
  canReveal: boolean;
  onRevealComplete: () => void;
}

export function LaunchCurtain({ canReveal, onRevealComplete }: LaunchCurtainProps) {
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!canReveal || hasStarted.current) return;

    hasStarted.current = true;

    Animated.sequence([
      Animated.delay(3000),
      Animated.timing(translateY, {
        toValue: -height - 120,
        duration: 900,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onRevealComplete();
      }
    });
  }, [canReveal, height, onRevealComplete, translateY]);

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateY }] }]}>
      <LinearGradient colors={['#090909', '#18181B', '#28282C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={styles.title}>partylink</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  title: {
    color: '#ECECEC',
    fontFamily: fonts.display,
    fontSize: 68,
    letterSpacing: 2.5,
    textTransform: 'lowercase',
  },
});