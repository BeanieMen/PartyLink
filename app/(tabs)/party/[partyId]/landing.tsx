import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import {
  ArrowLeft, CalendarDays, MapPin, Clock, ChevronDown, ChevronUp,
  MessageCircle, Users, Compass, UserPlus, UserCheck, UserMinus, UserX
} from 'lucide-react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import Colors, { API_BASE_URL } from '@/constants';
import { PartyRow, UserRow, GroupRow } from '@/types/database';

const AppColors = Colors.dark;
const { width: screenWidth } = Dimensions.get('window');

interface GroupMembersApiResponse {
  members: { userId: string; username?: string; status: string; }[];
  count?: number;
}


const PartyLandingScreen: React.FC = () => {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const router = useRouter();

  const [party, setParty] = useState<PartyRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [qrValue, setQrValue] = useState<string>('');
  const [showQR, setShowQR] = useState<boolean>(false);

  const { userId, isLoaded: authLoaded } = useAuth();

  const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserRow | null>(null);
  const [userGroup, setUserGroup] = useState<GroupRow | undefined>(undefined);
  const [checkingGroup, setCheckingGroup] = useState<boolean>(false);
  const [groupStatus, setGroupStatus] = useState<string | null>(null);
  const [showPartyDetailsDropdown, setShowPartyDetailsDropdown] = useState<boolean>(false); // New state for Party Details dropdown
  const [isEstablishingGroup, setIsEstablishingGroup] = useState<boolean>(false);


  const fetchPartyAndUserData = useCallback(async () => {
    if (!partyId) {
      setLoading(false);
      console.error('Party ID is missing');
      return;
    }

    if (!authLoaded) {
      console.log("Waiting for auth/user loaded...");
      setLoading(true);
      return;
    }

    setLoading(true);
    setCheckingGroup(true);

    try {
      const partyResponse = await fetch(`${API_BASE_URL}/party/${partyId}`);
      if (!partyResponse.ok) {
        console.error(`Failed to fetch party: ${partyResponse.status}`);
        setParty(null);
      } else {
        const partyData: PartyRow = await partyResponse.json();
        setParty(partyData);
      }

      if (userId) {
        const [userResponse, userGroupResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/user/${userId}`),
          fetch(`${API_BASE_URL}/user/${userId}/party/${partyId}/group`)
        ]);

        if (!userResponse.ok) {
          console.warn(`User ${userId} not found in DB, proceeding without user details.`);
          setCurrentUser(null);
        } else {
          const userData: UserRow = await userResponse.json();
          setCurrentUser(userData);
        }

        if (userGroupResponse.status === 404) {
          setUserGroup(undefined);
          setGroupStatus(null);
        } else if (!userGroupResponse.ok) {
          console.error(`Failed to fetch user group: ${userGroupResponse.status}`);
          setUserGroup(undefined);
          setGroupStatus(null);
        } else {
          const groupData: GroupRow = await userGroupResponse.json();
          setUserGroup(groupData);

          if (groupData?.group_id) {
            const membersResponse = await fetch(`${API_BASE_URL}/group/${groupData.group_id}/members`);
            if (!membersResponse.ok) {
              console.error(`Failed to fetch group member status: ${membersResponse.status}`);
              setGroupStatus(null);
            } else {
              const membersData: GroupMembersApiResponse = await membersResponse.json();
              const status = membersData.members.find(member => member.userId === userId)?.status;
              setGroupStatus(status || null);
            }
          } else {
            console.warn("Fetched group data but group_id is missing.");
            setGroupStatus(null);
            setUserGroup(undefined);
          }
        }
      } else {
        setCurrentUser(null);
        setUserGroup(undefined);
        setGroupStatus(null);
      }
    } catch (error) {
      console.error("Error fetching party and user data:", error);
      setParty(null);
      setCurrentUser(null);
      setUserGroup(undefined);
      setGroupStatus(null);
    } finally {
      setCheckingGroup(false);
      setLoading(false);
    }
  }, [partyId, authLoaded, userId]);

  useEffect(() => {
    fetchPartyAndUserData();
  }, [fetchPartyAndUserData]);

  const handleTicket = (): void => {
    if (!partyId) return;
    const userIdPart: string = currentUser?.user_id || (userId ? userId : 'guest');
    const code: string = `${partyId}-${userIdPart}`;
    setQrValue(code);
    setShowQR(true);
  };

  const handleCreateGroup = async (): Promise<void> => {
    if (!userId || !partyId || !currentUser) {
      Alert.alert('Error', 'You must be signed in and user data loaded to create a group.');
      return;
    }
    setIsCreatingGroup(true);
    try {
      const response = await fetch(`${API_BASE_URL}/party/${partyId}/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creator_user_id: userId,
          creator_username: currentUser.username,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create group: ${response.status}`);
      }

      const newGroup: GroupRow = await response.json();

      if (newGroup && newGroup.group_id) {
        await fetchPartyAndUserData();
        router.replace(`/party/${partyId}/groups/edit`);
      } else {
        throw new Error('Group ID not returned from API.');
      }
    } catch (error) {
      console.error('Create Group Error:', error);
      Alert.alert(
        'Error Creating Group',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      );
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleViewYourGroup = (): void => {
    if (partyId && userGroup?.group_id) {
      router.push(`/party/${partyId}/groups`);
    } else {
      Alert.alert('Error', 'Group information is missing or party context is missing.');
    }
  };

  const handleNavigateToChats = (): void => {
    if (partyId && userGroup?.group_id) {
        router.push(`/party/${partyId}/dms`);
    } else {
        Alert.alert('Error', 'Group chat not available or group information missing.');
    }
  };

  const handleExploreScene = (): void => {
    if (partyId) {
      router.push(`/party/${partyId}/groups/explore`);
    } else {
      Alert.alert('Error', 'Party context is missing.');
    }
  };

  const handleConfirmAndEstablishGroup = async (): Promise<void> => {
    if (!userGroup?.group_id || userId !== userGroup?.creator_user_id || userGroup?.established) {
      Alert.alert("Info", "This group cannot be established at this time, is already established, or you are not the creator.");
      return;
    }

    Alert.alert(
      "Establish Group",
      "Establishing your group will make it visible for others to explore, and allow your group to explore other established groups. Do you want to proceed?",
      [
        { text: "Cancel", style: "cancel", onPress: () => {} },
        {
          text: "Establish",
          onPress: async () => {
            setIsEstablishingGroup(true);
            try {
              const response = await fetch(`${API_BASE_URL}/group/${userGroup.group_id}/establish`);

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Failed to establish group. Please try again.' }));
                throw new Error(errorData.message || `Server error: ${response.status}`);
              }
              Alert.alert("Success", "Group established! You can now explore the scene.");
              await fetchPartyAndUserData();
            } catch (err) {
              console.error('Establish Group Error:', err);
              Alert.alert('Error Establishing Group', err instanceof Error ? err.message : 'An unexpected error occurred.');
            } finally {
              setIsEstablishingGroup(false);
            }
          },
        },
      ]
    );
  };









  if (loading || checkingGroup || (!partyId && !party)) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={AppColors.white} />
        <Text style={styles.loaderText}>
          {!partyId ? 'Party ID Missing...' :
            !authLoaded ? 'Authenticating...' :
              checkingGroup ? 'Checking group status...' :
                'Loading party details...'}
        </Text>
      </View>
    );
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
    );
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

      {/* User Profile - Centered, Bigger, Above Event Details Dropdown */}
      {userId && currentUser && (
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={() => router.push('/user/update')}>
            <Image
              source={{ uri: `${API_BASE_URL}/user/${userId}/profile-picture` }}
              style={styles.profilePicture}
              onError={(e) => console.log('Profile Image Load Error:', e.nativeEvent.error)}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Party Details (eventSummaryCard) - NOW A DROPDOWN */}
      <TouchableOpacity
        style={styles.partyDetailsDropdownButton}
        onPress={() => setShowPartyDetailsDropdown(!showPartyDetailsDropdown)}
      >
        <Text style={styles.partyDetailsDropdownButtonText}>
          {party.name.toUpperCase()}
        </Text>
        {showPartyDetailsDropdown ? (
          <ChevronUp size={20} color={AppColors.white} />
        ) : (
          <ChevronDown size={20} color={AppColors.white} />
        )}
      </TouchableOpacity>

      {showPartyDetailsDropdown && (
        <View style={styles.eventSummaryCard}>
          <View style={styles.eventDetails}>
            <Text style={styles.eventName}>{party.name.toUpperCase()}</Text>
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
          <View style={styles.eventImageContainer}>
            <Image
              source={{ uri: `${API_BASE_URL}/party/${partyId}/banner` }}
              style={styles.eventImage}
              resizeMode="cover"
            />
          </View>
        </View>
      )}

      <View style={styles.ctaContainer}>
        {userId ? (
          groupStatus === 'joined' && userGroup ? (
            <>
              {/* Group Summary/Details removed, directly showing actions */}
              <View style={styles.groupActionsContainer}>
                <TouchableOpacity style={styles.groupActionButton} onPress={handleViewYourGroup}>
                  <Users size={20} color={AppColors.primary} />
                  <Text style={styles.groupActionButtonText}>Group Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.groupActionButton} onPress={handleNavigateToChats}>
                  <MessageCircle size={20} color={AppColors.primary} />
                  <Text style={styles.groupActionButtonText}>Chats</Text>
                </TouchableOpacity>
                
                {userGroup.established ? (
                  <TouchableOpacity style={styles.groupActionButtonHighlight} onPress={handleExploreScene}>
                    <Compass size={20} color={AppColors.accent} />
                    <Text style={styles.groupActionButtonTextHighlight}>Explore the Scene</Text>
                  </TouchableOpacity>
                ) : userId === userGroup.creator_user_id ? (
                  <TouchableOpacity
                    style={[styles.groupActionButtonHighlight, isEstablishingGroup && styles.disabledButton]}
                    onPress={handleConfirmAndEstablishGroup}
                    disabled={isEstablishingGroup}
                  >
                    {isEstablishingGroup ? (
                      <ActivityIndicator size="small" color={AppColors.accent} style={styles.dropdownActivityIndicator}/>
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
                    <Text style={styles.groupActionButtonTextDisabled}>Establish Group (Creator Only)</Text>
                  </View>
                )}
              </View>
            </>
          ) : groupStatus === 'invited' ? (
            <>
              <Text style={styles.ctaText}>You have a pending invitation for a group for this party!</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  router.push(`/party/${partyId}/groups/join`);
                }}
              >
                <Text style={styles.primaryButtonText}>View Invitation</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.ctaText}>
                Before Connecting With Others,
                {'\n'}
                Establish Who You are Going With!
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, isCreatingGroup && styles.disabledButton]}
                onPress={handleCreateGroup}
                disabled={isCreatingGroup || !currentUser}
              >
                {isCreatingGroup ? (
                  <ActivityIndicator color={AppColors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Group</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  router.push(`/party/${partyId}/groups/join`);
                }}
              >
                <Text style={styles.primaryButtonText}>Join Group</Text>
              </TouchableOpacity>
            </>
          )
        ) : (
          <>
            <Text style={styles.ctaText}>
              Sign in to create or join a group and connect with others!
            </Text>
            <Text style={styles.signInPrompt}>You can still view party details and your ticket.</Text>
          </>
        )}
      </View>

      <View style={styles.ticketButtonContainer}>
        <TouchableOpacity onPress={handleTicket} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Show my ticket</Text>
        </TouchableOpacity>
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
                <Text>Generating QR Code...</Text>
              )}
              <Text style={styles.qrMessageText}>Have a blast!</Text>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContentContainer: {
    paddingBottom: 40,
    alignItems: 'center', // Center content horizontally
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
    paddingTop: Platform.OS === 'android' ? 40 : 60, // Adjust this as needed for overall top spacing
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
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
    marginLeft: 6,
    color: AppColors.gray300,
    fontSize: 14,
    fontWeight: '500',
  },
  // Updated Profile Header for centering and vertical spacing
  profileHeader: {
    width: '100%',
    alignItems: 'center', // Centered horizontally
    paddingVertical: 25, // Increased vertical padding for visual centering
    marginBottom: 20, // Space below profile picture before next element
  },
  userButtonWrapper: {
    // No changes needed here usually, just a container
  },
  // Updated Profile Picture for size
  profilePicture: {
    width: 90, // Bigger
    height: 90, // Bigger
    borderRadius: 45, // Half of width/height for perfect circle
    borderWidth: 3, // Slightly thicker border
    borderColor: AppColors.primary, // More prominent border color
  },
  // Party Details (eventSummaryCard) styles - now displayed conditionally
  eventSummaryCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    marginHorizontal: 20,
    width: screenWidth - 40,
    overflow: 'hidden',
    marginBottom: 30,
    elevation: 5,
    shadowColor: AppColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: AppColors.gray700,
    borderTopWidth: 0, // No top border for the content part
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  eventImageContainer: {
    width: '100%',
    height: 180,
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  eventDetails: {
    padding: 20,
  },
  eventName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: 15,
  },
  eventMeta: {},
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 15,
    color: AppColors.gray300,
    marginLeft: 10,
  },
  ctaContainer: {
    width: '100%',
    paddingHorizontal: 30,
    alignItems: 'center',
    marginBottom: 30,
  },
  ctaText: {
    fontSize: 16,
    color: AppColors.gray300,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: AppColors.cardBg,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    marginBottom: 15,
    minHeight: 50,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  disabledButton: {
    backgroundColor: AppColors.gray600,
    borderColor: AppColors.gray700,
    opacity: 0.7,
  },
  primaryButtonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  signInPrompt: {
    fontSize: 14,
    color: AppColors.gray300,
    textAlign: 'center',
    marginTop: 10,
  },
  ticketButtonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: AppColors.cardBg,
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    width: '85%',
    maxWidth: 350,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 15,
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: AppColors.white,
    fontWeight: 'bold',
  },
  qrMessageText: {
    marginTop: 20,
    fontSize: 18,
    color: AppColors.white,
    textAlign: 'center',
  },
  // Styles for Party Details Dropdown Button (Event Details)
  partyDetailsDropdownButton: {
    backgroundColor: AppColors.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: screenWidth - 40, // Match width of the card
    marginBottom: 10, // Space below it
    elevation: 3,
    shadowColor: AppColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 1,
    borderColor: AppColors.gray700,
  },
  partyDetailsDropdownButtonText: {
    color: AppColors.white,
    fontSize: 18, // Slightly larger for main event name
    fontWeight: 'bold',
  },
  // Styles for Always Displayed Group Actions
  groupActionsContainer: {
    width: '90%',
    marginTop: 10,
    alignItems: 'center',
  },
  groupActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: AppColors.cardBg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    width: '100%',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppColors.gray700,
    elevation: 2,
    shadowColor: AppColors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  groupActionButtonHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: AppColors.darkerBg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    width: '100%',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppColors.accent,
    elevation: 2,
    shadowColor: AppColors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  groupActionButtonDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: AppColors.gray800,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
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
    marginRight: 10,
  },
});

export default PartyLandingScreen;