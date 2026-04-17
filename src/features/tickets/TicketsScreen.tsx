import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { fetchPartyDetail, type PartyDetail } from '../../api/party.api';
import { queryKeys } from '../../api/query-keys';
import { fetchMyAttendingParties } from '../../api/user.api';
import { AuthPromptCard } from '../../components/AuthPromptCard';
import { GlassCard } from '../../components/GlassCard';
import { ProfileMenuButton } from '../../components/ProfileMenuButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StateView } from '../../components/StateView';
import type { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/session-store';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { formatPartyDate } from '../../utils/format';

interface TicketItem {
  partyId: string;
  party: PartyDetail;
}

function buildTicketQrValue(partyId: string, userId: string): string {
  return `partylink://ticket?partyId=${encodeURIComponent(partyId)}&userId=${encodeURIComponent(userId)}`;
}

export function TicketsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const currentUserId = useSessionStore((state) => state.currentUserId);

  const attendingQuery = useQuery({
    queryKey: queryKeys.userAttending(currentUserId),
    queryFn: () => fetchMyAttendingParties(currentUserId as string),
    enabled: Boolean(currentUserId),
  });

  const partyIds = attendingQuery.data ?? [];

  const partyQueries = useQueries({
    queries: partyIds.map((partyId) => ({
      queryKey: queryKeys.party(partyId),
      queryFn: () => fetchPartyDetail(partyId),
      enabled: Boolean(currentUserId),
    })),
  });

  const ticketItems: TicketItem[] = [];
  for (const [index, partyId] of partyIds.entries()) {
    const party = partyQueries[index]?.data;
    if (party) {
      ticketItems.push({ partyId, party });
    }
  }

  const isDetailsLoading = partyQueries.some((query) => query.isLoading);
  const detailsError = partyQueries.find((query) => query.isError)?.error as Error | undefined;

  const refreshTicketDetails = () => {
    for (const partyId of partyIds) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.party(partyId) });
    }
  };

  if (!currentUserId) {
    return (
      <ScreenContainer>
        <Text style={styles.pageTitle}>Tickets</Text>
        <Text style={styles.pageHint}>Sign in to view your event passes.</Text>
        <AuthPromptCard
          title="Sign in to open your tickets"
          description="Your RSVP passes will appear here after sign in."
          onPressLogin={() => navigation.navigate('AuthGate', { reason: 'Sign in to open your tickets.' })}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Tickets</Text>
        <ProfileMenuButton />
      </View>

      {attendingQuery.isLoading ? <StateView loading /> : null}
      {attendingQuery.isError ? (
        <StateView errorMessage={(attendingQuery.error as Error).message} onRetry={attendingQuery.refetch} />
      ) : null}
      {isDetailsLoading && partyIds.length > 0 ? <StateView loading /> : null}
      {detailsError ? <StateView errorMessage={detailsError.message} onRetry={refreshTicketDetails} /> : null}

      <View style={styles.sectionList}>
        {ticketItems.map((ticket) => (
          <GlassCard key={ticket.partyId} style={styles.ticketSection}>
            <Text style={styles.sectionTitle}>{ticket.party.name}</Text>

            <View style={styles.ticketItem}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketLine}>{formatPartyDate(ticket.party.party_date, ticket.party.party_time)}</Text>
                <Text style={styles.ticketLine}>{ticket.party.location}</Text>
                <Text style={styles.ticketCode}>Ticket code {ticket.partyId.slice(-8).toUpperCase()}</Text>
              </View>

              <View style={styles.qrWrap}>
                <QRCode
                  value={buildTicketQrValue(ticket.partyId, currentUserId)}
                  size={96}
                  color={colors.textDark}
                  backgroundColor={colors.surfaceLight}
                />
              </View>
            </View>
          </GlassCard>
        ))}
      </View>

      {attendingQuery.isSuccess && partyIds.length === 0 ? (
        <StateView emptyMessage="No tickets yet. RSVP to a party and your pass will appear here." />
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
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 46,
    marginTop: 8,
  },
  pageHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: 12,
  },
  sectionList: {
    gap: 12,
  },
  ticketSection: {
    width: '100%',
    minHeight: 170,
    gap: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  ticketItem: {
    width: '100%',
    minHeight: 126,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ticketInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  ticketLine: {
    color: colors.textPrimary,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  ticketCode: {
    color: colors.accentMint,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  qrWrap: {
    width: 112,
    height: 112,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDark,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
   },
});
