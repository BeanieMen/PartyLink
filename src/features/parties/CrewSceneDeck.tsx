import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { CrewDiscoveryCard } from '../../api/party.api';
import { userProfilePictureUrl } from '../../api/user.api';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

interface CrewMatchDeckProps {
  crews: CrewDiscoveryCard[];
  disabled?: boolean;
  onSwipe: (groupId: string, action: 'like' | 'pass') => void;
  onPreview?: (crew: CrewDiscoveryCard) => void;
  statusByGroupId?: Record<string, string>;
}

const SWIPE_THRESHOLD = 108;
const PREVIEW_THRESHOLD = -82;
const LEAD_AVATAR_SIZE = 84;
const ORBIT_AVATAR_SIZE = 86;
const MIN_STAGE_SIZE = 248;
const MAX_STAGE_SIZE = 336;

export function CrewMatchDeck({
  crews,
  disabled = false,
  onSwipe,
  onPreview,
  statusByGroupId,
}: CrewMatchDeckProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const previewPulse = useRef(new Animated.Value(0)).current;

  const deckFingerprint = useMemo(() => crews.map((crew) => crew.groupId).join('|'), [crews]);
  const stageSize = useMemo(() => Math.min(MAX_STAGE_SIZE, Math.max(MIN_STAGE_SIZE, width - 86)), [width]);

  useEffect(() => {
    setIndex(0);
    pan.setValue({ x: 0, y: 0 });
  }, [deckFingerprint, pan]);

  const activeCrew = crews[index] ?? null;

  const activeEnergy = useMemo(() => {
    if (!activeCrew) return 'chill';
    if (activeCrew.overview.votes.score >= 8) return 'party-heavy';
    if (activeCrew.overview.dominantSchools.length >= 2) return 'networking';
    return 'chill';
  }, [activeCrew]);

  const filterChips = useMemo(() => {
    if (!activeCrew) return [] as string[];

    const chips: string[] = [];
    const schools = activeCrew.overview.dominantSchools;

    if (schools[0]) {
      chips.push(`${schools[0].school} (${schools[0].count})`);
    }

    const roundedAge = activeCrew.overview.averageAge ? Math.round(activeCrew.overview.averageAge) : null;
    chips.push(`Age ${roundedAge ?? '--'} (${activeCrew.joinedCount})`);

    if (schools[1]) {
      chips.push(`${schools[1].school} (${schools[1].count})`);
    } else {
      chips.push(`Private (${activeCrew.overview.privateMemberCount})`);
    }

    return chips.slice(0, 3);
  }, [activeCrew]);

  const sceneAvatars = useMemo(
    () =>
      crews.slice(index, index + 4).map((crew, slot) => ({
        id: `${crew.groupId}-${slot}`,
        uri: userProfilePictureUrl(crew.leader.userId),
      })),
    [crews, index],
  );

  const orbitPositions = useMemo(
    () => [
      { left: stageSize * 0.04, top: stageSize * 0.46 },
      { left: stageSize - ORBIT_AVATAR_SIZE - stageSize * 0.04, top: stageSize * 0.45 },
      { left: stageSize * 0.5 - ORBIT_AVATAR_SIZE * 0.5, top: stageSize - ORBIT_AVATAR_SIZE - stageSize * 0.05 },
    ],
    [stageSize],
  );

  const resetCard = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      friction: 6,
      tension: 90,
    }).start();
  }, [pan]);

  const finishSwipe = useCallback(
    (action: 'like' | 'pass') => {
      if (!activeCrew || disabled) return;

      const toX = action === 'like' ? width * 1.2 : -width * 1.2;
      Animated.timing(pan, {
        toValue: { x: toX, y: 0 },
        duration: 180,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished) return;

        onSwipe(activeCrew.groupId, action);
        setIndex((prev) => prev + 1);
        pan.setValue({ x: 0, y: 0 });
      });
    },
    [activeCrew, disabled, onSwipe, pan, width],
  );

  const revealPreview = useCallback(() => {
    if (!activeCrew || !onPreview) return;

    onPreview(activeCrew);
    Animated.sequence([
      Animated.timing(previewPulse, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(previewPulse, {
        toValue: 0,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeCrew, onPreview, previewPulse]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !disabled && (Math.abs(gestureState.dx) > 8 || gestureState.dy < -8),
        onPanResponderMove: (_, gestureState) => {
          pan.setValue({ x: gestureState.dx, y: Math.min(0, gestureState.dy * 0.38) });
        },
        onPanResponderRelease: (_, gestureState) => {
          if (disabled) {
            resetCard();
            return;
          }

          if (gestureState.dy < PREVIEW_THRESHOLD && Math.abs(gestureState.dx) < SWIPE_THRESHOLD * 0.72) {
            revealPreview();
            resetCard();
            return;
          }

          if (gestureState.dx > SWIPE_THRESHOLD) {
            finishSwipe('like');
            return;
          }

          if (gestureState.dx < -SWIPE_THRESHOLD) {
            finishSwipe('pass');
            return;
          }

          resetCard();
        },
        onPanResponderTerminate: resetCard,
      }),
    [disabled, finishSwipe, pan, resetCard, revealPreview],
  );

  const rotation = pan.x.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  const passOpacity = pan.x.interpolate({
    inputRange: [-180, -48, 0],
    outputRange: [1, 0.25, 0],
    extrapolate: 'clamp',
  });

  const likeOpacity = pan.x.interpolate({
    inputRange: [0, 48, 180],
    outputRange: [0, 0.25, 1],
    extrapolate: 'clamp',
  });

  const hintLift = Animated.add(
    pan.y.interpolate({
      inputRange: [-90, 0],
      outputRange: [-4, 0],
      extrapolate: 'clamp',
    }),
    previewPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -7],
    }),
  );

  const sceneTitle = activeCrew ? `${activeCrew.leader.displayName ?? activeCrew.leader.username}'s Crew` : '';

  const resolvedStatus =
    (activeCrew ? statusByGroupId?.[activeCrew.groupId] : undefined) ?? activeCrew?.outboundStatus ?? 'fresh crew';

  const sceneTint: readonly [string, string, string] =
    activeEnergy === 'party-heavy'
      ? ['#D7C1FF', '#A14AFF', '#5F18D4']
      : activeEnergy === 'networking'
        ? ['#D5ECFF', '#8E59FF', '#442299']
        : ['#E2D3FF', '#AC67FF', '#6D2DE6'];

  const topRailAvatars = sceneAvatars.slice(0, 2);
  const orbitAvatars = sceneAvatars.slice(1, 4);

  if (!activeCrew) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No more crews in your scene</Text>
        <Text style={styles.emptyBody}>Check back shortly as more established crews appear in this party.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sceneHeadline}>Browse the Scene!</Text>

      <View style={styles.controlRow}>
        <Pressable
          style={[styles.reactionRail, disabled && styles.actionButtonDisabled]}
          onPress={() => finishSwipe('pass')}
          disabled={disabled}
        >
          <Ionicons name="thumbs-down" size={22} color="#F6F3FF" />
          <View style={styles.railAvatarStack}>
            {topRailAvatars.map((avatar, avatarIndex) => (
              <Image
                key={avatar.id}
                source={{ uri: avatar.uri }}
                style={[styles.railAvatar, avatarIndex > 0 && styles.railAvatarOverlap]}
              />
            ))}
          </View>
        </Pressable>

        <Text style={styles.filterLabel}>Filters</Text>
      </View>

      <View style={styles.filterRow}>
        {filterChips.map((chip) => (
          <View key={chip} style={styles.filterChip}>
            <Text style={styles.filterChipText}>{chip}</Text>
          </View>
        ))}
      </View>

      <Animated.View
        style={[
          styles.sceneWrap,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate: rotation }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <LinearGradient
          colors={sceneTint}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.86, y: 1 }}
          style={[styles.sceneOrb, { width: stageSize, height: stageSize, borderRadius: stageSize / 2 }]}
        >
          <View style={styles.sceneGloss} />

          <View
            style={[
              styles.leadAvatarWrap,
              {
                left: stageSize * 0.5 - LEAD_AVATAR_SIZE * 0.5,
                top: stageSize * 0.08,
              },
            ]}
          >
            <Image source={{ uri: sceneAvatars[0]?.uri }} style={styles.leadAvatar} />
          </View>

          {orbitPositions.map((position, positionIndex) => {
            const avatar = orbitAvatars[positionIndex];
            if (!avatar) return null;

            return (
              <View key={avatar.id} style={[styles.orbitAvatarWrap, position]}>
                <Image source={{ uri: avatar.uri }} style={styles.orbitAvatar} />
              </View>
            );
          })}

          <Animated.View style={[styles.swipeBadge, styles.passBadge, { opacity: passOpacity }]}>
            <Text style={styles.swipeBadgeText}>PASS</Text>
          </Animated.View>
          <Animated.View style={[styles.swipeBadge, styles.likeBadge, { opacity: likeOpacity }]}>
            <Text style={styles.swipeBadgeText}>CONNECT</Text>
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      <Text style={styles.sceneCrewTitle}>{sceneTitle}</Text>
      <Text style={styles.sceneStatus}>{resolvedStatus}</Text>

      <Text style={styles.swipeHint}>*swipe up to view crew info</Text>

      <Animated.View style={[styles.hintGlyphWrap, { transform: [{ translateY: hintLift }] }]}>
        <View style={styles.hintLine} />
        <View style={[styles.hintLine, styles.hintLineShort]} />
        <Ionicons name="chevron-up" size={26} color="#F2EDFF" />
      </Animated.View>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, styles.passButton, disabled && styles.actionButtonDisabled]}
          onPress={() => finishSwipe('pass')}
          disabled={disabled}
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.likeButton, disabled && styles.actionButtonDisabled]}
          onPress={() => finishSwipe('like')}
          disabled={disabled}
        >
          <Ionicons name="heart" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 600,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
  },
  sceneHeadline: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 48,
    lineHeight: 46,
    textAlign: 'center',
  },
  controlRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reactionRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    backgroundColor: 'rgba(162, 79, 255, 0.66)',
  },
  railAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  railAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
    backgroundColor: 'rgba(11,9,23,0.4)',
  },
  railAvatarOverlap: {
    marginLeft: -10,
  },
  filterLabel: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 38,
    lineHeight: 36,
  },
  filterRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(160, 76, 255, 0.86)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  filterChipText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 18,
  },
  sceneWrap: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneOrb: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
  },
  sceneGloss: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.1)',
    opacity: 0.55,
  },
  leadAvatarWrap: {
    position: 'absolute',
    width: LEAD_AVATAR_SIZE,
    height: LEAD_AVATAR_SIZE,
    borderRadius: LEAD_AVATAR_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(20,16,34,0.5)',
    zIndex: 3,
  },
  leadAvatar: {
    width: '100%',
    height: '100%',
  },
  orbitAvatarWrap: {
    position: 'absolute',
    width: ORBIT_AVATAR_SIZE,
    height: ORBIT_AVATAR_SIZE,
    borderRadius: ORBIT_AVATAR_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.78)',
    backgroundColor: 'rgba(20,16,34,0.5)',
  },
  orbitAvatar: {
    width: '100%',
    height: '100%',
  },
  swipeBadge: {
    position: 'absolute',
    top: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  passBadge: {
    left: 14,
  },
  likeBadge: {
    right: 14,
  },
  swipeBadgeText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  sceneCrewTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 30,
    textAlign: 'center',
    marginTop: 4,
  },
  sceneStatus: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  swipeHint: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 4,
  },
  hintGlyphWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  hintLine: {
    width: 122,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  hintLineShort: {
    width: 94,
    opacity: 0.8,
  },
  actionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passButton: {
    backgroundColor: 'rgba(255,98,116,0.22)',
  },
  likeButton: {
    backgroundColor: 'rgba(53,214,177,0.24)',
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  emptyCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  emptyBody: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
});
