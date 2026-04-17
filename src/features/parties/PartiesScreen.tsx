import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { attendParty, fetchParties } from '../../api/party.api';
import { queryKeys } from '../../api/query-keys';
import { fetchMyAttendingParties } from '../../api/user.api';
import { AuthPromptCard } from '../../components/AuthPromptCard';
import { PartyPosterCard } from '../../components/PartyPosterCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StateView } from '../../components/StateView';
import type { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/session-store';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

const PAGE_SIZE = 12;

export function PartiesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const currentUserId = useSessionStore((state) => state.currentUserId);
  const [optimisticAttending, setOptimisticAttending] = useState<Record<string, boolean>>({});

  const partiesQuery = useInfiniteQuery({
    queryKey: [...queryKeys.parties(PAGE_SIZE), 'infinite'],
    queryFn: ({ pageParam }) => fetchParties({ limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: Boolean(currentUserId),
  });

  const attendingQuery = useQuery({
    queryKey: queryKeys.userAttending(currentUserId),
    queryFn: () => fetchMyAttendingParties(currentUserId as string),
    enabled: Boolean(currentUserId),
  });

  const rsvpMutation = useMutation({
    mutationFn: (partyId: string) => attendParty(partyId),
    onMutate: (partyId) => {
      setOptimisticAttending((prev) => ({ ...prev, [partyId]: true }));
    },
    onError: (_error, partyId) => {
      setOptimisticAttending((prev) => {
        const copy = { ...prev };
        delete copy[partyId];
        return copy;
      });
    },
    onSuccess: async () => {
      if (!currentUserId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.userAttending(currentUserId) });
    },
  });

  const parties = useMemo(() => partiesQuery.data?.pages.flatMap((page) => page.items) ?? [], [partiesQuery.data?.pages]);

  const attendingSet = useMemo(() => {
    const ids = new Set(attendingQuery.data ?? []);
    for (const partyId of Object.keys(optimisticAttending)) {
      ids.add(partyId);
    }
    return ids;
  }, [attendingQuery.data, optimisticAttending]);

  if (!currentUserId) {
    return (
      <ScreenContainer>
        <Text style={styles.pageTitle}>Parties</Text>
        <Text style={styles.pageHint}>No hard login wall. Sign in only when you want to enter party flows.</Text>

        <AuthPromptCard
          title="Sign in to join events"
          description="You can browse first, then sign in when you want to reserve and connect."
          onPressLogin={() => navigation.navigate('AuthGate', { reason: 'Login required to access parties.' })}
          ctaLabel="Unlock party features"
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.pageTitle}>Parties</Text>
      <Text style={styles.pageHint}>Live events selected for tonight and beyond.</Text>

      {partiesQuery.isLoading ? <StateView loading /> : null}
      {partiesQuery.isError ? (
        <StateView errorMessage={(partiesQuery.error as Error).message} onRetry={partiesQuery.refetch} />
      ) : null}

      <View style={styles.listWrap}>
        {parties.map((party) => {
          const isAttending = attendingSet.has(party.party_id);
          return (
            <View key={party.party_id} style={styles.itemWrap}>
              <PartyPosterCard
                party={party}
                compact
                onPress={() => navigation.navigate('PartyDetail', { partyId: party.party_id })}
              />
              <View style={styles.itemActions}>
                <PrimaryButton
                  label="Details"
                  variant="outline"
                  onPress={() => navigation.navigate('PartyDetail', { partyId: party.party_id })}
                />
                <PrimaryButton
                  label={isAttending ? 'Ticketed' : 'Get Ticket'}
                  disabled={isAttending}
                  loading={rsvpMutation.isPending && !isAttending}
                  onPress={() => rsvpMutation.mutate(party.party_id)}
                />
              </View>
            </View>
          );
        })}
      </View>

      {partiesQuery.isSuccess && parties.length === 0 ? (
        <StateView emptyMessage="No events right now. New ones will appear soon." />
      ) : null}

      {partiesQuery.hasNextPage ? (
        <PrimaryButton
          label={partiesQuery.isFetchingNextPage ? 'Loading more...' : 'Load more parties'}
          variant="outline"
          disabled={partiesQuery.isFetchingNextPage}
          onPress={() => partiesQuery.fetchNextPage()}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 16,
  },
  listWrap: {
    gap: 14,
  },
  itemWrap: {
    gap: 10,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 10,
  },
});