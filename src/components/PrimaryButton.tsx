import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

type ButtonVariant = 'primary' | 'outline' | 'ghost';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
}

export function PrimaryButton({ label, onPress, disabled, loading, variant = 'primary' }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.textDark : colors.textPrimary} />
      ) : (
        <Text style={[styles.label, variant !== 'primary' && styles.labelAlt]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: colors.accentOrange,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textDark,
    letterSpacing: 0.4,
  },
  labelAlt: {
    color: colors.textPrimary,
  },
});