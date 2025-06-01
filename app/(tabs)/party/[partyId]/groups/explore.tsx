import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
} from 'react-native'
import { Stack, useRouter, useLocalSearchParams } from 'expo-router'
import { HelpCircle, ThumbsDown, ChevronUp, LucideAlertCircle, Info } from 'lucide-react-native'
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import { useAuth } from '@clerk/clerk-expo'
import { LinearGradient } from 'expo-linear-gradient'

import Colors, { API_BASE_URL } from '@/constants'
import { GroupRow, UserRow, GroupDislikeRow, GroupChatRow } from '@/types/database'
import InfoPopup from '@/components/InfoPopup'

const AppColors = Colors.dark
const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

const placeholderImage = (width: number, height: number, text: string = '?'): string => {
  const bgColor = AppColors.cardBg ? AppColors.cardBg.replace('#', '') : 'A0A0A0'
  const txtColor = AppColors.white ? AppColors.white.replace('#', '') : 'FFFFFF'
  const initial = text ? text.substring(0, 1).toUpperCase() : '?'
  return `https://placehold.co/${width}x${height}/${bgColor}/${txtColor}?text=${encodeURIComponent(initial)}&font=Inter`
}

interface BrowsableGroupState extends GroupRow {
  creator_username: UserRow['username']
  members: UserRow[]
}

const BrowseSceneScreen: React.FC = () => {
  const router = useRouter()
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const { userId, isLoaded: authLoaded } = useAuth()

  const [myGroupId, setMyGroupId] = useState<string | null>(null)
  const [myGroupDetails, setMyGroupDetails] = useState<GroupRow | null>(null)
  const [browsableGroups, setBrowsableGroups] = useState<BrowsableGroupState[]>([])
  const [currentGroupIndex, setCurrentGroupIndex] = useState<number>(0)
  const currentGroup = browsableGroups[currentGroupIndex]

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [checkingMyGroup, setCheckingMyGroup] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [myGroupMemberDislikes, setMyGroupMemberDislikes] = useState<Record<string, string[]>>({})
  const [isDislikeInfoPopupVisible, setIsDislikeInfoPopupVisible] = useState<boolean>(false)
  const [isSwipeInfoPopupVisible, setIsSwipeInfoPopupVisible] = useState<boolean>(false)
  const [groupChat, setGroupChat] = useState<GroupChatRow[]>([])
  const dragTranslationX = useSharedValue(0)
  const dragTranslationY = useSharedValue(0)
  const swipeTranslationX = useSharedValue(0)
  const swipeTranslationY = useSharedValue(0)

  const springConfig = { damping: 15, stiffness: 120 }
  const fastSpringConfig = { damping: 20, stiffness: 150 }

  const fetchMyGroup = useCallback(async (currentPartyId: string, currentUserId: string) => {
    setCheckingMyGroup(true)
    setMyGroupId(null)
    setMyGroupDetails(null)
    try {
      const res = await fetch(`${API_BASE_URL}/user/${currentUserId}/party/${currentPartyId}/group`)
      if (res.status === 404) {
        setMyGroupId(null)
        setMyGroupDetails(null)
      } else if (!res.ok) {
        const errorData = await res
          .json()
          .catch(() => ({ message: `Failed to fetch user group: ${res.status}` }))
        throw new Error(errorData.message)
      } else {
        const groupData: GroupRow = await res.json()
        setMyGroupId(groupData.group_id || null)
        setMyGroupDetails(groupData)

        if (groupData?.group_id) {
          const membersRes = await fetch(`${API_BASE_URL}/group/${groupData.group_id}/members`)
          if (membersRes.ok) {
            const groupMembersData: {
              members: { userId: string; username?: string; status: string }[]
            } = await membersRes.json()
            const memberDislikesEntries = await Promise.all(
              groupMembersData.members
                .filter((member) => member.status === 'joined')
                .map(async (member) => {
                  const memberDislikeRes = await fetch(
                    `${API_BASE_URL}/party/${currentPartyId}/user/${member.userId}/dislikes`,
                  )
                  const memberDislikes: GroupDislikeRow[] = memberDislikeRes.ok
                    ? await memberDislikeRes.json()
                    : []
                  return [member.userId, memberDislikes.map((dislike) => dislike.group_id)]
                }),
            )
            setMyGroupMemberDislikes(
              Object.fromEntries(memberDislikesEntries.filter((entry) => entry !== null)) as Record<
                string,
                string[]
              >,
            )
          } else {
            console.error('Failed to fetch my group members for dislikes:', membersRes.status)
            setMyGroupMemberDislikes({})
          }
        } else {
          setMyGroupMemberDislikes({})
        }
      }
    } catch (err: any) {
      console.error('Error fetching my group:', err)
      setError(err.message || 'Could not fetch your group details.')
      setMyGroupId(null)
      setMyGroupDetails(null)
      setMyGroupMemberDislikes({})
    } finally {
      setCheckingMyGroup(false)
    }
  }, [])

  const fetchBrowsableGroups = useCallback(
    async (currentPartyId: string, currentUserId: string, currentUserGroupId: string | null) => {
      setIsLoading(true)
      setError(null)
      try {
                if (!myGroupDetails) return
console.log('hey')
        const userDislikesRes = await fetch(
          `${API_BASE_URL}/party/${currentPartyId}/user/${currentUserId}/dislikes`,
        )
        const userDislikesData: GroupDislikeRow[] = userDislikesRes.ok
          ? await userDislikesRes.json()
          : []
        const dislikedGroupIds = userDislikesData.map((dislike) => dislike.group_id)

        
        const groupChatsRequest = await fetch(`${API_BASE_URL}/group-chat/sessions/${myGroupDetails?.group_id}`)
        const groupChats: { sessions: GroupChatRow[] }  = await groupChatsRequest.json()

        const likedGroupIds = groupChats.sessions.map((like) => myGroupDetails?.group_id == like.group1_id ? like.group2_id : like.group1_id)
        const response = await fetch(`${API_BASE_URL}/party/${currentPartyId}/groups`)
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: `Failed to fetch groups: ${response.statusText}` }))
          throw new Error(errorData.message)
        }
        const data: GroupRow[] = await response.json()

        const filteredData = data.filter(
          (group) =>
            group.group_id !== currentUserGroupId &&
            group.established === 1 &&
            !dislikedGroupIds.includes(group.group_id) &&
            !likedGroupIds.includes(group.group_id)
        )

        const formattedGroups: BrowsableGroupState[] = await Promise.all(
          filteredData.map(async (group) => {
            const groupMembersRes = await fetch(`${API_BASE_URL}/group/${group.group_id}/members`)
            const groupMembersData: {
              members: { userId: string; username?: string; status: string }[]
            } = groupMembersRes.ok ? await groupMembersRes.json() : { members: [] }

            const membersFormatted: UserRow[] = groupMembersData.members
              .filter((member) => member.status === 'joined')
              .map((member) => ({
                user_id: member.userId,
                username: member.username || 'Unknown User',
                description: null,
                socials: null,
                is_private: 0,
                created_at: '',
                updated_at: '',
              }))

            return {
              ...group,
              creator_username: group.creator_username || 'Unknown User',
              members: membersFormatted,
            }
          }),
        )

        setBrowsableGroups(formattedGroups)
        setCurrentGroupIndex(0)
      } catch (err: any) {
        console.error('Fetch Browsable Groups Error:', err)
        setError(err.message || 'Could not load groups.')
        setBrowsableGroups([])
      } finally {
        setIsLoading(false)
      }
    },
    [API_BASE_URL, myGroupDetails],
  )

  useEffect(() => {
    if (!partyId) {
      setError('Party ID is missing.')
      setIsLoading(false)
      setCheckingMyGroup(false)
      return
    }
    if (!authLoaded) {
      setIsLoading(true)
      return
    }
    if (!userId) {
      setError('User not authenticated. Please sign in to browse.')
      setIsLoading(false)
      setCheckingMyGroup(false)
      return
    }

    fetchMyGroup(partyId, userId)
  }, [partyId, authLoaded, userId, fetchMyGroup])

  useEffect(() => {
    if (partyId && authLoaded && userId && !checkingMyGroup && myGroupId !== undefined) {
      fetchBrowsableGroups(partyId, userId, myGroupId)
    }
  }, [partyId, authLoaded, userId, myGroupId, checkingMyGroup, fetchBrowsableGroups])

  useEffect(() => {
    if (currentGroup && partyId) {
      router.prefetch({
        pathname: '/party/[partyId]/groups/[groupId]/summary',
        params: { partyId: partyId, groupId: currentGroup.group_id },
      })
    }
  }, [currentGroup, partyId, router])

  const handleSwipeComplete = useCallback(
    (direction: 'left' | 'right' | 'none') => {
      const nextIndex =
        browsableGroups.length > 1 ? (currentGroupIndex + 1) % browsableGroups.length : 0

      dragTranslationX.value = 0
      dragTranslationY.value = 0

      if (direction === 'right') {
        swipeTranslationX.value = screenWidth
      } else if (direction === 'left') {
        swipeTranslationX.value = -screenWidth
      } else {
        swipeTranslationX.value = 0
      }
      swipeTranslationY.value = 0

      swipeTranslationX.value = withSpring(0, fastSpringConfig)
      swipeTranslationY.value = withSpring(0, fastSpringConfig)

      if (browsableGroups.length > 0) {
        if (
          currentGroupIndex === browsableGroups.length - 1 &&
          (direction === 'left' || direction === 'right')
        ) {
          const remainingGroups = browsableGroups.filter(
            (g) => g.group_id !== currentGroup.group_id,
          )
          if (remainingGroups.length === 0) {
            runOnJS(setBrowsableGroups)([])
          } else {
            runOnJS(setCurrentGroupIndex)(0)
          }
        } else if (browsableGroups.length > 1) {
          runOnJS(setCurrentGroupIndex)(nextIndex)
        } else {
          runOnJS(setBrowsableGroups)([])
        }
      }

      if (direction === 'left') {
        runOnJS(Alert.alert)('Disliked', 'You have disliked this group.')
      } else if (direction === 'right') {
        runOnJS(Alert.alert)('Matched!', 'Group chat request sent (simulated).')
      }
    },
    [
      browsableGroups,
      currentGroupIndex,
      dragTranslationX,
      dragTranslationY,
      swipeTranslationX,
      swipeTranslationY,
      fastSpringConfig,
      screenWidth,
      currentGroup?.group_id,
    ],
  )

  const handleDislike = useCallback(
    async (groupId: string) => {
      if (!userId || !myGroupId || !partyId) return
      try {
        await fetch(`${API_BASE_URL}/group/${groupId}/dislike`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            disliking_group_id: myGroupId,
            party_id: partyId,
          }),
        })


        setMyGroupMemberDislikes((prev) => {
          const updatedUserDislikes = [...new Set([...(prev[userId] || []), groupId])]
          return { ...prev, [userId]: updatedUserDislikes }
        })

        setBrowsableGroups((prev) => prev.filter((group) => group.group_id !== groupId))
      } catch (err: any) {
        console.error('Network Dislike Error:', err)
        Alert.alert('Error', 'Could not process dislike.')
      }
    },
    [userId, myGroupId, partyId, API_BASE_URL],
  )

  const handleLike = useCallback(
    async (requesteeGroupId: string) => {
      if (!userId || !myGroupId || !partyId) {
        Alert.alert(
          'Action Incomplete',
          'Could not send chat request. Essential information is missing. Please ensure you are in a group and try again.',
        )
        console.warn('handleLike prerequisites not met:', { userId, myGroupId, partyId })
        return
      }
      console.log(myGroupId)

      try {
        const response = await fetch(`${API_BASE_URL}/group-chat/create-session`, {
          method: 'POST',
              headers: {
            'Content-Type': 'application/json', // <--- Add this line
          },
          body: JSON.stringify({
            requester_group_id: myGroupId,
            requestee_group_id: requesteeGroupId,
            party_id: partyId,
          }),
        })

        const responseData = await response.json()

        if (!response.ok) {
          console.error(
            'API Error creating group chat session:',
            response.status,
            responseData,
          )
          throw new Error(
            responseData.error || `Failed to send group chat request. Status: ${response.status}`,
          )
        }

        // Success
        console.log('Group chat session request processed:', responseData)
        Alert.alert(
          responseData.success ? 'Request Sent!' : 'Request Processed',
          responseData.message || `Group chat request status: ${responseData.status || 'pending'}`,
        )

        setBrowsableGroups((prev) => prev.filter((group) => group.group_id !== requesteeGroupId))

      } catch (err: any) {
        console.error('Error sending group chat request:', err)
        Alert.alert(
          'Request Failed',
          err.message || 'Could not send group chat request. Please try again.',
        )
      }
    },
    [
      userId,
      myGroupId,
      partyId,
      API_BASE_URL,
      setBrowsableGroups,
    ],
  )


  const handleSwipeLeft = useCallback(() => {
    if (!currentGroup || !myGroupId) {
      dragTranslationX.value = withSpring(0, springConfig)
      dragTranslationY.value = withSpring(0, springConfig)
      if (!myGroupId)
        runOnJS(Alert.alert)('Join a Group', 'You must be in a group to browse and dislike others.')
      return
    }
    swipeTranslationX.value = withSpring(-screenWidth * 1.5, springConfig, () => {
      runOnJS(handleDislike)(currentGroup.group_id)
      runOnJS(handleSwipeComplete)('left')
    })
    swipeTranslationY.value = withSpring(0, springConfig)
  }, [
    currentGroup,
    myGroupId,
    swipeTranslationX,
    swipeTranslationY,
    screenWidth,
    springConfig,
    handleDislike,
    handleSwipeComplete,
    dragTranslationX,
    dragTranslationY,
  ])

  const handleSwipeRight = useCallback(() => {
    if (!currentGroup || !myGroupId) {
      dragTranslationX.value = withSpring(0, springConfig)
      dragTranslationY.value = withSpring(0, springConfig)
      if (!myGroupId)
        runOnJS(Alert.alert)('Join a Group', 'You must be in a group to browse and like others.')
      return
    }
    swipeTranslationX.value = withSpring(screenWidth * 1.5, springConfig, () => {
      runOnJS(handleLike)(currentGroup.group_id)
      runOnJS(handleSwipeComplete)('right')
    })
    swipeTranslationY.value = withSpring(0, springConfig)
  }, [
    currentGroup,
    myGroupId,
    swipeTranslationX,
    swipeTranslationY,
    screenWidth,
    springConfig,
    handleLike,
    handleSwipeComplete,
    dragTranslationX,
    dragTranslationY,
  ])

  const handleSwipeUp = useCallback(() => {
    if (!currentGroup || !partyId) {
      console.warn('Cannot open summary: currentGroup or partyId missing.')
      dragTranslationX.value = withSpring(0, springConfig)
      dragTranslationY.value = withSpring(0, springConfig)
      return
    }

    dragTranslationY.value = withSpring(
      -screenHeight * 0.1,
      { ...springConfig, damping: 20 },
      () => {
        runOnJS(router.push)(`/party/${partyId}/groups/${currentGroup.group_id}/summary`)

        dragTranslationX.value = withSpring(0, fastSpringConfig)
        dragTranslationY.value = withSpring(0, fastSpringConfig, () => {
          runOnJS(handleSwipeComplete)('none')
        })
      },
    )
  }, [
    currentGroup,
    partyId,
    router,
    springConfig,
    dragTranslationX,
    dragTranslationY,
    screenHeight,
    fastSpringConfig,
    handleSwipeComplete,
  ])

  const handleProfilePress = useCallback(
    (memberId: string) => {
      if (!partyId || !memberId) return
      router.push(`/party/${partyId}/${memberId}`)
    },
    [partyId, router],
  )

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      dragTranslationX.value = event.translationX
      dragTranslationY.value = event.translationY
      swipeTranslationX.value = 0
      swipeTranslationY.value = 0
    })
    .onEnd((event) => {
      const { translationX, translationY, velocityX } = event
      const swipeVelocityThreshold = 500
      const swipePositionThresholdX = screenWidth * 0.25
      const swipePositionThresholdY = screenHeight * 0.1

      const swipedRight =
        translationX > swipePositionThresholdX || velocityX > swipeVelocityThreshold
      const swipedLeft =
        translationX < -swipePositionThresholdX || velocityX < -swipeVelocityThreshold

      const swipedUp =
        translationY < -swipePositionThresholdY &&
        Math.abs(translationY) > Math.abs(translationX * 0.8)

      if (swipedUp && currentGroup) {
        runOnJS(handleSwipeUp)()
      } else if (swipedRight && currentGroup) {
        runOnJS(handleSwipeRight)()
      } else if (swipedLeft && currentGroup) {
        runOnJS(handleSwipeLeft)()
      } else {
        dragTranslationX.value = withSpring(0, springConfig)
        dragTranslationY.value = withSpring(0, springConfig)
        swipeTranslationX.value = withSpring(0, springConfig)
        swipeTranslationY.value = withSpring(0, springConfig)
        if (!myGroupId && (swipedLeft || swipedRight)) {
          runOnJS(Alert.alert)(
            'Join a Group',
            'You must be in a group to browse and like/dislike others.',
          )
        }
      }
    })

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragTranslationX.value + swipeTranslationX.value },
      { translateY: dragTranslationY.value + swipeTranslationY.value },
      {
        rotate: `${((dragTranslationX.value + swipeTranslationX.value) / (screenWidth * 0.8)) * 10}deg`,
      },
    ],
  }))

  const renderGroupMembersOnCard = useCallback(
    (group: BrowsableGroupState | null) => {
      const members = group?.members || []
      const validMembers = Array.isArray(members) ? members.slice(0, 6) : []
      const numMembers = validMembers.length

      const containerDiameter = screenWidth * 0.75
      const R_container = containerDiameter / 2

      if (numMembers === 0) {
        const placeholderSize = containerDiameter * 0.4
        return (
          <View
            style={[
              styles.pfpTouchableBase,
              {
                left: R_container - placeholderSize / 2,
                top: R_container - placeholderSize / 2,
                width: placeholderSize,
                height: placeholderSize,
                borderRadius: placeholderSize / 2,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 0,
              },
            ]}
          >
            <Image
              source={{
                uri: placeholderImage(
                  placeholderSize,
                  placeholderSize,
                  `${group?.creator_username}'s Group`,
                ),
              }}
              style={[styles.pfpImageBase, { borderRadius: placeholderSize / 2, opacity: 0.6 }]}
            />
          </View>
        )
      }

      let pfpDiameter: number
      const pfpPositions: { x: number; y: number }[] = []
      const baseAngleOffset = -Math.PI / 2

      switch (numMembers) {
        case 1:
          pfpDiameter = containerDiameter * 0.5
          pfpPositions.push({ x: 0, y: 0 })
          break
        case 2:
          pfpDiameter = containerDiameter * 0.4
          const offsetX_2 = pfpDiameter * 0.6
          pfpPositions.push({ x: -offsetX_2, y: 0 })
          pfpPositions.push({ x: offsetX_2, y: 0 })
          break
        case 3:
          pfpDiameter = containerDiameter * 0.38
          const r_3 = R_container - pfpDiameter / 2 - containerDiameter * 0.05
          for (let i = 0; i < 3; i++) {
            const angle = baseAngleOffset + (i * 2 * Math.PI) / 3
            pfpPositions.push({ x: r_3 * Math.cos(angle), y: r_3 * Math.sin(angle) })
          }
          break
        case 4:
          pfpDiameter = containerDiameter * 0.35
          const r_4 = R_container - pfpDiameter / 2 - containerDiameter * 0.05
          for (let i = 0; i < 4; i++) {
            const angle = baseAngleOffset + Math.PI / 4 + (i * 2 * Math.PI) / 4
            pfpPositions.push({ x: r_4 * Math.cos(angle), y: r_4 * Math.sin(angle) })
          }
          break
        case 5:
          pfpDiameter = containerDiameter * 0.32
          const r_5 = R_container - pfpDiameter / 2 - containerDiameter * 0.08
          for (let i = 0; i < 5; i++) {
            const angle = baseAngleOffset + (i * 2 * Math.PI) / 5
            pfpPositions.push({ x: r_5 * Math.cos(angle), y: r_5 * Math.sin(angle) })
          }
          break
        case 6:
          pfpDiameter = containerDiameter * 0.3
          const r_6 = R_container - pfpDiameter / 2 - containerDiameter * 0.08
          for (let i = 0; i < 6; i++) {
            const angle = baseAngleOffset + (i * 2 * Math.PI) / 6
            pfpPositions.push({ x: r_6 * Math.cos(angle), y: r_6 * Math.sin(angle) })
          }
          break
        default:
          pfpDiameter = 0
      }

      const pfpOuterStyle = {
        width: pfpDiameter,
        height: pfpDiameter,
        borderRadius: pfpDiameter / 2,
      }
      const pfpImageStyle = {
        borderRadius: pfpDiameter / 2,
      }

      return (
        <>
          {validMembers.map((member, index) => {
            const position = pfpPositions[index]
            const dynamicPfpStyle = {
              left: R_container + position.x - pfpDiameter / 2,
              top: R_container + position.y - pfpDiameter / 2,
            }

            return (
              <TouchableOpacity
                key={member.user_id || `member-${index}-${group?.group_id}`}
                style={[styles.pfpTouchableBase, pfpOuterStyle, dynamicPfpStyle]}
                onPress={() => handleProfilePress(member.user_id)}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: `${API_BASE_URL}/user/${member.user_id}/profile-picture` }}
                  style={[styles.pfpImageBase, pfpImageStyle]}
                />
              </TouchableOpacity>
            )
          })}
        </>
      )
    },
    [handleProfilePress, AppColors.white, AppColors.gray200, API_BASE_URL, screenWidth],
  )

  if (!authLoaded || (!userId && !error && authLoaded && !checkingMyGroup)) {
    let loadingMessage = 'Authenticating...'
    if (authLoaded && !userId && !error) loadingMessage = 'Waiting for user session...'
    return (
      <LinearGradient
        colors={
          AppColors.darkerBg
            ? [AppColors.darkerBg, AppColors.secondaryBg || AppColors.darkerBg]
            : ['#1A0C2E', '#2C154F']
        }
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={AppColors.pink400 || '#FF007A'} />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </LinearGradient>
    )
  }

  if (checkingMyGroup || (isLoading && browsableGroups.length === 0)) {
    let loadingMessage = 'Loading...'
    if (checkingMyGroup) loadingMessage = 'Checking your group status...'
    else if (isLoading) loadingMessage = 'Finding groups for you...'
    return (
      <LinearGradient
        colors={
          AppColors.darkerBg
            ? [AppColors.darkerBg, AppColors.secondaryBg || AppColors.darkerBg]
            : ['#1A0C2E', '#2C154F']
        }
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={AppColors.pink400 || '#FF007A'} />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </LinearGradient>
    )
  }

  if (error && browsableGroups.length === 0) {
    return (
      <LinearGradient
        colors={
          AppColors.darkerBg
            ? [AppColors.darkerBg, AppColors.secondaryBg || AppColors.darkerBg]
            : ['#1A0C2E', '#2C154F']
        }
        style={styles.loadingContainer}
      >
        <LucideAlertCircle size={48} color={AppColors.red400 || '#FF3B30'} />
        <Text style={styles.errorTextCentral}>{error}</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => (partyId && userId ? fetchMyGroup(partyId, userId) : router.back())}
        >
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </LinearGradient>
    )
  }

  if (authLoaded && userId && !myGroupId && !checkingMyGroup) {
    return (
      <LinearGradient
        colors={
          AppColors.darkerBg
            ? [AppColors.darkerBg, AppColors.secondaryBg || AppColors.darkerBg]
            : ['#1A0C2E', '#2C154F']
        }
        style={styles.loadingContainer}
      >
        <Info size={48} color={AppColors.gray300 || '#8E8E93'} />
        <Text style={styles.noMoreGroupsText}>
          You need to be in a group to browse other groups.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push(partyId ? `/party/${partyId}/groups/join` : '/')}
        >
          <Text style={styles.primaryButtonText}>Join or Create Group</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: AppColors.gray600 || '#4B5563' }]}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    )
  }

  if (
    !currentGroup &&
    !isLoading &&
    browsableGroups.length === 0 &&
    authLoaded &&
    userId &&
    myGroupId
  ) {
    return (
      <LinearGradient
        colors={
          AppColors.darkerBg
            ? [AppColors.darkerBg, AppColors.secondaryBg || AppColors.darkerBg]
            : ['#1A0C2E', '#2C154F']
        }
        style={styles.loadingContainer}
      >
        <Info size={48} color={AppColors.gray300 || '#8E8E93'} />
        <Text style={styles.noMoreGroupsText}>
          No more groups to browse right now. Check back later!
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            partyId && userId ? fetchBrowsableGroups(partyId, userId, myGroupId) : router.back()
          }
        >
          <Text style={styles.primaryButtonText}>Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: AppColors.gray600 || '#4B5563' }]}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    )
  }

  if (!currentGroup) {
    return (
      <LinearGradient
        colors={
          AppColors.darkerBg
            ? [AppColors.darkerBg, AppColors.secondaryBg || AppColors.darkerBg]
            : ['#1A0C2E', '#2C154F']
        }
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={AppColors.pink400 || '#FF007A'} />
        <Text style={styles.loadingText}>Preparing group display...</Text>
      </LinearGradient>
    )
  }

  const dislikeExplanationContent = (
    <>
      <Text style={styles.popupText}>
        When you swipe left (dislike) a group, your own group members who are also Browse may see
        that this group has been disliked by someone in your group.
      </Text>
      <Text style={styles.popupText}>
        This helps your group avoid matching with groups that members have decided against. Your
        group's collective dislikes are indicated by profile pictures next to the "Thumbs Down"
        icon.
      </Text>
    </>
  )

  const swipeExplanationContent = (
    <>
      <Text style={styles.popupText}>
        <Text style={{ fontWeight: 'bold' }}>Swipe Left:</Text> Dislike the group.
      </Text>
      <Text style={styles.popupText}>
        <Text style={{ fontWeight: 'bold' }}>Swipe Up:</Text> View the group's detailed summary.
      </Text>
      <Text style={styles.popupText}>
        <Text style={{ fontWeight: 'bold' }}>Swipe Right:</Text> Like the group! If they also like
        your group, it's a match (feature coming soon!).
      </Text>
    </>
  )

  return (
    <GestureHandlerRootView style={styles.rootPageContainer}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={[AppColors.primaryBg || '#2C154F', AppColors.secondaryBg || '#1A0C2E']}
        style={styles.sceneContainer}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.exitButton}>
          <Text style={styles.exitButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.browseTitle}>Browse the Scene!</Text>
          <TouchableOpacity
            onPress={() => setIsSwipeInfoPopupVisible(true)}
            style={styles.helpButton}
          >
            <HelpCircle size={24} color={AppColors.gray300 || '#8E8E93'} />
          </TouchableOpacity>
        </View>

        <View style={styles.controlsHeader}>
          <TouchableOpacity
            onPress={() => setIsDislikeInfoPopupVisible(true)}
            style={styles.dislikeIndicator}
          >
            <ThumbsDown
              size={32}
              color={AppColors.textGray || '#333333'}
              style={{ marginRight: 8 }}
            />
            {(() => {
              if (!currentGroup || !myGroupId || !userId || !myGroupDetails) {
                return <Text style={styles.noDislikesText}>N/A</Text>
              }

              const pfpUrlsToShow = Object.entries(myGroupMemberDislikes)
                .filter(
                  ([memberId, dislikedGroupsByMember]) =>
                    memberId !== userId && dislikedGroupsByMember.includes(currentGroup.group_id),
                )
                .map(([memberId]) => `${API_BASE_URL}/user/${memberId}/profile-picture`)
                .slice(0, 3)

              if (pfpUrlsToShow.length > 0) {
                return pfpUrlsToShow.map((pfpUrl, index) => (
                  <Image
                    key={`disliked-pfp-${index}-${currentGroup.group_id}`}
                    source={{ uri: pfpUrl }}
                    style={[styles.smallDislikedPfp, index > 0 && styles.stackedSmallDislikedPfp]}
                  />
                ))
              } else {
                return <Text style={styles.noDislikesText}>No group dislikes yet</Text>
              }
            })()}
          </TouchableOpacity>
        </View>

        <View style={styles.cardOuterContainer}>
          {currentGroup && (
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.animatedGroupCard, animatedCardStyle]}>
                <LinearGradient
                  colors={['#6B3AFF', '#B73AFF', '#C76BFF']}
                  style={StyleSheet.absoluteFillObject}
                />
                {/* Ensure key change when currentGroup changes to force re-render of PFPs if necessary */}
                <View style={styles.cardInternalPfpContainer} key={currentGroup.group_id}>
                  {renderGroupMembersOnCard(currentGroup)}
                </View>
              </Animated.View>
            </GestureDetector>
          )}
        </View>

        <TouchableOpacity
          onPress={handleSwipeUp}
          style={styles.swipeUpContainer}
          activeOpacity={0.7}
        >
          <Text style={styles.swipeUpText}>*swipe up to view group info</Text>
          <View style={styles.swipeUpLines}>
            <View style={styles.swipeUpLine} />
            <View style={styles.swipeUpLine} />
          </View>
          <ChevronUp
            size={28}
            color={AppColors.gray400 || '#636366'}
            style={styles.swipeUpChevron}
          />
        </TouchableOpacity>
      </LinearGradient>

      <InfoPopup
        isVisible={isDislikeInfoPopupVisible}
        onClose={() => setIsDislikeInfoPopupVisible(false)}
        title="Group Dislikes"
        content={dislikeExplanationContent}
      />
      <InfoPopup
        isVisible={isSwipeInfoPopupVisible}
        onClose={() => setIsSwipeInfoPopupVisible(false)}
        title="How to Browse"
        content={swipeExplanationContent}
      />
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  rootPageContainer: {
    flex: 1,
    backgroundColor: AppColors.primaryBg || '#000000',
  },
  sceneContainer: {
    flex: 1,
    borderRadius: 30,
    marginHorizontal: Platform.OS === 'ios' ? 10 : 8,
    marginTop: Platform.OS === 'ios' ? 50 : 30,
    marginBottom: Platform.OS === 'ios' ? 25 : 15,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  exitButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 20 : 15,
    left: Platform.OS === 'ios' ? 20 : 15,
    zIndex: 10,
    padding: 5,
  },
  exitButtonText: {
    color: AppColors.gray300 || '#8E8E93',
    fontSize: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 20,
    position: 'relative',
  },
  browseTitle: {
    color: AppColors.white || '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  helpButton: {
    position: 'absolute',
    right: 0,
    padding: 5,
  },
  controlsHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  dislikeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.whiteA05 || 'rgba(255,255,255,0.05)',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 56,
    borderWidth: 1,
    borderColor: AppColors.whiteA10 || 'rgba(255,255,255,0.1)',
  },
  noDislikesText: {
    color: AppColors.gray300 || '#8E8E93',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  smallDislikedPfp: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppColors.primaryBg || '#333',
    borderWidth: 1.5,
    borderColor: AppColors.whiteA50 || 'rgba(255,255,255,0.5)',
  },
  stackedSmallDislikedPfp: {
    marginLeft: -14,
  },
  cardOuterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: screenWidth * 0.75 + 30,
  },
  animatedGroupCard: {
    width: screenWidth * 0.75,
    height: screenWidth * 0.75,
    borderRadius: (screenWidth * 0.75) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9C37E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
    overflow: 'hidden',
  },
  cardInternalPfpContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pfpTouchableBase: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: AppColors.whiteA75 || 'rgba(255,255,255,0.75)',
    backgroundColor: AppColors.gray700 || '#3A3A3C',
    overflow: 'hidden',
  },
  pfpImageBase: {
    width: '100%',
    height: '100%',
  },
  swipeUpContainer: {
    alignItems: 'center',
    paddingVertical: 15,
    marginBottom: Platform.OS === 'ios' ? 5 : 10,
  },
  swipeUpText: {
    color: AppColors.gray400 || '#636366',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
    textAlign: 'center',
  },
  swipeUpLines: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  swipeUpLine: {
    width: 30,
    height: 2.5,
    backgroundColor: AppColors.gray500 || '#48484A',
    marginHorizontal: 3,
    borderRadius: 1,
  },
  swipeUpChevron: {
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    color: AppColors.white || '#FFFFFF',
    fontSize: 18,
    marginTop: 15,
    textAlign: 'center',
  },
  errorTextCentral: {
    color: AppColors.red400 || '#FF3B30',
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  noMoreGroupsText: {
    color: AppColors.gray300 || '#8E8E93',
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: AppColors.pink400 || '#FF007A',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginVertical: 10,
    minWidth: 220,
    alignItems: 'center',
    shadowColor: AppColors.pink400 || '#FF007A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  primaryButtonText: {
    color: AppColors.white || '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  popupText: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'left',
    color: AppColors.gray200 || '#AEAEB2',
    lineHeight: 23,
  },
})

export default BrowseSceneScreen
