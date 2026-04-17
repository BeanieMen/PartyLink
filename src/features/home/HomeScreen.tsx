import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchParties } from '../../api/party.api';
import { queryKeys } from '../../api/query-keys';
import { NotificationMenuButton } from '../../components/NotificationMenuButton';
import { PartyPosterCard } from '../../components/PartyPosterCard';
import { ProfileMenuButton } from '../../components/ProfileMenuButton';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StateView } from '../../components/StateView';
import type { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/session-store';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

const PAGE_SIZE = 14;

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currentUserId = useSessionStore((state) => state.currentUserId);

  const partiesQuery = useInfiniteQuery({
    queryKey: [...queryKeys.parties(PAGE_SIZE), 'home-feed'],
    queryFn: ({ pageParam }) => fetchParties({ limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });

  const parties = partiesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const trending = parties.slice(0, 5);
  const freshPicks = parties.slice(5);

  const openParty = (partyId: string) => {
    if (!currentUserId) {
      navigation.navigate('AuthGate', {
        reason: 'Sign in to view full event details and reserve your spot.',
        partyId,
      });
      return;
    }

    navigation.navigate('PartyDetail', { partyId });
  };

  return (
    <ScreenContainer>
      <View style={styles.topRow}>
        <View style={styles.topActions}>
          <Pressable style={styles.iconWrap} onPress={() => navigation.navigate('Inbox')}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textPrimary} />
          </Pressable>
          <NotificationMenuButton />
          <ProfileMenuButton />
        </View>
      </View>

      <Text style={styles.brand}>PARTYLINK</Text>
      <Text style={styles.trendingLabel}>TRENDING EVENTS</Text>

      {partiesQuery.isLoading ? <StateView loading /> : null}
      {partiesQuery.isError ? (
        <StateView errorMessage={(partiesQuery.error as Error).message} onRetry={partiesQuery.refetch} />
      ) : null}

      {trending.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterRow}>
          {trending.map((party) => (
            <PartyPosterCard key={party.party_id} party={party} onPress={() => openParty(party.party_id)} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.discoveryHeader}>
        <Text style={styles.discoveryTitle}>Find New Experiences</Text>
        <Text style={styles.discoveryLink}>Live now</Text>
      </View>

      <View style={styles.compactList}>
        {freshPicks.slice(0, 6).map((party) => (
          <PartyPosterCard key={party.party_id} party={party} compact onPress={() => openParty(party.party_id)} />
        ))}
      </View>

      {partiesQuery.isSuccess && parties.length === 0 ? (
        <StateView emptyMessage="No events are listed yet. Check back in a moment." />
      ) : null}

      {partiesQuery.hasNextPage ? (
        <PrimaryButton
          label={partiesQuery.isFetchingNextPage ? 'Loading more events...' : 'Show more events'}
          variant="outline"
          disabled={partiesQuery.isFetchingNextPage}
          onPress={() => partiesQuery.fetchNextPage()}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  brand: {
    marginTop: 8,
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: 52,
    letterSpacing: 2,
    lineHeight: 50,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  trendingLabel: {
    marginTop: 8,
    marginBottom: 16,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 4,
  },
  posterRow: {
    paddingRight: 18,
    marginBottom: 24,
  },
  discoveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  discoveryTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  discoveryLink: {
    color: colors.accentMint,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  compactList: {
    gap: 12,
  },
});