import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  Platform,
  RefreshControl,
  Image
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  MessageCircle
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Colors, { API_BASE_URL } from '@/constants';
import { ChatSessionRow, UserRow } from '@/types/database';

const AppColors = Colors.dark;



interface OpponentUserMap {
  [userId: string]: UserRow;
}


interface EnrichedChatSession extends ChatSessionRow {
  opponentUser: UserRow | null;
}


type FlatListDataItem =
  | { type: 'header'; title: string }
  | { type: 'session'; data: EnrichedChatSession };


interface ChatSessionCardProps {
  session: EnrichedChatSession;
  myUserId: string;
  onAccept: (sessionId: string) => Promise<void>;
  onDecline: (sessionId: string) => Promise<void>;
  onOpenChat: (sessionId: string) => void;
}

const ChatSessionCard: React.FC<ChatSessionCardProps> = ({
  session,
  myUserId,
  onAccept,
  onDecline,
  onOpenChat,
}) => {
  const isRequester = session.user1_id === myUserId;
  const isPendingReceived = session.status === 'pending' && !isRequester;

  const opponentProfilePicUri = session.opponentUser?.user_id
    ? `${API_BASE_URL}/user/${session.opponentUser.user_id}/profile-picture`
    : 'https://via.placeholder.com/100/A020F0/FFFFFF?text=U';

  return (
    <View style={styles.chatCardContainer}>
      <Image source={{ uri: opponentProfilePicUri }} style={styles.chatCardAvatar} />
      <View style={styles.chatCardContent}>
        <Text style={styles.chatCardUsername} numberOfLines={1}>
          {session.opponentUser?.username || 'Unknown User'}
        </Text>
        {session.status === 'accepted' && (
          <View style={styles.chatCardStatusRow}>
            <CheckCircle size={16} color={AppColors.green400} />
            <Text style={[styles.chatCardStatusText, { color: AppColors.green400 }]}>
              Chat Accepted
            </Text>
          </View>
        )}
        {session.status === 'declined' && (
          <View style={styles.chatCardStatusRow}>
            <XCircle size={16} color={AppColors.red400} />
            <Text style={[styles.chatCardStatusText, { color: AppColors.red400 }]}>
              Declined
            </Text>
          </View>
        )}
      </View>
      <View style={styles.chatCardActions}>
        {session.status === 'accepted' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.chatButton]}
            onPress={() => onOpenChat(session.chat_session_id)}
          >
            <MessageCircle size={20} color={AppColors.white} />
            <Text style={styles.actionButtonText}>Chat</Text>
          </TouchableOpacity>
        )}
        {isPendingReceived && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => onAccept(session.chat_session_id)}
            >
              <CheckCircle size={20} color={AppColors.white} />
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={() => onDecline(session.chat_session_id)}
            >
              <XCircle size={20} color={AppColors.white} />
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};


const DMScreen: React.FC = () => {
  const router = useRouter();
  const { userId: myUserId, isLoaded, isSignedIn } = useAuth();

  const [allChatSessions, setAllChatSessions] = useState<EnrichedChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { partyId } = useLocalSearchParams<{ partyId: string }>()


  const fetchChatSessions = useCallback(async () => {
    if (!myUserId) return;

    !refreshing && setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/chat/sessions/${myUserId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch chat sessions: ${response.status}`);
      }
      let data: { sessions: ChatSessionRow[] } = await response.json();
      data.sessions = data.sessions.filter(v => v.party_id === partyId)
      
      const uniqueOpponentIds = new Set<string>();
      data.sessions.forEach(session => {
        const opponentId = session.user1_id === myUserId ? session.user2_id : session.user1_id;
        uniqueOpponentIds.add(opponentId);
      });

      const fetchedOpponentUsers: OpponentUserMap = {};
      await Promise.all(
        Array.from(uniqueOpponentIds).map(async (id) => {
          if (!id) return;
          try {
            const userResponse = await fetch(`${API_BASE_URL}/user/${id}`);
            if (userResponse.ok) {
              const userData: UserRow = await userResponse.json();
              fetchedOpponentUsers[id] = userData;
            } else {
              console.warn(`Failed to fetch user data for ${id}: ${userResponse.status}`);
            }
          } catch (userErr) {
            console.error(`Error fetching user ${id}:`, userErr);
          }
        })
      );

      const enrichedSessions = data.sessions.map(session => {
        const opponentId = session.user1_id === myUserId ? session.user2_id : session.user1_id;
        return {
          ...session,
          opponentUser: fetchedOpponentUsers[opponentId] || null,
        };
      });

      setAllChatSessions(enrichedSessions);
      await AsyncStorage.setItem(`chat_sessions_${myUserId}`, JSON.stringify(enrichedSessions));
    } catch (e: any) {
      console.error('Error fetching chat sessions:', e);
      try {
        const cached = await AsyncStorage.getItem(`chat_sessions_${myUserId}`);
        if (cached) {
          setAllChatSessions(JSON.parse(cached));
          Alert.alert('Offline Mode', 'Could not fetch latest data. Showing cached sessions.');
        }
      } catch (cacheErr) {
        console.error('Failed to load cached sessions:', cacheErr);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [myUserId, refreshing]);


  useEffect(() => {
    if (isLoaded && isSignedIn && myUserId) {
      fetchChatSessions();
    }
  }, [isLoaded, isSignedIn, myUserId, fetchChatSessions]);


  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChatSessions();
  }, [fetchChatSessions]);

  const handleAcceptChat = async (sessionId: string) => {
    Alert.alert(
      'Accept Chat Request',
      'Are you sure you want to accept this chat request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/chat/accept/${sessionId}`, {
                method: 'POST',
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to accept chat: ${response.status}`);
              }
              Alert.alert('Success', 'Chat request accepted!');
              fetchChatSessions();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not accept chat request.');
            }
          },
        },
      ]
    );
  };

  const handleDeclineChat = async (sessionId: string) => {
    Alert.alert(
      'Decline Chat Request',
      'Are you sure you want to decline this chat request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/chat/decline/${sessionId}`, {
                method: 'POST',
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Failed to decline chat: ${response.status}`);
              }
              Alert.alert('Success', 'Chat request declined!');
              fetchChatSessions();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not decline chat request.');
            }
          },
        },
      ]
    );
  };

  const handleOpenChat = (sessionId: string) => {

    router.push(`/chat/${sessionId}`);
  };

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const renderEmptyList = (message: string) => (
    <View style={styles.noSessionsContainer}>
      <MessageSquare size={40} color={AppColors.gray400} style={styles.noSessionsIcon} />
      <Text style={styles.noSessionsText}>{message}</Text>
    </View>
  );

  if (!isLoaded || !isSignedIn || !myUserId) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg]}
        style={styles.centeredStatusContainer}
      >
        <ActivityIndicator size="large" color={AppColors.pink500} />
        <Text style={styles.statusText}>Loading DMs...</Text>
      </LinearGradient>
    );
  }


  const acceptedSessions = allChatSessions.filter(s => s.status === 'accepted');
  const pendingSentSessions = allChatSessions.filter(
    s => s.status === 'pending' && s.user1_id === myUserId
  );
  const pendingReceivedSessions = allChatSessions.filter(
    s => s.status === 'pending' && s.user2_id === myUserId
  );
  const declinedSessions = allChatSessions.filter(s => s.status === 'declined');



  const flatListData: FlatListDataItem[] = [];

  if (pendingReceivedSessions.length > 0) {
    flatListData.push({ type: 'header', title: 'Incoming Chat Requests' });
    flatListData.push(...pendingReceivedSessions.map(s => ({ type: 'session' as 'session', data: s })));
  }


  if (acceptedSessions.length > 0 || pendingSentSessions.length > 0) {
    flatListData.push({ type: 'header', title: 'Chats' });

    flatListData.push(...pendingSentSessions.map(s => ({ type: 'session' as 'session', data: s })));

    flatListData.push(...acceptedSessions.map(s => ({ type: 'session' as 'session', data: s })));
  }

  if (declinedSessions.length > 0) {
    flatListData.push({ type: 'header', title: 'Declined Chats' });
    flatListData.push(...declinedSessions.map(s => ({ type: 'session' as 'session', data: s })));
  }


  if (isLoading && flatListData.length === 0) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg]}
        style={styles.centeredStatusContainer}
      >
        <ActivityIndicator size="large" color={AppColors.pink500} />
        <Text style={styles.statusText}>Loading your messages...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[AppColors.primaryBg, AppColors.secondaryBg]}
      style={styles.container}
    >
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: AppColors.secondaryBg },
          headerTintColor: AppColors.white,
          headerTitle: 'Messages',
          headerTitleAlign: 'center',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={24} color={AppColors.white} />
            </TouchableOpacity>
          ),
          headerShadowVisible: false,
        }}
      />

      <FlatList
        data={flatListData}
        keyExtractor={(item, index) => {
          if (item.type === 'header') {
            return `header_${item.title}`;
          } else {
            return `session_${item.data.chat_session_id}`;
          }
        }}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return renderSectionHeader(item.title);
          } else {
            return (
              <ChatSessionCard
                session={item.data}
                myUserId={myUserId}
                onAccept={handleAcceptChat}
                onDecline={handleDeclineChat}
                onOpenChat={handleOpenChat}
              />
            );
          }
        }}
        ListEmptyComponent={
          !isLoading && flatListData.length === 0
            ? renderEmptyList('No chat sessions right now.')
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
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 0 : 0,
  },
  centeredStatusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    marginTop: 15,
    fontSize: 18,
    color: AppColors.gray300,
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
  },
  flatListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 10,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.white,
    marginTop: 20,
    marginBottom: 10,
  },
  chatCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chatCardAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    borderWidth: 1,
    borderColor: AppColors.gray500,
  },
  chatCardContent: {
    flex: 1,
  },
  chatCardUsername: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: 5,
  },
  chatCardStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatCardStatusText: {
    fontSize: 13,
    marginLeft: 5,
    fontWeight: '500',
  },
  chatCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginLeft: 10,
    marginTop: 5,
  },
  actionButtonText: {
    color: AppColors.white,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 5,
  },
  chatButton: {
    backgroundColor: AppColors.blue500,
  },
  acceptButton: {
    backgroundColor: AppColors.green500,
  },
  declineButton: {
    backgroundColor: AppColors.red500,
  },
  noSessionsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  noSessionsIcon: {
    marginBottom: 20,
  },
  noSessionsText: {
    fontSize: 16,
    color: AppColors.gray300,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default DMScreen;