import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { absoluteUrl, endpoint } from '../api/endpoints';
import type { PartyCard } from '../api/party.api';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { formatCurrency, formatPartyDate } from '../utils/format';

interface PartyPosterCardProps {
  party: PartyCard;
  onPress: () => void;
  compact?: boolean;
}

export function PartyPosterCard({ party, onPress, compact = false }: PartyPosterCardProps) {
  return (
    <Pressable style={[styles.card, compact && styles.cardCompact]} onPress={onPress}>
      <ImageBackground
        source={{ uri: absoluteUrl(endpoint.partyBanner(party.party_id)) }}
        style={styles.image}
        imageStyle={[styles.imageStyle, compact && styles.imageStyleCompact]}
      >
        <View style={styles.overlay}>
          <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
            {party.name}
          </Text>
          <Text style={styles.subtitle}>{formatPartyDate(party.party_date, party.party_time)}</Text>
          <View style={styles.footerRow}>
            <Text style={styles.footer}>{party.location}</Text>
            <Text style={styles.footer}>{formatCurrency(party.price)}</Text>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 300,
    height: 400,
    borderRadius: 26,
    overflow: 'hidden',
    marginRight: 14,
    backgroundColor: '#2A243B',
  },
  cardCompact: {
    width: '100%',
    height: 190,
    marginRight: 0,
  },
  image: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  imageStyle: {
    borderRadius: 26,
  },
  imageStyleCompact: {
    borderRadius: 18,
  },
  overlay: {
    backgroundColor: 'rgba(8, 8, 18, 0.58)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  title: {
    color: '#FBF7F2',
    fontFamily: fonts.bold,
    fontSize: 23,
    letterSpacing: 0.3,
  },
  titleCompact: {
    fontSize: 18,
  },
  subtitle: {
    color: '#ECE4DA',
    fontFamily: fonts.body,
    fontSize: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  footer: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
    flexShrink: 1,
  },
});