import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  FlatList,
  TextInput,
} from 'react-native'
import { useAuth } from '@clerk/clerk-expo'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  Send,
  Inbox,
  AlertCircle,
  Clock,
} from 'lucide-react-native'

import Colors, { API_BASE_URL } from '@/constants'
import { UserRow, PartyRow, GroupRow, GroupMemberRow } from '@/types/database'

const AppColors = Colors.dark

interface DisplayablePendingInvitation {
  group_member_id: GroupMemberRow['group_member_id']
  group_id: GroupMemberRow['group_id']
  group_creator_user_id: GroupRow['creator_user_id']
  group_creator_username: GroupRow['creator_username']
  party_name: PartyRow['name']
  party_id: PartyRow['party_id']
}

interface DisplayableSearchedGroup {
  group_id: GroupRow['group_id']
  party_id: GroupRow['party_id']
  creator_user_id: GroupRow['creator_user_id']
  creator_username: GroupRow['creator_username']
  max_members: GroupRow['max_members']
  creator_pfp_url: UserRow['pfp_url']
}

const JoinGroupScreen = () => {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  const params = useLocalSearchParams<{ partyId: string; partyName?: string }>()
  const partyId = params.partyId
  let partyName = partyId.split('-')
  partyName.pop()

  const partyNameParam = partyName.join(' ')

  const [pendingInvitations, setPendingInvitations] = useState<DisplayablePendingInvitation[]>([])
  const [searchedGroups, setSearchedGroups] = useState<DisplayableSearchedGroup[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [userOutgoingRequestGroupId, setUserOutgoingRequestGroupId] = useState<string | null>(null)

  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true)
  const [isLoadingSearch, setIsLoadingSearch] = useState(false)
  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchSearchedGroupsApi = useCallback(
    async (query: string) => {
      setIsLoadingSearch(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE_URL}/party/${partyId}/groups`)
        if (!res.ok) throw new Error(`Failed to search groups: ${res.statusText}`)

        const rawResultsFromApi: GroupRow[] = await res.json()

        const formattedResults: DisplayableSearchedGroup[] = rawResultsFromApi
          .map((apiItem) => {
            return {
              group_id: apiItem.group_id,
              party_id: apiItem.party_id,
              creator_user_id: apiItem.creator_user_id,
              creator_username: apiItem.creator_username,
              max_members: apiItem.max_members,
              creator_pfp_url: `${API_BASE_URL}/user/${apiItem.creator_user_id}/profile-picture`,
            }
          })
          .filter((result) => {
            return result.creator_username.toLowerCase().startsWith(query.toLowerCase())
          })

        setSearchedGroups(formattedResults)
      } catch (err: any) {
        console.error('Error searching groups:', err)
        setError(err.message || 'Could not perform search.')
        setSearchedGroups([])
      } finally {
        setIsLoadingSearch(false)
      }
    },
    [partyId, setIsLoadingSearch, setError, setSearchedGroups],
  )
  useEffect(() => {
    fetchSearchedGroupsApi(searchTerm)
  }, [searchTerm, partyId, fetchSearchedGroupsApi])

  const fetchData = useCallback(async () => {
    if (!isLoaded || !userId || !partyId) {
      if (isLoaded && !userId) setError('Please sign in.')
      if (!partyId) setError('Party context is missing.')
      setIsLoadingInvitations(false)
      return
    }
    setError(null)
    setIsLoadingInvitations(true)

    try {
      const invRes = await fetch(
        `${API_BASE_URL}/user/${userId}/invitations/pending?partyId=${partyId}`,
      )
      if (!invRes.ok) throw new Error(`Failed to fetch invitations: ${invRes.statusText}`)

      const rawInvitesFromApi: {
        group_member_id: string
        group_id: string
        party_name: string
        party_id: string
        inviter: {
          userId: string
          username: string
          pfp_url: string | null
        }
        created_at: string
      }[] = await invRes.json()
      const formattedInvites: DisplayablePendingInvitation[] = rawInvitesFromApi.map((apiItem) => {
        return {
          group_member_id: apiItem.group_member_id,
          group_id: apiItem.group_id,
          group_creator_user_id: apiItem.inviter.userId,
          group_creator_username: apiItem.inviter.username,
          party_name: apiItem.party_name,
          party_id: apiItem.party_id,
        }
      })
      setPendingInvitations(formattedInvites)
    } catch (err: any) {
      console.error('Error fetching invitations:', err)
      setError(err.message || 'Could not load invitations.')
    } finally {
      setIsLoadingInvitations(false)
    }

    try {
      const reqRes = await fetch(`${API_BASE_URL}/users/${userId}/requests?partyId=${partyId}`)
      if (!reqRes.ok) {
        if (reqRes.status === 404) {
          setUserOutgoingRequestGroupId(null)
        } else {
          throw new Error(`Failed to fetch outgoing request: ${reqRes.statusText}`)
        }
      } else {
        const requestData: { group_id: GroupRow['group_id'] } | null = await reqRes.json()
        setUserOutgoingRequestGroupId(requestData?.group_id || null)
      }
    } catch (err: any) {
      console.error('Error fetching outgoing request:', err)
    }
  }, [
    isLoaded,
    userId,
    partyId,
    setError,
    setIsLoadingInvitations,
    setPendingInvitations,
    setUserOutgoingRequestGroupId,
  ]) 

  useEffect(() => {
    fetchData()
  }, [isLoaded, userId, partyId, fetchData])

  const handleRespondToInvitation = async (
    group_member_id: GroupMemberRow['group_member_id'],
    response: 'accept' | 'decline',
  ) => {
    if (isProcessingAction) return
    setIsProcessingAction(group_member_id)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/group-members/${group_member_id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).message || `Failed to ${response} invitation.`,
        )
      Alert.alert('Success', `Invitation ${response === 'accept' ? 'accepted' : 'decline'}d!`)
      fetchData()
    } catch (err: any) {
      setError(err.message)
      Alert.alert('Error', err.message)
    } finally {
      setIsProcessingAction(null)
    }
  }

  const handleRequestToJoinGroup = async (groupIdToRequest: GroupRow['group_id']) => {
    if (!userId || userOutgoingRequestGroupId || isProcessingAction) return
    setIsProcessingAction(groupIdToRequest)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/groups/${groupIdToRequest}/members/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const resData = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(resData.message || `Failed to request to join group.`)

      Alert.alert('Success', 'Request sent!')
      setUserOutgoingRequestGroupId(groupIdToRequest)
      setSearchedGroups((prev) =>
        prev.map((g) => (g.group_id === groupIdToRequest ? { ...g, requested_by_user: true } : g)),
      )
    } catch (err: any) {
      setError(err.message)
      Alert.alert('Error', err.message)
    } finally {
      setIsProcessingAction(null)
    }
  }

  const InvitationCard: React.FC<{ item: DisplayablePendingInvitation; index: number }> = ({
    item,
    index,
  }) => {
    const cardOpacity = useSharedValue(0)
    const cardTranslateY = useSharedValue(20)
    const groupDisplayName = `${item.group_creator_username}'s Crew`

    useEffect(() => {
      cardOpacity.value = withDelay(index * 100, withTiming(1, { duration: 400 }))
      cardTranslateY.value = withDelay(index * 100, withTiming(0, { duration: 400 }))
    }, [index, cardOpacity, cardTranslateY])

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: cardOpacity.value,
      transform: [{ translateY: cardTranslateY.value }],
    }))

    return (
      <Animated.View style={[styles.invitationCard, animatedStyle]}>
        <Image
          source={{ uri: `${API_BASE_URL}/user/${item.group_creator_user_id}/banner` }}
          style={styles.leaderPhoto}
        />
        <View style={styles.invitationDetails}>
          <Text style={styles.groupNameText} numberOfLines={1}>
            {groupDisplayName}
          </Text>
          <Text style={styles.invitedByText} numberOfLines={1}>
            Invited by: <Text style={{ fontWeight: 'bold' }}>{item.group_creator_username}</Text>
          </Text>
          <Text style={styles.invitedByText} numberOfLines={1}>
            For: <Text style={{ fontWeight: 'bold' }}>{item.party_name}</Text>
          </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Group Details',
                `More details for ${groupDisplayName} (ID: ${item.group_id}) coming soon.`,
              )
            }
          >
            <Text style={styles.viewLinkText}>view details</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.invitationActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleRespondToInvitation(item.group_member_id, 'accept')}
            disabled={!!isProcessingAction}
          >
            {isProcessingAction === item.group_member_id ? (
              <ActivityIndicator size="small" color={AppColors.white} />
            ) : (
              <CheckCircle size={20} color={AppColors.white} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.ignoreButton]}
            onPress={() => handleRespondToInvitation(item.group_member_id, 'decline')}
            disabled={!!isProcessingAction}
          >
            {isProcessingAction === item.group_member_id ? (
              <ActivityIndicator size="small" color={AppColors.text} />
            ) : (
              <XCircle size={20} color={AppColors.text} />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    )
  }

  const SearchResultCard: React.FC<{ item: DisplayableSearchedGroup; index: number }> = ({
    item,
    index,
  }) => {
    const isRequested = userOutgoingRequestGroupId === item.group_id
    const canRequest = !userOutgoingRequestGroupId && !isRequested
    const groupDisplayName = `${item.creator_username}'s Crew`

    const cardOpacity = useSharedValue(0)
    const cardTranslateY = useSharedValue(20)

    useEffect(() => {
      cardOpacity.value = withDelay(index * 100, withTiming(1, { duration: 400 }))
      cardTranslateY.value = withDelay(index * 100, withTiming(0, { duration: 400 }))
    }, [index, cardOpacity, cardTranslateY])

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: cardOpacity.value,
      transform: [{ translateY: cardTranslateY.value }],
    }))

    return (
      <Animated.View style={[styles.searchResultCard, animatedStyle]}>
        <Image
          source={{ uri: `${API_BASE_URL}/user/${item.creator_user_id}/profile-picture` }}
          style={styles.leaderPhoto}
        />
        <View style={styles.searchResultDetails}>
          <Text style={styles.groupNameText} numberOfLines={1}>
            {groupDisplayName}
          </Text>
          <Text style={styles.groupMetaText} numberOfLines={1}>
            Leader: {item.creator_username}
          </Text>
          <Text style={styles.groupMetaText}>Members:1/{item.max_members}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.requestButton,
            isRequested && styles.requestedButton,
            !canRequest && !isRequested && styles.requestButtonDisabled,
          ]}
          onPress={() => !isRequested && canRequest && handleRequestToJoinGroup(item.group_id)}
          disabled={isRequested || !canRequest || !!isProcessingAction}
        >
          {isProcessingAction === item.group_id ? (
            <ActivityIndicator size="small" color={AppColors.white} />
          ) : isRequested ? (
            <>
              <Clock size={18} color={AppColors.white} style={{ marginRight: 6 }} />
              <Text style={styles.requestButtonText}>Requested</Text>
            </>
          ) : (
            <>
              <Send size={18} color={AppColors.white} style={{ marginRight: 6 }} />
              <Text style={styles.requestButtonText}>Request Join</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    )
  }

  if (!isLoaded || (!userId && !error)) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg]}
        style={styles.fullScreenLoader}
      >
        <ActivityIndicator size="large" color={AppColors.pink400} />
        <Text style={{ color: AppColors.white, marginTop: 10 }}>Loading...</Text>
      </LinearGradient>
    )
  }

  if (
    error &&
    !isLoadingInvitations &&
    pendingInvitations.length === 0 &&
    searchedGroups.length === 0
  ) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg]}
        style={styles.fullScreenLoader}
      >
        <AlertCircle size={48} color={AppColors.red400} />
        <Text style={styles.errorTextCentral}>{error}</Text>
        <TouchableOpacity onPress={fetchData} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </LinearGradient>
    )
  }

  return (
    <LinearGradient
      colors={[AppColors.primaryBg, AppColors.secondaryBg, AppColors.darkerBg]}
      style={styles.screenContainer}
    >
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: AppColors.secondaryBg },
          headerTintColor: AppColors.white,
          headerTitle: 'Join Group!',
          headerTitleAlign: 'center',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
              style={{ marginLeft: Platform.OS === 'ios' ? 0 : 10 }}
            >
              <ArrowLeft size={24} color={AppColors.gray300} />
            </TouchableOpacity>
          ),
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Pending Invitations</Text>
          {isLoadingInvitations ? (
            <ActivityIndicator color={AppColors.pink400} style={{ marginVertical: 20 }} />
          ) : pendingInvitations.length > 0 ? (
            <FlatList
              data={pendingInvitations}
              renderItem={({ item, index }) => <InvitationCard item={item} index={index} />}
              keyExtractor={(item) => item.group_member_id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyStateContainer}>
              <Inbox size={32} color={AppColors.gray300} />
              <Text style={styles.emptyStateText}>No pending invitations right now.</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Search Groups</Text>
          <Text style={styles.sectionSubtitle}>
            Search for groups in <Text style={{ fontWeight: 'bold' }}>{partyNameParam}</Text>.
            {userOutgoingRequestGroupId && ' You can only have one active join request per party.'}
          </Text>
          <View style={styles.searchBarContainer}>
            <Search size={20} color={AppColors.gray300} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Search groups or leaders...`}
              placeholderTextColor={AppColors.gray300}
              value={searchTerm}
              onChangeText={setSearchTerm}
              editable={!userOutgoingRequestGroupId}
            />
          </View>

          {isLoadingSearch && (
            <ActivityIndicator color={AppColors.pink400} style={{ marginTop: 15 }} />
          )}

          {!isLoadingSearch && searchTerm.length > 2 && searchedGroups.length === 0 && (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>
                No groups found for &quot;{searchTerm}&quot;.
              </Text>
            </View>
          )}

          {searchedGroups.length > 0 && (
            <FlatList
              data={searchedGroups}
              renderItem={({ item, index }) => <SearchResultCard item={item} index={index} />}
              keyExtractor={(item) => item.group_id}
              scrollEnabled={false}
              style={{ marginTop: 10 }}
            />
          )}
        </View>
        {error && (
          <View style={styles.inlineErrorView}>
            <AlertCircle size={18} color={AppColors.red300} style={{ marginRight: 8 }} />
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  fullScreenLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTextCentral: {
    color: AppColors.red300,
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: AppColors.pink400,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 10,
  },
  retryButtonText: {
    color: AppColors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  scrollContentContainer: {
    paddingBottom: 40,
  },
  sectionContainer: {
    paddingHorizontal: 15,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray700,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: AppColors.gray300,
    marginBottom: 15,
    lineHeight: 20,
  },
  invitationCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: AppColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leaderPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: AppColors.gray500,
  },
  invitationDetails: {
    flex: 1,
    marginRight: 10,
  },
  groupNameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: 2,
  },
  invitedByText: {
    fontSize: 13,
    color: AppColors.gray300,
  },
  viewLinkText: {
    fontSize: 13,
    color: AppColors.pink400,
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  invitationActions: {
    flexDirection: 'column',
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: AppColors.green500,
    marginBottom: 8,
  },
  ignoreButton: {
    backgroundColor: AppColors.gray600,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.cardBg,
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: AppColors.white,
  },
  searchResultCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchResultDetails: {
    flex: 1,
    marginRight: 10,
  },
  groupMetaText: {
    fontSize: 13,
    color: AppColors.gray300,
  },
  requestButton: {
    backgroundColor: AppColors.blue500,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  requestButtonText: {
    color: AppColors.white,
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  requestedButton: {
    backgroundColor: AppColors.pink400,
  },
  requestButtonDisabled: {
    backgroundColor: AppColors.gray500,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyStateText: {
    color: AppColors.gray300,
    fontSize: 15,
    marginTop: 10,
    textAlign: 'center',
  },
  inlineErrorView: {
    backgroundColor: AppColors.red700,
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 15,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineErrorText: {
    color: AppColors.red100,
    fontSize: 14,
    flex: 1,
  },
})

export default JoinGroupScreen
