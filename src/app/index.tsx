import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser, useAuth, useSSO } from '@clerk/clerk-expo';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { FadeIn, FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import {
  ArrowLeft,
  CalendarDays,
  CircleUserRound,
  Home as HomeIcon,
  MapPin,
  Search,
  Ticket,
  UserRound,
} from 'lucide-react-native';

import { api, errorMessage } from '@/lib/api';
import { formatPartyDate, displayName } from '@/lib/format';
import type { PartySummary, PartyDetail, MeProfile } from '@/types/domain';

type AppView = 'discover' | 'event' | 'tickets' | 'profile' | 'profile-setup';
type Notice = { tone: 'success' | 'error' | 'info'; message: string };
type ProfileForm = { username: string; displayName: string; bio: string; school: string };

const { width } = Dimensions.get('window');
const maxMobileWidth = 480;
const containerWidth = width > maxMobileWidth ? maxMobileWidth : width;
const colors = {
  ink: '#3b2f38',
  muted: '#7f6f78',
  cream: '#fff8f0',
  card: '#fffdf8',
  blush: '#ffd9dc',
  peach: '#ffb8a3',
  lavender: '#b9a7ff',
  mint: '#9ddfc8',
  honey: '#ffe69b',
  border: '#f0ded8',
  rose: '#d95d77',
};
const fonts = {
  body: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'Montserrat, Avenir Next, system-ui' }),
  heavy: Platform.select({ ios: 'AvenirNext-Heavy', android: 'sans-serif-condensed', default: 'Montserrat, Avenir Next, system-ui' }),
};

export default function EntryScreen() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <View style={[styles.outerContainer, styles.loadingScreen]}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      {isSignedIn ? <TicketingApp /> : <AuthScreen />}
    </View>
  );
}

// ----------------------------------------------------
// AUTHENTICATION SCREEN (Copied to a Tee)
// ----------------------------------------------------
function AuthScreen() {
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = useState<string | null>(null);

  const handleOAuth = async (strategy: 'oauth_google' | 'oauth_discord') => {
    setLoading(strategy);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy,
        redirectUrl: Linking.createURL('/', { scheme: 'partylinkexpo' }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err: any) {
      Alert.alert('Authentication Error', err.message || 'SSO sign-in failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <LinearGradient
      colors={['#ffd9dc', '#ffe69b', '#b9a7ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.authContainer}
    >
      <Animated.View entering={FadeInDown.duration(650).springify()} style={styles.authCard}>
        <View style={styles.logoWrapper}>
          <Text style={styles.brandTitle}>PARTYLINK</Text>
          <Text style={styles.brandSubtitle}>Find the night that finds you back.</Text>
        </View>

        <View style={styles.authButtonsContainer}>
          <TouchableOpacity
            style={styles.authButtonPrimary}
            activeOpacity={0.9}
            disabled={!!loading}
            onPress={() => handleOAuth('oauth_google')}
          >
            {loading === 'oauth_google' ? (
              <ActivityIndicator color="#2e1065" size="small" />
            ) : (
              <View style={styles.authButtonInner}>
                <BrandIcon brand="google" />
                <Text style={styles.authButtonTextPrimary}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.authButtonSecondary}
            activeOpacity={0.9}
            disabled={!!loading}
            onPress={() => handleOAuth('oauth_discord')}
          >
            {loading === 'oauth_discord' ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <View style={styles.authButtonInner}>
                <BrandIcon brand="discord" />
                <Text style={styles.authButtonTextSecondary}>Continue with Discord</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

function BrandIcon({ brand }: { brand: 'google' | 'discord' }) {
  if (brand === 'discord') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
          d="M8.7 7.4c2.1-.6 4.4-.6 6.6 0l.4.1 1.1-1.4c2 .6 3.6 1.5 4.7 2.6-.8 5.8-2.4 8.3-4.6 9.1-1.1-.6-2-1.3-2.7-2.2.4-.1.8-.3 1.1-.5-.2-.1-.4-.2-.6-.4-1.8.8-3.7.8-5.4 0-.2.2-.4.3-.6.4.4.2.7.4 1.1.5-.7.9-1.6 1.6-2.7 2.2-2.2-.8-3.8-3.3-4.6-9.1 1.1-1.1 2.7-2 4.7-2.6l1.1 1.4.4-.1Z"
          fill="#5865F2"
        />
        <Circle cx={9.4} cy={12.2} r={1.1} fill="#fff" />
        <Circle cx={14.6} cy={12.2} r={1.1} fill="#fff" />
      </Svg>
    );
  }

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1c1.8-1.7 3-4.2 3-7Z" fill="#4285F4" />
      <Path d="M12 22c2.6 0 4.8-.9 6.4-2.4l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.7-1.7-5.4-4H3.4v2.5C5 19.8 8.2 22 12 22Z" fill="#34A853" />
      <Path d="M6.6 14.1c-.2-.6-.3-1.3-.3-2.1s.1-1.4.3-2.1V7.4H3.4A10 10 0 0 0 2.4 12c0 1.6.4 3.2 1.1 4.6l3.1-2.5Z" fill="#FBBC05" />
      <Path d="M12 5.9c1.4 0 2.7.5 3.7 1.5l2.8-2.8C16.8 3 14.6 2 12 2 8.2 2 5 4.2 3.4 7.4l3.2 2.5c.7-2.3 2.9-4 5.4-4Z" fill="#EA4335" />
    </Svg>
  );
}

// ----------------------------------------------------
// MAIN TICKETING APPLICATION
// ----------------------------------------------------
function TicketingApp() {
  const { user } = useUser();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const { signOut } = useAuth();

  const [history, setHistory] = useState<AppView[]>(['discover']);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState('');
  const [profileForm, setProfileForm] = useState<ProfileForm>({ username: '', displayName: '', bio: '', school: '' });
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);

  const view = history[history.length - 1] ?? 'discover';

  // API Queries
  const partiesQuery = useQuery({ queryKey: ['parties'], queryFn: api.listParties });
  const meQuery = useQuery({
    queryKey: ['me', userId],
    queryFn: () => api.getMe(userId),
    enabled: !!userId,
  });
  const ticketsQuery = useQuery({
    queryKey: ['tickets', userId],
    queryFn: () => api.getAttending(userId),
    enabled: !!userId,
  });
  const partyQuery = useQuery({
    queryKey: ['party', selectedPartyId, userId],
    queryFn: () => api.getParty(userId, selectedPartyId!),
    enabled: !!selectedPartyId && !!userId,
  });

  const ticketedPartyIds = useMemo(
    () => new Set((ticketsQuery.data ?? []).map((ticket) => ticket.party_id)),
    [ticketsQuery.data],
  );

  const filteredParties = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const parties = partiesQuery.data ?? [];
    if (!normalized) return parties;

    return parties.filter((party) =>
      [party.name, party.location, party.location_meta?.address]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized)),
    );
  }, [partiesQuery.data, search]);

  useEffect(() => {
    if (!meQuery.data || !user) return;
    setProfileForm({
      username: meQuery.data.username ?? '',
      displayName: meQuery.data.display_name ?? user.fullName ?? user.username ?? '',
      bio: meQuery.data.bio ?? '',
      school: meQuery.data.school ?? '',
    });
  }, [meQuery.data, user]);

  useEffect(() => {
    if (meQuery.isLoading || !meQuery.data) return;
    const isProfileIncomplete =
      !meQuery.data.username?.trim() ||
      !meQuery.data.display_name?.trim() ||
      !meQuery.data.has_profile_picture;
    if (isProfileIncomplete && view !== 'profile-setup') {
      setHistory(['profile-setup']);
    }
  }, [meQuery.data, meQuery.isLoading, view]);

  const showNotice = (next: Notice) => {
    setNotice(next);
    setTimeout(() => setNotice(null), 3200);
  };

  const navigate = (next: AppView, options?: { replace?: boolean }) => {
    setHistory((previous) => {
      const current = previous[previous.length - 1];
      if (options?.replace) return current === next ? previous : [...previous.slice(0, -1), next];
      return current === next ? previous : [...previous, next];
    });
  };

  const goBack = () => {
    setHistory((previous) => (previous.length > 1 ? previous.slice(0, -1) : previous));
  };

  const openParty = (partyId: string) => {
    setSelectedPartyId(partyId);
    navigate('event');
  };

  // Mutations
  const attendMutation = useMutation({
    mutationFn: () => api.attendParty(userId, selectedPartyId!),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['parties'] }),
        queryClient.invalidateQueries({ queryKey: ['party', selectedPartyId, userId] }),
        queryClient.invalidateQueries({ queryKey: ['tickets', userId] }),
      ]);
      showNotice({ tone: 'success', message: result.alreadyAttending ? 'You are already on the list.' : 'You are on the list.' });
      navigate('tickets', { replace: true });
    },
    onError: (error) => showNotice({ tone: 'error', message: errorMessage(error) }),
  });

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      api.updateMe(userId, {
        username: profileForm.username.trim(),
        displayName: profileForm.displayName.trim(),
        bio: profileForm.bio.trim(),
        school: profileForm.school.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', userId] });
      showNotice({ tone: 'success', message: 'Profile saved.' });
    },
    onError: (error) => showNotice({ tone: 'error', message: errorMessage(error) }),
  });

  const uploadProfilePictureMutation = useMutation({
    mutationFn: (fileUri: string) => api.uploadProfilePicture(userId, fileUri),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', userId] });
      showNotice({ tone: 'success', message: 'Profile photo updated.' });
    },
    onError: (error) => showNotice({ tone: 'error', message: errorMessage(error) }),
  });

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Camera roll access is required to upload a profile picture.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
      uploadProfilePictureMutation.mutate(pickerResult.assets[0].uri);
    }
  };

  const setupProfileMutation = useMutation({
    mutationFn: async (form: ProfileForm) => {
      await api.updateMe(userId, {
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        school: form.school.trim(),
      });
      if (selectedPhotoUri) {
        await api.uploadProfilePicture(userId, selectedPhotoUri);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', userId] });
      setSelectedPhotoUri(null);
      showNotice({ tone: 'success', message: 'Profile completed!' });
      setHistory(['discover']);
    },
    onError: (error) => showNotice({ tone: 'error', message: errorMessage(error) }),
  });

  const handlePickImageForSetup = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Camera roll access is required to upload a profile picture.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
      setSelectedPhotoUri(pickerResult.assets[0].uri);
    }
  };

  const isBusy =
    updateProfileMutation.isPending ||
    uploadProfilePictureMutation.isPending ||
    setupProfileMutation.isPending;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.appContainer}>
      {notice && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.noticeBanner,
            notice.tone === 'error' && styles.noticeError,
            notice.tone === 'success' && styles.noticeSuccess,
          ]}
          onPress={() => setNotice(null)}
        >
          <Text style={styles.noticeText}>{notice.message}</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.mainScroll} keyboardShouldPersistTaps="handled">
        {view === 'discover' && (
          <DiscoverScreen
            me={meQuery.data}
            parties={filteredParties}
            loading={partiesQuery.isLoading}
            error={partiesQuery.error}
            search={search}
            ticketedPartyIds={ticketedPartyIds}
            onSearch={setSearch}
            onOpenParty={openParty}
            onOpenProfile={() => navigate('profile')}
          />
        )}

        {view === 'event' && (
          <EventScreen
            party={partyQuery.data ?? null}
            loading={partyQuery.isLoading}
            error={partyQuery.error}
            hasTicket={selectedPartyId ? ticketedPartyIds.has(selectedPartyId) : false}
            busy={attendMutation.isPending}
            onBack={goBack}
            onAttend={() => attendMutation.mutate()}
            onTickets={() => navigate('tickets')}
          />
        )}

        {view === 'tickets' && (
          <TicketsScreen
            tickets={ticketsQuery.data ?? []}
            loading={ticketsQuery.isLoading}
            onOpenParty={openParty}
          />
        )}

        {view === 'profile' && (
          <ProfileScreen
            me={meQuery.data}
            form={profileForm}
            ticketCount={ticketsQuery.data?.length ?? 0}
            busy={isBusy}
            onBack={goBack}
            onForm={setProfileForm}
            onProfilePicture={handlePickImage}
            onSave={() => updateProfileMutation.mutate()}
            onSignOut={() => signOut()}
          />
        )}

        {view === 'profile-setup' && (
          <ProfileSetupScreen
            me={meQuery.data}
            busy={setupProfileMutation.isPending}
            onComplete={(form) => setupProfileMutation.mutate(form)}
            onProfilePicture={handlePickImageForSetup}
            photoUri={selectedPhotoUri}
          />
        )}
      </ScrollView>

      {view !== 'profile-setup' && (
        <BottomNav active={view} onNavigate={(next) => navigate(next, { replace: true })} />
      )}
    </SafeAreaView>
  );
}

// ----------------------------------------------------
// DISCOVER VIEW
// ----------------------------------------------------
function DiscoverScreen({
  me,
  parties,
  loading,
  error,
  search,
  ticketedPartyIds,
  onSearch,
  onOpenParty,
  onOpenProfile,
}: {
  me: MeProfile | undefined;
  parties: PartySummary[];
  loading: boolean;
  error: unknown;
  search: string;
  ticketedPartyIds: Set<string>;
  onSearch: (value: string) => void;
  onOpenParty: (partyId: string) => void;
  onOpenProfile: () => void;
}) {
  return (
    <View style={styles.screenInner}>
      <Animated.View entering={FadeInDown.duration(450)} style={styles.discoverHeader}>
        <View>
          <Text style={styles.headerBrandTag}>PARTYLINK</Text>
          <Text style={styles.headerTitle}>Little nights out</Text>
        </View>
        <TouchableOpacity style={styles.headerProfileButton} onPress={onOpenProfile}>
          {me?.has_profile_picture ? (
            <Image source={{ uri: api.profilePicture(me.id) }} style={styles.headerProfileImage} />
          ) : (
            <CircleUserRound size={22} color="#ffffff" />
          )}
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(450)} style={styles.searchBarWrapper}>
        <Search size={19} color={colors.muted} style={styles.searchBarIcon} />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Find a vibe, venue, or friend-night"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={onSearch}
        />
      </Animated.View>

      <LoadState
        loading={loading}
        error={error}
        empty={!parties.length}
        emptyLabel="No cozy matches yet."
      />

      <View style={styles.cardsGrid}>
        {parties.map((party, index) => {
          const hasTicket = ticketedPartyIds.has(party.party_id);
          return (
            <Animated.View
              key={party.party_id}
              entering={FadeInUp.delay(Math.min(index * 60, 420)).duration(420)}
              layout={Layout.springify()}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.eventCard}
                onPress={() => onOpenParty(party.party_id)}
              >
                <View style={styles.eventCardImageWrapper}>
                  <Image
                    source={{ uri: api.partyBanner(party.party_id) }}
                    style={styles.eventCardImage}
                  />
                </View>
                <View style={styles.eventCardDetails}>
                  <View style={styles.cardInfoSplit}>
                    <View style={styles.cardInfoLeft}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {party.name}
                      </Text>
                      <View style={styles.cardMetaRow}>
                        <CalendarDays size={15} color={colors.muted} />
                        <Text style={styles.cardMetaText}>
                          {formatPartyDate(party.party_date, party.party_time)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.cardInfoSplit}>
                    <View style={styles.cardLocationRow}>
                      <MapPin size={15} color={colors.muted} />
                      <Text style={styles.cardLocationText} numberOfLines={1}>
                        {party.location}
                      </Text>
                    </View>
                    <Text style={hasTicket ? styles.statusSavedText : styles.statusLeftText}>
                      {hasTicket ? 'Saved for you' : 'Open invite'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

// ----------------------------------------------------
// EVENT VIEW
// ----------------------------------------------------
function EventScreen({
  party,
  loading,
  error,
  hasTicket,
  busy,
  onBack,
  onAttend,
  onTickets,
}: {
  party: PartyDetail | null;
  loading: boolean;
  error: unknown;
  hasTicket: boolean;
  busy: boolean;
  onBack: () => void;
  onAttend: () => void;
  onTickets: () => void;
}) {
  return (
    <View style={styles.screenInner}>
      <ScreenHeader title="Event" onBack={onBack} />
      <LoadState loading={loading} error={error} empty={!party} emptyLabel="Event not found." />

      {party && (
        <Animated.View entering={FadeInUp.duration(500)} style={styles.eventDetailCard}>
          <View style={styles.eventDetailImageWrapper}>
            <Image
              source={{ uri: api.partyBanner(party.party_id) }}
              style={styles.eventDetailImage}
            />
          </View>

          <View style={styles.eventDetailInfo}>
            <Text style={styles.liveEventTag}>Tonight feels like</Text>
            <Text style={styles.detailName}>{party.name}</Text>

            <View style={styles.detailMetaRow}>
              <CalendarDays size={18} color={colors.rose} />
              <Text style={styles.detailMetaText}>
                {formatPartyDate(party.party_date, party.party_time)}
              </Text>
            </View>

            <View style={styles.detailMetaRow}>
              <MapPin size={18} color={colors.rose} />
              <Text style={styles.detailMetaText}>
                {party.location_meta?.address ?? party.location}
              </Text>
            </View>

            {party.description && (
              <Text style={styles.detailDescription}>{party.description}</Text>
            )}
          </View>
        </Animated.View>
      )}

      {party && (
        <Animated.View entering={FadeInUp.delay(120).duration(450)}>
        <TouchableOpacity
          style={styles.blackButton}
          activeOpacity={0.9}
          disabled={busy}
          onPress={hasTicket ? onTickets : onAttend}
        >
          {busy ? (
            <ActivityIndicator color={colors.ink} size="small" />
          ) : (
            <View style={styles.buttonIconLabel}>
              <Ticket size={19} color={colors.ink} />
              <Text style={styles.blackButtonText}>{hasTicket ? 'View pass' : 'Save my spot'}</Text>
            </View>
          )}
        </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

// ----------------------------------------------------
// TICKETS VIEW
// ----------------------------------------------------
function TicketsScreen({
  tickets,
  loading,
  onOpenParty,
}: {
  tickets: PartySummary[];
  loading: boolean;
  onOpenParty: (partyId: string) => void;
}) {
  return (
    <View style={styles.screenInner}>
      <Animated.View entering={FadeInDown.duration(450)} style={styles.ticketsHeader}>
        <Text style={styles.headerBrandTag}>Keepsakes</Text>
        <Text style={styles.headerTitle}>Your passes</Text>
      </Animated.View>

      <LoadState
        loading={loading}
        error={null}
        empty={!tickets.length}
        emptyLabel="No passes yet. Pick a night that feels like you."
      />

      <View style={styles.ticketsList}>
        {tickets.map((ticket, index) => (
          <Animated.View key={ticket.party_id} entering={FadeInUp.delay(Math.min(index * 60, 420)).duration(420)} layout={Layout.springify()}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.ticketCard}
              onPress={() => onOpenParty(ticket.party_id)}
            >
              <View style={styles.ticketMainRow}>
                <View style={styles.ticketQrContainer}>
                  <QRCode value={ticket.ticket_code ?? ticket.party_id} size={80} />
                </View>
                <View style={styles.ticketInfoContainer}>
                  <Text style={styles.ticketNameText} numberOfLines={1}>
                    {ticket.name}
                  </Text>
                  <Text style={styles.ticketDetailText}>
                    {formatPartyDate(ticket.party_date, ticket.party_time)}
                  </Text>
                  <Text style={styles.ticketDetailText} numberOfLines={1}>
                    {ticket.location}
                  </Text>
                </View>
              </View>

              <View style={styles.ticketCodeBox}>
                <Text style={styles.ticketCodeText}>{ticket.ticket_code ?? 'Code pending'}</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ----------------------------------------------------
// PROFILE VIEW
// ----------------------------------------------------
function ProfileScreen({
  me,
  form,
  ticketCount,
  busy,
  onBack,
  onForm,
  onProfilePicture,
  onSave,
  onSignOut,
}: {
  me: MeProfile | undefined;
  form: ProfileForm;
  ticketCount: number;
  busy: boolean;
  onBack: () => void;
  onForm: (form: ProfileForm) => void;
  onProfilePicture: () => void;
  onSave: () => void;
  onSignOut: () => void;
}) {
  return (
    <View style={styles.screenInner}>
      <ScreenHeader title="Profile" onBack={onBack} />

      <Animated.View entering={FadeInUp.duration(500)} style={styles.profileBoxCard}>
        <View style={styles.profileAvatarRow}>
          <TouchableOpacity style={styles.avatarPickerButton} onPress={onProfilePicture}>
            {me?.has_profile_picture ? (
              <Image
                source={{ uri: api.profilePicture(me.id) }}
                style={styles.avatarImage}
              />
            ) : (
              <UserRound size={30} color={colors.muted} />
            )}
          </TouchableOpacity>
          <View style={styles.avatarDetails}>
            <Text style={styles.avatarNameText} numberOfLines={1}>
              {displayName(me)}
            </Text>
            <Text style={styles.avatarSubText}>{ticketCount} saved tickets</Text>
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={styles.formInput}
            autoCapitalize="none"
            autoCorrect={false}
            value={form.username}
            onChangeText={(text) => onForm({ ...form, username: text })}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Display name</Text>
          <TextInput
            style={styles.formInput}
            value={form.displayName}
            onChangeText={(text) => onForm({ ...form, displayName: text })}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Bio</Text>
          <TextInput
            style={[styles.formInput, styles.textAreaInput]}
            multiline
            numberOfLines={4}
            value={form.bio}
            onChangeText={(text) => onForm({ ...form, bio: text })}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>City or school</Text>
          <TextInput
            style={styles.formInput}
            value={form.school}
            onChangeText={(text) => onForm({ ...form, school: text })}
          />
        </View>

        <TouchableOpacity
          style={styles.blackButton}
          activeOpacity={0.9}
          disabled={busy}
          onPress={onSave}
        >
          {busy ? (
            <ActivityIndicator color={colors.ink} size="small" />
          ) : (
            <Text style={styles.blackButtonText}>Save profile</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity
        style={styles.signOutBtn}
        activeOpacity={0.9}
        onPress={onSignOut}
      >
        <Text style={styles.signOutBtnText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

// ----------------------------------------------------
// PROFILE SETUP SCREEN
// ----------------------------------------------------
function ProfileSetupScreen({
  me,
  busy,
  onComplete,
  onProfilePicture,
  photoUri,
}: {
  me: MeProfile | undefined;
  busy: boolean;
  onComplete: (form: ProfileForm) => void;
  onProfilePicture: () => void;
  photoUri: string | null;
}) {
  const isDefaultUsername = (uname: string | undefined, uid: string | undefined) => {
    if (!uname) return true;
    if (!uid) return false;
    const normalizedId = uid
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'user';
    return uname === normalizedId || uname === uid || uname.startsWith('user_');
  };

  const [form, setForm] = useState<ProfileForm>({
    username: me?.username && !isDefaultUsername(me.username, me.id) ? me.username : '',
    displayName: me?.display_name ?? '',
    bio: me?.bio ?? '',
    school: me?.school ?? '',
  });

  const hasProfilePhoto = Boolean(photoUri || me?.has_profile_picture);
  const isFormValid = form.username.trim().length >= 3 && form.displayName.trim().length > 0 && hasProfilePhoto;

  const handleComplete = () => {
    if (!form.username.trim() || form.username.trim().length < 3) {
      Alert.alert('Username needed', 'Pick a username with at least 3 characters.');
      return;
    }
    if (!form.displayName.trim()) {
      Alert.alert('Display name needed', 'Add the name friends should see.');
      return;
    }
    if (!hasProfilePhoto) {
      Alert.alert('Photo needed', 'Add a profile photo so people can recognize you.');
      return;
    }
    onComplete(form);
  };

  return (
    <View style={styles.screenInner}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.setupHeader}>
        <Text style={styles.setupBrandTag}>PARTYLINK</Text>
        <Text style={styles.setupTitle}>Setup your profile</Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.profileBoxCard}>
        <View style={styles.profileAvatarRow}>
          <TouchableOpacity style={styles.avatarPickerButton} onPress={onProfilePicture}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : me?.has_profile_picture ? (
              <Image source={{ uri: api.profilePicture(me.id) }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <UserRound size={30} color={colors.muted} />
                <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.avatarDetails}>
            <Text style={styles.avatarNameText} numberOfLines={1}>
              {form.displayName.trim() || 'New User'}
            </Text>
            <Text style={styles.avatarSubText}>{form.username.trim() ? `@${form.username.trim()}` : 'Pick your party handle'}</Text>
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>
            Username <Text style={{ color: colors.rose }}>*</Text>
          </Text>
          <TextInput
            style={styles.formInput}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="your_handle"
            placeholderTextColor={colors.muted}
            value={form.username}
            onChangeText={(text) => setForm({ ...form, username: text })}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>
            Display name <Text style={{ color: colors.rose }}>*</Text>
          </Text>
          <TextInput
            style={styles.formInput}
            placeholder="Your name"
            placeholderTextColor={colors.muted}
            value={form.displayName}
            onChangeText={(text) => setForm({ ...form, displayName: text })}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Bio</Text>
          <TextInput
            style={[styles.formInput, styles.textAreaInput]}
            multiline
            numberOfLines={4}
            placeholder="Tell us about yourself..."
            placeholderTextColor={colors.muted}
            value={form.bio}
            onChangeText={(text) => setForm({ ...form, bio: text })}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>City or school</Text>
          <TextInput
            style={styles.formInput}
            placeholder="e.g. UCLA, Los Angeles"
            placeholderTextColor={colors.muted}
            value={form.school}
            onChangeText={(text) => setForm({ ...form, school: text })}
          />
        </View>

        <TouchableOpacity
          style={[styles.blackButton, !isFormValid && styles.disabledButton]}
          activeOpacity={0.9}
          disabled={busy || !isFormValid}
          onPress={handleComplete}
        >
          {busy ? (
            <ActivityIndicator color={colors.ink} size="small" />
          ) : (
            <Text style={styles.blackButtonText}>Complete Setup</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ----------------------------------------------------
// SHARED COMPONENTS
// ----------------------------------------------------
function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.screenHeader}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <ArrowLeft size={20} color={colors.ink} />
      </TouchableOpacity>
      <Text style={styles.screenHeaderTitle}>{title}</Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

function BottomNav({ active, onNavigate }: { active: AppView; onNavigate: (view: AppView) => void }) {
  const items: { view: AppView; label: string; icon: typeof HomeIcon }[] = [
    { view: 'discover', label: 'Home', icon: HomeIcon },
    { view: 'tickets', label: 'Tickets', icon: Ticket },
    { view: 'profile', label: 'Profile', icon: CircleUserRound },
  ];

  return (
    <Animated.View entering={FadeIn.duration(450)} style={styles.bottomNavContainer}>
      <View style={styles.bottomNavGrid}>
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active === item.view;
          return (
            <TouchableOpacity
              key={item.view}
              activeOpacity={0.85}
              style={[styles.navBtn, selected ? styles.navBtnSelected : styles.navBtnUnselected]}
              onPress={() => onNavigate(item.view)}
            >
              <Icon size={20} color={selected ? '#ffffff' : colors.muted} />
              <Text style={[styles.navLabel, selected ? styles.navLabelSelected : styles.navLabelUnselected]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

function LoadState({
  loading,
  error,
  empty,
  emptyLabel,
}: {
  loading: boolean;
  error: unknown;
  empty: boolean;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <View style={styles.loaderStateCard}>
        <ActivityIndicator color={colors.muted} size="small" />
        <Text style={styles.loaderStateText}>Loading</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorStateCard}>
        <Text style={styles.errorStateText}>{errorMessage(error)}</Text>
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.loaderStateCard}>
        <Text style={styles.loaderStateText}>{emptyLabel}</Text>
      </View>
    );
  }

  return null;
}

// ----------------------------------------------------
// STYLE COORDINATES
// ----------------------------------------------------
const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingScreen: {
    backgroundColor: colors.cream,
  },
  authContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  logoWrapper: {
    paddingVertical: 24,
  },
  brandTitle: {
    fontSize: 56,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    color: colors.ink,
    letterSpacing: 0,
  },
  brandSubtitle: {
    color: colors.ink,
    fontFamily: fonts.heavy,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
  },
  authButtonsContainer: {
    width: '100%',
    gap: 12,
  },
  authButtonPrimary: {
    backgroundColor: colors.card,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.rose,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 3,
  },
  authButtonSecondary: {
    backgroundColor: 'rgba(255, 253, 248, 0.55)',
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 47, 56, 0.12)',
  },
  authButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authButtonTextPrimary: {
    color: colors.ink,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    fontSize: 16,
  },
  authButtonTextSecondary: {
    color: colors.ink,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    fontSize: 16,
  },

  // Main ticketing layout styles
  appContainer: {
    flex: 1,
    width: containerWidth,
    backgroundColor: colors.cream,
  },
  mainScroll: {
    paddingBottom: 120,
    paddingHorizontal: 16,
  },
  screenInner: {
    width: '100%',
    paddingTop: 16,
  },
  noticeBanner: {
    position: 'absolute',
    top: 16,
    left: '5%',
    width: '90%',
    zIndex: 100,
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: colors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  noticeError: {
    backgroundColor: colors.rose,
  },
  noticeSuccess: {
    backgroundColor: '#63b99f',
  },
  noticeText: {
    color: '#ffffff',
    fontWeight: '700',
    fontFamily: fonts.heavy,
    fontSize: 14,
  },

  // Discover layout styles
  discoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerBrandTag: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: colors.rose,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    color: colors.ink,
    letterSpacing: 0,
  },
  headerProfileButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.rose,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerProfileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  searchBarIcon: {
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  cardsGrid: {
    gap: 12,
  },

  // EventCard styling
  eventCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.rose,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.11,
    shadowRadius: 18,
    elevation: 2,
  },
  eventCardImageWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.blush,
    position: 'relative',
  },
  eventCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  eventCardDetails: {
    padding: 16,
    gap: 12,
  },
  cardInfoSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardInfoLeft: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    color: colors.ink,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardMetaText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  cardLocationRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardLocationText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  statusSavedText: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    color: '#438b72',
  },
  statusLeftText: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    color: colors.rose,
  },

  // Event Detail Screen styling
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    color: colors.ink,
  },
  eventDetailCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  eventDetailImageWrapper: {
    width: '100%',
    aspectRatio: 5 / 4,
    backgroundColor: colors.blush,
    position: 'relative',
  },
  eventDetailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  eventDetailInfo: {
    padding: 16,
    gap: 16,
  },
  liveEventTag: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    textTransform: 'uppercase',
    color: colors.rose,
    letterSpacing: 2,
  },
  detailName: {
    fontSize: 30,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    color: colors.ink,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailMetaText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.ink,
    flex: 1,
    lineHeight: 20,
  },
  detailDescription: {
    fontSize: 14,
    lineHeight: 24,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  setupHeader: {
    marginBottom: 24,
    alignItems: 'center',
  },
  setupBrandTag: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: colors.rose,
    marginBottom: 8,
  },
  setupTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    color: colors.ink,
    letterSpacing: 0,
    marginBottom: 8,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  avatarPlaceholderText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '700',
    fontFamily: fonts.heavy,
  },
  blackButton: {
    height: 56,
    backgroundColor: colors.honey,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blackButtonText: {
    color: colors.ink,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    fontSize: 16,
  },
  // Tickets Wallet styling
  ticketsHeader: {
    marginBottom: 20,
  },
  ticketsList: {
    gap: 12,
  },
  ticketCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 16,
  },
  ticketMainRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  ticketQrContainer: {
    width: 96,
    height: 96,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketInfoContainer: {
    flex: 1,
  },
  ticketNameText: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    color: colors.ink,
  },
  ticketDetailText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.muted,
    marginTop: 4,
  },
  ticketCodeBox: {
    backgroundColor: '#fff2ea',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  ticketCodeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: '900',
    color: colors.ink,
  },

  // Profile styling
  profileBoxCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  profileAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarPickerButton: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: '#fff2ea',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarDetails: {
    flex: 1,
  },
  avatarNameText: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: fonts.heavy,
    color: colors.ink,
  },
  avatarSubText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.muted,
    marginTop: 4,
  },
  secondaryActionButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: '#fff2ea',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.heavy,
  },
  inputWrapper: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.heavy,
    color: colors.ink,
  },
  formInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  textAreaInput: {
    height: 96,
    textAlignVertical: 'top',
    paddingVertical: 12,
  },
  signOutBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signOutBtnText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
    fontFamily: fonts.heavy,
  },

  // Bottom Nav Bar styling
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 253, 248, 0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  bottomNavGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  navBtnSelected: {
    backgroundColor: colors.rose,
  },
  navBtnUnselected: {
    backgroundColor: 'transparent',
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: fonts.heavy,
  },
  navLabelSelected: {
    color: '#ffffff',
  },
  navLabelUnselected: {
    color: colors.muted,
  },

  // Loader and Error components
  loaderStateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loaderStateText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.heavy,
    color: colors.muted,
  },
  errorStateCard: {
    backgroundColor: '#fff1f2',
    borderRadius: 8,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  errorStateText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.heavy,
    color: '#be123c',
  },
});
