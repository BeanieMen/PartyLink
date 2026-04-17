import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { userProfilePictureUrl } from '../api/user.api';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/session-store';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

export function ProfileMenuButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currentUserId = useSessionStore((state) => state.currentUserId);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

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

  const toggleMenu = () => {
    if (isMenuOpen) {
      closeMenu();
      return;
    }

    openMenu();
  };

  const openTarget = (target: 'Profile' | 'Tickets') => {
    closeMenu(() => {
      if (!currentUserId) {
        navigation.navigate('AuthGate', {
          reason: target === 'Profile' ? 'Sign in to open your profile.' : 'Sign in to open your tickets.',
        });
        return;
      }

      navigation.navigate(target);
    });
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.trigger} onPress={toggleMenu}>
        {currentUserId ? (
          <Image source={{ uri: userProfilePictureUrl(currentUserId) }} style={styles.profileImage} />
        ) : (
          <Ionicons name="person-circle-outline" size={20} color={colors.textPrimary} />
        )}
        <View style={styles.menuBadge}>
          <Ionicons name="menu-outline" size={12} color={colors.textPrimary} />
        </View>
      </Pressable>

      {isMenuOpen ? (
        <Animated.View style={[styles.dropdown, animatedMenuStyle]}>
          <Pressable style={styles.item} onPress={() => openTarget('Profile')}>
            <Ionicons name="person-outline" size={14} color={colors.textPrimary} />
            <Text style={styles.itemText}>Profile</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.item} onPress={() => openTarget('Tickets')}>
            <Ionicons name="ticket-outline" size={14} color={colors.textPrimary} />
            <Text style={styles.itemText}>Tickets</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 60,
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
    overflow: 'hidden',
  },
  menuBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  dropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    minWidth: 136,
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
  item: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
