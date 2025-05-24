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
import { useAuth, useUser } from '@clerk/clerk-expo';
import { ArrowLeft, CalendarDays, MapPin, Clock } from 'lucide-react-native';
import QRCodeSVG from 'react-native-qrcode-svg';
import Colors, { API_BASE_URL } from '@/constants';
import { PartyRow, UserRow, GroupRow, GroupMemberRow } from '@/types/database';

const AppColors = Colors.dark;
const { width: screenWidth } = Dimensions.get('window');

// Add type for the group members API response structure
interface GroupMembersApiResponse {
  members: { userId: string; username?: string; status: string; }[];
  count?: number;
}

const PartyLandingScreen: React.FC = () => {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const router = useRouter();

  const [party, setParty] = useState<PartyRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Overall loading state
  const [qrValue, setQrValue] = useState<string>('');
  const [showQR, setShowQR] = useState<boolean>(false);

  const { userId, isLoaded: authLoaded } = useAuth();

  const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserRow | null>(null);
  const [userGroup, setUserGroup] = useState<GroupRow | undefined>(undefined); // undefined if not in a group, object if in a group
  const [checkingGroup, setCheckingGroup] = useState<boolean>(false); // Specific state for checking group status
  const [groupStatus, setGroupStatus] = useState<string | null>(null); // Status within the group (e.g., 'joined', 'invited')
  // You might want a general error state here as well, e.g., const [error, setError] = useState<string | null>(null);

  // Combined data fetching function
  const fetchPartyAndUserData = useCallback(async () => {
    if (!partyId) {
      setLoading(false);
      console.error('Party ID is missing');
      // Optionally set an error state
      // setError('Party ID is missing.');
      return;
    }

    // Wait for auth and user data to be loaded before proceeding with fetches that depend on them
    if (!authLoaded) {
      console.log("Waiting for auth/user loaded...");
      // Keep loading true until auth is ready
      setLoading(true);
      return; // Exit and useEffect will re-run when dependencies change
    }

    setLoading(true); // Start overall loading
    setCheckingGroup(true); // Indicate that group status is being checked (part of initial load)
    // setError(null); // Clear any previous errors

    try {
      // 1. Fetch Party Details
      const partyResponse = await fetch(`${API_BASE_URL}/party/${partyId}`);
      if (!partyResponse.ok) {
        // Even if party fetch fails, attempt to fetch user/group info if signed in
        console.error(`Failed to fetch party: ${partyResponse.status}`);
        // Optionally set a party-specific error: setPartyError(`Could not load party details: ${partyResponse.status}`);
        setParty(null); // Set party to null on failure
      } else {
        const partyData: PartyRow = await partyResponse.json();

        setParty(partyData);
      }

      // 2. Fetch User-Specific Data (only if signed in)
      if (userId) {
        // Use Promise.all for fetches that can happen concurrently
        const [userResponse, userGroupResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/user/${userId}`),
          fetch(`${API_BASE_URL}/user/${userId}/party/${partyId}/group`)
        ]);

        // Handle User Details Response
        if (!userResponse.ok) {
          console.warn(`User ${userId} not found in DB, proceeding without user details.`);
          setCurrentUser(null);
        } else {
          const userData: UserRow = await userResponse.json();
          setCurrentUser(userData);
        }

        // Handle User Group Details and Status Response
        if (userGroupResponse.status === 404) {
          // User is not part of any group for this party
          setUserGroup(undefined);
          setGroupStatus(null);
        } else if (!userGroupResponse.ok) {
          console.error(`Failed to fetch user group: ${userGroupResponse.status}`);
          // Optionally set a group-specific error: setUserGroupError(...)
          setUserGroup(undefined); // Ensure userGroup is undefined on error
          setGroupStatus(null); // Cannot determine status on error
        } else {
          const groupData: GroupRow = await userGroupResponse.json();
          setUserGroup(groupData);

          // If group data is successfully fetched, get the user's status within that group
          if (groupData?.group_id) { // Check if group_id is available
            const membersResponse = await fetch(`${API_BASE_URL}/group/${groupData.group_id}/members`);
            if (!membersResponse.ok) {
              console.error(`Failed to fetch group member status: ${membersResponse.status}`);
              // Optionally set a group status error: setGroupStatusError(...)
              setGroupStatus(null); // Cannot determine status on error
            } else {
              const membersData: GroupMembersApiResponse = await membersResponse.json();
              // Find the current user's status in the members list
              const status = membersData.members.find(member => member.userId === userId)?.status;
              setGroupStatus(status || null); // Set the found status or null if not found
            }
          } else {
            // Group data was fetched, but group_id is missing - should not happen if response is ok
            console.warn("Fetched group data but group_id is missing.");
            setGroupStatus(null);
          }
        }

      } else {
        // User is not signed in, clear user-specific states
        setCurrentUser(null);
        setUserGroup(undefined);
        setGroupStatus(null);
      }
      setLoading(false)
      setCheckingGroup(false)
    } catch (error) {
      console.error("Error fetching party and user data:", error);
      setLoading(false);
      setCheckingGroup(false);

      

    } finally {
      // Turn off loading states after all fetch operations have attempted to complete
      setCheckingGroup(false); // Finished checking group status
      setLoading(false); // Finished overall loading
    }
  }, [partyId,  authLoaded, userId]); // Dependencies for useCallback

  useEffect(() => {
    fetchPartyAndUserData();
  }, [fetchPartyAndUserData]); 

  const handleTicket = (): void => {
    if (!partyId) return;
    // Fallback userIdPart to 'guest' or 'unknown' if not signed in
    const userIdPart: string = currentUser?.user_id || (userId ? userId : 'guest');
    const code: string = `${partyId}-${userIdPart}`;
    setQrValue(code);
    setShowQR(true);
  };

  const handleCreateGroup = async (): Promise<void> => {
    if (  !userId || !partyId || !currentUser) {
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
          creator_username: currentUser.username, // Use currentUser's username
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create group: ${response.status}`);
      }

      const newGroup: GroupRow = await response.json();

      if (newGroup && newGroup.group_id) {
        // Refresh data to show user is now in a group, then navigate
        // Calling fetchPartyAndUserData will update the state including userGroup and groupStatus
        await fetchPartyAndUserData();
        // Navigate after state is updated and reflects the new group membership
        // Use replace if creating group is the end of this flow before going to the group
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
    // Navigate to the general groups page for this party, which should then show the user's group
    if (partyId) {
      router.push(`/party/${partyId}/groups`);
    } else {
      Alert.alert('Error', 'Party context is missing.');
    }
    // Note: Navigating directly to a specific group ID route like `/party/${partyId}/groups/${userGroup.group_id}`
    // might be more direct if that route exists and can handle it. The current `/party/${partyId}/groups`
    // route seems designed to show the user's group if they are in one, or the join/create options.
  };


  const handleExploreScene = (): void => {
    if (partyId) { // Ensure partyId is available for navigation
      router.push(`/party/${partyId}/groups/explore`);
    } else {
      Alert.alert('Error', 'Party context is missing.');
    }
  };

  // Conditional rendering based on loading states
  // Show loading if overall loading or checking group status is in progress
  // Also check if partyId is missing, which is an initial error state
  if (loading || checkingGroup || !partyId && !party) {
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

  // If not loading, and party is null, it means fetching failed or party not found
  if (!party) {
    return (
      <View style={styles.loaderContainer}>
        {/* You could add a specific error icon here */}
        {/* <LucideAlertCircle size={48} color={AppColors.white} /> */}
        <Text style={styles.errorText}>Party details could not be loaded or party not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonContainerError}>
          <ArrowLeft size={20} color={AppColors.white} />
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
        {/* Optionally add a retry button for the fetchPartyAndUserData */}
        {/* <TouchableOpacity onPress={fetchPartyAndUserData} style={styles.primaryButton}>
             <Text style={styles.primaryButtonText}>Try Again</Text>
         </TouchableOpacity> */}
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

      {/* Render profile header only if signed in and user data is available */}
      {userId && currentUser && (
        <View style={styles.profileHeader}>
          <View style={styles.userButtonWrapper}>
            <Image
              source={{ uri: `${API_BASE_URL}/user/${userId}/profile-picture` }}
              style={styles.profilePicture}
              onError={(e) => console.log('Profile Image Load Error:', e.nativeEvent.error)}
            />
          </View>
        </View>
      )}

      {/* Event Summary Card */}
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

      {/* Call to Action (CTA) Container based on user's group status */}
      <View style={styles.ctaContainer}>
        {/* Only show group-related actions if signed in */}
        { userId ? (
          groupStatus === 'joined' && userGroup ? ( // Ensure userGroup is also available
            <>
              <Text style={styles.ctaText}>You are already part of a group for this party!</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleViewYourGroup}>
                <Text style={styles.primaryButtonText}>Group Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleExploreScene}>
                <Text style={styles.primaryButtonText}>Explore the Scene</Text>
              </TouchableOpacity>
            </>
          ) : groupStatus === 'invited' ? (
            <>
              <Text style={styles.ctaText}>You have a pending invitation for a group for this party!</Text>
              {/* Link to Join Group screen where they can accept/decline */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  router.push(`/party/${partyId}/groups/join`);
                }}
              >
                <Text style={styles.primaryButtonText}>View Invitation</Text>
              </TouchableOpacity>
            </>
          ) : ( // No group or invited status found for the user
            <>
              <Text style={styles.ctaText}>
                Before Connecting With Others,
                {'\n'}
                Establish Who You are Going With!
              </Text>
              <TouchableOpacity
                style={[styles.primaryButton, isCreatingGroup && styles.disabledButton]}
                onPress={handleCreateGroup}
                disabled={isCreatingGroup} // Disable while creating
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
          // User is not signed in
          <>
            <Text style={styles.ctaText}>
              Sign in to create or join a group and connect with others!
            </Text>
            {/* Optionally add a sign-in button */}
            {/* <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/sign-in')}>
                     <Text style={styles.primaryButtonText}>Sign In</Text>
                 </TouchableOpacity> */}
            <Text style={styles.signInPrompt}>You can still view party details and your ticket.</Text>
          </>
        )}
      </View>

      {/* Show Ticket Button */}
      <View style={styles.ticketButtonContainer}>
        <TouchableOpacity onPress={handleTicket} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Show my ticket</Text>
        </TouchableOpacity>
      </View>

      {/* QR Code Modal */}
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
    alignItems: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
    paddingHorizontal: 20, // Add padding for text wrapping
  },
  loaderText: {
    marginTop: 10,
    fontSize: 16,
    color: AppColors.white,
    textAlign: 'center', // Center text
  },
  errorText: {
    fontSize: 18,
    color: AppColors.white, // Consider using a distinct error color if available in AppColors
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 20, // Add padding for text wrapping
  },
  headerActions: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
    flexDirection: 'row',
    justifyContent: 'space-between', // Space between back button and potential other items
    alignItems: 'center',
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.2)', // Semi-transparent background
    borderRadius: 20,
  },
  backButtonContainerError: { // Style specific to error screen back button
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: AppColors.cardBg, // Use card background for button on error screen
    borderRadius: 25,
    marginTop: 20,
  },
  backButtonText: {
    marginLeft: 6,
    color: AppColors.gray300, // Gray text color
    fontSize: 14,
    fontWeight: '500',
  },
  profileHeader: {
    width: '100%',
    alignItems: 'flex-end', // Align to the right
    paddingHorizontal: 20,
    marginBottom: 10, // Space below profile picture
  },
  userButtonWrapper: {}, // Wrapper for touchable area if needed
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24, // Perfect circle
    borderWidth: 2, // Border around picture
    borderColor: AppColors.gray300, // Border color
  },
  eventSummaryCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    marginHorizontal: 20, // Horizontal margin
    width: screenWidth - 40, // Card width
    overflow: 'hidden', // Hide content outside border-radius
    marginBottom: 30, // Space below card
    elevation: 5, // Android shadow
    shadowColor: AppColors.black, // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  eventImageContainer: {
    width: '100%',
    height: 180, // Fixed height for image container
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  eventDetails: {
    padding: 20, // Padding inside details section
  },
  eventName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: 15, // Space below event name
  },
  eventMeta: {}, // Wrapper for meta items
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Space between meta items
  },
  metaText: {
    fontSize: 15,
    color: AppColors.gray300,
    marginLeft: 10, // Space between icon and text
  },
  ctaContainer: {
    width: '100%',
    paddingHorizontal: 30, // Horizontal padding
    alignItems: 'center', // Center content horizontally
    marginBottom: 30, // Space below CTA section
  },
  ctaText: {
    fontSize: 16,
    color: AppColors.gray300,
    textAlign: 'center',
    marginBottom: 25, // Space below CTA text
    lineHeight: 22, // Improved readability
  },
  primaryButton: {
    backgroundColor: AppColors.cardBg, // Card background for button
    paddingVertical: 14, // Vertical padding
    paddingHorizontal: 30, // Horizontal padding
    borderRadius: 25, // Rounded corners
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%', // Button width
    marginBottom: 15, // Space between buttons
    minHeight: 50, // Minimum tap target size
    borderWidth: 1, // Border for definition
    borderColor: AppColors.primary, // Primary color border
  },
  disabledButton: {
    backgroundColor: AppColors.gray600, // Darker gray for disabled state
    borderColor: AppColors.gray600, // Matching border color
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
    alignItems: 'center', // Center button horizontally
    paddingHorizontal: 30, // Horizontal padding
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Dark semi-transparent background
    justifyContent: 'center', // Center modal vertically
    alignItems: 'center', // Center modal horizontally
  },
  modalContent: {
    backgroundColor: AppColors.cardBg, // Card background for modal
    padding: 30, // Padding inside modal
    borderRadius: 15, // Rounded corners
    alignItems: 'center',
    width: '85%', // Modal width
    maxWidth: 350, // Maximum width for larger screens
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 15,
    padding: 5, // Make easier to tap
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
});

export default PartyLandingScreen;