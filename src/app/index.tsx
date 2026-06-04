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
import {
  ArrowLeft,
  CalendarDays,
  CircleUserRound,
  Home as HomeIcon,
  Lock,
  MapPin,
  Search,
  Sparkles,
  Ticket,
  UserRound,
} from 'lucide-react-native';

import { api, errorMessage } from '@/lib/api';
import { formatMoney, formatPartyDate, displayName } from '@/lib/format';
import type { PartySummary, PartyDetail, MeProfile } from '@/types/domain';

type AppView = 'discover' | 'event' | 'tickets' | 'profile' | 'profile-setup';
type Notice = { tone: 'success' | 'error' | 'info'; message: string };
type ProfileForm = { displayName: string; bio: string; school: string };

const { width } = Dimensions.get('window');
const maxMobileWidth = 480;
const containerWidth = width > maxMobileWidth ? maxMobileWidth : width;

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
      colors={['#2e1065', '#4c1d95', '#2e1065']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.authContainer}
    >
      <View style={styles.authCard}>
        <View style={styles.logoWrapper}>
          <Text style={styles.brandTitle}>PARTYLINK</Text>
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
                <Lock size={18} color="#2e1065" />
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
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <View style={styles.authButtonInner}>
                <Sparkles size={18} color="#ffffff" />
                <Text style={styles.authButtonTextSecondary}>Continue with Discord</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
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
  const [profileForm, setProfileForm] = useState({ displayName: '', bio: '', school: '' });
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [selectedPortraitUri, setSelectedPortraitUri] = useState<string | null>(null);

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
      displayName: meQuery.data.display_name ?? user.fullName ?? user.username ?? '',
      bio: meQuery.data.bio ?? '',
      school: meQuery.data.school ?? '',
    });
  }, [meQuery.data, user]);

  useEffect(() => {
    if (meQuery.isLoading || !meQuery.data) return;
    const isProfileIncomplete = !meQuery.data.display_name || !meQuery.data.display_name.trim();
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
      showNotice({ tone: 'success', message: result.alreadyAttending ? 'Ticket already saved.' : 'Ticket saved.' });
      navigate('tickets', { replace: true });
    },
    onError: (error) => showNotice({ tone: 'error', message: errorMessage(error) }),
  });

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      api.updateMe(userId, {
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

  const uploadPortraitMutation = useMutation({
    mutationFn: (fileUri: string) => api.uploadPortrait(userId, fileUri),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', userId] });
      showNotice({ tone: 'success', message: 'Profile portrait updated.' });
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

  const handlePickPortrait = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Camera roll access is required to upload a profile portrait.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
      uploadPortraitMutation.mutate(pickerResult.assets[0].uri);
    }
  };

  const setupProfileMutation = useMutation({
    mutationFn: async (form: { displayName: string; bio: string; school: string }) => {
      await api.updateMe(userId, {
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        school: form.school.trim(),
      });
      if (selectedPhotoUri) {
        await api.uploadProfilePicture(userId, selectedPhotoUri);
      }
      if (selectedPortraitUri) {
        await api.uploadPortrait(userId, selectedPortraitUri);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', userId] });
      setSelectedPhotoUri(null);
      setSelectedPortraitUri(null);
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

  const handlePickPortraitForSetup = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Camera roll access is required to upload a profile portrait.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
      setSelectedPortraitUri(pickerResult.assets[0].uri);
    }
  };

  const isBusy =
    updateProfileMutation.isPending ||
    uploadProfilePictureMutation.isPending ||
    uploadPortraitMutation.isPending ||
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
            onPortrait={handlePickPortrait}
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
            onPortrait={handlePickPortraitForSetup}
            photoUri={selectedPhotoUri}
            portraitUri={selectedPortraitUri}
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
  parties,
  loading,
  error,
  search,
  ticketedPartyIds,
  onSearch,
  onOpenParty,
  onOpenProfile,
}: {
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
      <View style={styles.discoverHeader}>
        <View>
          <Text style={styles.headerBrandTag}>PARTYLINK</Text>
          <Text style={styles.headerTitle}>Upcoming events</Text>
        </View>
        <TouchableOpacity style={styles.headerProfileButton} onPress={onOpenProfile}>
          <CircleUserRound size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBarWrapper}>
        <Search size={19} color="#71717a" style={styles.searchBarIcon} />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search by artist, venue, or city"
          placeholderTextColor="#71717a"
          value={search}
          onChangeText={onSearch}
        />
      </View>

      <LoadState
        loading={loading}
        error={error}
        empty={!parties.length}
        emptyLabel="No events match your search."
      />

      <View style={styles.cardsGrid}>
        {parties.map((party) => {
          const hasTicket = ticketedPartyIds.has(party.party_id);
          return (
            <TouchableOpacity
              key={party.party_id}
              activeOpacity={0.9}
              style={styles.eventCard}
              onPress={() => onOpenParty(party.party_id)}
            >
              <View style={styles.eventCardImageWrapper}>
                <Image
                  source={{ uri: api.partyBanner(party.party_id) }}
                  style={styles.eventCardImage}
                />
                <View style={styles.priceOverlay}>
                  <Text style={styles.priceOverlayText}>{formatMoney(party.price)}</Text>
                </View>
              </View>
              <View style={styles.eventCardDetails}>
                <View style={styles.cardInfoSplit}>
                  <View style={styles.cardInfoLeft}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {party.name}
                    </Text>
                    <View style={styles.cardMetaRow}>
                      <CalendarDays size={15} color="#52525b" />
                      <Text style={styles.cardMetaText}>
                        {formatPartyDate(party.party_date, party.party_time)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardPriceBox}>
                    <Text style={styles.cardPriceText}>{formatMoney(party.price)}</Text>
                  </View>
                </View>

                <View style={styles.cardInfoSplit}>
                  <View style={styles.cardLocationRow}>
                    <MapPin size={15} color="#52525b" />
                    <Text style={styles.cardLocationText} numberOfLines={1}>
                      {party.location}
                    </Text>
                  </View>
                  <Text style={hasTicket ? styles.statusSavedText : styles.statusLeftText}>
                    {hasTicket ? 'Ticket saved' : `${party.tickets_left} left`}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
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
        <View style={styles.eventDetailCard}>
          <View style={styles.eventDetailImageWrapper}>
            <Image
              source={{ uri: api.partyBanner(party.party_id) }}
              style={styles.eventDetailImage}
            />
            <View style={styles.priceOverlay}>
              <Text style={styles.priceOverlayText}>{formatMoney(party.price)}</Text>
            </View>
          </View>

          <View style={styles.eventDetailInfo}>
            <Text style={styles.liveEventTag}>Live event</Text>
            <Text style={styles.detailName}>{party.name}</Text>

            <View style={styles.detailMetaRow}>
              <CalendarDays size={18} color="#09090b" />
              <Text style={styles.detailMetaText}>
                {formatPartyDate(party.party_date, party.party_time)}
              </Text>
            </View>

            <View style={styles.detailMetaRow}>
              <MapPin size={18} color="#09090b" />
              <Text style={styles.detailMetaText}>
                {party.location_meta?.address ?? party.location}
              </Text>
            </View>

            {party.description && (
              <Text style={styles.detailDescription}>{party.description}</Text>
            )}

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Price</Text>
                <Text style={styles.statValue}>{formatMoney(party.price)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Tickets left</Text>
                <Text style={styles.statValue}>{party.tickets_left}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {party && (
        <TouchableOpacity
          style={styles.blackButton}
          activeOpacity={0.9}
          disabled={busy}
          onPress={hasTicket ? onTickets : onAttend}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <View style={styles.buttonIconLabel}>
              <Ticket size={19} color="#ffffff" />
              <Text style={styles.blackButtonText}>{hasTicket ? 'View ticket' : 'Get free ticket'}</Text>
            </View>
          )}
        </TouchableOpacity>
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
      <View style={styles.ticketsHeader}>
        <Text style={styles.headerBrandTag}>Wallet</Text>
        <Text style={styles.headerTitle}>Your tickets</Text>
      </View>

      <LoadState
        loading={loading}
        error={null}
        empty={!tickets.length}
        emptyLabel="No tickets yet. Find an event to get started."
      />

      <View style={styles.ticketsList}>
        {tickets.map((ticket) => (
          <TouchableOpacity
            key={ticket.party_id}
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
  onPortrait,
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
  onPortrait: () => void;
  onSave: () => void;
  onSignOut: () => void;
}) {
  return (
    <View style={styles.screenInner}>
      <ScreenHeader title="Profile" onBack={onBack} />

      <View style={styles.profileBoxCard}>
        <View style={styles.profileAvatarRow}>
          <TouchableOpacity style={styles.avatarPickerButton} onPress={onProfilePicture}>
            {me?.has_profile_picture ? (
              <Image
                source={{ uri: api.profilePicture(me.id) }}
                style={styles.avatarImage}
              />
            ) : (
              <UserRound size={30} color="#71717a" />
            )}
          </TouchableOpacity>
          <View style={styles.avatarDetails}>
            <Text style={styles.avatarNameText} numberOfLines={1}>
              {displayName(me)}
            </Text>
            <Text style={styles.avatarSubText}>{ticketCount} saved tickets</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.secondaryActionButton} activeOpacity={0.9} onPress={onPortrait}>
          <UserRound size={17} color="#09090b" />
          <Text style={styles.secondaryActionText}>
            {me?.has_portrait ? 'Update portrait' : 'Add profile portrait'}
          </Text>
        </TouchableOpacity>

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
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.blackButtonText}>Save profile</Text>
          )}
        </TouchableOpacity>
      </View>

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
  onPortrait,
  photoUri,
  portraitUri,
}: {
  me: MeProfile | undefined;
  busy: boolean;
  onComplete: (form: ProfileForm) => void;
  onProfilePicture: () => void;
  onPortrait: () => void;
  photoUri: string | null;
  portraitUri: string | null;
}) {
  const { user } = useUser();
  const [form, setForm] = useState<ProfileForm>({ displayName: '', bio: '', school: '' });

  const isFormValid = form.displayName.trim().length > 0;

  const handleComplete = () => {
    if (!isFormValid) {
      Alert.alert('Required Field', 'Please enter a display name to complete your profile.');
      return;
    }
    onComplete(form);
  };

  return (
    <View style={styles.screenInner}>
      <View style={styles.setupHeader}>
        <Text style={styles.setupBrandTag}>PARTYLINK</Text>
        <Text style={styles.setupTitle}>Setup your profile</Text>
        <Text style={styles.setupSubtitle}>Please complete your profile to continue to the application.</Text>
      </View>

      <View style={styles.profileBoxCard}>
        <View style={styles.profileAvatarRow}>
          <TouchableOpacity style={styles.avatarPickerButton} onPress={onProfilePicture}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : me?.has_profile_picture ? (
              <Image source={{ uri: api.profilePicture(me.id) }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <UserRound size={30} color="#71717a" />
                <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.avatarDetails}>
            <Text style={styles.avatarNameText} numberOfLines={1}>
              {form.displayName.trim() || 'New User'}
            </Text>
            <Text style={styles.avatarSubText}>
              @{user?.username || user?.primaryEmailAddress?.emailAddress.split('@')[0]}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.secondaryActionButton} activeOpacity={0.9} onPress={onPortrait}>
          <UserRound size={17} color="#09090b" />
          <Text style={styles.secondaryActionText}>
            {portraitUri || me?.has_portrait ? 'Portrait selected' : 'Add profile portrait'}
          </Text>
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={[styles.formInput, styles.disabledInput]}
            value={user?.username || user?.primaryEmailAddress?.emailAddress.split('@')[0]}
            editable={false}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>
            Display name <Text style={{ color: '#e11d48' }}>*</Text>
          </Text>
          <TextInput
            style={styles.formInput}
            placeholder="Your name"
            placeholderTextColor="#71717a"
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
            placeholderTextColor="#71717a"
            value={form.bio}
            onChangeText={(text) => setForm({ ...form, bio: text })}
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>City or school</Text>
          <TextInput
            style={styles.formInput}
            placeholder="e.g. UCLA, Los Angeles"
            placeholderTextColor="#71717a"
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
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.blackButtonText}>Complete Setup</Text>
          )}
        </TouchableOpacity>
      </View>
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
        <ArrowLeft size={20} color="#09090b" />
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
    <View style={styles.bottomNavContainer}>
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
              <Icon size={20} color={selected ? '#ffffff' : '#71717a'} />
              <Text style={[styles.navLabel, selected ? styles.navLabelSelected : styles.navLabelUnselected]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
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
        <ActivityIndicator color="#71717a" size="small" />
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
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingScreen: {
    backgroundColor: '#0a0a0a',
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
    fontSize: 60,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -3,
  },
  authButtonsContainer: {
    width: '100%',
    gap: 12,
  },
  authButtonPrimary: {
    backgroundColor: '#ffffff',
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  authButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  authButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authButtonTextPrimary: {
    color: '#2e1065',
    fontWeight: '900',
    fontSize: 16,
  },
  authButtonTextSecondary: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
  },

  // Main ticketing layout styles
  appContainer: {
    flex: 1,
    width: containerWidth,
    backgroundColor: '#f5f5f4', // bg-stone-50
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
    backgroundColor: '#09090b',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  noticeError: {
    backgroundColor: '#e11d48',
  },
  noticeSuccess: {
    backgroundColor: '#047857',
  },
  noticeText: {
    color: '#ffffff',
    fontWeight: '700',
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
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#e11d48', // text-rose-600
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#09090b',
    letterSpacing: -0.5,
  },
  headerProfileButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  searchBarIcon: {
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 15,
    color: '#09090b',
  },
  cardsGrid: {
    gap: 12,
  },

  // EventCard styling
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventCardImageWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#e4e4e7',
    position: 'relative',
  },
  eventCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  priceOverlay: {
    position: 'absolute',
    left: 12,
    top: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceOverlayText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#09090b',
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
    color: '#09090b',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardMetaText: {
    fontSize: 14,
    color: '#52525b',
  },
  cardPriceBox: {
    backgroundColor: '#f4f4f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardPriceText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#09090b',
  },
  cardLocationRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardLocationText: {
    fontSize: 14,
    color: '#52525b',
  },
  statusSavedText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#047857',
  },
  statusLeftText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#e11d48',
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
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenHeaderTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#09090b',
  },
  eventDetailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    overflow: 'hidden',
    marginBottom: 16,
  },
  eventDetailImageWrapper: {
    width: '100%',
    aspectRatio: 5 / 4,
    backgroundColor: '#e4e4e7',
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
    textTransform: 'uppercase',
    color: '#e11d48',
    letterSpacing: 2,
  },
  detailName: {
    fontSize: 30,
    fontWeight: '900',
    color: '#09090b',
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailMetaText: {
    fontSize: 14,
    color: '#3f3f46',
    flex: 1,
    lineHeight: 20,
  },
  detailDescription: {
    fontSize: 14,
    lineHeight: 24,
    color: '#3f3f46',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f4f4f5',
    borderRadius: 8,
    padding: 12,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: '#71717a',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#09090b',
    marginTop: 4,
  },
  setupHeader: {
    marginBottom: 24,
    alignItems: 'center',
  },
  setupBrandTag: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#e11d48',
    marginBottom: 8,
  },
  setupTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#09090b',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  setupSubtitle: {
    fontSize: 14,
    color: '#71717a',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  disabledInput: {
    backgroundColor: '#f4f4f5',
    color: '#71717a',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  avatarPlaceholderText: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: '700',
  },
  blackButton: {
    height: 56,
    backgroundColor: '#09090b',
    borderRadius: 8,
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
    color: '#ffffff',
    fontWeight: '900',
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
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e4e7',
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketInfoContainer: {
    flex: 1,
  },
  ticketNameText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#09090b',
  },
  ticketDetailText: {
    fontSize: 14,
    color: '#52525b',
    marginTop: 4,
  },
  ticketCodeBox: {
    backgroundColor: '#f4f4f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  ticketCodeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: '900',
    color: '#09090b',
  },

  // Profile styling
  profileBoxCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e4e4e7',
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
    borderRadius: 8,
    backgroundColor: '#f4f4f5',
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
    color: '#09090b',
  },
  avatarSubText: {
    fontSize: 14,
    color: '#52525b',
    marginTop: 4,
  },
  secondaryActionButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: '#09090b',
    fontSize: 14,
    fontWeight: '800',
  },
  inputWrapper: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#09090b',
  },
  formInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#09090b',
  },
  textAreaInput: {
    height: 96,
    textAlignVertical: 'top',
    paddingVertical: 12,
  },
  signOutBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    backgroundColor: 'transparent',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signOutBtnText: {
    color: '#3f3f46',
    fontSize: 14,
    fontWeight: '900',
  },

  // Bottom Nav Bar styling
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#e4e4e7',
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
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  navBtnSelected: {
    backgroundColor: '#09090b',
  },
  navBtnUnselected: {
    backgroundColor: 'transparent',
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '900',
  },
  navLabelSelected: {
    color: '#ffffff',
  },
  navLabelUnselected: {
    color: '#71717a',
  },

  // Loader and Error components
  loaderStateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  loaderStateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#71717a',
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
    color: '#be123c',
  },
});
