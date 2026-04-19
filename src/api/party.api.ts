import { apiRequest, apiRequestWithMeta } from './client';
import { endpoint } from './endpoints';
import type { ApiMeta, CursorPage } from './types';

export interface PartyCard {
  party_id: string;
  name: string;
  party_date: string;
  party_time: string;
  location: string;
  image_url: string | null;
  tickets_left: number;
  total_tickets: number;
  price: number;
}

export interface PartyDetail extends PartyCard {
  description: string | null;
}

export interface AttendPartyResult {
  alreadyAttending?: boolean;
  success?: boolean;
  message?: string;
  ticketId?: string;
  status?: string;
  partyId?: string;
}

export interface PartyGroup {
  id: string;
  partyId: string;
  status: string;
  maxMembers: number;
}

export interface MyMembership {
  id: string;
  status: string;
  role: string;
}

export interface MyGroupResponse {
  group: PartyGroup;
  membership: MyMembership;
}

export interface GroupMember {
  user_id: string;
  username: string;
  role: string;
  status: string;
}

export interface GroupModerationResult {
  updated: boolean;
  status: string;
}

export interface GroupInviteCandidate {
  id: string;
  username: string;
  displayName: string | null;
}

export interface PendingGroupInvite {
  inviteId: string;
  groupId: string;
  partyId: string;
  partyTitle: string;
  inviterUserId: string;
  inviterUsername: string;
  inviterDisplayName: string | null;
  invitedAt: string;
}

export interface JoinedGroupSummary {
  groupId: string;
  partyId: string;
  partyTitle: string;
  groupStatus: string;
  maxMembers: number;
  role: string;
  membershipStatus: string;
  createdBy: string;
}

export interface JoinCrewLeader {
  userId: string;
  username: string;
  displayName: string | null;
}

export interface JoinCrewCandidate {
  groupId: string;
  status: string;
  maxMembers: number;
  joinedCount: number;
  leader: JoinCrewLeader;
}

export interface ActiveJoinRequest {
  requestId: string;
  groupId: string;
}

export interface JoinCandidatesResponse {
  activeJoinRequest: ActiveJoinRequest | null;
  crews: JoinCrewCandidate[];
}

export interface GroupOverviewSchool {
  school: string;
  count: number;
}

export interface GroupOverviewKeyword {
  keyword: string;
  count: number;
}

export interface GroupOverviewComment {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  body: string;
  createdAt: string;
}

export interface GroupOverview {
  memberCount: number;
  privateMemberCount: number;
  publicMemberCount: number;
  averageAge: number | null;
  dominantSchools: GroupOverviewSchool[];
  topKeywords: GroupOverviewKeyword[];
  votes: {
    upvotes: number;
    downvotes: number;
    score: number;
  };
  comments: GroupOverviewComment[];
  generatedAt: string;
}

export interface CrewDiscoveryCard {
  groupId: string;
  maxMembers: number;
  joinedCount: number;
  leader: JoinCrewLeader;
  overview: GroupOverview;
  outboundStatus: string | null;
  inboundStatus: string | null;
}

export interface CrewDiscoveryResponse {
  sourceGroupId: string;
  crews: CrewDiscoveryCard[];
}

const DEFAULT_LIMIT = 20;

const pageFromMeta = <T>(items: T[], meta: ApiMeta, requestedLimit: number): CursorPage<T> => ({
  items,
  nextCursor: typeof meta.nextCursor === 'string' ? meta.nextCursor : null,
  hasMore: Boolean(meta.hasMore),
  limit: typeof meta.limit === 'number' ? meta.limit : requestedLimit,
});

export async function fetchParties(params?: { limit?: number; cursor?: string }) {
  const limit = params?.limit ?? DEFAULT_LIMIT;
  const response = await apiRequestWithMeta<PartyCard[]>({
    method: 'GET',
    url: endpoint.parties,
    params: {
      limit,
      cursor: params?.cursor,
    },
  });

  return pageFromMeta(response.data, response.meta, limit);
}

export async function fetchPartyDetail(partyId: string) {
  return apiRequest<PartyDetail>({
    method: 'GET',
    url: endpoint.partyDetail(partyId),
  });
}

export async function attendParty(partyId: string) {
  return apiRequest<AttendPartyResult>({
    method: 'POST',
    url: endpoint.attendParty(partyId),
  });
}

export async function fetchMyGroup(partyId: string) {
  return apiRequest<MyGroupResponse | null>({
    method: 'GET',
    url: endpoint.myGroup(partyId),
  });
}

export async function createPartyGroup(partyId: string, maxMembers = 6) {
  return apiRequest<PartyGroup>({
    method: 'POST',
    url: endpoint.createGroup(partyId),
    data: { maxMembers },
  });
}

export async function fetchMyJoinedGroups() {
  return apiRequest<JoinedGroupSummary[]>({
    method: 'GET',
    url: endpoint.myGroups,
  });
}

export async function fetchPendingGroupInvites(params?: { partyId?: string }) {
  return apiRequest<PendingGroupInvite[]>({
    method: 'GET',
    url: endpoint.pendingGroupInvites,
    params: {
      partyId: params?.partyId,
    },
  });
}

export async function fetchGroupInviteCandidates(partyId: string, groupId: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [] as GroupInviteCandidate[];

  return apiRequest<GroupInviteCandidate[]>({
    method: 'GET',
    url: endpoint.groupInviteCandidates(partyId, groupId),
    params: {
      query: trimmed,
    },
  });
}

export async function sendGroupInvite(groupId: string, targetUserId: string) {
  return apiRequest<{ invited: true; groupId: string; partyId: string; targetUserId: string }>({
    method: 'POST',
    url: endpoint.groupInvites(groupId),
    data: { targetUserId },
  });
}

export async function acceptGroupInvite(inviteId: string) {
  return apiRequest<{ accepted: true; groupId: string; partyId: string }>({
    method: 'POST',
    url: endpoint.acceptGroupInvite(inviteId),
  });
}

export async function declineGroupInvite(inviteId: string) {
  return apiRequest<{ declined: true }>({
    method: 'POST',
    url: endpoint.declineGroupInvite(inviteId),
  });
}

export async function fetchGroupMembers(groupId: string) {
  return apiRequest<GroupMember[]>({
    method: 'GET',
    url: endpoint.groupMembers(groupId),
  });
}

export async function fetchGroupJoinCandidates(partyId: string, query: string) {
  return apiRequest<JoinCandidatesResponse>({
    method: 'GET',
    url: endpoint.groupJoinCandidates(partyId),
    params: {
      query: query.trim(),
    },
  });
}

export async function withdrawGroupJoinRequest(requestId: string) {
  return apiRequest<{ withdrawn: true }>({
    method: 'POST',
    url: endpoint.withdrawGroupJoinRequest(requestId),
  });
}

export async function establishCrew(groupId: string) {
  return apiRequest<{ established: true; groupId: string; partyId: string; snapshotId: string }>({
    method: 'POST',
    url: endpoint.establishGroup(groupId),
  });
}

export async function fetchGroupOverview(groupId: string) {
  return apiRequest<GroupOverview>({
    method: 'GET',
    url: endpoint.groupOverview(groupId),
  });
}

export async function submitGroupOverviewComment(groupId: string, body: string) {
  return apiRequest<{ created: true; commentId: string }>({
    method: 'POST',
    url: endpoint.groupOverviewComments(groupId),
    data: {
      body: body.trim(),
    },
  });
}

export async function submitGroupOverviewVote(groupId: string, vote: 'up' | 'down') {
  return apiRequest<{ updated: true; vote: number }>({
    method: 'POST',
    url: endpoint.groupOverviewVotes(groupId),
    data: {
      vote,
    },
  });
}

export async function fetchCrewDiscovery(partyId: string) {
  return apiRequest<CrewDiscoveryResponse>({
    method: 'GET',
    url: endpoint.groupDiscovery(partyId),
  });
}

export async function swipeCrewMatch(groupId: string, targetGroupId: string, action: 'like' | 'pass') {
  return apiRequest<{
    submitted: true;
    matched: boolean;
    status: string;
    sourceGroupId: string;
    targetGroupId: string;
  }>({
    method: 'POST',
    url: endpoint.groupMatchRequests(groupId),
    data: {
      targetGroupId,
      action,
    },
  });
}

export async function requestGroupJoin(groupId: string) {
  return apiRequest<{ requested: true }>({
    method: 'POST',
    url: endpoint.groupJoinRequests(groupId),
  });
}

export async function moderateGroupMember(groupId: string, userId: string, action: 'accept' | 'decline' | 'remove') {
  return apiRequest<GroupModerationResult>({
    method: 'PATCH',
    url: endpoint.groupMemberAction(groupId, userId),
    data: { action },
  });
}