import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { createDmThread, fetchDmThreads, updateDmThreadStatus } from '../../api/dm.api';
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

const PAGE_SIZE = 15;

export function InboxScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const currentUserId = useSessionStore((state) => state.currentUserId);

  const [targetUserId, setTargetUserId] = useState('');
  const [partyId, setPartyId] = useState('');

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
      setPartyId('');
      navigation.navigate('ThreadDetail', { threadId: data.threadId });
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
      <Text style={styles.pageTitle}>Inbox</Text>
      <Text style={styles.pageHint}>Start a conversation and keep the vibe going.</Text>

      <GlassCard style={styles.createCard}>
        <Text style={styles.fieldLabel}>Who do you want to message?</Text>
        <TextInput
          value={targetUserId}
          onChangeText={setTargetUserId}
          autoCapitalize="none"
          style={styles.input}
          placeholder="Enter profile code"
          placeholderTextColor="rgba(255,255,255,0.55)"
        />

        <Text style={styles.fieldLabel}>Event code (optional)</Text>
        <TextInput
          value={partyId}
          onChangeText={setPartyId}
          autoCapitalize="none"
          style={styles.input}
          placeholder="Add event code"
          placeholderTextColor="rgba(255,255,255,0.55)"
        />

        <PrimaryButton
          label="Open conversation"
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
        {threads.map((thread) => {
          const partner = thread.participant_a === currentUserId ? thread.participant_b : thread.participant_a;
          return (
            <GlassCard key={thread.id} style={styles.threadCard}>
              <Text style={styles.threadTitle}>Chat with {partner}</Text>
              <Text style={styles.threadMeta}>{thread.status} · {thread.updated_at}</Text>
              <View style={styles.threadActions}>
                <PrimaryButton
                  label="Open"
                  variant="outline"
                  onPress={() => navigation.navigate('ThreadDetail', { threadId: thread.id })}
                />
                <PrimaryButton
                  label="Accept"
                  variant="ghost"
                  onPress={() => threadActionMutation.mutate({ threadId: thread.id, action: 'accept' })}
                />
                <PrimaryButton
                  label="Close"
                  variant="ghost"
                  onPress={() => threadActionMutation.mutate({ threadId: thread.id, action: 'close' })}
                />
              </View>
            </GlassCard>
          );
        })}
      </View>

      {threadsQuery.isSuccess && threads.length === 0 ? <StateView emptyMessage="No chats yet. Start one above." /> : null}

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
  createCard: {
    gap: 8,
    marginBottom: 14,
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
  threadTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  threadMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  threadActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});