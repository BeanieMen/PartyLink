import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  acceptGroupInvite,
  attendParty,
  declineGroupInvite,
  fetchGroupMembers,
  fetchMyGroup,
  fetchPendingGroupInvites,
  fetchPartyDetail,
  moderateGroupMember,
} from '../../api/party.api';
import { absoluteUrl, endpoint } from '../../api/endpoints';
import { queryKeys } from '../../api/query-keys';
import { fetchMyAttendingParties, userProfilePictureUrl } from '../../api/user.api';
import { AuthPromptCard } from '../../components/AuthPromptCard';
import { GlassCard } from '../../components/GlassCard';
import { ProfileMenuButton } from '../../components/ProfileMenuButton';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StateView } from '../../components/StateView';
import type { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/session-store';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { formatCurrency, formatPartyDate } from '../../utils/format';

type PartyDetailRoute = RouteProp<RootStackParamList, 'PartyDetail'>;
type PartySlug = 'party' | 'group';
type GroupSlug = 'overview' | 'requests';

function createRandomTicketToken(): string {
  const randomA = Math.random().toString(36).slice(2, 10);
  const randomB = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${randomA}-${randomB}`.toUpperCase();
}

function roleLabel(role: string) {
  return role === 'owner' ? 'creator' : 'member';
}

export function PartyDetailScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<PartyDetailRoute>();
  const currentUserId = useSessionStore((state) => state.currentUserId);

  const partyId = route.params.partyId;

  const [activeSlug, setActiveSlug] = useState<PartySlug>(route.params.slug === 'group' ? 'group' : 'party');
  const [groupSlug, setGroupSlug] = useState<GroupSlug>('overview');
  const [optimisticAttending, setOptimisticAttending] = useState(false);
  const [ticketQrToken] = useState(createRandomTicketToken);

  useEffect(() => {
    if (route.params.slug === 'group') {
      setActiveSlug('group');
    }
  }, [route.params.slug]);

  const partyQuery = useQuery({
    queryKey: queryKeys.party(partyId),
    queryFn: () => fetchPartyDetail(partyId),
  });

  const attendingQuery = useQuery({
    queryKey: queryKeys.userAttending(currentUserId),
    queryFn: () => fetchMyAttendingParties(currentUserId as string),
    enabled: Boolean(currentUserId),
  });

  const hasTicket = Boolean(attendingQuery.data?.includes(partyId)) || optimisticAttending;

  const myGroupQuery = useQuery({
    queryKey: queryKeys.myGroup(partyId, currentUserId),
    queryFn: () => fetchMyGroup(partyId),
    enabled: Boolean(currentUserId && hasTicket),
  });

  const groupId = myGroupQuery.data?.group?.id;

  const membersQuery = useQuery({
    queryKey: queryKeys.groupMembers(groupId ?? 'none'),
    queryFn: () => fetchGroupMembers(groupId as string),
    enabled: Boolean(currentUserId && hasTicket && groupId),
  });

  const pendingInvitesQuery = useQuery({
    queryKey: queryKeys.pendingGroupInvites(currentUserId, partyId),
    queryFn: () => fetchPendingGroupInvites({ partyId }),
    enabled: Boolean(currentUserId && hasTicket),
  });

  const rsvpMutation = useMutation({
    mutationFn: () => attendParty(partyId),
    onMutate: () => setOptimisticAttending(true),
    onError: () => setOptimisticAttending(false),
    onSuccess: async () => {
      if (!currentUserId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.userAttending(currentUserId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myGroup(partyId, currentUserId) });
    },
  });

  const moderateMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: 'accept' | 'decline' | 'remove' }) =>
      moderateGroupMember(groupId as string, userId, action),
    onSuccess: async () => {
      if (!groupId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(groupId) });
    },
  });

  const acceptInviteMutation = useMutation({
    mutationFn: (inviteId: string) => acceptGroupInvite(inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pendingGroupInvites(currentUserId, partyId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myGroup(partyId, currentUserId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myGroups(currentUserId) });
    },
  });

  const declineInviteMutation = useMutation({
    mutationFn: (inviteId: string) => declineGroupInvite(inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pendingGroupInvites(currentUserId, partyId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myGroup(partyId, currentUserId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myGroups(currentUserId) });
    },
  });

  const ticketQrValue = useMemo(() => {
    const encodedToken = encodeURIComponent(ticketQrToken);
    if (!currentUserId) return `partylink://ticket?token=${encodedToken}`;
    return `partylink://ticket?token=${encodedToken}&userId=${encodeURIComponent(currentUserId)}`;
  }, [currentUserId, ticketQrToken]);

  const asCreator = myGroupQuery.data?.membership.role === 'owner';

  const members = membersQuery.data ?? [];
  const joinedMembers = members.filter((member) => member.status === 'joined');
  const requestedMembers = members.filter((member) => member.status === 'requested' || member.status === 'invited');
  const leader = joinedMembers.find((member) => member.role === 'owner') ?? joinedMembers[0];

  const currentStatusLabel = myGroupQuery.data ? roleLabel(myGroupQuery.data.membership.role) : 'member';

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Party Detail</Text>
        <ProfileMenuButton />
      </View>

      {partyQuery.isLoading ? <StateView loading /> : null}
      {partyQuery.isError ? <StateView errorMessage={(partyQuery.error as Error).message} onRetry={partyQuery.refetch} /> : null}

      {partyQuery.data ? (
        <View style={styles.contentWrap}>
          <Image source={{ uri: absoluteUrl(endpoint.partyBanner(partyId)) }} style={styles.hero} />

          <GlassCard>
            <Text style={styles.partyName}>{partyQuery.data.name}</Text>
            <Text style={styles.partyMeta}>{formatPartyDate(partyQuery.data.party_date, partyQuery.data.party_time)}</Text>
            <Text style={styles.partyMeta}>{partyQuery.data.location}</Text>
            <Text style={styles.price}>{formatCurrency(partyQuery.data.price)}</Text>
            <Text style={styles.description}>{partyQuery.data.description ?? 'No description yet.'}</Text>
          </GlassCard>

          <View style={styles.slugRow}>
            <Pressable
              style={[styles.slugChip, activeSlug === 'party' && styles.slugChipActive]}
              onPress={() => setActiveSlug('party')}
            >
              <Text style={[styles.slugText, activeSlug === 'party' && styles.slugTextActive]}>Party</Text>
            </Pressable>
            <Pressable
              style={[styles.slugChip, activeSlug === 'group' && styles.slugChipActive]}
              onPress={() => setActiveSlug('group')}
            >
              <Text style={[styles.slugText, activeSlug === 'group' && styles.slugTextActive]}>Group</Text>
            </Pressable>
          </View>

          {activeSlug === 'party' ? (
            <>
              {!currentUserId ? (
                <AuthPromptCard
                  title="Sign in to join this event"
                  description="Browse freely first, then sign in when you want to reserve your ticket."
                  onPressLogin={() =>
                    navigation.navigate('AuthGate', {
                      partyId,
                      reason: 'Sign in to reserve your place at this event.',
                    })
                  }
                />
              ) : hasTicket ? (
                <GlassCard style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Your Ticket QR</Text>
                  <Text style={styles.sectionHint}>Present this code at entry for check-in.</Text>
                  <View style={styles.qrWrap}>
                    <QRCode value={ticketQrValue} size={190} color={colors.textDark} backgroundColor={colors.surfaceLight} />
                  </View>
                  <PrimaryButton label="View Group" variant="outline" onPress={() => setActiveSlug('group')} />
                </GlassCard>
              ) : (
                <GlassCard style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Ticket</Text>
                  <Text style={styles.sectionHint}>
                    Capacity: {partyQuery.data.tickets_left} / {partyQuery.data.total_tickets} left
                  </Text>
                  <PrimaryButton
                    label="Get Ticket"
                    disabled={optimisticAttending}
                    loading={rsvpMutation.isPending}
                    onPress={() => rsvpMutation.mutate()}
                  />
                </GlassCard>
              )}
            </>
          ) : (
            <>
              {!currentUserId ? (
                <AuthPromptCard
                  title="Sign in to open party group"
                  description="Sign in to view invites and your party crew."
                  onPressLogin={() =>
                    navigation.navigate('AuthGate', {
                      partyId,
                      reason: 'Sign in to access this party group.',
                    })
                  }
                />
              ) : !hasTicket ? (
                <GlassCard style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Group Locked</Text>
                  <Text style={styles.sectionHint}>Get your ticket first to unlock this party's group.</Text>
                </GlassCard>
              ) : (
                <>
                  <GlassCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Invites For This Party</Text>

                    {pendingInvitesQuery.isLoading ? <StateView loading /> : null}
                    {(pendingInvitesQuery.data ?? []).map((invite) => (
                      <View key={invite.inviteId} style={styles.inviteItem}>
                        <Text style={styles.inviteItemTitle}>Invite from {invite.inviterDisplayName ?? invite.inviterUsername}</Text>
                        <Text style={styles.inviteItemMeta}>Group code: {invite.groupId}</Text>
                        <View style={styles.inviteItemActions}>
                          <PrimaryButton
                            label="Accept"
                            variant="ghost"
                            loading={acceptInviteMutation.isPending && acceptInviteMutation.variables === invite.inviteId}
                            onPress={() => acceptInviteMutation.mutate(invite.inviteId)}
                          />
                          <PrimaryButton
                            label="Decline"
                            variant="outline"
                            loading={declineInviteMutation.isPending && declineInviteMutation.variables === invite.inviteId}
                            onPress={() => declineInviteMutation.mutate(invite.inviteId)}
                          />
                        </View>
                      </View>
                    ))}

                    {pendingInvitesQuery.isSuccess && (pendingInvitesQuery.data?.length ?? 0) === 0 ? (
                      <Text style={styles.sectionHint}>No pending invites for this party.</Text>
                    ) : null}
                  </GlassCard>

                  {myGroupQuery.isLoading ? <StateView loading /> : null}

                  {!myGroupQuery.isLoading && !myGroupQuery.data ? (
                    <GlassCard style={styles.sectionCard}>
                      <Text style={styles.crewTitle}>Your Crew</Text>
                      <Text style={styles.sectionHint}>Current Status: {currentStatusLabel}</Text>
                      <Text style={styles.footnote}>*establishing group means you are posting your group on the party scene</Text>
                      <PrimaryButton
                        label="Establish Group"
                        onPress={() => {
                          // Intentionally no-op for now per product direction.
                        }}
                      />
                    </GlassCard>
                  ) : null}

                  {myGroupQuery.data ? (
                    <GlassCard style={styles.sectionCard}>
                      <View style={styles.crewActionsTop}>
                        <Text style={styles.crewActionGhost}>remove member</Text>
                        <Text style={styles.crewActionGhost}>delete crew</Text>
                      </View>

                      <Text style={styles.crewTitle}>Your Crew</Text>
                      <Text style={styles.crewLeader}>
                        Party Leader: {leader ? `${leader.username}${leader.user_id === currentUserId ? ' (you)' : ''}` : 'Unknown'}
                      </Text>
                      <Text style={styles.sectionHint}>Current Status: {currentStatusLabel}</Text>

                      <View style={styles.groupSlugRow}>
                        <Pressable
                          style={[styles.groupSlugChip, groupSlug === 'overview' && styles.groupSlugChipActive]}
                          onPress={() => setGroupSlug('overview')}
                        >
                          <Text style={[styles.groupSlugText, groupSlug === 'overview' && styles.groupSlugTextActive]}>Crew Overview</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.groupSlugChip, groupSlug === 'requests' && styles.groupSlugChipActive]}
                          onPress={() => setGroupSlug('requests')}
                        >
                          <Text style={[styles.groupSlugText, groupSlug === 'requests' && styles.groupSlugTextActive]}>
                            Members Requested
                          </Text>
                        </Pressable>
                      </View>

                      {groupSlug === 'overview' ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberStrip}>
                          {joinedMembers.map((member) => (
                            <View key={member.user_id} style={styles.memberCircleCard}>
                              <Image source={{ uri: userProfilePictureUrl(member.user_id) }} style={styles.memberAvatar} />
                              <Text style={styles.memberName}>{member.username}</Text>
                              <Text style={styles.memberMeta}>{roleLabel(member.role)}</Text>

                              {asCreator && member.user_id !== currentUserId ? (
                                <PrimaryButton
                                  label="Remove"
                                  variant="outline"
                                  onPress={() => moderateMutation.mutate({ userId: member.user_id, action: 'remove' })}
                                />
                              ) : null}
                            </View>
                          ))}
                        </ScrollView>
                      ) : (
                        <View style={styles.requestList}>
                          {requestedMembers.map((member) => (
                            <View key={member.user_id} style={styles.requestItem}>
                              <View style={styles.requestMeta}>
                                <Text style={styles.requestTitle}>{member.username}</Text>
                                <Text style={styles.requestSub}>status: {member.status}</Text>
                              </View>

                              {asCreator ? (
                                <View style={styles.requestActions}>
                                  <PrimaryButton
                                    label="Accept"
                                    variant="ghost"
                                    onPress={() => moderateMutation.mutate({ userId: member.user_id, action: 'accept' })}
                                  />
                                  <PrimaryButton
                                    label="Decline"
                                    variant="outline"
                                    onPress={() => moderateMutation.mutate({ userId: member.user_id, action: 'decline' })}
                                  />
                                </View>
                              ) : null}
                            </View>
                          ))}

                          {requestedMembers.length === 0 ? (
                            <Text style={styles.sectionHint}>No pending requests right now.</Text>
                          ) : null}
                        </View>
                      )}
                    </GlassCard>
                  ) : null}
                </>
              )}
            </>
          )}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 14,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    letterSpacing: 1,
  },
  contentWrap: {
    gap: 14,
  },
  hero: {
    width: '100%',
    height: 280,
    borderRadius: 22,
  },
  partyName: {
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 40,
    letterSpacing: 0.8,
  },
  partyMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    marginTop: 2,
  },
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
  slugRow: {
    flexDirection: 'row',
    gap: 8,
  },
  slugChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
  slugTextActive: {
    color: colors.textDark,
  },
  sectionCard: {
    gap: 10,
  },
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  inviteItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    gap: 6,
  },
  inviteItemTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  inviteItemMeta: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  inviteItemActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  crewActionsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crewActionGhost: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
    opacity: 0.9,
  },
  crewTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 48,
    lineHeight: 46,
  },
  crewLeader: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  footnote: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.9,
  },
  groupSlugRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  groupSlugChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  groupSlugChipActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  groupSlugText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  groupSlugTextActive: {
    color: colors.textPrimary,
  },
  memberStrip: {
    gap: 10,
    paddingRight: 10,
  },
  memberCircleCard: {
    width: 180,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  memberAvatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: colors.surfaceLight,
  },
  memberName: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  memberMeta: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  requestList: {
    gap: 8,
  },
  requestItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  requestMeta: {
    gap: 2,
  },
  requestTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  requestSub: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
});
