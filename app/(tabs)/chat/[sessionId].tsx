import React, { useState, useEffect, useCallback, useRef } from 'react'
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
} from 'react-native'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { Send, ChevronLeft, MessageSquare, User } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Colors, { API_BASE_URL } from '@/constants'
import { ChatSessionRow, GroupMessageRow, UserRow } from '@/types/database'

const AppColors = Colors.dark
const { height: screenHeight } = Dimensions.get('window')

interface EnrichedGroupMessage extends GroupMessageRow {
  senderUser: UserRow | null
}

interface UserMap {
  [userId: string]: UserRow
}

interface ChatHeaderProps {
  groupChatInfo: { session: ChatSessionRow; participants: UserRow[] }
  myUserId: string
  onBackPress: () => void
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ groupChatInfo, myUserId, onBackPress }) => {
  const insets = useSafeAreaInsets() // Use useSafeAreaInsets here

  if (!groupChatInfo) return null

  const otherParticipants = groupChatInfo.participants?.filter((p) => p.user_id !== myUserId) || []
  const primaryUser = otherParticipants[0]

  const getDisplayName = () => {
    // For 1-on-1 chats, display the opponent's username.
    // For group chats, you might want to display the group name here,
    // but based on the provided ChatSessionRow, it's a 1-on-1 session.
    return primaryUser?.username || 'Unknown User'
  }

  const getSubtitle = () => {
    if (groupChatInfo.session.status === 'accepted') {
      return 'Active now'
    }
    if (groupChatInfo.session.status === 'pending') {
      return 'Request pending'
    }
    if (groupChatInfo.session.status === 'declined') {
      return 'Chat declined'
    }
    return ''
  }

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
        <ChevronLeft size={24} color={AppColors.white} />
      </TouchableOpacity>

      <View style={styles.headerCenterContent}>
        <View style={styles.profileContainer}>
          {primaryUser?.user_id ? (
            <Image
              source={{ uri: `${API_BASE_URL}/user/${primaryUser.user_id}/profile-picture` }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profilePlaceholder}>
              <User size={20} color={AppColors.gray400} />
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
  )
}

interface MessageBubbleProps {
  message: EnrichedGroupMessage
  isMyMessage: boolean
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isMyMessage }) => {
  const bubbleStyles = isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
  const textStyles = isMyMessage ? styles.myMessageText : styles.otherMessageText
  const senderNameStyles = isMyMessage ? styles.myMessageSenderName : styles.otherMessageSenderName // Defined here

  const formattedTime = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

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
  )
}

// Estimate the height of the ChatHeader component for KeyboardAvoidingView offset
// Based on styles: paddingTop: dynamic (insets.top + 12), paddingVertical: 12 (top+bottom), plus content
// Let's use a slightly more robust estimation, or pass the actual height
const HEADER_HEIGHT_ESTIMATE = Platform.OS === 'ios' ? 94 : 70 // A reasonable estimate for iOS (including safe area) and Android

const GroupChatScreen: React.FC = () => {
  const router = useRouter()
  const { sessionId: chatSessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { userId: myUserId, isLoaded, isSignedIn } = useAuth()
  const insets = useSafeAreaInsets() // Used for safe area insets

  const [messages, setMessages] = useState<EnrichedGroupMessage[]>([])
  const [newMessageContent, setNewMessageContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [usersMap, setUsersMap] = useState<UserMap>({})
  const [chatSessionInfo, setChatSessionInfo] = useState<{
    session: ChatSessionRow
    participants: UserRow[]
  } | null>(null)

  const flatListRef = useRef<FlatList>(null)
  const wsRef = useRef<WebSocket | null>(null)


  const fetchChatSessionInfo = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/${chatSessionId}`)
      if (response.ok) {
        const sessionData: { session: ChatSessionRow; participants: UserRow[] } =
          await response.json()

        setChatSessionInfo(sessionData)
      } else {
        console.warn(`Failed to fetch chat session info: ${response.status}`)
      }
    } catch (error) {
      console.error('Error fetching chat session info:', error)
    }
  }, [chatSessionId])

  const fetchMessages = useCallback(async () => {
    if (!chatSessionId || !myUserId) return

    !refreshing && setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/chat-message/${chatSessionId}/messages`)
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`)
      }
      const data: { messages: GroupMessageRow[] } = await response.json()

      const uniqueSenderIds = new Set<string>()
      data.messages.forEach((msg) => uniqueSenderIds.add(msg.sender_user_id))

      const fetchedUsers: UserMap = {}
      await Promise.all(
        Array.from(uniqueSenderIds).map(async (id) => {
          if (!id) return
          try {
            const userResponse = await fetch(`${API_BASE_URL}/user/${id}`)
            if (userResponse.ok) {
              const userData: UserRow = await userResponse.json()
              fetchedUsers[id] = userData
            } else {
              console.warn(`Failed to fetch user data for ${id}: ${userResponse.status}`)
            }
          } catch (userErr) {
            console.error(`Error fetching user ${id}:`, userErr)
          }
        }),
      )
      setUsersMap((prev) => ({ ...prev, ...fetchedUsers }))

      const enrichedMessages = data.messages.map((msg) => ({
        ...msg,
        senderUser: fetchedUsers[msg.sender_user_id] || null,
      }))

      setMessages(enrichedMessages)
      await AsyncStorage.setItem(`chat_messages_${chatSessionId}`, JSON.stringify(enrichedMessages))

      if (!refreshing && enrichedMessages.length > 0) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred while fetching messages.')
      console.error('Error fetching messages:', e)
      try {
        const cached = await AsyncStorage.getItem(`chat_messages_${chatSessionId}`)
        if (cached) {
          setMessages(JSON.parse(cached))
          Alert.alert('Offline Mode', 'Could not fetch latest data. Showing cached messages.')
        }
      } catch (cacheErr) {
        console.error('Failed to load cached messages:', cacheErr)
      }
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [chatSessionId, myUserId, refreshing])

  useEffect(() => {
    if (isLoaded && isSignedIn && myUserId && chatSessionId) {
      fetchMessages()
      fetchChatSessionInfo()

      const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws/chat/${chatSessionId}`
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log(`WebSocket connected to ${wsUrl}`)
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string)
          if (data.type === 'refresh') {
            console.log('Received refresh event, fetching messages...')
            fetchMessages()
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e)
        }
      }

      wsRef.current.onerror = (e) => {
        console.error('WebSocket error:', e)
      }

      wsRef.current.onclose = (e) => {
        console.log('WebSocket closed:', e.code, e.reason)
      }

      return () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close()
          console.log('WebSocket disconnected on component unmount/dependency change')
        }
      }
    }
  }, [isLoaded, isSignedIn, myUserId, chatSessionId, fetchChatSessionInfo, fetchMessages])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchMessages()
    fetchChatSessionInfo()
  }, [fetchMessages, fetchChatSessionInfo])

  const handleSendMessage = async () => {
    if (!newMessageContent.trim() || !chatSessionId || !myUserId) {
      Alert.alert('Error', 'Message content, chat session ID, or sender ID is missing.')
      return
    }

    const messageToSend = newMessageContent.trim()
    setNewMessageContent('')

    const tempMessageId = `temp-${Date.now()}`
    const optimisticMessage: EnrichedGroupMessage = {
      message_id: tempMessageId,
      group_chat_id: chatSessionId, // Use group_chat_id as it's for GroupMessageRow
      sender_user_id: myUserId,
      content: messageToSend,
      created_at: new Date().toISOString(),
      senderUser: usersMap[myUserId] || null,
    }

    setMessages((prevMessages) => [...prevMessages, optimisticMessage])
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50)

    try {
      const response = await fetch(`${API_BASE_URL}/chat-message/${chatSessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sender_user_id: myUserId, content: messageToSend }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Failed to send message: ${response.status}`)
      }

      // No explicit fetchMessages() call here, rely on WebSocket 'refresh' event
      // If WebSocket is not reliable or not used for all messages, re-add fetchMessages()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send message.')
      setMessages((prevMessages) => prevMessages.filter((msg) => msg.message_id !== tempMessageId))
      setNewMessageContent(messageToSend)
    }
  }

  const renderEmptyList = (message: string) => (
    <View style={styles.noMessagesContainer}>
      <MessageSquare size={40} color={AppColors.gray400} style={styles.noMessagesIcon} />
      <Text style={styles.noMessagesText}>{message}</Text>
    </View>
  )

  if (!isLoaded || !isSignedIn || !myUserId || !chatSessionId) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg]}
        style={styles.centeredStatusContainer}
      >
        <ActivityIndicator size="large" color={AppColors.pink500} />
        <Text style={styles.statusText}>Loading chat...</Text>
      </LinearGradient>
    )
  }

  return (
    <LinearGradient colors={[AppColors.primaryBg, AppColors.secondaryBg]} style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <SafeAreaView style={styles.safeArea}>
        {chatSessionInfo && (
          <ChatHeader
            groupChatInfo={chatSessionInfo}
            myUserId={myUserId}
            onBackPress={() => router.back()}
          />
        )}

        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          // Offset by the estimated height of the ChatHeader
          keyboardVerticalOffset={Platform.OS === 'ios' ? HEADER_HEIGHT_ESTIMATE : 0}
        >
          {isLoading && messages.length === 0 ? (
            <View style={styles.centeredStatusContainer}>
              <ActivityIndicator size="large" color={AppColors.pink500} />
              <Text style={styles.statusText}>Loading messages...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.message_id}
              renderItem={({ item }) => (
                <MessageBubble message={item} isMyMessage={item.sender_user_id === myUserId} />
              )}
              ListEmptyComponent={
                !isLoading && messages.length === 0
                  ? renderEmptyList('No messages in this chat yet.')
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
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
            />
          )}

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
              style={[styles.sendButton, !newMessageContent.trim() && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!newMessageContent.trim()}
            >
              <Send size={20} color={AppColors.white} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1, // This is crucial for KeyboardAvoidingView to fill available space
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
    flexGrow: 1, // Allows FlatList to expand and contract
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
    marginVertical: 2,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  myMessageBubble: {
    backgroundColor: AppColors.blue500,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '75%',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '75%',
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
    fontSize: 12,
    color: AppColors.gray300,
    marginBottom: 4,
    fontWeight: '600',
    display: 'none', // Hide sender name for my messages
  },
  otherMessageSenderName: {
    fontSize: 12,
    color: AppColors.gray300,
    marginBottom: 4,
    fontWeight: '600',
  },
  messageTimestamp: {
    fontSize: 10,
    color: AppColors.gray400,
    alignSelf: 'flex-end',
    marginTop: 4,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: AppColors.secondaryBg,
    borderTopWidth: 1,
    borderTopColor: AppColors.gray500,
  },
  textInput: {
    flex: 1,
    backgroundColor: AppColors.inputBg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: AppColors.white,
    marginRight: 12,
    maxHeight: 100, // Keep max height for multiline input
    minHeight: 40, // Ensure minimum height
  },
  sendButton: {
    backgroundColor: AppColors.pink500,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: AppColors.gray500,
  },
})

export default GroupChatScreen
