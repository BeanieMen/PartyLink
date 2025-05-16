
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  FlatList,
} from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useLocalSearchParams, useRouter, Link, Stack } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  withDelay,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  Users,
  PlusCircle,
  ArrowLeft,
  PartyPopper,
  UserCheck,
  ListChecks,
  CalendarDays,
  MapPin,
  AlertCircle,
  Clock,
  MessageSquare,
  LogOut,
} from "lucide-react-native";

import Colors, { API_BASE_URL } from "@/constants";
import { PartyRow, GroupRow, UserRow, GroupMemberRow } from "@/types/database";


const AppColors = Colors.dark;

const { width: screenWidth } = Dimensions.get("window");
const screenHeight = Dimensions.get("window").height;

const placeholderImage = (width: number, height: number, text = "Image") =>
  `https://placehold.co/${width}x${height}/${AppColors.cardBg.replace("#", "")}/${AppColors.white.replace("#", "")}?text=${encodeURIComponent(text)}&font=Inter`;


interface UserForGroupList {
  userId: string; 
  username?: string;
}

interface EnrichedGroupForList extends GroupRow {
  memberCount?: number;
}

interface UserJoinedGroupDetails extends GroupRow {
  members: UserForGroupList[];
}


const PartySummaryCard: React.FC<{ party: PartyRow | null }> = ({ party }) => {
  if (!party) return null;

  const partyDate = party.party_date
    ? new Date(party.party_date).toLocaleDateString()
    : "N/A";
  const partyTime = party.party_time || "6:00 PM";

  return (
    <View style={styles.partySummaryCard}>
      {/* Banner Image Container */}
      <View style={styles.bannerContainer}>
        <Image
          source={{
            uri: party.image_url
              ? `${API_BASE_URL}/party/${party.party_id}/banner`
              : placeholderImage(screenWidth - 20, Math.round((screenWidth - 20) * 9 / 16), party.name),
          }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
      </View>

      {/* Text below */}
      <View style={styles.summaryTextContainer}>
        <Text style={styles.summaryTitle}>{party.name}</Text>

        <View style={styles.metaRow}>
          <CalendarDays size={16} color={AppColors.gray300} />
          <Text style={styles.metaText}>{partyDate}</Text>
        </View>

        <View style={styles.metaRow}>
          <MapPin size={16} color={AppColors.gray300} />
          <Text style={styles.metaText}>{party.location}</Text>
        </View>

        <View style={styles.metaRow}>
          <Clock size={16} color={AppColors.gray300} />
          <Text style={styles.metaText}>{partyTime}</Text>
        </View>
      </View>
    </View>
  );
};



const YourGroupDetailsSection: React.FC<{ group: UserJoinedGroupDetails }> = ({ group }) => {
  return (
    <View style={styles.yourGroupSection}>
      <Text style={styles.sectionTitle}>Your Current Squad</Text>
      <Text style={styles.sectionSubtitle}>Details of the group you're part of for this party.</Text>

      <View style={styles.yourGroupInfoBox}>
        <Text style={styles.yourGroupInfoName} numberOfLines={1}>
          <Text>Group </Text>
          <Text style={{ color: AppColors.pink400 }}>#{group.group_id.substring(0, 6)}...</Text>
        </Text>
        <Text style={styles.yourGroupMetaText}>
          <Text>Created by: </Text>
          <Text>{group.creator_username}</Text>
        </Text>
        <Text style={styles.yourGroupMetaText}>
          <Text>Formed on: </Text>
          <Text>{group.created_at ? new Date(group.created_at).toLocaleDateString() : 'Recently'}</Text>
        </Text>
      </View>

      <Text style={styles.membersTitle}>
        <Text>Members (</Text>
        <Text>{group.members.length}</Text>
        <Text>):</Text>
      </Text>
      {group.members.length > 0 ? (
        <FlatList
          data={group.members}
          keyExtractor={(item) => item.userId}
          renderItem={({ item: member }) => (
            <View style={styles.memberItem}>
              <UserCheck size={18} color={AppColors.teal500} style={{ marginRight: 12 }} />
              <Text style={styles.memberItemText} numberOfLines={1}>
                {member.username || <Text>{`User ID: ${member.userId.substring(0, 10)}...`}</Text>}
              </Text>
            </View>
          )}
          scrollEnabled={false}
        />
      ) : (
        <Text style={styles.noMembersText}>No members found in this group.</Text>
      )}
    </View>
  );
};

const GroupCard: React.FC<{ group: EnrichedGroupForList; onJoin: (groupId: string) => void; disabled: boolean; index: number }> = ({ group, onJoin, disabled, index }) => {
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(20);

  useEffect(() => {
    cardOpacity.value = withDelay(index * 100, withTiming(1, { duration: 500 }));
    cardTranslateY.value = withDelay(index * 100, withTiming(0, { duration: 500 }));
  }, [index, cardOpacity, cardTranslateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  return (
    <Animated.View style={[styles.groupCard, animatedStyle]}>
      <View style={styles.groupCardContent}>
        <Text style={styles.groupCardName} numberOfLines={1}>
          <Text>Group </Text>
          <Text style={{ color: AppColors.pink400 }}>#{group.group_id.substring(0, 6)}...</Text>
        </Text>
        <Text style={styles.groupCardMeta}>
          <Text>Created by: </Text>
          <Text>{group.creator_username || (group.creator_user_id ? `User ID: ${group.creator_user_id.substring(0, 10)}...` : 'Unknown')}</Text>
        </Text>
        <Text style={styles.groupCardMeta}>
          <Text>Created: </Text>
          <Text>{group.created_at ? new Date(group.created_at).toLocaleDateString() : 'Recently'}</Text>
        </Text>
        <View style={styles.groupCardMembers}>
          <Users size={20} color={AppColors.green400} style={{ marginRight: 8 }} />
          <Text style={{ color: AppColors.green400 }}>
            <Text>{group.memberCount ?? 0}</Text>
            <Text> Member(s)</Text>
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.joinButton, disabled && styles.joinButtonDisabled]}
        onPress={() => onJoin(group.group_id)}
        disabled={disabled}
      >
        <UserCheck size={20} color={AppColors.white} style={{ marginRight: 8 }} />
        <Text style={styles.joinButtonText}>Join Squad</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};


const PartyGroupsScreen = () => {
  const { isLoaded, userId, signOut } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ partyId: string }>();
  const partyId = params.partyId;

  const [partyDetails, setPartyDetails] = useState<PartyRow | null>(null);
  const [groups, setGroups] = useState<EnrichedGroupForList[]>([] as EnrichedGroupForList[]);
  const [userJoinedGroup, setUserJoinedGroup] = useState<UserJoinedGroupDetails | null>(null);
  const [currentUser, setUser] = useState<UserRow | null>(null)
  const [isLoadingParty, setIsLoadingParty] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  const [initialAppLoading, setInitialAppLoading] = useState(true);

  const loaderScale = useSharedValue(1);
  const loaderOpacity = useSharedValue(0.7);

  useEffect(() => {
    if (initialAppLoading) {
      loaderScale.value = withRepeat(withTiming(1.2, { duration: 750, easing: Easing.inOut(Easing.ease) }), -1, true);
      loaderOpacity.value = withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      loaderScale.value = withTiming(1);
      loaderOpacity.value = withTiming(1);
    }
  }, [initialAppLoading, loaderScale, loaderOpacity]);

  const animatedLoaderStyle = useAnimatedStyle(() => ({
    transform: [{ scale: loaderScale.value }],
    opacity: loaderOpacity.value,
  }));

  const fetchData = async () => {
    if (!partyId || !userId || !isLoaded) {
      if (isLoaded && !userId) setError("Please sign in to view party groups.");
      setIsLoadingParty(false);
      setIsLoadingGroups(false);
      setInitialAppLoading(false);
      return;
    }
    await getCurrentUser()
    setIsLoadingParty(true);
    setIsLoadingGroups(true);
    setError(null);

    try {
      const partyRes = await fetch(`${API_BASE_URL}/party/${partyId}`);
      if (!partyRes.ok) {
        const errorData = await partyRes.json().catch(() => ({}));
        setIsLoadingParty(false);
        throw new Error(errorData.error || `Failed to fetch party details: ${partyRes.statusText}`);
      }
      const partyData: PartyRow = await partyRes.json();
      setPartyDetails(partyData);
      setIsLoadingParty(false);

      const groupsRes = await fetch(`${API_BASE_URL}/party/${partyId}/groups`);
      if (!groupsRes.ok) {
        const errorData = await groupsRes.json().catch(() => ({}));
        setIsLoadingGroups(false);
        throw new Error(errorData.error || `Failed to fetch groups list: ${groupsRes.statusText}`);
      }
      const rawGroupsData: GroupRow[] = await groupsRes.json();

      let foundUserGroup: UserJoinedGroupDetails | null = null;
      const otherGroups: EnrichedGroupForList[] = [];


      for (const group of rawGroupsData) {
        let members: UserForGroupList[] = [];
        let memberCount = 0;

        try {
          const memRes = await fetch(`${API_BASE_URL}/groups/${group.group_id}/members`);
          if (memRes.ok) {
            const memData: { members: UserForGroupList[], count?: number } = await memRes.json();
            members = memData.members || [];
            memberCount = memData.count ?? members.length;
          } else {
            console.warn(`Failed to fetch members for group ${group.group_id}: ${memRes.status}`);
          }
        } catch (e) { console.warn(`Error fetching members for group ${group.group_id}:`, e); }

        const isCreator = group.creator_user_id === userId;
        const isMember = members.some(member => member.userId === userId);

        if (isCreator || isMember) {
          foundUserGroup = { ...group, members };
        } else {
          otherGroups.push({ ...group, memberCount });
        }
      }

      setUserJoinedGroup(foundUserGroup);
      setGroups(otherGroups);


    } catch (err: any) {
      if (!partyDetails) {
        setError(err.message || "Could not load party or group information.");
      } else {
        setError(err.message || "Could not load group information.");
      }
      console.error("Error in fetchDataForPartyAndGroups:", err);
    } finally {
      if (isLoadingParty) setIsLoadingParty(false);
      setIsLoadingGroups(false);
      setInitialAppLoading(false);
    }
  };

  const getCurrentUser = async () => {
    const userResponse = await fetch(`${API_BASE_URL}/user/${userId}`)
    const userData: UserRow = await userResponse.json()
    setUser(userData)
  }

  useEffect(() => {
    if (isLoaded) {
      if (userId && partyId) {
        fetchData();
      } else {
        if (!userId) setError("Please sign in to view party groups.");
        if (!partyId) setError("Party ID is missing.");
        setIsLoadingParty(false);
        setIsLoadingGroups(false);
        setInitialAppLoading(false);
      }
    }
  }, [isLoaded, userId, partyId]);


  const handleCreateGroup = async () => {
    if (!userId || !partyId) {
      Alert.alert("Error", "User ID or Party ID is missing.");
      return;
    }
    if (actionInProgress) return;
    setActionInProgress(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/party/${partyId}/groups`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ party_id: partyId, creator_user_id: userId, creator_username: currentUser?.username }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Failed to create group`);
      Alert.alert("Success", "Group created successfully!");
      await fetchData();
    } catch (err: any) {
      setError(err.message);
      Alert.alert("Error", err.message || "Could not create group.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!userId) {
      Alert.alert("Error", "User not identified.");
      return;
    }
    if (actionInProgress) return;
    setActionInProgress(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/groups/${groupId}/members`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, user_id: userId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Failed to join group`);
      Alert.alert("Success", "Successfully joined group!");
      await fetchData();
    } catch (err: any) {
      setError(err.message);
      Alert.alert("Error", err.message || "Could not join group.");
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Confirm Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            router.replace('/');
          } catch (e) {
            console.error("Sign out error", e);
            Alert.alert("Error", "Failed to sign out.");
          }
        },
      },
    ]);
  };


  if (initialAppLoading) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg, AppColors.darkerBg]}
        style={styles.fullScreenLoaderContainer}
      >
        <Animated.View style={[styles.loaderAnimationContent, animatedLoaderStyle]}>
          <PartyPopper size={64} color={AppColors.pink400} />
        </Animated.View>
        <Text style={styles.loaderText}>Loading PartyLink Groups...</Text>
      </LinearGradient>
    );
  }

  const renderContent = () => {
    if (!isLoadingParty && !partyDetails && error) {
      return (
        <View style={styles.errorDisplayBox}>
          <AlertCircle size={48} color={AppColors.red400} style={{ marginBottom: 16 }} />
          <Text style={styles.errorDisplayText}>
            {error || "Party details could not be loaded or party not found."}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setError(null);
              if (isLoaded && userId && partyId) fetchData();
            }}
            style={styles.retryButton}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
          <Link href="/dashboard" asChild>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: AppColors.gray400, marginTop: 8 }]}>
              <Text style={styles.buttonText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </Link>
        </View>
      );
    }

    if (partyDetails) {
      return (
        <>
          {error && !isLoadingGroups && (
            <View style={[styles.errorDisplayBox, styles.nonCriticalErrorBox]}>
              <AlertCircle size={32} color={AppColors.red400} style={{ marginBottom: 8 }} />
              <Text style={[styles.errorDisplayText, { fontSize: 16 }]}>{error}</Text>
              <TouchableOpacity
                onPress={() => {
                  setError(null);
                  if (isLoaded && userId && partyId) fetchData();
                }}
                style={[styles.retryButton, styles.smallRetryButton]}
              >
                <Text style={[styles.buttonText, { fontSize: 14 }]}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {(isLoadingGroups || actionInProgress) && !error && !userJoinedGroup && groups.length === 0 && (
            <View style={styles.groupsLoadingContainer}>
              <ActivityIndicator size="large" color={AppColors.pink400} />
              <Text style={styles.loadingText}>
                {actionInProgress ? "Processing..." : "Loading squads..."}
              </Text>
            </View>
          )}

          {!isLoadingGroups && !actionInProgress && !error && (
            <>
              {userJoinedGroup ? (
                <YourGroupDetailsSection group={userJoinedGroup} />
              ) : (
                <>
                  {groups.length === 0 ? (
                    <View style={styles.noSquadsContainer}>
                      <ListChecks size={48} color={AppColors.pink400} style={{ marginBottom: 16 }} />
                      <Text style={styles.noSquadsTitle}>No Squads Yet!</Text>
                      <Text style={styles.noSquadsSubtitle}>Be the first to start a squad for this party.</Text>
                    </View>
                  ) : (
                    <View style={styles.groupsListContainer}>
                      <Text style={styles.sectionTitle}>Available Squads</Text>
                      <Text style={styles.sectionSubtitle}>Join an existing group for this party.</Text>
                      <FlatList
                        data={groups}
                        keyExtractor={(item) => item.group_id}
                        renderItem={({ item, index }) => (
                          <GroupCard
                            key={item.group_id}
                            group={item}
                            onJoin={handleJoinGroup}
                            disabled={actionInProgress}
                            index={index}
                          />
                        )}
                        contentContainerStyle={styles.groupsFlatListContent}
                        scrollEnabled={false}
                      />
                    </View>
                  )}
                  <View style={styles.createGroupCtaContainer}>
                    <Text style={styles.createGroupCtaText}>
                      Can't find your squad? Create a new one!
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.createGroupButton,
                        (isLoadingGroups || actionInProgress || !partyDetails) && styles.buttonDisabled
                      ]}
                      onPress={handleCreateGroup}
                      disabled={isLoadingGroups || actionInProgress || !partyDetails}
                    >
                      {actionInProgress ? (
                        <ActivityIndicator color={AppColors.textBlack} size="small" style={{ marginRight: 8 }} />
                      ) : (
                        <PlusCircle size={20} color={AppColors.textBlack} style={{ marginRight: 8 }} />
                      )}
                      <Text style={styles.createGroupButtonText}>Create New Group</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}
        </>
      );
    }
    return null;
  };

  return (
    <LinearGradient
      colors={[AppColors.primaryBg, AppColors.secondaryBg, AppColors.darkerBg]}
      style={styles.screenContainer}
    >
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: AppColors.secondaryBg },
          headerTintColor: AppColors.white,
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <PartyPopper size={26} color={AppColors.pink500} />
              <Text style={styles.headerTitleText}>PartyLink</Text>
            </View>
          ),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color={AppColors.gray300} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerIconsContainer}>
              <TouchableOpacity
                onPress={() => Alert.alert("Messages", "Feature coming soon!")}
                style={[styles.headerIconWrapper, { marginLeft: 10 }]}
              >
                <MessageSquare size={24} color={AppColors.gray300} />
                <View style={styles.messageBadge}>
                  <Text style={styles.messageBadgeText}>5</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSignOut} style={[styles.headerIconWrapper, { marginLeft: 10 }]}>
                <LogOut size={24} color={AppColors.gray300} />
              </TouchableOpacity>
            </View>
          ),
          headerShadowVisible: false,
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContentContainer} nestedScrollEnabled={true}>
        {!isLoadingParty && partyDetails && <PartySummaryCard party={partyDetails} />}
        <View style={styles.groupsSection}>
          {renderContent()}
        </View>
      </ScrollView>

    </LinearGradient>
  );
};
const styles = StyleSheet.create({
  screenContainer: { flex: 1 },
  fullScreenLoaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderAnimationContent: { alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 20, fontSize: 18, color: AppColors.white, fontWeight: '600' },
  scrollContentContainer: { paddingBottom: 80, flexGrow: 1, paddingTop: 20 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerTitleText: { color: AppColors.white, fontSize: 22, fontWeight: 'bold', marginLeft: 10, letterSpacing: -0.5 },
  headerIconsContainer: { flexDirection: 'row', alignItems: 'center' },
  headerIconWrapper: { padding: 6, position: 'relative' },
  messageBadge: { position: 'absolute', top: 3, right: 3, backgroundColor: AppColors.pink500, borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  messageBadgeText: { color: AppColors.white, fontSize: 10, fontWeight: 'bold' },
  profilePicture: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppColors.gray700,
  },
  profilePicturePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppColors.gray700,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventSummaryCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: AppColors.cardBg,
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    alignSelf: 'center',
  },
  eventSummaryContent: {
    flexDirection: 'row',
    gap: 16,
  },
  eventSummaryDetails: {
    flex: 1,
  },
  eventSummaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.white,
  },
  eventSummaryMeta: {
    marginTop: 16,
    gap: 8,
  },
  eventSummaryMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventSummaryMetaText: {
    color: AppColors.gray300,
    fontSize: 14,
  },
  eventSummaryImageContainer: {
    width: 96,
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
  },
  eventSummaryImage: {
    width: '100%',
    height: '100%',
  },
  groupsSection: {
    padding: 16,
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
    marginBottom: 16,
  },
  yourGroupSection: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  yourGroupInfoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  yourGroupInfoName: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.white,
    marginBottom: 4,
  },
  yourGroupMetaText: {
    fontSize: 14,
    color: AppColors.gray300,
    marginBottom: 4,
  },
  membersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.white,
    marginTop: 8,
    marginBottom: 12,
  },
  bannerWrapper: {
    position: "relative",
    width: "100%",
    height: 220,
    marginBottom: 16,
  },



  bannerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },

  bannerContent: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
  },

  bannerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  partySummaryCard: {
    marginBottom: 16,
    backgroundColor: AppColors.cardBg,
    borderRadius: 16,
    overflow: "hidden",
    alignSelf: "center",
    width: "80%",
  },
  bannerContainer: {
    width: "80%",
    alignSelf: "center",

  },

  bannerImage: {
    marginTop: 20,
    width: "100%",
    aspectRatio: 16 / 9,
  },

  summaryTextContainer: {
    padding: 16,
  },

  summaryTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: AppColors.white,
    marginBottom: 6,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  metaText: {
    color: AppColors.gray300,
    fontSize: 14,
    marginLeft: 6,
  },

  bannerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },

  bannerMetaText: {
    color: "#fff",
    marginLeft: 6,
    fontSize: 14,
  },

  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  memberItemText: {
    fontSize: 16,
    color: AppColors.gray300,
    flexShrink: 1,
  },
  noMembersText: {
    fontSize: 14,
    color: AppColors.gray400,
    textAlign: 'center',
    paddingVertical: 16,
  },
  noSquadsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noSquadsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AppColors.pink400,
    marginBottom: 8,
  },
  noSquadsSubtitle: {
    fontSize: 16,
    color: AppColors.gray300,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  groupsListContainer: {
    marginTop: 10,
  },
  groupsFlatListContent: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupCardContent: {
    flex: 1,
    marginRight: 16,
  },
  groupCardName: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.white,
    marginBottom: 4,
  },
  groupCardMeta: {
    fontSize: 12,
    color: AppColors.gray300,
    marginBottom: 4,
  },
  groupCardMembers: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  createGroupButton: {
    backgroundColor: AppColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
    shadowColor: AppColors.textBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  createGroupButtonText: {
    color: AppColors.textBlack,
    fontSize: 16,
    fontWeight: '500',
  },
  createGroupCtaContainer: {
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  createGroupCtaText: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.white,
    textAlign: 'center',
    marginBottom: 16,
  },
  joinButton: {
    backgroundColor: AppColors.green400,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    shadowColor: AppColors.textBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  joinButtonText: {
    color: AppColors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  joinButtonDisabled: {
    backgroundColor: AppColors.gray400,
    opacity: 0.6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorDisplayBox: {
    backgroundColor: AppColors.red900,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
    marginHorizontal: 16,
  },
  nonCriticalErrorBox: {
    marginVertical: 20,
    backgroundColor: AppColors.red900,
  },
  errorDisplayText: {
    color: AppColors.red400,
    fontSize: 18,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: AppColors.pink500,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 16,
  },
  smallRetryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  buttonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  groupsLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    color: AppColors.gray300,
    marginTop: 8,
    fontSize: 16,
  },

});

export default PartyGroupsScreen;