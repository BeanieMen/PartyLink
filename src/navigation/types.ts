export type RootStackParamList = {
  Home: undefined;
  Inbox:
    | {
        partyId?: string;
        sourceGroupId?: string;
        focusThreadId?: string;
      }
    | undefined;
  Profile: { userId?: string } | undefined;
  AccountEdit: undefined;
  Tickets: undefined;
  PartyDetail: { partyId: string };
  GroupDetail: { partyId: string };
  GroupMatch: { partyId: string };
  GroupInvites: { partyId: string };
  ThreadDetail: {
    threadId: string;
    partyId?: string;
    mode?: 'crew-link' | 'direct';
    partnerUserId?: string;
    sourceGroupId?: string;
    targetGroupId?: string;
    threadStatus?: string;
  };
  AuthGate: { reason?: string; partyId?: string } | undefined;
};