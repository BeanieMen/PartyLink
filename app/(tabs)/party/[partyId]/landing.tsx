import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Users,
  Compass,
  // Plus, // Optional: if you want to use Lucide Plus icon
} from 'lucide-react-native'
import QRCodeSVG from 'react-native-qrcode-svg'
import Colors, { API_BASE_URL } from '@/constants' // Assuming API_BASE_URL is correctly exported
import { PartyRow, UserRow, GroupRow } from '@/types/database'

const AppColors = Colors.dark
const { width: screenWidth } = Dimensions.get('window')

interface GroupMemberBase {
  userId: string
  username?: string
  status: string
}
interface GroupMembersApiResponse {
  members: GroupMemberBase[]
  count?: number
}

interface DetailedGroupMember extends GroupMemberBase {
  profilePictureUrl?: string
}

const PartyLandingScreen: React.FC = () => {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const router = useRouter()

  const [party, setParty] = useState<PartyRow | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [qrValue, setQrValue] = useState<string>('')
  const [showQR, setShowQR] = useState<boolean>(false)

  const { userId, isLoaded: authLoaded } = useAuth()

  const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false)
  const [currentUser, setCurrentUser] = useState<UserRow | null>(null)
  const [userGroup, setUserGroup] = useState<GroupRow | undefined>(undefined)
  const [checkingGroup, setCheckingGroup] = useState<boolean>(false)
  const [groupStatus, setGroupStatus] = useState<string | null>(null)
  const [showPartyDetailsDropdown, setShowPartyDetailsDropdown] = useState<boolean>(false)
  const [isEstablishingGroup, setIsEstablishingGroup] = useState<boolean>(false)
  const [detailedGroupMembers, setDetailedGroupMembers] = useState<DetailedGroupMember[]>([])

  const fetchPartyAndUserData = useCallback(async () => {
    if (!partyId) {
      setLoading(false)
      console.error('Party ID is missing')
      return
    }

    if (!authLoaded) {
      console.log('Waiting for auth/user loaded...')
      setLoading(true)
      return
    }

    setLoading(true)
    setCheckingGroup(true)
    setDetailedGroupMembers([]) // Reset on fresh fetch

    try {
      const partyResponse = await fetch(`${API_BASE_URL}/party/${partyId}`)
      if (!partyResponse.ok) {
        console.error(`Failed to fetch party: ${partyResponse.status}`)
        setParty(null)
      } else {
        const partyData: PartyRow = await partyResponse.json()
        setParty(partyData)
      }

      if (userId) {
        const [userResponse, userGroupResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/user/${userId}`),
          fetch(`${API_BASE_URL}/user/${userId}/party/${partyId}/group`),
        ])

        if (!userResponse.ok) {
          console.warn(`User ${userId} not found in DB, proceeding without user details.`)
          setCurrentUser(null)
        } else {
          const userData: UserRow = await userResponse.json()
          setCurrentUser(userData)
        }

        if (userGroupResponse.status === 404) {
          setUserGroup(undefined)
          setGroupStatus(null)
          setDetailedGroupMembers([])
        } else if (!userGroupResponse.ok) {
          console.error(`Failed to fetch user group: ${userGroupResponse.status}`)
          setUserGroup(undefined)
          setGroupStatus(null)
          setDetailedGroupMembers([])
        } else {
          const groupData: GroupRow = await userGroupResponse.json()
          setUserGroup(groupData)

          if (groupData?.group_id) {
            const membersResponse = await fetch(
              `${API_BASE_URL}/group/${groupData.group_id}/members`,
            )
            if (!membersResponse.ok) {
              console.error(`Failed to fetch group member status: ${membersResponse.status}`)
              setGroupStatus(null)
              setDetailedGroupMembers([])
            } else {
              const membersData: GroupMembersApiResponse = await membersResponse.json()
              const currentUserInGroupStatus = membersData.members.find(
                (member) => member.userId === userId,
              )?.status
              setGroupStatus(currentUserInGroupStatus || null)

              if (membersData.members && membersData.members.length > 0) {
                const resolvedDetailedMembers = membersData.members.map((member) => {
                  return {
                    ...member,
                    profilePictureUrl: `${API_BASE_URL}/user/${member.userId}/profile-picture`,
                  }
                })
                setDetailedGroupMembers(resolvedDetailedMembers)
              } else {
                setDetailedGroupMembers([])
              }
            }
          } else {
            console.warn('Fetched group data but group_id is missing.')
            setGroupStatus(null)
            setUserGroup(undefined)
            setDetailedGroupMembers([])
          }
        }
      } else {
        setCurrentUser(null)
        setUserGroup(undefined)
        setGroupStatus(null)
        setDetailedGroupMembers([])
      }
    } catch (error) {
      console.error('Error fetching party and user data:', error)
      setParty(null)
      setCurrentUser(null)
      setUserGroup(undefined)
      setGroupStatus(null)
      setDetailedGroupMembers([])
    } finally {
      setCheckingGroup(false)
      setLoading(false)
    }
  }, [partyId, authLoaded, userId])

  useEffect(() => {
    fetchPartyAndUserData()
  }, [fetchPartyAndUserData])

  const handleTicket = (): void => {
    if (!partyId) return
    const userIdPart: string = currentUser?.user_id || (userId ? userId : 'guest')
    const code: string = `${partyId}-${userIdPart}`
    setQrValue(code)
    setShowQR(true)
  }

  const handleCreateGroup = async (): Promise<void> => {
    if (!userId || !partyId || !currentUser) {
      Alert.alert('Error', 'You must be signed in and user data loaded to create a group.')
      return
    }
    setIsCreatingGroup(true)
    try {
      const response = await fetch(`${API_BASE_URL}/party/${partyId}/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creator_user_id: userId,
          creator_username: currentUser.username, // Ensure currentUser.username is available
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Failed to create group: ${response.status}`)
      }

      const newGroup: GroupRow = await response.json()

      if (newGroup && newGroup.group_id) {
        await fetchPartyAndUserData() // Refetch to update group status and members
        router.replace(`/party/${partyId}/groups/edit`) // Navigate to edit/setup screen
      } else {
        throw new Error('Group ID not returned from API.')
      }
    } catch (error) {
      console.error('Create Group Error:', error)
      Alert.alert(
        'Error Creating Group',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      )
    } finally {
      setIsCreatingGroup(false)
    }
  }

  const handleViewYourGroup = (): void => {
    if (partyId && userGroup?.group_id) {
      router.push(`/party/${partyId}/groups`)
    } else {
      Alert.alert('Error', 'Group information is missing or party context is missing.')
    }
  }

  const handleNavigateToChats = (): void => {
    if (partyId && userGroup?.group_id) {
      router.push(`/party/${partyId}/dms`) // Assuming this is the correct route for group DMs
    } else {
      Alert.alert('Error', 'Group chat not available or group information missing.')
    }
  }

  const handleExploreScene = (): void => {
    if (partyId) {
      router.push(`/party/${partyId}/groups/explore`)
    } else {
      Alert.alert('Error', 'Party context is missing.')
    }
  }

  const handleConfirmAndEstablishGroup = async (): Promise<void> => {
    if (!userGroup?.group_id || userId !== userGroup?.creator_user_id || userGroup?.established) {
      Alert.alert(
        'Info',
        'This group cannot be established at this time, is already established, or you are not the creator.',
      )
      return
    }

    Alert.alert(
      'Establish Group',
      'Establishing your group will make it visible for others to explore, and allow your group to explore other established groups. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => {} },
        {
          text: 'Establish',
          onPress: async () => {
            setIsEstablishingGroup(true)
            try {
              // Assuming the establish endpoint doesn't require a body or is a PUT/PATCH
              const response = await fetch(`${API_BASE_URL}/group/${userGroup.group_id}/establish`)

              if (!response.ok) {
                const errorData = await response
                  .json()
                  .catch(() => ({ message: 'Failed to establish group. Please try again.' }))
                throw new Error(errorData.message || `Server error: ${response.status}`)
              }
              Alert.alert('Success', 'Group established! You can now explore the scene.')
              await fetchPartyAndUserData() // Refresh data
            } catch (err) {
              console.error('Establish Group Error:', err)
              Alert.alert(
                'Error Establishing Group',
                err instanceof Error ? err.message : 'An unexpected error occurred.',
              )
            } finally {
              setIsEstablishingGroup(false)
            }
          },
        },
      ],
    )
  }

  if (loading || checkingGroup || (!partyId && !party)) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={AppColors.white} />
        <Text style={styles.loaderText}>
          {!partyId
            ? 'Party ID Missing...'
            : !authLoaded
              ? 'Authenticating...'
              : checkingGroup
                ? 'Checking group status...'
                : 'Loading party details...'}
        </Text>
      </View>
    )
  }

  if (!party) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>Party details could not be loaded or party not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonContainerError}>
          <ArrowLeft size={20} color={AppColors.white} />
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonContainer}>
          <ArrowLeft size={20} color={AppColors.gray300} />
          <Text style={styles.backButtonText}>Back to Events</Text>
        </TouchableOpacity>
      </View>

      {/* Show my ticket - TOP */}
      <View style={styles.mainSection}>
        <TouchableOpacity onPress={handleTicket} style={styles.ticketButton}>
          <Text style={styles.ticketButtonText}>Show My QR Ticket</Text>
        </TouchableOpacity>
      </View>

      {/* Party Details (eventSummaryCard) - NOW A DROPDOWN - BELOW TICKET */}
      <View style={styles.mainSection}>
        <TouchableOpacity
          style={styles.partyDetailsDropdownButton}
          onPress={() => setShowPartyDetailsDropdown(!showPartyDetailsDropdown)}
        >
          <Text style={styles.partyDetailsDropdownButtonText}>{party.name.toUpperCase()}</Text>
          {showPartyDetailsDropdown ? (
            <ChevronUp size={20} color={AppColors.white} />
          ) : (
            <ChevronDown size={20} color={AppColors.white} />
          )}
        </TouchableOpacity>

        {showPartyDetailsDropdown && (
          <View style={styles.eventSummaryCard}>
            <View style={styles.eventImageContainer}>
              <Image
                source={{ uri: `${API_BASE_URL}/party/${partyId}/banner` }}
                style={styles.eventImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.eventDetails}>
              <Text style={styles.eventName}>{party.name}</Text>
              <View style={styles.eventMeta}>
                <View style={styles.metaItem}>
                  <CalendarDays size={18} color={AppColors.gray300} />
                  <Text style={styles.metaText}>{party.party_date}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MapPin size={18} color={AppColors.gray300} />
                  <Text style={styles.metaText}>{party.location}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={18} color={AppColors.gray300} />
                  <Text style={styles.metaText}>{party.party_time || '6:00 PM'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* User Profile & Party Squad - Centered, BELOW Party Details Dropdown */}
      {userId && currentUser && (
        <View style={styles.profileSectionContainer}>
          <Text style={styles.sectionHeader}>Your Squad</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.squadMembersScrollContainer}
          >
            {/* Current User's Profile */}
            <TouchableOpacity
              onPress={() => router.push('/user/update')}
              style={styles.squadMemberItem}
            >
              <Image
                source={{ uri: `${API_BASE_URL}/user/${userId}/profile-picture` }}
                style={[
                  styles.squadMemberPicture,
                  userGroup && userId === userGroup.creator_user_id && styles.leaderPictureBorder,
                ]}
                onError={(e) =>
                  console.log('Current User Profile Image Load Error:', e.nativeEvent.error)
                }
              />
              <Text style={styles.squadMemberName} numberOfLines={1}>
                {currentUser.username || 'Your Profile'}
              </Text>
              {userGroup && userId === userGroup.creator_user_id && (
                <View style={styles.leaderBadge}>
                  <Text style={styles.leaderBadgeText}>LEADER</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Other Joined Group Members' Profiles */}
            {userGroup &&
              detailedGroupMembers
                .filter((member) => member.userId !== userId && member.status === 'joined')
                .map((member) => (
                  <TouchableOpacity key={member.userId} style={styles.squadMemberItem}>
                    <Image
                      source={{ uri: member.profilePictureUrl }}
                      style={styles.squadMemberPicture}
                      onError={(e) =>
                        console.log(
                          `Profile Image Load Error for ${member.username}:`,
                          e.nativeEvent.error,
                        )
                      }
                    />
                    <Text style={styles.squadMemberName} numberOfLines={1}>
                      {member.username || 'Member'}
                    </Text>
                  </TouchableOpacity>
                ))}

            {/* Add More People Icon (for creator of an existing group) */}
            {userGroup &&
              userId === userGroup.creator_user_id &&
              groupStatus === 'joined' && ( // Only show if in a group and is creator
                <TouchableOpacity
                  style={[styles.squadMemberItem, styles.addMemberButtonContainer]}
                  onPress={() => {
                    router.push(`/party/${partyId}/groups/edit`) // Or your specific invite/edit route
                  }}
                >
                  <View style={styles.addMemberIconCircle}>
                    <Text style={styles.addMemberPlusIcon}>+</Text>
                    {/* Or use an icon: <Plus size={24} color={AppColors.gray300} /> */}
                  </View>
                  <Text style={styles.squadMemberName}>Add New</Text>
                </TouchableOpacity>
              )}
          </ScrollView>
        </View>
      )}

      {/* Group Actions */}
      <View style={styles.mainSection}>
        {userId ? (
          groupStatus === 'joined' && userGroup ? (
            <View style={styles.groupActionsGrid}>
              <TouchableOpacity style={styles.groupActionButton} onPress={handleViewYourGroup}>
                <Users size={20} color={AppColors.primary} />
                <Text style={styles.groupActionButtonText}>Group Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.groupActionButton} onPress={handleNavigateToChats}>
                <MessageCircle size={20} color={AppColors.primary} />
                <Text style={styles.groupActionButtonText}>Group Chat</Text>
              </TouchableOpacity>

              {userGroup.established ? (
                <TouchableOpacity
                  style={styles.groupActionButtonHighlight}
                  onPress={handleExploreScene}
                >
                  <Compass size={20} color={AppColors.accent} />
                  <Text style={styles.groupActionButtonTextHighlight}>Explore Scene</Text>
                </TouchableOpacity>
              ) : userId === userGroup.creator_user_id ? (
                <TouchableOpacity
                  style={[
                    styles.groupActionButtonHighlight,
                    isEstablishingGroup && styles.disabledButton,
                  ]}
                  onPress={handleConfirmAndEstablishGroup}
                  disabled={isEstablishingGroup}
                >
                  {isEstablishingGroup ? (
                    <ActivityIndicator
                      size="small"
                      color={AppColors.accent}
                      style={styles.dropdownActivityIndicator}
                    />
                  ) : (
                    <Compass size={20} color={AppColors.accent} />
                  )}
                  <Text style={styles.groupActionButtonTextHighlight}>
                    {isEstablishingGroup ? 'Establishing...' : 'Establish Group'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.groupActionButtonDisabled}>
                  <Compass size={20} color={AppColors.gray600} />
                  <Text style={styles.groupActionButtonTextDisabled}>
                    Establish Group (Creator Only)
                  </Text>
                </View>
              )}
            </View>
          ) : groupStatus === 'invited' ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                You have a pending invitation for a group for this party!
              </Text>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => {
                  router.push(`/party/${partyId}/groups/join`)
                }}
              >
                <Text style={styles.ctaButtonText}>View Invitation</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Before connecting with others, establish who you are going with!
              </Text>
              <TouchableOpacity
                style={[styles.ctaButton, (isCreatingGroup || !currentUser) && styles.disabledButton]}
                onPress={handleCreateGroup}
                disabled={isCreatingGroup || !currentUser}
              >
                {isCreatingGroup ? (
                  <ActivityIndicator color={AppColors.white} />
                ) : (
                  <Text style={styles.ctaButtonText}>Create a Group</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctaButtonOutline}
                onPress={() => {
                  router.push(`/party/${partyId}/groups/join`)
                }}
              >
                <Text style={styles.ctaButtonOutlineText}>Join a Group</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Sign in to create or join a group and connect with others!
            </Text>
            <Text style={styles.signInPrompt}>
              You can still view party details and your ticket.
            </Text>
          </View>
        )}
      </View>

      {showQR && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={showQR}
          onRequestClose={() => setShowQR(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowQR(false)}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
              {qrValue ? (
                <QRCodeSVG value={qrValue} size={200} backgroundColor="white" color="black" />
              ) : (
                <Text style={styles.qrMessageText}>Generating QR Code...</Text>
              )}
              <Text style={styles.qrMessageText}>Have a blast!</Text>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContentContainer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
    paddingHorizontal: 20,
  },
  loaderText: {
    marginTop: 10,
    fontSize: 16,
    color: AppColors.white,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    color: AppColors.white,
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  headerActions: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: AppColors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.gray700,
  },
  backButtonContainerError: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: AppColors.cardBg,
    borderRadius: 25,
    marginTop: 20,
  },
  backButtonText: {
    marginLeft: 8,
    color: AppColors.gray300,
    fontSize: 14,
    fontWeight: '500',
  },
  mainSection: {
    width: screenWidth - 40,
    marginVertical: 10,
    alignItems: 'center',
  },
  ticketButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  ticketButtonText: {
    color: AppColors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  partyDetailsDropdownButton: {
    backgroundColor: AppColors.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 0,
    borderWidth: 1,
    borderColor: AppColors.gray700,
  },
  partyDetailsDropdownButtonText: {
    color: AppColors.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  eventSummaryCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    width: '100%',
    overflow: 'hidden',
    marginTop: -1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 1,
    borderColor: AppColors.gray700,
    borderTopWidth: 0,
    paddingBottom: 20,
  },
  eventImageContainer: {
    width: '100%',
    height: 180,
    marginBottom: 15,
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  eventDetails: {
    paddingHorizontal: 20,
  },
  eventName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: 15,
  },
  eventMeta: {},
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaText: {
    fontSize: 15,
    color: AppColors.gray300,
    marginLeft: 12,
  },

  // --- NEW STYLES FOR PROFILE SQUAD ---
  profileSectionContainer: {
    width: screenWidth - 40, // Match mainSection width
    marginVertical: 20,
    alignItems: 'center', // Center the ScrollView if its content is narrower
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.white,
    marginBottom: 15,
    alignSelf: 'flex-start',
  },
  squadMembersScrollContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 5, // Padding for items inside scroll
    paddingHorizontal: 5, // Ensure first item doesn't stick to edge
  },
  squadMemberItem: {
    alignItems: 'center',
    marginRight: 12, // Spacing between members
    width: 75, // Fixed width for each item including text
  },
  squadMemberPicture: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: AppColors.primary, // Default border for members
    marginBottom: 6,
  },
  leaderPictureBorder: {
    borderColor: AppColors.accent, // Special border for the leader
    borderWidth: 2.5,
  },
  leaderBadge: {
    backgroundColor: AppColors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    position: 'absolute',
    top: 42, // Adjust to sit nicely on/below the image
    // right: -5, // Example positioning
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
  },
  leaderBadgeText: {
    color: AppColors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  squadMemberName: {
    fontSize: 12,
    color: AppColors.gray300,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },
  addMemberButtonContainer: {
    // Uses squadMemberItem for base, can add specifics if needed
    // e.g., different margin if it's the last item
  },
  addMemberIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: AppColors.gray500,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: AppColors.darkerBg, // Slight background tint
  },
  addMemberPlusIcon: {
    fontSize: 28,
    color: AppColors.gray300,
    fontWeight: '300',
  },
  // --- END OF NEW PROFILE SQUAD STYLES ---

  // Old profile styles (can be removed if new squad display fully replaces them)
  /*
  profileContainer: {
    alignItems: 'center',
    marginVertical: 20, 
  },
  profilePictureCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: AppColors.primary,
  },
  profileUsernameText: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.white,
    marginTop: 10,
  },
  */
  infoCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    width: '100%',
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.gray700,
    marginTop: 10,
  },
  infoText: {
    fontSize: 16,
    color: AppColors.gray300,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  ctaButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 10,
    minHeight: 50,
    elevation: 2,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  ctaButtonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  ctaButtonOutline: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: AppColors.primary,
    minHeight: 50,
  },
  ctaButtonOutlineText: {
    color: AppColors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: AppColors.gray600,
    borderColor: AppColors.gray700, // For outline buttons if they also get disabled
    opacity: 0.7,
  },
  signInPrompt: {
    fontSize: 14,
    color: AppColors.gray300,
    textAlign: 'center',
    marginTop: 10,
  },
  groupActionsGrid: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 10,
  },
  groupActionButton: {
    backgroundColor: AppColors.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppColors.gray700,
  },
  groupActionButtonHighlight: {
    backgroundColor: AppColors.darkerBg, // Or a specific highlight bg
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppColors.accent, // Accent border for highlight
  },
  groupActionButtonDisabled: {
    backgroundColor: AppColors.gray800, // Darker, less prominent
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppColors.gray700,
    opacity: 0.6,
  },
  groupActionButtonText: {
    color: AppColors.white,
    fontSize: 16,
    marginLeft: 15,
    fontWeight: '500',
  },
  groupActionButtonTextHighlight: {
    color: AppColors.accent,
    fontSize: 16,
    marginLeft: 15,
    fontWeight: '600',
  },
  groupActionButtonTextDisabled: {
    color: AppColors.gray300,
    fontSize: 16,
    marginLeft: 15,
    fontWeight: '500',
  },
  dropdownActivityIndicator: {
    // marginRight: 10, // If icon is also present
    // If it replaces the icon, no margin needed, or adjust as per layout
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: AppColors.cardBg,
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: AppColors.gray700,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
  },
  closeButtonText: {
    fontSize: 28,
    color: AppColors.gray300,
    fontWeight: 'bold',
  },
  qrMessageText: {
    marginTop: 20,
    fontSize: 18,
    color: AppColors.white,
    textAlign: 'center',
  },
})

export default PartyLandingScreen