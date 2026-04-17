import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from './AppBackground';

interface ScreenContainerProps {
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  padded?: boolean;
}

export function ScreenContainer({ children, scroll = true, style, contentContainerStyle, padded = true }: PropsWithChildren<ScreenContainerProps>) {
  return (
    <AppBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {scroll ? (
          <ScrollView
            style={style}
            contentContainerStyle={[styles.scrollContent, padded && styles.padded, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, padded && styles.padded, style]}>{children}</View>
        )}
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  padded: {
    paddingHorizontal: 18,
  },
});