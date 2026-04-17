import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { PrimaryButton } from './PrimaryButton';

interface StateViewProps {
  loading?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
}

export function StateView({ loading, errorMessage, emptyMessage, onRetry }: StateViewProps) {
  if (loading) {
    return (
      <View style={styles.stateWrap}>
        <ActivityIndicator color={colors.accentOrange} size="small" />
        <Text style={styles.message}>Loading party energy...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.stateWrap}>
        <Text style={styles.title}>Something went off-beat</Text>
        <Text style={styles.message}>{errorMessage}</Text>
        {onRetry ? <PrimaryButton label="Try again" onPress={onRetry} variant="outline" /> : null}
      </View>
    );
  }

  if (emptyMessage) {
    return (
      <View style={styles.stateWrap}>
        <Text style={styles.title}>Nothing yet</Text>
        <Text style={styles.message}>{emptyMessage}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  stateWrap: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 10,
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  message: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    textAlign: 'center',
    lineHeight: 20,
  },
});