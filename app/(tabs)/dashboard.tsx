import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,

  ActivityIndicator,
  FlatList,
  Dimensions,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter, Link, Stack } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import {
  Search,
  MessageSquare,
  MapPin,
  LogOut,
  Compass,
  Calendar as CalendarIcon,
  Ticket,
  PartyPopper,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Colors, { API_BASE_URL } from "@/constants";
import { PartyRow } from "@/types/database";

const AppColors = Colors.dark;

const { width: screenWidth } = Dimensions.get("window");

const placeholderImage = (width: number, height: number, text = "Image") =>
  `https://placehold.co/${width}x${height}/${AppColors.cardBg.replace("#", "")}/${AppColors.white.replace("#", "")}?text=${encodeURIComponent(text)}&font=Inter`;


const SearchFilters: React.FC<{
  filters: { date: string; search: string };
  setFilters: React.Dispatch<React.SetStateAction<{ date: string; search: string }>>;
}> = ({ filters, setFilters }) => {
  const filterDateOptions = ["Any Date", "Today", "This Weekend", "Next Week", "This Month"];

  return (
    <View style={styles.searchFiltersContainer}>
      <View style={styles.searchInputContainer}>
        <Search
          size={18}
          color={AppColors.gray400}
          style={styles.searchIcon}
        />
        <TextInput
          placeholder="Search for parties..."
          placeholderTextColor={AppColors.gray400}
          value={filters.search}
          onChangeText={(text) => setFilters({ ...filters, search: text })}
          style={styles.searchInput}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateFilterScrollView}>
        {filterDateOptions.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.dateFilterButton,
              filters.date === option && styles.dateFilterButtonActive,
            ]}
            onPress={() => setFilters({ ...filters, date: option })}
          >
            <Text style={[
              styles.dateFilterButtonText,
              filters.date === option && styles.dateFilterButtonTextActive,
            ]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};


const PartyCard: React.FC<{ party: PartyRow }> = ({ party }) => {
  return (
    <View style={styles.partyCardContainer}>
      <Image
        source={{ uri: `${API_BASE_URL}/party/${party.party_id}/banner` }}
        defaultSource={{ uri: placeholderImage(400, 160, party.name) }}
        style={styles.partyCardImage}
      />
      <View style={styles.partyCardContent}>
        <Text style={styles.partyCardName} numberOfLines={2}>{party.name}</Text>
        <View style={styles.partyCardRow}>
          <CalendarIcon size={14} color={AppColors.gray300} style={styles.partyCardIcon} />
          <Text style={styles.partyCardText}>{party.party_date}</Text>
          {party.tickets_left > 0 ? (
            <View style={[styles.ticketBadge, { backgroundColor: AppColors.green400 + '30', marginLeft: 'auto' }]}>
              <Text style={[styles.ticketBadgeText, { color: AppColors.green400 }]}>
                {party.tickets_left} spots left
              </Text>
            </View>
          ) : (
            <View style={[styles.ticketBadge, { backgroundColor: AppColors.red400 + '30', marginLeft: 'auto' }]}>
              <Text style={[styles.ticketBadgeText, { color: AppColors.red400 }]}>
                Sold out
              </Text>
            </View>
          )}
        </View>
        <View style={styles.partyCardRow}>
          <MapPin size={14} color={AppColors.gray300} style={styles.partyCardIcon} />
          <Text style={styles.partyCardText} numberOfLines={1}>{party.location}</Text>
        </View>
      </View>
      <Link href={{ pathname: "/party/[id]", params: { id: party.party_id } }} asChild>
        <TouchableOpacity style={styles.partyCardButton}>
          <Text style={styles.partyCardButtonText}>View Details</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
};



const DashboardScreen: React.FC = () => {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"explore" | "attending">("explore");
  const [filters, setFilters] = useState({ search: "", date: "Any Date" });
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [initialAppLoading, setInitialAppLoading] = useState(true);

  const loaderScale = useSharedValue(1);
  const loaderOpacity = useSharedValue(0.7);

  useEffect(() => {
    if (initialAppLoading) {
      loaderScale.value = withRepeat(withTiming(1.2, { duration: 750, easing: Easing.inOut(Easing.ease) }), -1, true);
      loaderOpacity.value = withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      loaderScale.value = withTiming(1);
      loaderOpacity.value = withTiming(1);
    }
  }, [initialAppLoading, loaderScale, loaderOpacity]);

  const animatedLoaderStyle = useAnimatedStyle(() => ({
    transform: [{ scale: loaderScale.value }],
    opacity: loaderOpacity.value,
  }));

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/");
    }
    if (isLoaded && isSignedIn) {
      setInitialAppLoading(false);
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn || initialAppLoading) return;

    const fetchParties = async () => {
      setContentLoading(true);
      const cacheKey = activeTab === "explore" ? "explore_parties_cache" : "attending_parties_cache";

      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setParties(JSON.parse(cached));
        }
      } catch {
        await AsyncStorage.removeItem(cacheKey);
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/party`);
        if (!resp.ok) throw new Error(`Status ${resp.status}`);
        const data: PartyRow[] = await resp.json()
        setParties(data);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (err: any) {
        Alert.alert("Error", `Could not load parties: ${err.message}`);
      } finally {
        setContentLoading(false);
      }
    };

    fetchParties();
  }, [isSignedIn, activeTab, initialAppLoading]);

  const handleSignOut = async () => {
    Alert.alert("Confirm Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (e) {
            console.error("Sign out error", e);
            Alert.alert("Error", "Failed to sign out.");
          }
        },
      },
    ]);
  };

  const filteredParties = parties.filter((p) => {
    const searchLower = filters.search.toLowerCase();
    const nameMatch = p.name.toLowerCase().includes(searchLower);
    return nameMatch;
  });

  const ListHeader = () => (
    <>
      <View style={styles.contentHeader}>
        <Text style={styles.contentTitle}>
          {activeTab === "explore" ? "Explore Parties" : "Parties You're Attending"}
        </Text>
        <Text style={styles.contentSubtitle}>
          {activeTab === "explore" ? "Discover the hottest parties happening near you" : "Events you've RSVP'd to"}
        </Text>
      </View>
      <SearchFilters filters={filters} setFilters={setFilters} />
    </>
  );

  const EmptyListComponent = () => (
    <View style={styles.noPartiesContainer}>
      <View style={styles.noPartiesIconBg}>
        <Search size={40} color={AppColors.gray400} />
      </View>
      <Text style={styles.noPartiesTitle}>No parties found</Text>
      <Text style={styles.noPartiesSubtitle}>
        Try adjusting your search or check back later!
      </Text>
    </View>
  );


  if (initialAppLoading || !isLoaded) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg, AppColors.darkerBg]}
        style={styles.fullScreenLoaderContainer}
      >
        <Animated.View style={[styles.loaderAnimationContent, animatedLoaderStyle]}>
          <PartyPopper size={64} color={AppColors.pink500} />
        </Animated.View>
        <Text style={styles.loaderText}>Loading PartyLink...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[AppColors.primaryBg, AppColors.secondaryBg, AppColors.darkerBg]}
      style={styles.dashboardContainer}
    >
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: AppColors.secondaryBg },
          headerTintColor: AppColors.white,
          headerTitle: () => (
            <View style={styles.headerTitleContainer}>
              <PartyPopper size={26} color={AppColors.pink500} />
              <Text style={styles.headerTitleText}>PartyLink</Text>
            </View>
          ),
          headerRight: () => (
            <View style={styles.headerIconsContainer}>
              <TouchableOpacity onPress={() => Alert.alert("Messages", "Feature coming soon!")} style={styles.headerIconWrapper}>
                <MessageSquare size={24} color={AppColors.gray300} />
                <View style={styles.messageBadge}>
                  <Text style={styles.messageBadgeText}>5</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSignOut} style={[styles.headerIconWrapper, { marginLeft: 10 }]}>
                <LogOut size={24} color={AppColors.gray300} />
              </TouchableOpacity>
            </View>
          ),
          headerShadowVisible: false,
        }}
      />

      <View style={styles.tabSelectorContainer}>
        {([
          { id: "explore", icon: Compass, label: "Explore" },
          { id: "attending", icon: Ticket, label: "Attending" },
        ] as const).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.tabButton, activeTab === item.id && styles.activeTabButton]}
            onPress={() => {
                setActiveTab(item.id);
                setFilters({ search: "", date: "Any Date" });
            }}
          >
            <item.icon size={20} color={activeTab === item.id ? AppColors.pink500 : AppColors.gray300} />
            <Text style={[styles.tabButtonText, activeTab === item.id && styles.activeTabButtonText]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {contentLoading && !parties.length ? (
        <View style={styles.centeredLoader}>
          <ActivityIndicator size="large" color={AppColors.pink500} />
          <Text style={styles.loadingPartiesText}>Loading parties...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredParties}
          renderItem={({ item }) => <PartyCard party={item} />}
          keyExtractor={(item) => item.party_id}
          ListHeaderComponent={<ListHeader />}
          ListEmptyComponent={!contentLoading ? <EmptyListComponent /> : null}
          ListFooterComponent={contentLoading && parties.length > 0 ? <ActivityIndicator size="small" color={AppColors.pink500} style={{ marginVertical: 20 }} /> : null}
          numColumns={Platform.OS === 'web' ? 4 : (screenWidth > 768 ? 2 : 1)}
          columnWrapperStyle={Platform.OS !== 'web' && screenWidth > 768 && filteredParties.length > 0 ? styles.flatlistColumnWrapper : undefined}
          contentContainerStyle={styles.flatListContentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  dashboardContainer: { flex: 1 },
  fullScreenLoaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderAnimationContent: { alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 20, fontSize: 18, color: AppColors.white, fontWeight: '600' },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  headerTitleText: { color: AppColors.white, fontSize: 22, fontWeight: 'bold', marginLeft: 10, letterSpacing: -0.5 },
  headerIconsContainer: { flexDirection: 'row', alignItems: 'center' },
  headerIconWrapper: { padding: 6, position: 'relative' },
  messageBadge: { position: 'absolute', top: 3, right: 3, backgroundColor: AppColors.pink500, borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  messageBadgeText: { color: AppColors.white, fontSize: 10, fontWeight: 'bold' },
  tabSelectorContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: AppColors.secondaryBg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.gray500,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  activeTabButton: { backgroundColor: `${AppColors.pink500}30` },
  tabButtonText: { marginLeft: 8, fontSize: 15, color: AppColors.gray300, fontWeight: '500' },
  activeTabButtonText: { color: AppColors.pink500, fontWeight: 'bold' },


  contentHeader: { marginVertical: 24, paddingHorizontal: 16, },
  contentTitle: { fontSize: 26, fontWeight: "bold", color: AppColors.white, marginBottom: 6 },
  contentSubtitle: { fontSize: 15, color: AppColors.gray300 },

  searchFiltersContainer: {
    backgroundColor: AppColors.cardBg,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: AppColors.gray500,
    marginBottom: 16,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: 48, color: AppColors.white, fontSize: 16 },
  dateFilterScrollView: { flexDirection: 'row' },
  dateFilterButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: AppColors.inputBg,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: AppColors.gray500,
  },
  dateFilterButtonActive: { backgroundColor: AppColors.pink500, borderColor: AppColors.pink500 },
  dateFilterButtonText: { color: AppColors.gray300, fontSize: 14, fontWeight: '500' },
  dateFilterButtonTextActive: { color: AppColors.white, fontWeight: 'bold' },

  flatListContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  flatlistColumnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },

  centeredLoader: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 50, minHeight: 300 },
  loadingPartiesText: { marginTop: 12, fontSize: 16, color: AppColors.gray300 },


  noPartiesContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60, minHeight: 300, paddingHorizontal: 16, },
  noPartiesIconBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: AppColors.inputBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  noPartiesTitle: { fontSize: 20, fontWeight: "bold", color: AppColors.white, marginBottom: 10 },
  noPartiesSubtitle: { fontSize: 14, color: AppColors.gray300, textAlign: "center", maxWidth: "85%" },

  partyCardContainer: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    flex: screenWidth > 768 ? undefined : 1,
    marginHorizontal: screenWidth > 768 ? 8 : 0,
  },
  partyCardImage: { width: "100%", height: 160 },
  partyCardContent: { padding: 16, flexGrow: 1 },
  partyCardName: { fontSize: 18, fontWeight: "bold", color: AppColors.white, marginBottom: 10, lineHeight: 24 },
  partyCardRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  partyCardIcon: { marginRight: 8 },
  partyCardText: { fontSize: 13, color: AppColors.gray300, flexShrink: 1 },
  ticketBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  ticketBadgeText: { fontSize: 11, fontWeight: '600' },
  partyCardButton: { backgroundColor: AppColors.pink500, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  partyCardButtonText: { color: AppColors.white, fontSize: 16, fontWeight: "600" },

  footer: {
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: AppColors.gray500,
    backgroundColor: AppColors.primaryBg,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  }
});


export default DashboardScreen;
