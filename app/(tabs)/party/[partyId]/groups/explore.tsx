import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, AlertCircle as LucideAlertCircle, Info, ThumbsDown, ChevronUp, HelpCircle } from 'lucide-react-native'; // Import HelpCircle for the '?' button
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';

import Colors, { API_BASE_URL } from '@/constants';
import { GroupRow, UserRow, GroupDislikeRow } from '@/types/database';
import InfoPopup from '@/components/InfoPopup';

const AppColors = Colors.dark;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const placeholderImage = (width: number, height: number, text: string = "?"): string => {
  const bgColor = AppColors.cardBg ? AppColors.cardBg.replace("#", "") : 'A0A0A0';
  const txtColor = AppColors.white ? AppColors.white.replace("#", "") : 'FFFFFF';
  const initial = text ? text.substring(0, 1).toUpperCase() : '?';
  return `https://placehold.co/${width}x${height}/${bgColor}/${txtColor}?text=${encodeURIComponent(initial)}&font=Inter`;
};

interface BrowsableGroupState extends GroupRow {
  creator_username: UserRow['username'];
  members: UserRow[];
}

const BrowseSceneScreen: React.FC = () => {
  const router = useRouter();
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const { userId, isLoaded: authLoaded } = useAuth();

  const [myGroupId, setMyGroupId] = useState<string | null>(null);
  const [myGroupDetails, setMyGroupDetails] = useState<GroupRow | null>(null);
  const [browsableGroups, setBrowsableGroups] = useState<BrowsableGroupState[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState<number>(0);
  const currentGroup = browsableGroups[currentGroupIndex];

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [checkingMyGroup, setCheckingMyGroup] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [myGroupMemberDislikes, setMyGroupMemberDislikes] = useState<Record<string, string[]>>({});
  const [myDislikes, setMyDislikes] = useState<string[]>([]);
  const [isDislikeInfoPopupVisible, setIsDislikeInfoPopupVisible] = useState<boolean>(false);
  const [isSwipeInfoPopupVisible, setIsSwipeInfoPopupVisible] = useState<boolean>(false); // New state for swipe info popup

  const swipeUpTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragTranslationX = useSharedValue(0);
  const dragTranslationY = useSharedValue(0);
  const swipeTranslationX = useSharedValue(0);
  const swipeTranslationY = useSharedValue(0);

  const springConfig = { damping: 15, stiffness: 120 };
  const fastSpringConfig = { damping: 20, stiffness: 150 };

  const fetchMyGroup = useCallback(async (currentPartyId: string, currentUserId: string) => {
    setCheckingMyGroup(true);
    setMyGroupId(null);
    setMyGroupDetails(null);
    try {
      const res = await fetch(`${API_BASE_URL}/user/${currentUserId}/party/${currentPartyId}/group`);
      if (res.status === 404) {
        setMyGroupId(null);
        setMyGroupDetails(null);
      } else if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch user group: ${res.status}`);
      } else {
        const groupData: GroupRow = await res.json();
        setMyGroupId(groupData.group_id || null);
        setMyGroupDetails(groupData);

        if (groupData?.group_id) {
          const membersRes = await fetch(`${API_BASE_URL}/group/${groupData.group_id}/members`);
          if (membersRes.ok) {
            const groupMembersData: { members: { userId: string; username?: string; status: string }[]; count?: number } = await membersRes.json();
            const memberDislikesEntries = await Promise.all(
              groupMembersData.members.filter(member => member.status === 'joined').map(async (member) => {
                const memberDislikeRes = await fetch(`${API_BASE_URL}/party/${currentPartyId}/user/${member.userId}/dislikes`);
                const memberDislikes: GroupDislikeRow[] = memberDislikeRes.ok ? await memberDislikeRes.json() : [];
                return [member.userId, memberDislikes.map(dislike => dislike.group_id)];
              })
            );
            setMyGroupMemberDislikes(Object.fromEntries(memberDislikesEntries.filter(entry => entry !== null)) as Record<string, string[]>);
          } else {
            console.error("Failed to fetch my group members for dislikes:", membersRes.status);
            setMyGroupMemberDislikes({});
          }
        } else {
          setMyGroupMemberDislikes({});
        }
      }
    } catch (err: any) {
      console.error("Error fetching my group:", err);
      setMyGroupId(null);
      setMyGroupDetails(null);
      setMyGroupMemberDislikes({});
    } finally {
      setCheckingMyGroup(false);
    }
  }, []);

  const fetchBrowsableGroups = useCallback(async (currentPartyId: string, currentUserId: string, currentUserGroupId: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const dislikeReq = await fetch(`${API_BASE_URL}/party/${partyId}/user/${userId}/dislikes`)
      const dislikeData: GroupDislikeRow[] = await dislikeReq.json()
      const dislikedGroups = dislikeData.map(dislike => dislike.group_id)
      setMyDislikes(dislikedGroups)
      const response = await fetch(`${API_BASE_URL}/party/${currentPartyId}/groups`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch groups: ${response.statusText}`);
      }
      const data: GroupRow[] = await response.json();
      const filteredData = data.filter(group => group.group_id !== currentUserGroupId && group.established === 1);
      const formattedGroups: BrowsableGroupState[] = (await Promise.all(
        filteredData.map(async (group) => {
          const groupMembersRes = await fetch(`${API_BASE_URL}/group/${group.group_id}/members`);
          const groupMembersData: { members: { userId: string; username?: string; status: string }[]; count?: number } = groupMembersRes.ok ? await groupMembersRes.json() : { members: [] };

          const membersFormatted: UserRow[] = groupMembersData.members
            .filter(member => member.status === 'joined')
            .map(member => ({
              user_id: member.userId,
              username: member.username || 'Unknown User',
              description: null,
              socials: null,
              is_private: 0,
              created_at: '',
              updated_at: '',
            }));

          return {
            ...group,
            creator_username: group.creator_username || 'Unknown User',
            members: membersFormatted,
          };
        })
      )).filter(group => !dislikedGroups.includes(group.group_id))

      setBrowsableGroups(formattedGroups);
      setCurrentGroupIndex(0);
    } catch (err: any) {
      console.error('Fetch Browsable Groups Error:', err);
      setError(err.message || 'Could not load groups.');
      setBrowsableGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!partyId) {
      setError("Party ID is missing.");
      setIsLoading(false);
      setCheckingMyGroup(false);
      return;
    }
    if (!authLoaded || !userId) {
      if (authLoaded && !userId) setError("User not authenticated. Please sign in to browse.");
      if (!authLoaded) {
        setIsLoading(true);
        return;
      }
    }
    if (userId) {
      fetchMyGroup(partyId, userId);
    } else if (authLoaded && !userId) {
      setIsLoading(false);
      setCheckingMyGroup(false);
    }
  }, [partyId, authLoaded, userId, fetchMyGroup]);

  useEffect(() => {
    if (partyId && authLoaded && userId && !checkingMyGroup) {
      fetchBrowsableGroups(partyId, userId, myGroupId);
    }
  }, [partyId, authLoaded, userId, myGroupId, checkingMyGroup, fetchBrowsableGroups]);

  useEffect(() => {
    if (currentGroup && partyId) {
      router.prefetch({
        pathname: '/party/[partyId]/groups/[groupId]/summary', // Use the canonical route pattern
        params: { partyId: partyId, groupId: currentGroup.group_id },
      });
    }
  }, [currentGroup, partyId, router]);

  const handleSwipeComplete = useCallback((direction: 'left' | 'right') => {
    const nextIndex = browsableGroups.length > 1 ? (currentGroupIndex + 1) % browsableGroups.length : 0;

    dragTranslationX.value = 0;
    dragTranslationY.value = 0;
    swipeTranslationX.value = direction === 'right' ? screenWidth : -screenWidth;
    swipeTranslationY.value = 0;

    swipeTranslationX.value = withSpring(0, fastSpringConfig);
    swipeTranslationY.value = withSpring(0, fastSpringConfig);

    runOnJS(setCurrentGroupIndex)(nextIndex);

    if (direction === 'left') {
      runOnJS(Alert.alert)('You disliked this group!');
    } else if (direction === 'right') {
      runOnJS(Alert.alert)('Matched!');
    }
  }, [browsableGroups.length, currentGroupIndex, dragTranslationX, dragTranslationY, swipeTranslationX, swipeTranslationY, setCurrentGroupIndex, fastSpringConfig]);

  const handleDislike = useCallback(async (groupId: string) => {
    if (!userId || !myGroupId) return;
    try {
      await fetch(`${API_BASE_URL}/group/${groupId}/dislike`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, disliking_group_id: myGroupId }),
      });
      setMyGroupMemberDislikes(prev => {
        const updatedDislikesForUser = [...(prev[userId] || [])];
        if (!updatedDislikesForUser.includes(groupId)) {
          updatedDislikesForUser.push(groupId);
        }
        return { ...prev, [userId]: updatedDislikesForUser };
      });
    } catch (err: any) {
      console.error('Network Dislike Error:', err);
    }
  }, [userId, myGroupId]);

  const handleLike = useCallback(async (groupId: string) => {
    if (!userId || !myGroupId) return;
    try {
      // In a real application, this would send a match request
      console.log(`Simulating Like/Match network request for group: ${groupId} by user ${userId} from group ${myGroupId}`);
      // If a match occurs (server-side logic), you might navigate to a chat or match screen
    } catch (err: any) {
      console.error('Network Like Error:', err);
    }
  }, [userId, myGroupId]);

  const handleSwipeLeft = useCallback(() => {
    if (!currentGroup || browsableGroups.length === 0 || !myGroupId) {
      dragTranslationX.value = withSpring(0, springConfig);
      dragTranslationY.value = withSpring(0, springConfig);
      if (!myGroupId) runOnJS(Alert.alert)("Join a Group", "You must be in a group to browse and dislike others.");
      return;
    }
    swipeTranslationX.value = withSpring(-screenWidth * 1.5, springConfig, () => {
      runOnJS(handleSwipeComplete)('left');
      runOnJS(handleDislike)(currentGroup.group_id);
    });
    swipeTranslationY.value = withSpring(0, springConfig);
  }, [currentGroup, browsableGroups.length, myGroupId, swipeTranslationX, swipeTranslationY, springConfig, handleSwipeComplete, handleDislike, dragTranslationX, dragTranslationY]);

  const handleSwipeRight = useCallback(() => {
    if (!currentGroup || browsableGroups.length === 0 || !myGroupId) {
      dragTranslationX.value = withSpring(0, springConfig);
      dragTranslationY.value = withSpring(0, springConfig);
      if (!myGroupId) runOnJS(Alert.alert)("Join a Group", "You must be in a group to browse and like others.");
      return;
    }
    swipeTranslationX.value = withSpring(screenWidth * 1.5, springConfig, () => {
      runOnJS(handleSwipeComplete)('right');
      runOnJS(handleLike)(currentGroup.group_id);
    });
    swipeTranslationY.value = withSpring(0, springConfig);
  }, [currentGroup, browsableGroups.length, myGroupId, swipeTranslationX, swipeTranslationY, springConfig, handleSwipeComplete, handleLike, dragTranslationX, dragTranslationY]);

  const handleSwipeUp = useCallback(async () => {
    if (!currentGroup || !partyId) {
      console.warn("Cannot open summary: currentGroup or partyId missing.");
      return;
    }
    dragTranslationX.value = withSpring(0, springConfig);
    dragTranslationY.value = withSpring(0, springConfig);
    router.push(
      `/party/${partyId}/groups/${currentGroup.group_id}/summary`);
  }, [currentGroup, partyId, router]);

  const handleProfilePress = useCallback((memberId: string) => {
    if (!partyId || !memberId) return;
    router.push(`/party/${partyId}/${memberId}`);
  }, [partyId, router]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      dragTranslationX.value = event.translationX;
      dragTranslationY.value = event.translationY;
      swipeTranslationX.value = 0;
      swipeTranslationY.value = 0;

    })
    .onEnd((event) => {
      const { translationX, translationY, velocityX, velocityY } = event;
      const swipeVelocityThreshold = 500;
      const swipePositionThresholdX = screenWidth * 0.25;
      const swipePositionThresholdY = screenHeight * 0.1;

      const swipedRight = translationX > swipePositionThresholdX || velocityX > swipeVelocityThreshold;
      const swipedLeft = translationX < -swipePositionThresholdX || velocityX < -swipeVelocityThreshold;
      const swipedUp = translationY < -swipePositionThresholdY && Math.abs(translationY) > Math.abs(translationX * 0.8);

      if (swipedUp && currentGroup) {
        runOnJS(handleSwipeUp)()


        // dragTranslationX.value = withSpring(0, springConfig);
        // dragTranslationY.value = withSpring(0, springConfig);
      } else if (swipedRight && currentGroup && myGroupId) {
        runOnJS(handleSwipeRight)()
      } else if (swipedLeft && currentGroup && myGroupId) {
        runOnJS(handleSwipeLeft)()
      } else {
        dragTranslationX.value = withSpring(0, springConfig);
        dragTranslationY.value = withSpring(0, springConfig);
        swipeTranslationX.value = withSpring(0, springConfig);
        swipeTranslationY.value = withSpring(0, springConfig);
        if (!myGroupId && (swipedLeft || swipedRight)) {
          runOnJS(Alert.alert)("Join a Group", "You must be in a group to browse and like/dislike others.");
        }
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragTranslationX.value + swipeTranslationX.value },
      { translateY: dragTranslationY.value + swipeTranslationY.value },
      { rotate: `${(dragTranslationX.value + swipeTranslationX.value) / (screenWidth * 0.8) * 10}deg` },
    ],
  }));

  const renderGroupMembersOnCard = useCallback((members: UserRow[] = []) => {
    const validMembers = Array.isArray(members) ? members : [];
    const centralMember = validMembers[0];
    const satelliteMembers = validMembers.slice(1, 4);
    return (
      <View style={styles.cardInternalPfpContainer}>
        {centralMember ? (
          <TouchableOpacity
            style={styles.mainPfpTouchable}
            onPress={() => handleProfilePress(centralMember.user_id)}
            activeOpacity={0.7}
          >
            <Image
              source={{ uri: `${API_BASE_URL}/user/${centralMember.user_id}/profile-picture` }}
              style={styles.mainPfpOnCard}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.mainPfpTouchable}
            disabled={true}
            activeOpacity={1}
          >
            <Image
              source={{ uri: placeholderImage(screenWidth * 0.25, screenWidth * 0.25, '?') }}
              style={styles.mainPfpOnCard}
            />
          </TouchableOpacity>
        )}
        {satelliteMembers.map((member, index) => (
          <TouchableOpacity
            key={member.user_id || `sat-member-${index}`}
            style={[
              styles.satellitePfpTouchable,
              index === 0 && styles.satellitePfpLeft,
              index === 1 && styles.satellitePfpRight,
              index === 2 && styles.satellitePfpBottom,
            ]}
            onPress={() => handleProfilePress(member.user_id)}
            activeOpacity={0.7}
          >
            <Image
              source={{ uri: `${API_BASE_URL}/user/${member.user_id}/profile-picture` }}
              style={styles.satellitePfpOnCard}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  }, [handleProfilePress]);

  if (isLoading || checkingMyGroup || !authLoaded || (!userId && !error && authLoaded)) {
    let loadingMessage = 'Loading...';
    if (!authLoaded) loadingMessage = 'Authenticating...';
    else if (!userId && authLoaded && !error) loadingMessage = 'Waiting for user session...';
    else if (checkingMyGroup) loadingMessage = 'Checking your group status...';
    else if (isLoading) loadingMessage = 'Loading groups...';
    return (
      <LinearGradient colors={AppColors.darkerBg ? [AppColors.darkerBg, AppColors.secondaryBg || AppColors.darkerBg] : ['#1A0C2E', '#2C154F']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.pink400 || '#FF007A'} />
        <Text style={styles.loadingText}>{loadingMessage}</Text>
      </LinearGradient>
    );
  }

  if (error && browsableGroups.length === 0) {
    return (
      <LinearGradient colors={AppColors.darkerBg ? [AppColors.darkerBg, AppColors.secondaryBg || AppColors.darkerBg] : ['#1A0C2E', '#2C154F']} style={styles.loadingContainer}>
        <LucideAlertCircle size={48} color={AppColors.red400 || '#FF3B30'} />
        <Text style={styles.errorTextCentral}>{error}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => partyId && userId ? fetchMyGroup(partyId, userId) : router.back()}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  if (authLoaded && userId && !myGroupId && !checkingMyGroup) {
    return (
      <LinearGradient colors={AppColors.darkerBg ? [AppColors.darkerBg, AppColors.secondaryBg || AppColors.darkerBg] : ['#1A0C2E', '#2C154F']} style={styles.loadingContainer}>
        <Info size={48} color={AppColors.gray300 || '#8E8E93'} />
        <Text style={styles.noMoreGroupsText}>You need to be in a group to browse other groups.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push(partyId ? `/party/${partyId}/groups/join` : '/')}>
          <Text style={styles.primaryButtonText}>Join or Create Group</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: AppColors.gray600 || '#4B5563' }]} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    )
  }

  if (!currentGroup && !isLoading && browsableGroups.length === 0 && authLoaded && userId && myGroupId) {
    return (
      <LinearGradient colors={AppColors.darkerBg ? [AppColors.darkerBg, AppColors.secondaryBg || AppColors.darkerBg] : ['#1A0C2E', '#2C154F']} style={styles.loadingContainer}>
        <Info size={48} color={AppColors.gray300 || '#8E8E93'} />
        <Text style={styles.noMoreGroupsText}>No more groups to browse right now. Check back later!</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => partyId && userId ? fetchBrowsableGroups(partyId, userId, myGroupId) : router.back()}>
          <Text style={styles.primaryButtonText}>Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: AppColors.gray600 || '#4B5563' }]} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  if (!currentGroup) {
    return (
      <LinearGradient colors={AppColors.darkerBg ? [AppColors.darkerBg, AppColors.secondaryBg || AppColors.darkerBg] : ['#1A0C2E', '#2C154F']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.pink400 || '#FF007A'} />
        <Text style={styles.loadingText}>Preparing groups...</Text>
      </LinearGradient>
    );
  }

  const dislikeExplanationContent = (
    <>
      <Text style={styles.popupText}>
        When you dislike a group, other members in your group who are also exploring will be shown your dislike for that group at the top of their Browse screen.
      </Text>
      <Text style={styles.popupText}>
        This helps your group avoid matching with groups you've collectively decided against. Your personal dislike will be visible to your group members on the Browse screen, next to the "Thumbs Down" icon.
      </Text>
    </>
  );

  const swipeExplanationContent = (
    <>
      <Text style={styles.popupText}>
        <Text style={{ fontWeight: 'bold' }}>Swipe Left:</Text> Dislike the group. Your group members will see your dislike for this group.
      </Text>
      <Text style={styles.popupText}>
        <Text style={{ fontWeight: 'bold' }}>Swipe Up:</Text> View the group's detailed summary, including their description, members, and interests.
      </Text>
      <Text style={styles.popupText}>
        <Text style={{ fontWeight: 'bold' }}>Swipe Right:</Text> Send a group chat request to this group. If they also swipe right on your group, a group chat will be initiated!
      </Text>
    </>
  );

  return (
    <GestureHandlerRootView style={styles.rootPageContainer}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={[AppColors.primaryBg || '#2C154F', AppColors.secondaryBg || '#1A0C2E']} style={styles.sceneContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.exitButton}>
          <Text style={styles.exitButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.browseTitle}>Browse the Scene!</Text>
          <TouchableOpacity onPress={() => setIsSwipeInfoPopupVisible(true)} style={styles.helpButton}>
            <HelpCircle size={24} color={AppColors.gray300 || '#8E8E93'} />
          </TouchableOpacity>
        </View>


        <View style={styles.controlsHeader}>
          <TouchableOpacity onPress={() => setIsDislikeInfoPopupVisible(true)} style={styles.dislikeIndicator}>
            <ThumbsDown
              size={32}
              color={AppColors.textGray || '#333333'}
              style={{ marginRight: 8 }}
            />
            {(() => {
              if (!(currentGroup && myGroupId && userId)) {
                return <Text style={styles.noDislikesText}>None</Text>;
              }
              const pfpUrlsToShow = Object.entries(myGroupMemberDislikes)
                .filter(([, dislikesByUser]) => dislikesByUser.includes(currentGroup.group_id))
                .map(([memberId]) => `${API_BASE_URL}/user/${memberId}/profile-picture`)
                .slice(0, 3);

              if (pfpUrlsToShow.length > 0) {
                return pfpUrlsToShow.map((pfpUrl, index) => (
                  <Image
                    key={`disliked-pfp-${index}`}
                    source={{ uri: pfpUrl }}
                    style={[
                      styles.smallDislikedPfp,
                      index > 0 && styles.stackedSmallDislikedPfp
                    ]}
                  />
                ));
              } else {
                return <Text style={styles.noDislikesText}>None</Text>;
              }
            })()}
          </TouchableOpacity>
        </View>

        <View style={styles.cardOuterContainer}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.animatedGroupCard, animatedCardStyle]}>
              <LinearGradient
                colors={['#6B3AFF', '#B73AFF', '#C76BFF']}
                style={StyleSheet.absoluteFillObject}
              />
              {currentGroup && renderGroupMembersOnCard(currentGroup.members)}
            </Animated.View>
          </GestureDetector>
        </View>

        <TouchableOpacity onPress={handleSwipeUp} style={styles.swipeUpContainer} activeOpacity={0.7}>
          <Text style={styles.swipeUpText}>*swipe up to view group info</Text>
          <View style={styles.swipeUpLines}>
            <View style={styles.swipeUpLine} />
            <View style={styles.swipeUpLine} />
          </View>
          <ChevronUp size={28} color={AppColors.gray400 || '#636366'} style={styles.swipeUpChevron} />
        </TouchableOpacity>

      </LinearGradient>

      {/* InfoPopup for Dislike Explanation */}
      <InfoPopup
        isVisible={isDislikeInfoPopupVisible}
        onClose={() => setIsDislikeInfoPopupVisible(false)}
        title="How Dislike Works"
        content={dislikeExplanationContent}
      />

      {/* InfoPopup for Swipe Explanation */}
      <InfoPopup
        isVisible={isSwipeInfoPopupVisible}
        onClose={() => setIsSwipeInfoPopupVisible(false)}
        title="How to Browse"
        content={swipeExplanationContent}
      />
    </GestureHandlerRootView>
  );
};
const styles = StyleSheet.create({
  rootPageContainer: {
    flex: 1,
    backgroundColor: AppColors.primaryBg || '#000000',
  },
  gestureContainer: {
    flex: 1,
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
    top: 15,
    left: 15,
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
    backgroundColor: AppColors.white || '#FFFFFF',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minHeight: 56,
    shadowColor: AppColors.black || '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  noDislikesText: {
    color: AppColors.textGray || '#333333',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  smallDislikedPfp: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#9C37E9',
    borderWidth: 2,
    borderColor: AppColors.white || '#FFFFFF',
  },
  stackedSmallDislikedPfp: {
    marginLeft: -16,
  },
  cardOuterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedGroupCard: {
    width: screenWidth * 0.75,
    height: screenWidth * 0.75,
    borderRadius: (screenWidth * 0.75) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9C37E9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 15,
    overflow: 'hidden',
  },
  cardInternalPfpContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  mainPfpTouchable: {
    position: 'absolute',
    width: screenWidth * 0.25,
    height: screenWidth * 0.25,
    borderRadius: (screenWidth * 0.25) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5, // Main PFP on top
  },
  mainPfpOnCard: {
    width: '100%',
    height: '100%',
    borderRadius: (screenWidth * 0.25) / 2,
    backgroundColor: AppColors.gray200 || '#E5E5EA',
    borderWidth: 3,
    borderColor: AppColors.white || '#FFFFFF',
  },
  satellitePfpTouchable: {
    position: 'absolute',
    width: screenWidth * 0.25,
    height: screenWidth * 0.25,
    borderRadius: (screenWidth * 0.25) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3, // Satellite PFPs behind main if any slight overlap
  },
  satellitePfpLeft: {
    left: 0, // MODIFIED
    top: screenWidth * 0.25, // MODIFIED
  },
  satellitePfpRight: {
    left: screenWidth * 0.5, // MODIFIED
    top: screenWidth * 0.25, // MODIFIED
    // If you prefer using 'right' property:
    // right: 0,
    // top: screenWidth * 0.25,
  },
  satellitePfpBottom: {
    left: screenWidth * 0.25, // MODIFIED - This centers it horizontally
    top: screenWidth * 0.5, // MODIFIED
    // alignSelf: 'center', // REMOVED - 'left' now handles horizontal centering
  },
  satellitePfpOnCard: {
    width: '100%',
    height: '100%',
    borderRadius: (screenWidth * 0.25) / 2,
    backgroundColor: AppColors.gray200 || '#E5E5EA',
    borderWidth: 2,
    borderColor: AppColors.white || '#FFFFFF',
  },


  swipeUpContainer: {
    alignItems: 'center',
    paddingVertical: 15,
    marginBottom: 10,
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
    height: 2,
    backgroundColor: AppColors.gray400 || '#636366',
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
    minWidth: 200,
    alignItems: 'center',
    shadowColor: AppColors.pink400 || '#FF007A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  primaryButtonText: {
    color: AppColors.white || '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  popupText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
    color: AppColors.gray300 || '#8E8E93',
    lineHeight: 22,
  },
});
export default BrowseSceneScreen;