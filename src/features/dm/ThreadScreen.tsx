import { useMemo, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchThreadMessages, sendThreadMessage } from '../../api/dm.api';
import { queryKeys } from '../../api/query-keys';
import { AuthPromptCard } from '../../components/AuthPromptCard';
import { GlassCard } from '../../components/GlassCard';
import { ProfileMenuButton } from '../../components/ProfileMenuButton';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StateView } from '../../components/StateView';
import type { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/session-store';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

type ThreadRoute = RouteProp<RootStackParamList, 'ThreadDetail'>;

const PAGE_SIZE = 25;

export function ThreadScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ThreadRoute>();
  const currentUserId = useSessionStore((state) => state.currentUserId);
  const [draft, setDraft] = useState('');

  const threadId = route.params.threadId;

  const messagesQuery = useInfiniteQuery({
    queryKey: [...queryKeys.dmMessages(threadId, currentUserId), 'infinite'],
    queryFn: ({ pageParam }) => fetchThreadMessages(threadId, { limit: PAGE_SIZE, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: Boolean(currentUserId),
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendThreadMessage(threadId, body),
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.dmMessages(threadId, currentUserId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.dmThreads(currentUserId) });
    },
  });

  const messages = useMemo(() => {
    const all = messagesQuery.data?.pages.flatMap((page) => page.items) ?? [];
    return [...all].reverse();
  }, [messagesQuery.data?.pages]);

  if (!currentUserId) {
    return (
      <ScreenContainer>
        <AuthPromptCard
          title="Sign in to open this chat"
          description="Sign in when you are ready to read and send messages."
          onPressLogin={() => navigation.navigate('AuthGate', { reason: 'Sign in to open this chat.' })}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Conversation</Text>
        <ProfileMenuButton />
      </View>

      {messagesQuery.isLoading ? <StateView loading /> : null}
      {messagesQuery.isError ? <StateView errorMessage={(messagesQuery.error as Error).message} onRetry={messagesQuery.refetch} /> : null}

      <View style={styles.messageList}>
        {messages.map((message) => {
          const mine = message.sender_user_id === currentUserId;
          return (
            <View key={message.id} style={[styles.messageRow, mine ? styles.mine : styles.other]}>
              <Text style={styles.messageText}>{message.body}</Text>
              <Text style={styles.messageMeta}>{mine ? 'You' : message.sender_user_id}</Text>
            </View>
          );
        })}
      </View>

      {messagesQuery.isSuccess && messages.length === 0 ? <StateView emptyMessage="No messages yet. Start the conversation." /> : null}

      {messagesQuery.hasNextPage ? (
        <PrimaryButton
          label={messagesQuery.isFetchingNextPage ? 'Loading older messages...' : 'Load older'}
          variant="outline"
          disabled={messagesQuery.isFetchingNextPage}
          onPress={() => messagesQuery.fetchNextPage()}
        />
      ) : null}

      <GlassCard style={styles.composerCard}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={4000}
          style={styles.composerInput}
          placeholder="Write your message..."
          placeholderTextColor="rgba(255,255,255,0.55)"
        />
        <PrimaryButton
          label="Send"
          loading={sendMutation.isPending}
          disabled={!draft.trim()}
          onPress={() => sendMutation.mutate(draft.trim())}
        />
      </GlassCard>
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
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: 'center',
  },
  messageList: {
    gap: 8,
    marginBottom: 10,
  },
  messageRow: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: '86%',
  },
  mine: {
    marginLeft: 'auto',
    backgroundColor: '#F9A03F',
  },
  other: {
    marginRight: 'auto',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageText: {
    color: colors.textPrimary,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  messageMeta: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.74)',
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  composerCard: {
    gap: 8,
    marginTop: 10,
  },
  composerInput: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});