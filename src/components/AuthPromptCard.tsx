import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { GlassCard } from './GlassCard';
import { PrimaryButton } from './PrimaryButton';

interface AuthPromptCardProps {
  title: string;
  description: string;
  onPressLogin: () => void;
  ctaLabel?: string;
}

export function AuthPromptCard({ title, description, onPressLogin, ctaLabel = 'Sign in' }: AuthPromptCardProps) {
  return (
    <GlassCard>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <PrimaryButton label={ctaLabel} onPress={onPressLogin} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
    gap: 6,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  description: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
});