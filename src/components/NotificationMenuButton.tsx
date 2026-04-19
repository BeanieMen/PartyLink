import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Animated, Easing, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { acceptGroupInvite, declineGroupInvite, fetchMyJoinedGroups, fetchPendingGroupInvites } from '../api/party.api';
import { queryKeys } from '../api/query-keys';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/session-store';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { compactText } from '../utils/format';

function inviteLink(groupId: string) {
  return `partylink://groups/join?groupId=${encodeURIComponent(groupId)}`;
}

export function NotificationMenuButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const currentUserId = useSessionStore((state) => state.currentUserId);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

  const pendingInvitesQuery = useQuery({
    queryKey: queryKeys.pendingGroupInvites(currentUserId),
    queryFn: () => fetchPendingGroupInvites(),
    enabled: Boolean(currentUserId),
  });

  const myGroupsQuery = useQuery({
    queryKey: queryKeys.myGroups(currentUserId),
    queryFn: () => fetchMyJoinedGroups(),
    enabled: Boolean(currentUserId),
  });

  const acceptInviteMutation = useMutation({
    mutationFn: (inviteId: string) => acceptGroupInvite(inviteId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pendingGroupInvites(currentUserId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myGroups(currentUserId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myGroup(result.partyId, currentUserId) });
    },
  });

  const declineInviteMutation = useMutation({
    mutationFn: (inviteId: string) => declineGroupInvite(inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pendingGroupInvites(currentUserId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myGroups(currentUserId) });
    },
  });

  const animatedMenuStyle = {
    opacity: menuAnim,
    transform: [
      {
        translateY: menuAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, 0],
        }),
      },
      {
        scale: menuAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1],
        }),
      },
    ],
  };

  const openMenu = () => {
    setIsMenuOpen(true);
    menuAnim.setValue(0);
    Animated.timing(menuAnim, {
      toValue: 1,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = (onClosed?: () => void) => {
    if (!isMenuOpen) {
      onClosed?.();
      return;
    }

    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsMenuOpen(false);
      }
      onClosed?.();
    });
  };

  const pendingInvites = pendingInvitesQuery.data ?? [];
  const ownedGroups = (myGroupsQuery.data ?? []).filter((group) => group.role === 'owner');

  const openGroupForParty = (partyId: string) => {
    closeMenu(() => {
      if (!currentUserId) {
        navigation.navigate('AuthGate', { reason: 'Sign in to open group notifications.' });
        return;
      }

      navigation.navigate('GroupDetail', { partyId });
    });
  };

  const onPressBell = () => {
    if (!currentUserId) {
      navigation.navigate('AuthGate', { reason: 'Sign in to open notifications.' });
      return;
    }

    if (isMenuOpen) {
      closeMenu();
      return;
    }

    openMenu();
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.trigger} onPress={onPressBell}>
        <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
        {pendingInvites.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{Math.min(pendingInvites.length, 9)}</Text>
          </View>
        ) : null}
      </Pressable>

      {isMenuOpen ? (
        <Animated.View style={[styles.dropdown, animatedMenuStyle]}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Group Invites</Text>

            {pendingInvitesQuery.isLoading ? <Text style={styles.helperText}>Loading invites...</Text> : null}
            {pendingInvitesQuery.isError ? <Text style={styles.helperText}>Could not load invites.</Text> : null}

            {pendingInvites.map((invite) => (
              <View key={invite.inviteId} style={styles.inviteCard}>
                <Text style={styles.inviteParty}>{invite.partyTitle}</Text>
                <Text style={styles.inviteBy}>From {compactText(invite.inviterDisplayName, invite.inviterUsername)}</Text>
                <View style={styles.inviteActions}>
                  <Pressable
                    style={[styles.actionChip, styles.actionChipAccept]}
                    onPress={() => acceptInviteMutation.mutate(invite.inviteId)}
                    disabled={acceptInviteMutation.isPending || declineInviteMutation.isPending}
                  >
                    <Text style={styles.actionChipText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionChip, styles.actionChipDecline]}
                    onPress={() => declineInviteMutation.mutate(invite.inviteId)}
                    disabled={acceptInviteMutation.isPending || declineInviteMutation.isPending}
                  >
                    <Text style={styles.actionChipText}>Decline</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionChip, styles.actionChipView]}
                    onPress={() => openGroupForParty(invite.partyId)}
                  >
                    <Text style={styles.actionChipText}>View Group</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {pendingInvitesQuery.isSuccess && pendingInvites.length === 0 ? (
              <Text style={styles.helperText}>No pending invites.</Text>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Invite By Link</Text>
            {ownedGroups.slice(0, 2).map((group) => (
              <View key={group.groupId} style={styles.linkCard}>
                <Text style={styles.linkTitle}>{group.partyTitle}</Text>
                <Text style={styles.linkCopy} numberOfLines={1}>
                  {inviteLink(group.groupId)}
                </Text>
                <Pressable
                  style={styles.linkButton}
                  onPress={() => {
                    void Share.share({ message: `Join my group: ${inviteLink(group.groupId)}` });
                  }}
                >
                  <Text style={styles.linkButtonText}>Share</Text>
                </Pressable>
              </View>
            ))}

            {ownedGroups.length === 0 ? (
              <Text style={styles.helperText}>Create a group first to share invite links.</Text>
            ) : null}

            {pendingInvites.length === 0 && ownedGroups[0] ? (
              <Pressable style={styles.openHubButton} onPress={() => openGroupForParty(ownedGroups[0]!.partyId)}>
                <Ionicons name="people-outline" size={14} color={colors.textPrimary} />
                <Text style={styles.openHubText}>View Group</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 70,
  },
  trigger: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentRose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 11,
  },
  dropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    width: 320,
    maxHeight: 390,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 6,
  },
  scroll: {
    maxHeight: 390,
  },
  scrollContent: {
    padding: 10,
    gap: 8,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  helperText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  inviteCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inviteParty: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  inviteBy: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionChipAccept: {
    backgroundColor: 'rgba(53,214,177,0.18)',
  },
  actionChipDecline: {
    backgroundColor: 'rgba(255,98,116,0.15)',
  },
  actionChipView: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  actionChipText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  divider: {
    marginTop: 4,
    marginBottom: 2,
    height: 1,
    backgroundColor: colors.border,
  },
  linkCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  linkTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  linkCopy: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  linkButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  linkButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  openHubButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  openHubText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
});
