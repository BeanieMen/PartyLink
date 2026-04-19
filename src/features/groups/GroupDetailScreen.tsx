import { useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import {
  acceptGroupInvite,
  attendParty,
  type CrewDiscoveryCard,
  createPartyGroup,
  declineGroupInvite,
  establishCrew,
  fetchCrewDiscovery,
  fetchGroupInviteCandidates,
  fetchGroupJoinCandidates,
  fetchGroupMembers,
  fetchMyGroup,
  fetchPendingGroupInvites,
  fetchPartyDetail,
  moderateGroupMember,
  requestGroupJoin,
  sendGroupInvite,
  swipeCrewMatch,
  withdrawGroupJoinRequest,
} from "../../api/party.api";
import { createDmThread } from "../../api/dm.api";
import { absoluteUrl, endpoint } from "../../api/endpoints";
import { queryKeys } from "../../api/query-keys";
import {
  fetchMyAttendingParties,
  userProfilePictureUrl,
} from "../../api/user.api";
import { AuthPromptCard } from "../../components/AuthPromptCard";
import { GlassCard } from "../../components/GlassCard";
import { ProfileMenuButton } from "../../components/ProfileMenuButton";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenContainer } from "../../components/ScreenContainer";
import { StateView } from "../../components/StateView";
import { CrewMatchDeck } from "../parties/CrewSceneDeck";
import type { RootStackParamList } from "../../navigation/types";
import { useSessionStore } from "../../store/session-store";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";
import { formatCurrency, formatPartyDate } from "../../utils/format";
type GroupRouteName = "GroupDetail" | "GroupMatch" | "GroupInvites";
type GroupDetailRoute = RouteProp<RootStackParamList, GroupRouteName>;
type PartySlug = "party" | "group";
type GroupPanel = "home" | "requests" | "match";
type GroupEntry = "choose" | "join";
function createRandomTicketToken(): string {
  const randomA = Math.random().toString(36).slice(2, 10);
  const randomB = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${randomA}-${randomB}`.toUpperCase();
}
function roleLabel(role: string) {
  return role === "owner" ? "creator" : "member";
}
function primaryName(displayName: string | null | undefined, fallback: string) {
  if (displayName && displayName.trim().length > 0) return displayName;
  return fallback;
}
function crewEnergy(crew: CrewDiscoveryCard): "chill" | "party-heavy" | "networking" {
  const score = crew.overview.votes.score;
  if (score >= 8) return "party-heavy";
  if (crew.overview.dominantSchools.length >= 2) return "networking";
  return "chill";
}
export function GroupDetailScreen() {
  const queryClient = useQueryClient();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<GroupDetailRoute>();
  const currentUserId = useSessionStore((state) => state.currentUserId);
  const partyId = route.params.partyId;
  const forcedPanel: GroupPanel | null =
    route.name === "GroupMatch"
      ? "match"
      : route.name === "GroupInvites"
        ? "requests"
        : null;
  const [activeSlug, setActiveSlug] = useState<PartySlug>("group");
  const [groupPanel, setGroupPanel] = useState<GroupPanel>(
    forcedPanel ?? "home",
  );
  const [groupEntry, setGroupEntry] = useState<GroupEntry>("choose");
  const [optimisticAttending, setOptimisticAttending] = useState(false);
  const [ticketQrToken] = useState(createRandomTicketToken);
  const [joinSearch, setJoinSearch] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [selectedJoinGroupId, setSelectedJoinGroupId] = useState<string | null>(
    null,
  );
  const [selectedInviteCandidateIds, setSelectedInviteCandidateIds] = useState<
    string[]
  >([]);
  const [isInvitingBatch, setIsInvitingBatch] = useState(false);
  const [selectedDiscoveryCrew, setSelectedDiscoveryCrew] =
    useState<CrewDiscoveryCard | null>(null);
  const [matchStatusMap, setMatchStatusMap] = useState<Record<string, string>>(
    {},
  );
  const [matchAnnouncement, setMatchAnnouncement] = useState<string | null>(
    null,
  );
  const [latestCrewLinkThread, setLatestCrewLinkThread] = useState<{
    threadId: string;
    crewName: string;
  } | null>(null);
  const joinSearchTerm = joinSearch.trim();
  const inviteSearchTerm = inviteSearch.trim();
  const partyQuery = useQuery({
    queryKey: queryKeys.party(partyId),
    queryFn: () => fetchPartyDetail(partyId),
  });
  const attendingQuery = useQuery({
    queryKey: queryKeys.userAttending(currentUserId),
    queryFn: () => fetchMyAttendingParties(currentUserId as string),
    enabled: Boolean(currentUserId),
  });
  const hasTicket =
    Boolean(attendingQuery.data?.includes(partyId)) || optimisticAttending;
  const myGroupQuery = useQuery({
    queryKey: queryKeys.myGroup(partyId, currentUserId),
    queryFn: () => fetchMyGroup(partyId),
    enabled: Boolean(currentUserId && hasTicket),
  });
  const myGroup = myGroupQuery.data;
  const groupId = myGroup?.group?.id;
  const membershipStatus = myGroup?.membership.status;
  const hasJoinedCrew = membershipStatus === "joined";
  const asCreator = hasJoinedCrew && myGroup?.membership.role === "owner";
  const canOpenCrewDiscovery = Boolean(
    currentUserId &&
      hasTicket &&
      hasJoinedCrew &&
      groupId &&
      myGroup?.group.status === "established",
  );
  const canSwipeCrews = Boolean(
    asCreator && myGroup?.group.status === "established",
  );
  useEffect(() => {
    if (!myGroup) {
      setGroupPanel("home");
      setSelectedDiscoveryCrew(null);
      setLatestCrewLinkThread(null);
      setMatchAnnouncement(null);
      setMatchStatusMap({});
    }
  }, [myGroup]);
  useEffect(() => {
    if (forcedPanel) {
      setGroupPanel(forcedPanel);
      return;
    }
    setGroupPanel("home");
  }, [forcedPanel, partyId]);
  const membersQuery = useQuery({
    queryKey: queryKeys.groupMembers(groupId ?? "none"),
    queryFn: () => fetchGroupMembers(groupId as string),
    enabled: Boolean(currentUserId && hasTicket && hasJoinedCrew && groupId),
  });
  const pendingInvitesQuery = useQuery({
    queryKey: queryKeys.pendingGroupInvites(currentUserId, partyId),
    queryFn: () => fetchPendingGroupInvites({ partyId }),
    enabled: Boolean(currentUserId && hasTicket),
  });
  const joinCandidatesQuery = useQuery({
    queryKey: queryKeys.groupJoinCandidates(
      partyId,
      currentUserId,
      joinSearchTerm.toLowerCase(),
    ),
    queryFn: () => fetchGroupJoinCandidates(partyId, joinSearchTerm),
    enabled: Boolean(
      currentUserId &&
      hasTicket &&
      myGroupQuery.isSuccess &&
      !myGroup &&
      groupEntry === "join",
    ),
  });
  const inviteCandidatesQuery = useQuery({
    queryKey: queryKeys.groupInviteCandidates(
      partyId,
      groupId ?? "none",
      inviteSearchTerm.toLowerCase(),
    ),
    queryFn: () =>
      fetchGroupInviteCandidates(partyId, groupId as string, inviteSearchTerm),
    enabled: Boolean(
      asCreator &&
      groupId &&
      (groupPanel === "requests" || forcedPanel === "requests") &&
      inviteSearchTerm.length >= 1,
    ),
  });
  const crewDiscoveryQuery = useQuery({
    queryKey: queryKeys.groupDiscovery(
      partyId,
      groupId ?? "none",
      currentUserId,
    ),
    queryFn: () => fetchCrewDiscovery(partyId),
    enabled: Boolean(
      canOpenCrewDiscovery &&
        (groupPanel === "match" || forcedPanel === "match"),
    ),
  });
  const swipeMatchMutation = useMutation({
    mutationFn: ({
      targetGroupId,
      action,
    }: {
      targetGroupId: string;
      action: "like" | "pass";
    }) => swipeCrewMatch(groupId as string, targetGroupId, action),
    onSuccess: async (result, variables) => {
      const statusLabel = result.matched
        ? "Crew Link active"
        : variables.action === "like"
          ? "Request sent"
          : "Passed";
      setMatchStatusMap((previous) => ({
        ...previous,
        [variables.targetGroupId]: statusLabel,
      }));

      if (result.matched) {
        const matchedCrew = crewDiscoveryQuery.data?.crews.find(
          (crew) => crew.groupId === variables.targetGroupId,
        );
        if (matchedCrew) {
          setMatchAnnouncement(
            `${primaryName(matchedCrew.leader.displayName, matchedCrew.leader.username)} crew linked with yours. Open Crew Chat.`,
          );
          try {
            const thread = await createDmThread({
              targetUserId: matchedCrew.leader.userId,
              partyId,
            });
            setLatestCrewLinkThread({
              threadId: thread.threadId,
              crewName: primaryName(
                matchedCrew.leader.displayName,
                matchedCrew.leader.username,
              ),
            });
            await queryClient.invalidateQueries({
              queryKey: queryKeys.dmThreads(currentUserId),
            });
          } catch {
            setLatestCrewLinkThread(null);
          }
        }
      } else {
        setMatchAnnouncement(
          variables.action === "like"
            ? "Request sent. Waiting for their crew decision."
            : "Crew passed. Keep exploring more groups.",
        );
      }

      await queryClient.invalidateQueries({
        queryKey: queryKeys.groupDiscovery(
          partyId,
          groupId ?? "none",
          currentUserId,
        ),
      });
    },
  });
  const rsvpMutation = useMutation({
    mutationFn: () => attendParty(partyId),
    onMutate: () => setOptimisticAttending(true),
    onError: () => setOptimisticAttending(false),
    onSuccess: async () => {
      if (!currentUserId) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.userAttending(currentUserId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myGroup(partyId, currentUserId),
      });
    },
  });
  const createCrewMutation = useMutation({
    mutationFn: () => createPartyGroup(partyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myGroup(partyId, currentUserId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myGroups(currentUserId),
      });
      setGroupPanel("home");
    },
  });
  const requestJoinMutation = useMutation({
    mutationFn: (targetGroupId: string) => requestGroupJoin(targetGroupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myGroup(partyId, currentUserId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.groupJoinCandidates(
          partyId,
          currentUserId,
          joinSearchTerm.toLowerCase(),
        ),
      });
    },
  });
  const withdrawJoinRequestMutation = useMutation({
    mutationFn: (requestId: string) => withdrawGroupJoinRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myGroup(partyId, currentUserId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.groupJoinCandidates(
          partyId,
          currentUserId,
          joinSearchTerm.toLowerCase(),
        ),
      });
    },
  });
  const moderateMutation = useMutation({
    mutationFn: ({
      userId,
      action,
    }: {
      userId: string;
      action: "accept" | "decline" | "remove";
    }) => moderateGroupMember(groupId as string, userId, action),
    onSuccess: async () => {
      if (!groupId) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.groupMembers(groupId),
      });
    },
  });
  const sendInviteMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      sendGroupInvite(groupId as string, targetUserId),
    onSuccess: async () => {
      if (!groupId) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.groupInviteCandidates(
          partyId,
          groupId,
          inviteSearchTerm.toLowerCase(),
        ),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.groupMembers(groupId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.pendingGroupInvites(currentUserId, partyId),
      });
    },
  });
  const acceptInviteMutation = useMutation({
    mutationFn: (inviteId: string) => acceptGroupInvite(inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.pendingGroupInvites(currentUserId, partyId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myGroup(partyId, currentUserId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myGroups(currentUserId),
      });
      setGroupPanel("home");
    },
  });
  const declineInviteMutation = useMutation({
    mutationFn: (inviteId: string) => declineGroupInvite(inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.pendingGroupInvites(currentUserId, partyId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myGroup(partyId, currentUserId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myGroups(currentUserId),
      });
    },
  });
  const establishCrewMutation = useMutation({
    mutationFn: () => establishCrew(groupId as string),
    onSuccess: async () => {
      if (!groupId) return;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myGroup(partyId, currentUserId),
      });
    },
  });
  const ticketQrValue = useMemo(() => {
    const encodedToken = encodeURIComponent(ticketQrToken);
    if (!currentUserId) return `partylink://ticket?token=${encodedToken}`;
    return `partylink://ticket?token=${encodedToken}&userId=${encodeURIComponent(currentUserId)}`;
  }, [currentUserId, ticketQrToken]);
  const members = membersQuery.data ?? [];
  const joinedMembers = members.filter((member) => member.status === "joined");
  const queuedMembers = members.filter(
    (member) => member.status === "requested" || member.status === "invited",
  );
  const leader =
    joinedMembers.find((member) => member.role === "owner") ?? joinedMembers[0];
  const joinCandidates = joinCandidatesQuery.data?.crews ?? [];
  const selectedJoinCrew =
    joinCandidates.find((crew) => crew.groupId === selectedJoinGroupId) ?? null;
  useEffect(() => {
    if (!selectedJoinGroupId) return;
    if (
      joinCandidates.some(
        (candidate) => candidate.groupId === selectedJoinGroupId,
      )
    )
      return;
    setSelectedJoinGroupId(null);
  }, [joinCandidates, selectedJoinGroupId]);
  const inviteCandidates = inviteCandidatesQuery.data ?? [];
  const groupedAvatars = useMemo(
    () => joinedMembers.slice(0, 4),
    [joinedMembers],
  );
  const discoveryCrews = crewDiscoveryQuery.data?.crews ?? [];
  useEffect(() => {
    if (!selectedDiscoveryCrew) return;
    const stillPresent = discoveryCrews.some(
      (crew) => crew.groupId === selectedDiscoveryCrew.groupId,
    );
    if (!stillPresent) {
      setSelectedDiscoveryCrew(null);
    }
  }, [discoveryCrews, selectedDiscoveryCrew]);

  const crewStatusLabel = (crew: CrewDiscoveryCard) => {
    const forced = matchStatusMap[crew.groupId];
    if (forced) return forced;
    if (crew.outboundStatus === "accepted" || crew.inboundStatus === "accepted") {
      return "Crew Link active";
    }
    if (crew.outboundStatus === "pending") {
      return "Request sent";
    }
    if (crew.outboundStatus === "passed") {
      return "Passed";
    }
    return "Fresh crew";
  };

  const handleCrewSwipe = (targetGroupId: string, action: "like" | "pass") => {
    if (!canSwipeCrews || !groupId) return;
    swipeMatchMutation.mutate({ targetGroupId, action });
  };

  const openLatestCrewChat = () => {
    if (!latestCrewLinkThread) return;
    navigation.push("ThreadDetail", {
      threadId: latestCrewLinkThread.threadId,
      partyId,
      mode: "crew-link",
      sourceGroupId: groupId,
      threadStatus: "pending",
    });
  };

  const openCrewChatForCrew = async (crew: CrewDiscoveryCard) => {
    try {
      const thread = await createDmThread({
        targetUserId: crew.leader.userId,
        partyId,
      });
      setLatestCrewLinkThread({
        threadId: thread.threadId,
        crewName: primaryName(crew.leader.displayName, crew.leader.username),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.dmThreads(currentUserId),
      });
      navigation.push("ThreadDetail", {
        threadId: thread.threadId,
        partyId,
        mode: "crew-link",
        partnerUserId: crew.leader.userId,
        sourceGroupId: groupId,
        targetGroupId: crew.groupId,
        threadStatus: "pending",
      });
    } catch {
      setMatchAnnouncement("Crew chat could not be opened right now.");
    }
  };

  const showTopBar = !(activeSlug === "group" && currentUserId && hasTicket);
  const resolvedTopBarTitle =
    forcedPanel === "match"
      ? "Group Match"
      : forcedPanel === "requests"
        ? "Group Invites"
        : "Party Detail";
  const handleGroupBack = () => {
    if (forcedPanel) {
      navigation.goBack();
      return;
    }
    if (!myGroup) {
      if (groupEntry === "join") {
        setGroupEntry("choose");
        setJoinSearch("");
        setSelectedJoinGroupId(null);
        return;
      }
      navigation.goBack();
      return;
    }
    if (membershipStatus === "requested") {
      navigation.goBack();
      return;
    }
    if (groupPanel !== "home") {
      setGroupPanel("home");
      return;
    }
    navigation.goBack();
  };
  const submitJoinRequest = () => {
    if (!selectedJoinGroupId) return;
    requestJoinMutation.mutate(selectedJoinGroupId);
  };
  const toggleInviteCandidate = (candidateId: string) => {
    setSelectedInviteCandidateIds((previous) => {
      if (previous.includes(candidateId)) {
        return previous.filter((id) => id !== candidateId);
      }
      return [...previous, candidateId];
    });
  };
  const submitSelectedInvites = async () => {
    if (selectedInviteCandidateIds.length === 0 || !groupId) return;
    setIsInvitingBatch(true);
    try {
      for (const candidateId of selectedInviteCandidateIds) {
        await sendInviteMutation.mutateAsync(candidateId);
      }
      setSelectedInviteCandidateIds([]);
    } finally {
      setIsInvitingBatch(false);
    }
  };
  const renderInviteQueue = () => {
    const pendingInvites = pendingInvitesQuery.data ?? [];
    return (
      <View style={styles.groupInvitePanel}>
        
        <Text style={styles.groupPanelHeader}>Crew Invites</Text>
        {pendingInvitesQuery.isLoading ? <StateView loading /> : null}
        {pendingInvites.length === 0 && pendingInvitesQuery.isSuccess ? (
          <Text style={styles.groupSubtle}>No pending invites.</Text>
        ) : null}
        {pendingInvites.map((invite) => (
          <View key={invite.inviteId} style={styles.groupInviteItem}>
            
            <View style={styles.groupInviteMeta}>
              
              <Text style={styles.groupInviteTitle}>
                {primaryName(invite.inviterDisplayName, invite.inviterUsername)}
              </Text>
              <Text style={styles.groupInviteSubtitle}>
                invite to crew {invite.groupId}
              </Text>
            </View>
            <View style={styles.groupInviteActions}>
              
              <Pressable
                style={[styles.groupChipAction, styles.groupChipActionLight]}
                onPress={() => acceptInviteMutation.mutate(invite.inviteId)}
                disabled={
                  acceptInviteMutation.isPending ||
                  declineInviteMutation.isPending
                }
              >
                
                <Text style={styles.groupChipActionTextDark}>Accept</Text>
              </Pressable>
              <Pressable
                style={[styles.groupChipAction, styles.groupChipActionGhost]}
                onPress={() => declineInviteMutation.mutate(invite.inviteId)}
                disabled={
                  acceptInviteMutation.isPending ||
                  declineInviteMutation.isPending
                }
              >
                
                <Text style={styles.groupChipActionText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    );
  };
  const renderCreateJoinState = () => {
    if (groupEntry === "choose") {
      return (
        <View style={styles.groupCenterState}>
          
          <Text style={styles.groupCenterTitle}>
            Create or Join Group?
          </Text>
          <Pressable
            style={styles.groupActionButton}
            onPress={() => createCrewMutation.mutate()}
            disabled={createCrewMutation.isPending}
          >
            
            <Text style={styles.groupActionButtonText}>
              {createCrewMutation.isPending ? "Creating..." : "Create Group"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.groupActionButton}
            onPress={() => {
              setGroupEntry("join");
              setJoinSearch("");
            }}
          >
            
            <Text style={styles.groupActionButtonText}>Join Group</Text>
          </Pressable>
          {renderInviteQueue()}
        </View>
      );
    }
    return (
      <View style={styles.groupPanelFlow}>
        
        <Text style={styles.groupTitle}>Add your Friends!</Text>
        <Text style={styles.groupNote}>
          Keep in mind, people already in a group will NOT show up!
        </Text>
        <View style={styles.groupSearchWrap}>
          
          <Text style={styles.groupSearchLabel}>Search:</Text>
          <TextInput
            placeholder="leader username"
            placeholderTextColor="rgba(13,11,27,0.55)"
            value={joinSearch}
            onChangeText={setJoinSearch}
            autoCapitalize="none"
            style={styles.groupSearchInput}
          />
        </View>
        {selectedJoinCrew ? (
          <View style={styles.groupSelectedChipRow}>
            
            <View style={styles.groupSelectedChip}>
              
              <Text style={styles.groupSelectedChipText}>
                {primaryName(
                  selectedJoinCrew.leader.displayName,
                  selectedJoinCrew.leader.username,
                )}
              </Text>
            </View>
          </View>
        ) : null}
        {joinCandidatesQuery.isLoading ? <StateView loading /> : null}
        {joinCandidatesQuery.isError ? (
          <StateView
            errorMessage={(joinCandidatesQuery.error as Error).message}
            onRetry={joinCandidatesQuery.refetch}
          />
        ) : null}
        <View style={styles.groupCandidateList}>
          
          {joinCandidates.map((crew) => {
            const selected = crew.groupId === selectedJoinGroupId;
            return (
              <Pressable
                key={crew.groupId}
                style={styles.groupCandidateRow}
                onPress={() => setSelectedJoinGroupId(crew.groupId)}
              >
                
                <Image
                  source={{ uri: userProfilePictureUrl(crew.leader.userId) }}
                  style={styles.groupCandidateAvatar}
                />
                <View style={styles.groupCandidateTextWrap}>
                  
                  <Text style={styles.groupCandidateName}>
                    {primaryName(crew.leader.displayName, crew.leader.username)}
                  </Text>
                  <Text style={styles.groupCandidateSub}>
                    {crew.joinedCount}/{crew.maxMembers} members
                  </Text>
                </View>
                <View
                  style={[
                    styles.groupCandidateCheck,
                    selected && styles.groupCandidateCheckSelected,
                  ]}
                >
                  
                  {selected ? (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.textDark}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        {joinCandidatesQuery.isSuccess && joinCandidates.length === 0 ? (
          <Text style={styles.groupSubtle}>
            No leaders found for this search yet.
          </Text>
        ) : null}
        <Pressable
          style={[
            styles.groupActionButton,
            !selectedJoinGroupId && styles.groupActionDisabled,
          ]}
          disabled={!selectedJoinGroupId || requestJoinMutation.isPending}
          onPress={submitJoinRequest}
        >
          
          <Text style={styles.groupActionButtonText}>
            {requestJoinMutation.isPending
              ? "Requesting..."
              : "Request Members"}
          </Text>
        </Pressable>
        {renderInviteQueue()}
      </View>
    );
  };
  const renderRequestedState = () => {
    return (
      <View style={styles.groupCenterState}>
        
        <Text style={styles.groupCenterTitle}>Join Request Pending</Text>
        <Text style={styles.groupNote}>
          Your request is pending leader review.
        </Text>
        <Text style={styles.groupSubtle}>Crew code: {myGroup?.group.id}</Text>
        <Pressable
          style={styles.groupActionButton}
          onPress={() =>
            withdrawJoinRequestMutation.mutate(myGroup!.membership.id)
          }
          disabled={withdrawJoinRequestMutation.isPending}
        >
          
          <Text style={styles.groupActionButtonText}>
            {withdrawJoinRequestMutation.isPending
              ? "Withdrawing..."
              : "Withdraw Request"}
          </Text>
        </Pressable>
        {renderInviteQueue()}
      </View>
    );
  };
  const renderCrewHome = () => {
    return (
      <View style={styles.groupPanelFlow}>
        
        <Text style={styles.groupTitleHero}>Your Crew</Text>
        <Text style={styles.groupLeaderLine}>
          
          Party Leader:
          {leader
            ? `${leader.username}${leader.user_id === currentUserId ? " (you)" : ""}`
            : "Unknown"}
        </Text>
        <View style={styles.groupAvatarClusterRow}>
          
          {groupedAvatars.map((member, index) => (
            <View
              key={member.user_id}
              style={[
                styles.groupAvatarCircleWrap,
                index === 0
                  ? styles.groupAvatarMainWrap
                  : styles.groupAvatarSecondaryWrap,
                { marginLeft: index === 0 ? 0 : -18 },
              ]}
            >
              
              <Image
                source={{ uri: userProfilePictureUrl(member.user_id) }}
                style={
                  index === 0
                    ? styles.groupAvatarMain
                    : styles.groupAvatarSecondary
                }
              />
            </View>
          ))}
        </View>
        <Text style={styles.groupFootnote}>
          *establishing crew means you are posting your crew on the party scene
        </Text>
        {asCreator && myGroup?.group.status === "forming" ? (
          <Pressable
            style={styles.groupEstablishButton}
            onPress={() => establishCrewMutation.mutate()}
            disabled={establishCrewMutation.isPending}
          >
            
            <Text style={styles.groupEstablishText}>
              {establishCrewMutation.isPending
                ? "Establishing..."
                : "Establish Group"}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.groupSubtle}>
            Current Status: {myGroup?.group.status ?? "forming"} ·
            {roleLabel(myGroup?.membership.role ?? "member")}
          </Text>
        )}
        <View style={styles.groupMiniNav}>
          <Pressable
            onPress={() => navigation.push("GroupMatch", { partyId })}
          >
            
            <Text style={styles.groupMiniNavText}>Match</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.push("GroupInvites", { partyId })}
          >
            
            <Text style={styles.groupMiniNavText}>Invites</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              navigation.push("Inbox", {
                partyId,
                sourceGroupId: groupId,
              })
            }
          >
            <Text style={styles.groupMiniNavText}>Chats</Text>
          </Pressable>
        </View>
      </View>
    );
  };
  const renderMatchPanel = () => {
    const selectedStatus = selectedDiscoveryCrew
      ? crewStatusLabel(selectedDiscoveryCrew)
      : null;
    const selectedEnergy = selectedDiscoveryCrew
      ? crewEnergy(selectedDiscoveryCrew)
      : null;
    const selectedKeywords =
      selectedDiscoveryCrew?.overview.topKeywords
        .slice(0, 3)
        .map((item) => item.keyword)
        .join(" • ") ?? "No vibe signal yet";
    const selectedSchools =
      selectedDiscoveryCrew?.overview.dominantSchools
        .slice(0, 2)
        .map((item) => `${item.school} (${item.count})`)
        .join(" • ") ?? "No school overlap yet";

    return (
      <View style={styles.groupPanelFlow}>
        <Text style={styles.groupTitle}>Browse the Scene!</Text>

        {canOpenCrewDiscovery ? null : (
          <GlassCard style={styles.matchAnnouncementCard}>
            <Text style={styles.matchAnnouncementTitle}>Discovery locked</Text>
            <Text style={styles.matchAnnouncementBody}>
              Establish your crew first, then leader swipes become available.
            </Text>
          </GlassCard>
        )}

        {canOpenCrewDiscovery && matchAnnouncement ? (
          <GlassCard style={styles.matchAnnouncementCard}>
            <Text style={styles.matchAnnouncementTitle}>Crew Update</Text>
            <Text style={styles.matchAnnouncementBody}>{matchAnnouncement}</Text>
            {latestCrewLinkThread ? (
              <PrimaryButton
                label={`Open Crew Chat with ${latestCrewLinkThread.crewName}`}
                variant="outline"
                onPress={openLatestCrewChat}
              />
            ) : null}
          </GlassCard>
        ) : null}

        {canOpenCrewDiscovery && crewDiscoveryQuery.isLoading ? (
          <StateView loading />
        ) : null}
        {canOpenCrewDiscovery && crewDiscoveryQuery.isError ? (
          <StateView
            errorMessage={(crewDiscoveryQuery.error as Error).message}
            onRetry={crewDiscoveryQuery.refetch}
          />
        ) : null}

        {canOpenCrewDiscovery && crewDiscoveryQuery.isSuccess ? (
          discoveryCrews.length > 0 ? (
            <CrewMatchDeck
              crews={discoveryCrews}
              disabled={!canSwipeCrews || swipeMatchMutation.isPending}
              onSwipe={handleCrewSwipe}
              onPreview={(crew: CrewDiscoveryCard) => setSelectedDiscoveryCrew(crew)}
              statusByGroupId={matchStatusMap}
            />
          ) : (
            <StateView emptyMessage="No established crews available right now." />
          )
        ) : null}

        {canOpenCrewDiscovery && !canSwipeCrews ? (
          <Text style={styles.groupSubtle}>
            Only the crew leader can send group swipe requests.
          </Text>
        ) : null}

        {selectedDiscoveryCrew ? (
          <GlassCard style={styles.matchDetailCard}>
            <Text style={styles.matchDetailTitle}>
              {primaryName(
                selectedDiscoveryCrew.leader.displayName,
                selectedDiscoveryCrew.leader.username,
              )}
              {'\''}s Crew
            </Text>
            <View style={styles.matchDetailChips}>
              <View style={styles.matchMetaChip}>
                <Text style={styles.matchMetaChipLabel}>Status</Text>
                <Text style={styles.matchMetaChipValue}>{selectedStatus}</Text>
              </View>
              <View style={styles.matchMetaChip}>
                <Text style={styles.matchMetaChipLabel}>Energy</Text>
                <Text style={styles.matchMetaChipValue}>{selectedEnergy}</Text>
              </View>
              <View style={styles.matchMetaChip}>
                <Text style={styles.matchMetaChipLabel}>Members</Text>
                <Text style={styles.matchMetaChipValue}>
                  {selectedDiscoveryCrew.joinedCount}/
                  {selectedDiscoveryCrew.maxMembers}
                </Text>
              </View>
            </View>

            <Text style={styles.matchDetailBody}>Vibe: {selectedKeywords}</Text>
            <Text style={styles.matchDetailBody}>Shared interests: {selectedSchools}</Text>

            <View style={styles.matchMemberRow}>
              <Image
                source={{
                  uri: userProfilePictureUrl(selectedDiscoveryCrew.leader.userId),
                }}
                style={styles.matchMemberAvatar}
              />
              <View style={styles.matchMemberMeta}>
                <Text style={styles.matchMemberTitle}>Crew leader visible</Text>
                <Text style={styles.matchMemberSubtitle}>
                  {primaryName(
                    selectedDiscoveryCrew.leader.displayName,
                    selectedDiscoveryCrew.leader.username,
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.matchMemberRowMuted}>
              <Ionicons
                name="eye-off-outline"
                size={16}
                color="rgba(255,255,255,0.8)"
              />
              <Text style={styles.matchMemberSubtitle}>
                {selectedDiscoveryCrew.overview.privateMemberCount} private member
                {selectedDiscoveryCrew.overview.privateMemberCount === 1
                  ? ""
                  : "s"}
                hidden until crew link is accepted.
              </Text>
            </View>

            {selectedStatus === "Crew Link active" ? (
              <PrimaryButton
                label="Open Crew Chat"
                onPress={() => {
                  void openCrewChatForCrew(selectedDiscoveryCrew);
                }}
              />
            ) : (
              <PrimaryButton
                label={
                  swipeMatchMutation.isPending
                    ? "Sending..."
                    : selectedStatus === "Request sent"
                      ? "Request Sent"
                      : "Send Crew Request"
                }
                variant={selectedStatus === "Request sent" ? "outline" : "primary"}
                disabled={
                  !canSwipeCrews ||
                  swipeMatchMutation.isPending ||
                  selectedStatus === "Request sent"
                }
                onPress={() => handleCrewSwipe(selectedDiscoveryCrew.groupId, "like")}
              />
            )}
          </GlassCard>
        ) : null}
      </View>
    );
  };
  const renderRequestsPanel = () => {
    const selectedCandidateLabels = selectedInviteCandidateIds
      .map((id) => inviteCandidates.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      )
      .map((candidate) =>
        primaryName(candidate.displayName, candidate.username),
      );
    return (
      <View style={styles.groupPanelFlow}>
        
        <Text style={styles.groupTitle}>Add your Friends!</Text>
        <Text style={styles.groupNote}>
          Keep in mind, people already in a group will NOT show up!
        </Text>
        {asCreator ? (
          <>
            
            <View style={styles.groupSearchWrap}>
              
              <Text style={styles.groupSearchLabel}>Search:</Text>
              <TextInput
                placeholder="username"
                placeholderTextColor="rgba(13,11,27,0.55)"
                value={inviteSearch}
                onChangeText={setInviteSearch}
                autoCapitalize="none"
                style={styles.groupSearchInput}
              />
            </View>
            {selectedCandidateLabels.length > 0 ? (
              <View style={styles.groupSelectedChipRow}>
                
                {selectedCandidateLabels.map((label) => (
                  <View key={label} style={styles.groupSelectedChip}>
                    
                    <Text style={styles.groupSelectedChipText}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {inviteCandidatesQuery.isLoading ? <StateView loading /> : null}
            <View style={styles.groupCandidateList}>
              
              {inviteCandidates.map((candidate) => {
                const selected = selectedInviteCandidateIds.includes(
                  candidate.id,
                );
                return (
                  <Pressable
                    key={candidate.id}
                    style={styles.groupCandidateRow}
                    onPress={() => toggleInviteCandidate(candidate.id)}
                  >
                    
                    <Image
                      source={{ uri: userProfilePictureUrl(candidate.id) }}
                      style={styles.groupCandidateAvatar}
                    />
                    <View style={styles.groupCandidateTextWrap}>
                      
                      <Text style={styles.groupCandidateName}>
                        {primaryName(candidate.displayName, candidate.username)}
                      </Text>
                      <Text style={styles.groupCandidateSub}>
                        @{candidate.username}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.groupCandidateCheck,
                        selected && styles.groupCandidateCheckSelected,
                      ]}
                    >
                      
                      {selected ? (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={colors.textDark}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {inviteCandidatesQuery.isSuccess &&
            inviteCandidates.length === 0 &&
            inviteSearchTerm.length > 0 ? (
              <Text style={styles.groupSubtle}>No eligible users found.</Text>
            ) : null}
            <Pressable
              style={[
                styles.groupActionButton,
                selectedInviteCandidateIds.length === 0 &&
                  styles.groupActionDisabled,
              ]}
              onPress={() => {
                void submitSelectedInvites();
              }}
              disabled={
                selectedInviteCandidateIds.length === 0 || isInvitingBatch
              }
            >
              
              <Text style={styles.groupActionButtonText}>
                {isInvitingBatch ? "Requesting..." : "Request Members"}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.groupSubtle}>
            Only leader can invite members.
          </Text>
        )}
        <View style={styles.requestQueueWrap}>
          
          {queuedMembers.map((member) => (
            <View key={member.user_id} style={styles.requestQueueItem}>
              
              <View style={styles.requestQueueMeta}>
                
                <Text style={styles.requestQueueName}>
                  {member.username}
                </Text>
                <Text style={styles.requestQueueStatus}>
                  status: {member.status}
                </Text>
              </View>
              {asCreator ? (
                <View style={styles.requestQueueActions}>
                  
                  <Pressable
                    style={[
                      styles.groupChipAction,
                      styles.groupChipActionLight,
                    ]}
                    onPress={() =>
                      moderateMutation.mutate({
                        userId: member.user_id,
                        action: "accept",
                      })
                    }
                  >
                    
                    <Text style={styles.groupChipActionTextDark}>
                      Accept
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.groupChipAction,
                      styles.groupChipActionGhost,
                    ]}
                    onPress={() =>
                      moderateMutation.mutate({
                        userId: member.user_id,
                        action: "decline",
                      })
                    }
                  >
                    
                    <Text style={styles.groupChipActionText}>Decline</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
          {queuedMembers.length === 0 ? (
            <Text style={styles.groupSubtle}>No pending member requests.</Text>
          ) : null}
        </View>
      </View>
    );
  };
  const renderJoinedCrew = () => {
    if (forcedPanel === "match") return renderMatchPanel();
    if (forcedPanel === "requests") return renderRequestsPanel();
    return renderCrewHome();
  };
  return (
    <ScreenContainer>
      
      {forcedPanel || showTopBar ? (
        <View style={styles.topBar}>
          
          <Pressable
            style={styles.iconButton}
            onPress={() => navigation.goBack()}
          >
            
            <Ionicons
              name="chevron-back"
              size={18}
              color={colors.textPrimary}
            />
          </Pressable>
          <Text style={styles.topTitle}>{resolvedTopBarTitle}</Text>
          <ProfileMenuButton />
        </View>
      ) : null}
      {partyQuery.isLoading ? <StateView loading /> : null}
      {partyQuery.isError ? (
        <StateView
          errorMessage={(partyQuery.error as Error).message}
          onRetry={partyQuery.refetch}
        />
      ) : null}
      {partyQuery.data ? (
        activeSlug === "party" ? (
          <View style={styles.contentWrap}>
            
            <Image
              source={{ uri: absoluteUrl(endpoint.partyBanner(partyId)) }}
              style={styles.hero}
            />
            <GlassCard>
              
              <Text style={styles.partyName}>{partyQuery.data.name}</Text>
              <Text style={styles.partyMeta}>
                {formatPartyDate(
                  partyQuery.data.party_date,
                  partyQuery.data.party_time,
                )}
              </Text>
              <Text style={styles.partyMeta}>{partyQuery.data.location}</Text>
              <Text style={styles.price}>
                {formatCurrency(partyQuery.data.price)}
              </Text>
              <Text style={styles.description}>
                {partyQuery.data.description ?? "No description yet."}
              </Text>
            </GlassCard>
            <View style={styles.slugRow}>
              
              <Pressable
                style={[styles.slugChip, styles.slugChipActive]}
                onPress={() => setActiveSlug("party")}
              >
                
                <Text style={[styles.slugText, styles.slugTextActive]}>
                  Party
                </Text>
              </Pressable>
              <Pressable
                style={styles.slugChip}
                onPress={() => setActiveSlug("group")}
              >
                
                <Text style={styles.slugText}>Group</Text>
              </Pressable>
            </View>
            {!currentUserId ? (
              <AuthPromptCard
                title="Sign in to join this event"
                description="Browse freely first, then sign in when you want to reserve your ticket."
                onPressLogin={() =>
                  navigation.navigate("AuthGate", {
                    partyId,
                    reason: "Sign in to reserve your place at this event.",
                  })
                }
              />
            ) : hasTicket ? (
              <GlassCard style={styles.sectionCard}>
                
                <Text style={styles.sectionTitle}>Your Ticket QR</Text>
                <Text style={styles.sectionHint}>
                  Present this code at entry for check-in.
                </Text>
                <View style={styles.qrWrap}>
                  
                  <QRCode
                    value={ticketQrValue}
                    size={190}
                    color={colors.textDark}
                    backgroundColor={colors.surfaceLight}
                  />
                </View>
                <PrimaryButton
                  label="View Group"
                  variant="outline"
                  onPress={() => setActiveSlug("group")}
                />
              </GlassCard>
            ) : (
              <GlassCard style={styles.sectionCard}>
                
                <Text style={styles.sectionTitle}>Ticket</Text>
                <Text style={styles.sectionHint}>
                  
                  Capacity: {partyQuery.data.tickets_left} /
                  {partyQuery.data.total_tickets} left
                </Text>
                <PrimaryButton
                  label="Get Ticket"
                  disabled={optimisticAttending}
                  loading={rsvpMutation.isPending}
                  onPress={() => rsvpMutation.mutate()}
                />
              </GlassCard>
            )}
          </View>
        ) : (
          <View style={styles.groupRoot}>
            
            {!currentUserId ? (
              <AuthPromptCard
                title="Sign in to open party group"
                description="Sign in to view and manage your party crew."
                onPressLogin={() =>
                  navigation.navigate("AuthGate", {
                    partyId,
                    reason: "Sign in to access this party group.",
                  })
                }
              />
            ) : !hasTicket ? (
              <GlassCard style={styles.sectionCard}>
                
                <Text style={styles.sectionTitle}>Group Locked</Text>
                <Text style={styles.sectionHint}>
                  Get your ticket first to unlock this party's group flow.
                </Text>
              </GlassCard>
            ) : (
              <View style={styles.groupShell}>
                
                <View style={styles.groupHeaderRow}>
                  
                  <Pressable onPress={handleGroupBack}>
                    
                    <Text style={styles.groupBackText}>Back</Text>
                  </Pressable>
                  {myGroup && hasJoinedCrew && asCreator ? (
                    <Text style={styles.groupDeleteText}>delete crew</Text>
                  ) : (
                    <View style={styles.groupHeaderSpacer} />
                  )}
                </View>
                {!myGroup ? renderCreateJoinState() : null}
                {myGroup && membershipStatus === "requested"
                  ? renderRequestedState()
                  : null}
                {myGroup && hasJoinedCrew ? renderJoinedCrew() : null}
              </View>
            )}
          </View>
        )
      ) : null}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 14,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    letterSpacing: 1,
  },
  contentWrap: { gap: 14 },
  hero: { width: "100%", height: 280, borderRadius: 22 },
  partyName: {
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 40,
    letterSpacing: 0.8,
  },
  partyMeta: { color: colors.textMuted, fontFamily: fonts.body, marginTop: 2 },
  price: {
    marginTop: 6,
    color: colors.accentMint,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  description: {
    marginTop: 8,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  slugRow: { flexDirection: "row", gap: 8 },
  slugChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  slugChipActive: {
    backgroundColor: colors.accentOrange,
    borderColor: colors.accentOrange,
  },
  slugText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  slugTextActive: { color: colors.textDark },
  sectionCard: { gap: 10 },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  sectionHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  groupRoot: { paddingTop: 4, paddingBottom: 18 },
  groupShell: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 24,
    minHeight: 720,
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  groupBackText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 14,
    opacity: 0.9,
  },
  groupDeleteText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 14,
    opacity: 0.9,
  },
  groupHeaderSpacer: { width: 68, height: 12 },
  groupCenterState: { alignItems: "center", gap: 16, paddingTop: 26 },
  groupCenterTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 42,
    textAlign: "center",
    lineHeight: 40,
  },
  groupActionButton: {
    width: "84%",
    alignSelf: "center",
    borderRadius: 18,
    backgroundColor: "#EDEDED",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  groupActionDisabled: { opacity: 0.5 },
  groupActionButtonText: {
    color: "#121212",
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 30,
  },
  groupPanelFlow: { gap: 12, paddingTop: 6 },
  groupTitleHero: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 66,
    lineHeight: 60,
    marginTop: 10,
    textAlign: "center",
  },
  groupTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 50,
    lineHeight: 48,
    textAlign: "center",
  },
  groupLeaderLine: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 22,
    textAlign: "center",
  },
  groupNote: {
    color: "#FFFFFF",
    opacity: 0.95,
    fontFamily: fonts.bold,
    fontSize: 21,
    lineHeight: 26,
    textAlign: "center",
  },
  groupSubtle: {
    color: "#FFFFFF",
    opacity: 0.9,
    fontFamily: fonts.medium,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 20,
  },
  groupSearchWrap: {
    backgroundColor: "#E8E8E8",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  groupSearchLabel: {
    color: "#171522",
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 32,
  },
  groupSearchInput: {
    flex: 1,
    color: "#171522",
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 30,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  groupSelectedChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  groupSelectedChip: {
    borderRadius: 999,
    backgroundColor: "#E7E7E7",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  groupSelectedChipText: {
    color: "#141414",
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 24,
  },
  groupCandidateList: {
    borderRadius: 20,
    padding: 10,
    backgroundColor: "rgba(232,232,232,0.9)",
    gap: 7,
  },
  groupCandidateRow: {
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#1B1C23",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    gap: 10,
  },
  groupCandidateAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#E5E5E5",
  },
  groupCandidateTextWrap: { flex: 1 },
  groupCandidateName: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 34,
    lineHeight: 34,
  },
  groupCandidateSub: {
    color: "#D6D6D6",
    fontFamily: fonts.medium,
    fontSize: 17,
    lineHeight: 18,
  },
  groupCandidateCheck: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  groupCandidateCheckSelected: {
    backgroundColor: "#F1F1F1",
    borderColor: "#F1F1F1",
  },
  groupInvitePanel: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(9,0,44,0.5)",
    padding: 12,
    gap: 10,
  },
  groupPanelHeader: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 28,
  },
  groupInviteItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(0,0,0,0.25)",
    padding: 10,
    gap: 8,
  },
  groupInviteMeta: { gap: 2 },
  groupInviteTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 24,
  },
  groupInviteSubtitle: {
    color: "#DFDFDF",
    fontFamily: fonts.medium,
    fontSize: 17,
    lineHeight: 20,
  },
  groupInviteActions: { flexDirection: "row", gap: 8 },
  groupChipAction: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#EDEDED",
  },
  groupChipActionLight: { backgroundColor: "#EDEDED" },
  groupChipActionGhost: { backgroundColor: "transparent" },
  groupChipActionTextDark: {
    color: "#121212",
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 18,
  },
  groupChipActionText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 18,
  },
  groupAvatarClusterRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  groupAvatarCircleWrap: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#EDEDED",
    backgroundColor: "#0E0E18",
    overflow: "hidden",
  },
  groupAvatarMainWrap: { width: 170, height: 170, zIndex: 3 },
  groupAvatarSecondaryWrap: { width: 92, height: 92, zIndex: 1 },
  groupAvatarMain: { width: "100%", height: "100%" },
  groupAvatarSecondary: { width: "100%", height: "100%" },
  groupSwitchRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  groupSwitchText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 33,
    textAlign: "center",
  },
  groupFootnote: {
    marginTop: 4,
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  groupEstablishButton: {
    marginTop: 6,
    alignSelf: "center",
    borderRadius: 16,
    backgroundColor: "#EDEDED",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  groupEstablishText: {
    color: "#121212",
    fontFamily: fonts.bold,
    fontSize: 46,
    lineHeight: 44,
  },
  groupMiniNav: {
    marginTop: 10,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    borderRadius: 999,
    backgroundColor: "#E8E8E8",
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  groupMiniNavText: {
    color: "#181818",
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 22,
  },
  matchAnnouncementCard: {
    gap: 8,
    borderRadius: 16,
    backgroundColor: "rgba(11, 17, 35, 0.6)",
  },
  matchAnnouncementTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 24,
  },
  matchAnnouncementBody: {
    color: "#E9E9E9",
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  matchDetailCard: {
    gap: 10,
    borderRadius: 18,
    backgroundColor: "rgba(9, 18, 37, 0.72)",
  },
  matchDetailTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 30,
  },
  matchDetailChips: {
    flexDirection: "row",
    gap: 8,
  },
  matchMetaChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  matchMetaChipLabel: {
    color: "#D0D0D0",
    fontFamily: fonts.medium,
    fontSize: 11,
    textTransform: "uppercase",
  },
  matchMetaChipValue: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 16,
  },
  matchDetailBody: {
    color: "#EFEFEF",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  matchMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  matchMemberAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.75)",
  },
  matchMemberMeta: {
    gap: 2,
  },
  matchMemberTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  matchMemberSubtitle: {
    color: "#E2E2E2",
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  matchMemberRowMuted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  requestQueueWrap: { gap: 8, marginTop: 4 },
  requestQueueItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.25)",
    padding: 10,
    gap: 8,
  },
  requestQueueMeta: { gap: 2 },
  requestQueueName: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 24,
  },
  requestQueueStatus: {
    color: "#E8E8E8",
    fontFamily: fonts.medium,
    fontSize: 16,
  },
  requestQueueActions: { flexDirection: "row", gap: 8 },
});
