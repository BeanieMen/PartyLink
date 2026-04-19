import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { createDmThread, fetchDmThreads, updateDmThreadStatus } from '../../api/dm.api';
import { queryKeys } from '../../api/query-keys';
import { userProfilePictureUrl } from '../../api/user.api';
import { AuthPromptCard } from '../../components/AuthPromptCard';
import { GlassCard } from '../../components/GlassCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StateView } from '../../components/StateView';
import type { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/session-store';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

const PAGE_SIZE = 15;

type InboxRoute = RouteProp<RootStackParamList, 'Inbox'>;

function shortId(value: string) {
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function statusTone(status: string) {
  if (status === 'accepted' || status === 'accept') return 'live';
  if (status === 'pending') return 'pending';
  if (status === 'decline' || status === 'close' || status === 'block') return 'closed';
  return 'pending';
}

export function InboxScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<InboxRoute>();
  const queryClient = useQueryClient();
  const currentUserId = useSessionStore((state) => state.currentUserId);

  const [targetUserId, setTargetUserId] = useState('');
  const [partyId, setPartyId] = useState(route.params?.partyId ?? '');

  useEffect(() => {
    if (route.params?.partyId) {
      setPartyId(route.params.partyId);
    }
  }, [route.params?.partyId]);

  const threadsQuery = useInfiniteQuery({
    queryKey: [...queryKeys.dmThreads(currentUserId), 'infinite'],
    queryFn: ({ pageParam }) => fetchDmThreads({ limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: Boolean(currentUserId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { targetUserId: string; partyId?: string }) => createDmThread(payload),
    onSuccess: async (data) => {
      if (!currentUserId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.dmThreads(currentUserId) });
      setTargetUserId('');
      navigation.push('ThreadDetail', {
        threadId: data.threadId,
        partyId: partyId.trim() || undefined,
        mode: 'crew-link',
        partnerUserId: targetUserId.trim(),
        sourceGroupId: route.params?.sourceGroupId,
        threadStatus: data.status,
      });
    },
  });

  const threadActionMutation = useMutation({
    mutationFn: ({ threadId, action }: { threadId: string; action: 'accept' | 'decline' | 'block' | 'close' }) =>
      updateDmThreadStatus(threadId, action),
    onSuccess: async () => {
      if (!currentUserId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.dmThreads(currentUserId) });
    },
  });

  const threads = useMemo(() => threadsQuery.data?.pages.flatMap((page) => page.items) ?? [], [threadsQuery.data?.pages]);
  const contextPartyId = route.params?.partyId;
  const visibleThreads = useMemo(() => {
    if (!contextPartyId) return threads;
    return threads.filter((thread) => thread.party_id === contextPartyId);
  }, [contextPartyId, threads]);

  if (!currentUserId) {
    return (
      <ScreenContainer>
        <Text style={styles.pageTitle}>Inbox</Text>
        <Text style={styles.pageHint}>Your messages and invites live here.</Text>
        <AuthPromptCard
          title="Sign in to open your inbox"
          description="Stay signed out while browsing, then sign in when you want to chat."
          onPressLogin={() => navigation.navigate('AuthGate', { reason: 'Sign in to open your inbox.' })}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.pageTitle}>Crew Chat</Text>
      <Text style={styles.pageHint}>Group Link requests and active crew conversations.</Text>

      {contextPartyId ? (
        <View style={styles.contextChip}>
          <Text style={styles.contextLabel}>Event scoped</Text>
          <Text style={styles.contextValue}>{shortId(contextPartyId)}</Text>
        </View>
      ) : null}

      <GlassCard style={styles.createCard}>
        <Text style={styles.sectionTitle}>Send Group DM Request</Text>
        <Text style={styles.sectionHint}>Share another crew leader id to start a controlled Crew Link request.</Text>

        <Text style={styles.fieldLabel}>Target crew leader id</Text>
        <TextInput
          value={targetUserId}
          onChangeText={setTargetUserId}
          autoCapitalize="none"
          style={styles.input}
          placeholder="Enter leader user id"
          placeholderTextColor="rgba(255,255,255,0.55)"
        />

        <Text style={styles.fieldLabel}>Event id (optional)</Text>
        <TextInput
          value={partyId}
          onChangeText={setPartyId}
          autoCapitalize="none"
          style={styles.input}
          placeholder="Attach an event id"
          placeholderTextColor="rgba(255,255,255,0.55)"
        />

        <PrimaryButton
          label="Send Crew Request"
          loading={createMutation.isPending}
          disabled={!targetUserId.trim()}
          onPress={() =>
            createMutation.mutate({
              targetUserId: targetUserId.trim(),
              partyId: partyId.trim() || undefined,
            })
          }
        />
      </GlassCard>

      {threadsQuery.isLoading ? <StateView loading /> : null}
      {threadsQuery.isError ? <StateView errorMessage={(threadsQuery.error as Error).message} onRetry={threadsQuery.refetch} /> : null}

      <View style={styles.threadList}>
        {visibleThreads.map((thread) => {
          const partner = thread.participant_a === currentUserId ? thread.participant_b : thread.participant_a;
          const tone = statusTone(thread.status);
          const focused = route.params?.focusThreadId === thread.id;
          return (
            <GlassCard key={thread.id} style={[styles.threadCard, focused && styles.threadCardFocused]}>
              <View style={styles.threadTopRow}>
                <Text style={styles.threadTitle}>Group Link with {shortId(partner)}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    tone === 'live' ? styles.statusBadgeLive : tone === 'closed' ? styles.statusBadgeClosed : styles.statusBadgePending,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>{thread.status}</Text>
                </View>
              </View>

              <View style={styles.memberStrip}>
                <Image source={{ uri: userProfilePictureUrl(currentUserId) }} style={styles.memberAvatar} />
                <Image source={{ uri: userProfilePictureUrl(partner) }} style={styles.memberAvatar} />
                <Text style={styles.memberStripText}>Your crew + linked crew leaders</Text>
              </View>

              <Text style={styles.threadMeta}>Thread {shortId(thread.id)} · {thread.updated_at}</Text>
              {thread.party_id ? <Text style={styles.threadParty}>Event {shortId(thread.party_id)}</Text> : null}
              <View style={styles.threadActions}>
                <PrimaryButton
                  label="Open"
                  variant="outline"
                  onPress={() =>
                    navigation.push('ThreadDetail', {
                      threadId: thread.id,
                      partyId: thread.party_id ?? undefined,
                      mode: 'crew-link',
                      partnerUserId: partner,
                      sourceGroupId: route.params?.sourceGroupId,
                      threadStatus: thread.status,
                    })
                  }
                />
                {thread.status === 'pending' ? (
                  <PrimaryButton
                    label="Decline"
                    variant="ghost"
                    onPress={() => threadActionMutation.mutate({ threadId: thread.id, action: 'decline' })}
                  />
                ) : null}
                {(thread.status === 'accepted' || thread.status === 'accept' || thread.status === 'pending') ? (
                  <PrimaryButton
                    label="Close"
                    variant="ghost"
                    onPress={() => threadActionMutation.mutate({ threadId: thread.id, action: 'close' })}
                  />
                ) : null}
              </View>
            </GlassCard>
          );
        })}
      </View>

      {threadsQuery.isSuccess && visibleThreads.length === 0 ? (
        <StateView emptyMessage="No crew chats yet. Send a request to start one." />
      ) : null}

      {threadsQuery.hasNextPage ? (
        <PrimaryButton
          label={threadsQuery.isFetchingNextPage ? 'Loading more...' : 'Load more chats'}
          variant="outline"
          disabled={threadsQuery.isFetchingNextPage}
          onPress={() => threadsQuery.fetchNextPage()}
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
    marginBottom: 14,
  },
  contextChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  contextLabel: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  contextValue: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  createCard: {
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  sectionHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  threadList: {
    gap: 10,
  },
  threadCard: {
    gap: 8,
  },
  threadCardFocused: {
    borderColor: colors.accentMint,
    borderWidth: 1,
  },
  threadTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  threadTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  statusBadgePending: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  statusBadgeLive: {
    backgroundColor: 'rgba(53,214,177,0.22)',
  },
  statusBadgeClosed: {
    backgroundColor: 'rgba(255,98,116,0.18)',
  },
  statusBadgeText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  memberStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberStripText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  threadMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  threadParty: {
    color: colors.accentMint,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  threadActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});