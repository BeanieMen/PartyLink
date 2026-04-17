import { getApiBaseUrl } from './runtime-base-url';

const safe = (value: string) => encodeURIComponent(value);

export const endpoint = {
  health: '/health/live',

  parties: '/v1/parties',
  partyDetail: (partyId: string) => `/v1/parties/${safe(partyId)}`,
  partyBanner: (partyId: string) => `/v1/parties/${safe(partyId)}/banner`,
  attendParty: (partyId: string) => `/v1/parties/${safe(partyId)}/attend`,
  myGroup: (partyId: string) => `/v1/parties/${safe(partyId)}/my-group`,
  createGroup: (partyId: string) => `/v1/parties/${safe(partyId)}/groups`,
  myGroups: '/v1/parties/my-groups',
  groupMembers: (groupId: string) => `/v1/parties/${safe(groupId)}/members`,
  groupJoinRequests: (groupId: string) => `/v1/parties/${safe(groupId)}/join-requests`,
  groupMemberAction: (groupId: string, userId: string) => `/v1/parties/${safe(groupId)}/members/${safe(userId)}`,
  groupInviteCandidates: (partyId: string, groupId: string) =>
    `/v1/parties/${safe(partyId)}/groups/${safe(groupId)}/invite-candidates`,
  groupInvites: (groupId: string) => `/v1/parties/${safe(groupId)}/invites`,
  pendingGroupInvites: '/v1/parties/group-invites/pending',
  acceptGroupInvite: (inviteId: string) => `/v1/parties/group-invites/${safe(inviteId)}/accept`,
  declineGroupInvite: (inviteId: string) => `/v1/parties/group-invites/${safe(inviteId)}/decline`,

  me: '/v1/users/me',
  meProfile: '/v1/users/me/profile',
  meProfilePicture: '/v1/users/me/profile-picture',
  mePortrait: '/v1/users/me/portrait',
  publicUser: (userId: string) => `/v1/users/${safe(userId)}`,
  userProfilePicture: (userId: string) => `/v1/users/${safe(userId)}/profile-picture`,
  userPortrait: (userId: string) => `/v1/users/${safe(userId)}/portrait`,
  userAttending: (userId: string) => `/v1/users/${safe(userId)}/parties-attending`,

  dmThreads: '/v1/dm-threads',
  dmThread: (threadId: string) => `/v1/dm-threads/${safe(threadId)}`,
  dmMessages: (threadId: string) => `/v1/dm-threads/${safe(threadId)}/messages`,
};

export const absoluteUrl = (path: string) => `${getApiBaseUrl()}${path}`;