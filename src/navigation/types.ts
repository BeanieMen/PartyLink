export type RootStackParamList = {
  Home: undefined;
  Inbox: undefined;
  Profile: { userId?: string } | undefined;
  AccountEdit: undefined;
  Tickets: undefined;
  PartyDetail: { partyId: string; slug?: 'party' | 'group' };
  ThreadDetail: { threadId: string };
  AuthGate: { reason?: string; partyId?: string } | undefined;
};