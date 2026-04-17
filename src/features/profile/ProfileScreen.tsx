import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchMeProfile, fetchPublicProfile, userPortraitUrl, userProfilePictureUrl } from '../../api/user.api';
import { queryKeys } from '../../api/query-keys';
import { AuthPromptCard } from '../../components/AuthPromptCard';
import { GlassCard } from '../../components/GlassCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StateView } from '../../components/StateView';
import type { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/session-store';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { compactText } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

interface DisplayProfile {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  school: string | null;
  email?: string;
}

export function ProfileScreen({ navigation, route }: Props) {
  const currentUserId = useSessionStore((state) => state.currentUserId);
  const viewedUserId = route.params?.userId ?? currentUserId ?? null;
  const isSelf = Boolean(currentUserId && viewedUserId === currentUserId);

  const meQuery = useQuery({
    queryKey: queryKeys.me(currentUserId),
    queryFn: () => fetchMeProfile(),
    enabled: isSelf,
  });

  const publicProfileQuery = useQuery({
    queryKey: viewedUserId ? queryKeys.publicUser(viewedUserId) : ['public-user', 'none'],
    queryFn: () => fetchPublicProfile(viewedUserId as string),
    enabled: Boolean(viewedUserId && !isSelf),
  });

  if (!viewedUserId) {
    return (
      <ScreenContainer>
        <Text style={styles.pageTitle}>Profile</Text>
        <Text style={styles.pageHint}>Sign in to open your profile.</Text>
        <AuthPromptCard
          title="Sign in to open profile"
          description="You can still browse events without logging in."
          onPressLogin={() => navigation.navigate('AuthGate', { reason: 'Sign in to open your profile.' })}
        />
      </ScreenContainer>
    );
  }

  const loading = isSelf ? meQuery.isLoading : publicProfileQuery.isLoading;
  const error = isSelf ? (meQuery.error as Error | null) : (publicProfileQuery.error as Error | null);

  const profile: DisplayProfile | null = isSelf
    ? meQuery.data
      ? {
          id: meQuery.data.id,
          username: meQuery.data.username,
          displayName: meQuery.data.display_name,
          bio: meQuery.data.bio,
          school: meQuery.data.school,
          email: meQuery.data.email,
        }
      : null
    : publicProfileQuery.data
      ? {
          id: publicProfileQuery.data.id,
          username: publicProfileQuery.data.username,
          displayName: publicProfileQuery.data.display_name,
          bio: publicProfileQuery.data.bio,
          school: publicProfileQuery.data.school,
        }
      : null;

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Profile</Text>
        {isSelf ? (
          <Pressable style={styles.editButton} onPress={() => navigation.navigate('AccountEdit')}>
            <Ionicons name="create-outline" size={14} color={colors.textPrimary} />
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        ) : (
          <View style={styles.editPlaceholder} />
        )}
      </View>

      {loading ? <StateView loading /> : null}
      {error ? <StateView errorMessage={error.message} onRetry={isSelf ? meQuery.refetch : publicProfileQuery.refetch} /> : null}

      {profile ? (
        <>
          <View style={styles.heroWrap}>
            <Image source={{ uri: userPortraitUrl(profile.id) }} style={styles.heroImage} />
            <View style={styles.heroFade} />

            <View style={styles.heroContent}>
              <Image source={{ uri: userProfilePictureUrl(profile.id) }} style={styles.avatar} />
              <View style={styles.heroMeta}>
                <Text style={styles.heroName}>{compactText(profile.displayName, profile.username)}</Text>
                <Text style={styles.heroHandle}>@{profile.username}</Text>
                <Text style={styles.heroSchool}>{compactText(profile.school, 'School not shared')}</Text>
              </View>
            </View>
          </View>

          <GlassCard style={styles.aboutCard}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.aboutText}>{compactText(profile.bio, 'No bio yet. This user has not added details.')}</Text>
          </GlassCard>

          <GlassCard style={styles.metaCard}>
            <Text style={styles.infoLabel}>{isSelf ? 'Email' : 'Visibility'}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {isSelf ? compactText(profile.email, 'Not shared') : 'Public profile'}
            </Text>
          </GlassCard>

          {!isSelf ? (
            <GlassCard style={styles.publicNoteCard}>
              <Text style={styles.publicNoteTitle}>Public View</Text>
              <Text style={styles.publicNoteText}>This layout is optimized for search results and user discovery.</Text>
            </GlassCard>
          ) : null}
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 14,
    gap: 10,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    letterSpacing: 1,
  },
  editButton: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  editPlaceholder: {
    width: 74,
    height: 34,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 46,
    marginTop: 8,
  },
  pageHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: 12,
  },
  heroWrap: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  heroImage: {
    width: '100%',
    height: 340,
  },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,8,18,0.22)',
  },
  heroContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.surfaceLight,
  },
  heroMeta: {
    flex: 1,
    gap: 2,
  },
  heroName: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 23,
  },
  heroHandle: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  heroSchool: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
    opacity: 0.95,
  },
  aboutCard: {
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  aboutText: {
    color: colors.textPrimary,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  metaCard: {
    gap: 6,
    marginBottom: 10,
  },
  infoLabel: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  infoValue: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 20,
  },
  publicNoteCard: {
    gap: 6,
    marginBottom: 10,
  },
  publicNoteTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  publicNoteText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
});
