import { useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { attendParty, fetchPartyDetail } from '../../api/party.api';
import { absoluteUrl, endpoint } from '../../api/endpoints';
import { queryKeys } from '../../api/query-keys';
import { fetchMyAttendingParties } from '../../api/user.api';
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

function createRandomTicketToken(): string {
  const randomA = Math.random().toString(36).slice(2, 10);
  const randomB = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${randomA}-${randomB}`.toUpperCase();
}

export function PartyDetailScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<PartyDetailRoute>();
  const currentUserId = useSessionStore((state) => state.currentUserId);

  const partyId = route.params.partyId;

  const [optimisticAttending, setOptimisticAttending] = useState(false);
  const [ticketQrToken] = useState(createRandomTicketToken);

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

  const ticketQrValue = useMemo(() => {
    const encodedToken = encodeURIComponent(ticketQrToken);
    if (!currentUserId) return `partylink://ticket?token=${encodedToken}`;
    return `partylink://ticket?token=${encodedToken}&userId=${encodeURIComponent(currentUserId)}`;
  }, [currentUserId, ticketQrToken]);

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
              <PrimaryButton
                label="View Group"
                variant="outline"
                onPress={() => navigation.navigate('GroupDetail', { partyId })}
              />
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
});
