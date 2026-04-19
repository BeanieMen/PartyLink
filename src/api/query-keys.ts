export const queryKeys = {
  health: ['health'] as const,
  parties: (pageSize: number) => ['parties', pageSize] as const,
  party: (partyId: string) => ['party', partyId] as const,
  myGroup: (partyId: string, userId: string | null) => ['my-group', partyId, userId] as const,
  myGroups: (userId: string | null) => ['my-groups', userId] as const,
  pendingGroupInvites: (userId: string | null, partyId?: string) => ['pending-group-invites', userId, partyId ?? 'all'] as const,
  groupMembers: (groupId: string) => ['group-members', groupId] as const,
  groupOverview: (groupId: string) => ['group-overview', groupId] as const,
  groupJoinCandidates: (partyId: string, userId: string | null, query: string) =>
    ['group-join-candidates', partyId, userId, query] as const,
  groupDiscovery: (partyId: string, groupId: string, userId: string | null) => ['group-discovery', partyId, groupId, userId] as const,
  groupInviteCandidates: (partyId: string, groupId: string, query: string) =>
    ['group-invite-candidates', partyId, groupId, query] as const,
  me: (userId: string | null) => ['me', userId] as const,
  userAttending: (userId: string | null) => ['user-attending', userId] as const,
  publicUser: (userId: string) => ['public-user', userId] as const,
  dmThreads: (userId: string | null) => ['dm-threads', userId] as const,
  dmMessages: (threadId: string, userId: string | null) => ['dm-messages', threadId, userId] as const,
};