import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  TextInput,
  Alert,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
  SafeAreaView,
  Image,
  Dimensions,
  Keyboard,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Send, ChevronLeft, MessageSquare, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors, { API_BASE_URL } from '@/constants';
import { GroupChatRow, GroupMessageRow, UserRow, GroupRow } from '@/types/database';

const AppColors = Colors.dark;
const { height: screenHeight } = Dimensions.get('window');

// Extend GroupChatRow to include a status field
interface GroupChatRowWithStatus extends GroupChatRow {
  status: 'pending' | 'accepted' | 'declined';
}

interface EnrichedGroupMessage extends GroupMessageRow {
  senderUser: UserRow | null;
}

interface UserMap {
  [userId: string]: UserRow;
}

interface InterGroupChatHeaderProps {
  chatData: { session: GroupChatRowWithStatus; groups: GroupRow[] };
  myOwnGroupId: string | undefined;
  onBackPress: () => void;
}

const InterGroupChatHeader: React.FC<InterGroupChatHeaderProps> = ({
  chatData,
  myOwnGroupId,
  onBackPress,
}) => {
  const insets = useSafeAreaInsets();

  if (!chatData || !chatData.groups || chatData.groups.length === 0) {
    return (
      <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
          <ChevronLeft size={24} color={AppColors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenterContent}>
          <Text style={styles.headerTitle}>Loading Chat...</Text>
        </View>
        <View style={styles.headerRightSpace} />
      </View>
    );
  }

  const { session, groups } = chatData;
  const otherGroup =
    groups.find((g) => g.group_id !== myOwnGroupId) ||
    (groups.length > 0 ? groups[0] : undefined);

  const getDisplayName = () => {
    if (otherGroup) {
      return `${otherGroup.creator_username}'s Group`;
    }
    return 'Group Chat';
  };

  const getSubtitle = () => {
    if (session.status === 'accepted') return 'Chat active';
    if (session.status === 'pending') return 'Chat request pending';
    if (session.status === 'declined') return 'Chat request declined';
    if (groups.length === 2)
      return `${groups[0].creator_username}'s Group & ${groups[1].creator_username}'s Group`;
    return 'Loading status...';
  };

  const getGroupImageUrl = (group: GroupRow | undefined) => {
    if (group?.creator_user_id) {
      return `${API_BASE_URL}/user/${group.creator_user_id}/profile-picture`;
    }
    return null;
  };

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
        <ChevronLeft size={24} color={AppColors.white} />
      </TouchableOpacity>
      <View style={styles.headerCenterContent}>
        <View style={styles.profileContainer}>
          {getGroupImageUrl(otherGroup) ? (
            <Image source={{ uri: getGroupImageUrl(otherGroup)! }} style={styles.profileImage} />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Users size={20} color={AppColors.gray400} />
            </View>
          )}
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {getDisplayName()}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {getSubtitle()}
          </Text>
        </View>
      </View>
      <View style={styles.headerRightSpace} />
    </View>
  );
};

interface MessageBubbleProps {
  message: EnrichedGroupMessage;
  isMyMessage: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMyMessage }) => {
  const bubbleStyles = isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble;
  const textStyles = isMyMessage ? styles.myMessageText : styles.otherMessageText;
  const senderNameStyles = isMyMessage ? styles.myMessageSenderName : styles.otherMessageSenderName;

  const formattedTime = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View
      style={[
        styles.messageBubbleContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
      ]}
    >
      <View style={bubbleStyles}>
        {!isMyMessage && (
          <Text style={senderNameStyles}>{message.senderUser?.username || 'Unknown User'}</Text>
        )}
        <Text style={textStyles}>{message.content}</Text>
        <Text style={styles.messageTimestamp}>{formattedTime}</Text>
      </View>
    </View>
  );
};

const HEADER_HEIGHT_ESTIMATE = Platform.OS === 'ios' ? 94 : 70;

const InterGroupChatScreen: React.FC = () => {
  const router = useRouter();
  const { sessionId: groupChatId } = useLocalSearchParams<{ sessionId: string }>();
  const { userId: myUserId, isLoaded, isSignedIn } = useAuth();

  const [messages, setMessages] = useState<EnrichedGroupMessage[]>([]);
  const [newMessageContent, setNewMessageContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [usersMap, setUsersMap] = useState<UserMap>({});
  const [chatData, setChatData] = useState<{
    session: GroupChatRowWithStatus;
    groups: GroupRow[];
  } | null>(null);
  const [myGroup, setMyGroup] = useState<GroupRow | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchMyGroup = useCallback(async () => {
    if (chatData && myUserId) {
      try {
        const myGroupRequest = await fetch(
          `${API_BASE_URL}/user/${myUserId}/party/${chatData.session.party_id}/group`
        );
        if (myGroupRequest.ok) {
          const myGroupData: GroupRow = await myGroupRequest.json();
          setMyGroup(myGroupData);
        }
      } catch (err) {
        console.error('Error fetching my group:', err);
      }
    }
  }, [myUserId, chatData]);

  useEffect(() => {
    if (isLoaded && isSignedIn && myUserId) {
      fetchMyGroup();
    }
  }, [fetchMyGroup, isLoaded, isSignedIn, myUserId]);

  const fetchChatData = useCallback(async () => {
    if (!groupChatId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/group-chat/${groupChatId}`);
      if (response.ok) {
        const data: { session: GroupChatRowWithStatus; groups: GroupRow[] } =
          await response.json();
        setChatData(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(`Failed to fetch chat details: ${errorData.error || response.status}`);
        console.warn(`Failed to fetch group chat data: ${response.status}`);
      }
    } catch (err) {
      setError('Error fetching group chat data.');
      console.error('Error fetching group chat data:', err);
    }
  }, [groupChatId]);

  const fetchGroupMessages = useCallback(
    async () => {
      if (!groupChatId || !myUserId) return;

      !refreshing && setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE_URL}/group-chat-message/${groupChatId}/messages`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch group messages: ${response.status}`);
        }
        const data: { messages: GroupMessageRow[] } = await response.json();

        const uniqueSenderIds = new Set<string>();
        data.messages.forEach((msg) => uniqueSenderIds.add(msg.sender_user_id));

        // Use functional update to avoid dependency on usersMap
        setUsersMap((prevUsersMap) => {
          const fetchedUsers: UserMap = { ...prevUsersMap };
          
          // We'll fetch users we don't have yet
          const usersToFetch = Array.from(uniqueSenderIds).filter(id => id && !fetchedUsers[id]);
          
          // Fetch users asynchronously without affecting the current state update
          if (usersToFetch.length > 0) {
            Promise.all(
              usersToFetch.map(async (id) => {
                try {
                  const userResponse = await fetch(`${API_BASE_URL}/user/${id}`);
                  if (userResponse.ok) {
                    const userData: UserRow = await userResponse.json();
                    setUsersMap(currentMap => ({ ...currentMap, [id]: userData }));
                  } else {
                    console.warn(`Failed to fetch user ${id}: ${userResponse.status}`);
                    setUsersMap(currentMap => ({ 
                      ...currentMap, 
                      [id]: { user_id: id, username: 'Unknown User' } as UserRow 
                    }));
                  }
                } catch (userErr) {
                  console.error(`Error fetching user ${id}:`, userErr);
                  setUsersMap(currentMap => ({ 
                    ...currentMap, 
                    [id]: { user_id: id, username: 'Unknown User' } as UserRow 
                  }));
                }
              })
            );
          }

          return fetchedUsers;
        });

        const enrichedMessages = data.messages
          .map((msg) => ({
            ...msg,
            senderUser: null, // Will be updated when users are fetched
          }))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        setMessages(enrichedMessages);
        await AsyncStorage.setItem(
          `group_chat_messages_${groupChatId}`,
          JSON.stringify(enrichedMessages)
        );

        if (!refreshing && enrichedMessages.length > 0) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      } catch (e: any) {
        setError(e.message || 'An error occurred while fetching group messages.');
        console.error('Error fetching group messages:', e);
        try {
          const cached = await AsyncStorage.getItem(`group_chat_messages_${groupChatId}`);
          if (cached) {
            const parsedCached: GroupMessageRow[] = JSON.parse(cached);
            const enrichedCachedMessages = parsedCached.map((msg) => ({
              ...msg,
              senderUser: null, // Will be updated when users are fetched
            }));
            setMessages(enrichedCachedMessages);
            Alert.alert('Offline Mode', 'Could not fetch latest data. Showing cached messages.');
          }
        } catch (cacheErr) {
          console.error('Failed to load cached messages:', cacheErr);
        }
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [groupChatId, myUserId, refreshing] // Removed usersMap from dependencies
  );

  // Update messages with user data when usersMap changes
  useEffect(() => {
    setMessages(prevMessages => 
      prevMessages.map(msg => ({
        ...msg,
        senderUser: usersMap[msg.sender_user_id] || null
      }))
    );
  }, [usersMap]);

  useEffect(() => {
    if (isLoaded && isSignedIn && myUserId && groupChatId) {
      fetchChatData();
      fetchGroupMessages();

      // ─── Use the new "/ws/group-chat/:groupChatId" path ────────────────────
      const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws')}/ws/group-chat/${groupChatId}`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => console.log(`WebSocket connected to ${wsUrl}`);

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);

          // Listen for server "refresh" events on group-chat
          if (data.type === 'refresh' && data.chatType === 'group-chat') {
            // Only refetch if the ID matches this screen's groupChatId
            if (data.chatId === groupChatId) {
              console.log('Received refresh event for group-chat, refetching messages & session...');
              fetchGroupMessages();
              fetchChatData();
            }
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      wsRef.current.onerror = (e) => console.error('WebSocket error:', e);
      wsRef.current.onclose = (e) => console.log('WebSocket closed:', e.code, e.reason);

      return () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
          console.log('WebSocket disconnected on component unmount/dependency change');
        }
      };
    }
  }, [
    isLoaded,
    isSignedIn,
    myUserId,
    groupChatId,
    fetchChatData,
    fetchGroupMessages,
    // Removed usersMap from dependencies - this was causing the infinite loop
  ]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChatData();
    fetchGroupMessages();
  }, [fetchChatData, fetchGroupMessages]);

  const handleSendMessage = async () => {
    if (!newMessageContent.trim() || !groupChatId || !myUserId) {
      Alert.alert('Error', 'Message content, chat ID, or sender ID is missing.');
      return;
    }

    const messageToSend = newMessageContent.trim();
    setNewMessageContent('');
    Keyboard.dismiss();

    const tempMessageId = `temp-${Date.now()}`;
    const optimisticMessage: EnrichedGroupMessage = {
      message_id: tempMessageId,
      group_chat_id: groupChatId,
      sender_user_id: myUserId,
      content: messageToSend,
      created_at: new Date().toISOString(),
      senderUser: usersMap[myUserId] || null,
    };

    setMessages((prevMessages) =>
      [...prevMessages, optimisticMessage].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    );
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const response = await fetch(
        `${API_BASE_URL}/group-chat-message/${groupChatId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender_user_id: myUserId, content: messageToSend }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to send message: ${response.status}`);
      }

      // We rely on the server's broadcastRefresh('group-chat', groupChatId)
      // to send a "{ type:'refresh', chatType:'group-chat', chatId }" event via WebSocket,
      // which in turn triggers fetchGroupMessages() above.
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send message.');
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.message_id !== tempMessageId)
      );
      setNewMessageContent(messageToSend);
    }
  };

  const renderEmptyList = (message: string) => (
    <View style={styles.noMessagesContainer}>
      <MessageSquare size={40} color={AppColors.gray400} style={styles.noMessagesIcon} />
      <Text style={styles.noMessagesText}>{message}</Text>
      {error && (
        <Text style={[styles.noMessagesText, { color: AppColors.red500, marginTop: 10 }]}>
          {error}
        </Text>
      )}
    </View>
  );

  if (!isLoaded || (!isSignedIn && !error) || (!myUserId && !error) || !groupChatId) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg]}
        style={styles.centeredStatusContainer}
      >
        <ActivityIndicator size="large" color={AppColors.pink500} />
        <Text style={styles.statusText}>Loading chat session...</Text>
        {error && (
          <Text style={[styles.statusText, { color: AppColors.red500, marginTop: 10 }]}>
            {error}
          </Text>
        )}
      </LinearGradient>
    );
  }

  if (isLoading && messages.length === 0 && !error) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg]}
        style={styles.centeredStatusContainer}
      >
        <ActivityIndicator size="large" color={AppColors.pink500} />
        <Text style={styles.statusText}>Loading messages...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[AppColors.primaryBg, AppColors.secondaryBg]} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        {chatData && myGroup && (
          <InterGroupChatHeader
            chatData={chatData}
            myOwnGroupId={myGroup.group_id}
            onBackPress={() =>
              router.canGoBack() ? router.back() : router.replace('/')
            }
          />
        )}
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          {error && messages.length === 0 ? (
            renderEmptyList(`Could not load messages. ${error}`)
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.message_id.toString()}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  isMyMessage={item.sender_user_id === myUserId}
                />
              )}
              ListEmptyComponent={
                !isLoading && messages.length === 0
                  ? renderEmptyList(
                      chatData?.session?.status === 'pending'
                        ? 'Chat request is pending. Messages will appear once accepted.'
                        : 'No messages yet. Start the conversation!'
                    )
                  : null
              }
              contentContainerStyle={styles.flatListContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={AppColors.pink500}
                />
              }
              showsVerticalScrollIndicator={false}
            />
          )}

          {chatData?.session?.status === 'accepted' ? (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={newMessageContent}
                onChangeText={setNewMessageContent}
                placeholder="Type your message..."
                placeholderTextColor={AppColors.gray400}
                multiline
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !newMessageContent.trim() && styles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={!newMessageContent.trim()}
              >
                <Send size={20} color={AppColors.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.chatDisabledContainer}>
              <Text style={styles.chatDisabledText}>
                {chatData?.session?.status === 'pending' &&
                  'This chat request is still pending. Messaging will be enabled once accepted.'}
                {chatData?.session?.status === 'declined' &&
                  'This chat request was declined. You cannot send messages.'}
                {!chatData?.session?.status &&
                  'Chat status unknown. Messaging disabled.'}
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  centeredStatusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusText: {
    marginTop: 15,
    fontSize: 18,
    color: AppColors.gray300,
    textAlign: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: AppColors.secondaryBg,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray500,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerCenterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  profileContainer: {
    marginRight: 12,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.gray500,
  },
  profilePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppColors.gray500,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: AppColors.gray400,
  },
  headerRightSpace: {
    width: 40,
  },
  flatListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexGrow: 1,
  },
  noMessagesContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    flex: 1,
  },
  noMessagesIcon: {
    marginBottom: 16,
  },
  noMessagesText: {
    fontSize: 16,
    color: AppColors.gray300,
    textAlign: 'center',
    lineHeight: 24,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
    marginLeft: '20%',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
    marginRight: '20%',
  },
  myMessageBubble: {
    backgroundColor: AppColors.blue500,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  myMessageText: {
    color: AppColors.white,
    fontSize: 16,
    lineHeight: 20,
  },
  otherMessageText: {
    color: AppColors.white,
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageSenderName: {
    display: 'none',
  },
  otherMessageSenderName: {
    fontSize: 12,
    color: AppColors.pink300,
    marginBottom: 4,
    fontWeight: '600',
  },
  messageTimestamp: {
    fontSize: 10,
    color: AppColors.gray400,
    alignSelf: 'flex-end',
    marginTop: 4,
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: AppColors.secondaryBg,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray500,
  },
  textInput: {
    flex: 1,
    backgroundColor: AppColors.inputBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    color: AppColors.white,
    marginRight: 12,
    maxHeight: 100,
    minHeight: 44,
  },
  sendButton: {
    backgroundColor: AppColors.pink500,
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: AppColors.gray500,
  },
  chatDisabledContainer: {
    padding: 16,
    backgroundColor: AppColors.secondaryBg,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray500,
  },
  chatDisabledText: {
    textAlign: 'center',
    color: AppColors.gray300,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default InterGroupChatScreen;