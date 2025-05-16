import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Clock,
} from "lucide-react-native";
import QRCodeSVG from "react-native-qrcode-svg";
import { API_BASE_URL } from "@/constants";
import { PartyRow } from "@/types/database";


const PageColors = {
  background: "#160c36",
  cardBackground: "rgba(58, 31, 93, 0.8)",
  textWhite: "#FFFFFF",
  textGray300: "#D1D5DB",
  textBlack: "#000000",
};


const PartyLandingScreen: React.FC = () => {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const router = useRouter();
  const [party, setParty] = useState<PartyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrValue, setQrValue] = useState("");
  const [showQR, setShowQR] = useState(false);
  const { isSignedIn, isLoaded } = useUser();
  const { userId } = useAuth()

  useEffect(() => {

    if (!partyId) {
      setLoading(false);
      console.error("Party ID is missing");
      return;
    }

    if (!isLoaded) {
      return;
    }

    fetch(`${API_BASE_URL}/party/${partyId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch party: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setParty(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [partyId, isLoaded]);

  const handleTicket = () => {
    if (!partyId) return;
    const userIdPart = isSignedIn ? userId : "guest";
    const code = `${partyId}-${userIdPart}`;
    setQrValue(code);
    setShowQR(true);
  };

  if (loading || !isLoaded) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={PageColors.textWhite} />
        <Text style={styles.loaderText}>Loading...</Text>
      </View>
    );
  }

  if (!party) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>Party details could not be loaded.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonContainer}>
          <ArrowLeft size={20} color={PageColors.textWhite} />
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerActions}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButtonContainer}
        >
          <ArrowLeft size={20} color={PageColors.textGray300} />
          <Text style={styles.backButtonText}>Back to Events</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileHeader}>


        <View style={styles.userButtonWrapper}>
          <Image
            source={{ uri: `${API_BASE_URL}/user/${userId}/profile-picture` }}
            style={styles.profilePicture}
            onError={(e) => console.log('Placeholder Image Load Error:', e.nativeEvent.error)}
            onLoad={() => console.log('Placeholder Image Loaded Successfully!')}
          />
        </View>

      </View>

      <View style={styles.eventSummaryCard}>
        <View style={styles.eventDetails}>
          <Text style={styles.eventName}>{party.name.toUpperCase()}</Text>
          <View style={styles.eventMeta}>
            <View style={styles.metaItem}>
              <CalendarDays size={18} color={PageColors.textGray300} />
              <Text style={styles.metaText}>{party.party_date}</Text>
            </View>
            <View style={styles.metaItem}>
              <MapPin size={18} color={PageColors.textGray300} />
              <Text style={styles.metaText}>{party.location}</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={18} color={PageColors.textGray300} />
              <Text style={styles.metaText}>6:00 PM</Text>
            </View>
          </View>
        </View>
        <View style={styles.eventImageContainer}>
          <Image
            source={{ uri: `${API_BASE_URL}/party/${partyId}/banner` }}
            style={styles.eventImage}
            resizeMode="cover"
          />
        </View>
      </View>

      <View style={styles.ctaContainer}>
        <Text style={styles.ctaText}>
          Before Connecting With Others,
          {"\n"}
          Establish Who You are Going With!
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            router.replace(`/party/${partyId}/groups`);
          }}
        >
          <Text style={styles.primaryButtonText}>Create Group</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.ticketButtonContainer}>
        <TouchableOpacity
          onPress={handleTicket}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Show my ticket</Text>
        </TouchableOpacity>
      </View>

      {showQR && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={showQR}
          onRequestClose={() => setShowQR(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowQR(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
              {qrValue ? (
                <QRCodeSVG value={qrValue} size={200} backgroundColor="white" color="black" />
              ) : (
                <Text>Generating QR Code...</Text>
              )}
              <Text style={styles.qrMessageText}>Have a blast!</Text>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PageColors.background,
  },
  scrollContentContainer: {
    paddingBottom: 40,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: PageColors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loaderText: {
    marginTop: 10,
    color: PageColors.textWhite,
    fontSize: 16,
  },
  errorText: {
    color: PageColors.textWhite,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  headerActions: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
  },
  backButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButtonText: {
    color: PageColors.textGray300,
    marginLeft: 8,
    fontSize: 16,
  },
  profileHeader: {
    alignItems: "center",
    marginTop: 16,
  },
  userButtonWrapper: {
    transform: [{ scale: Platform.OS === 'ios' ? 1.5 : 1.8 }],
    marginVertical: 20,
  },
  signInText: {
    color: PageColors.textWhite,
    fontSize: 16,
  },
  eventSummaryCard: {
    marginHorizontal: "auto",
    marginTop: 20,
    marginBottom: 32,
    backgroundColor: PageColors.cardBackground,
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: Dimensions.get("window").width - 32,
    alignSelf: "center",
    flexDirection: "row",
    gap: 16,
  },
  eventDetails: {
    flex: 1,
  },
  eventName: {
    fontSize: 20,
    fontWeight: "bold",
    color: PageColors.textWhite,
    textTransform: "uppercase",
  },
  eventMeta: {
    marginTop: 16,
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    color: PageColors.textGray300,
    fontSize: 14,
  },
  eventImageContainer: {
    width: 96,
    height: 96,
    borderRadius: 8,
    overflow: "hidden",
  },
  eventImage: {
    width: "100%",
    height: "100%",
  },
  ctaContainer: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  ctaText: {
    fontWeight: "600",
    fontSize: 18,
    color: PageColors.textWhite,
    textAlign: "center",
    lineHeight: 24,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: PageColors.textWhite,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  primaryButtonText: {
    color: PageColors.textBlack,
    fontWeight: "500",
    fontSize: 16,
  },
  ticketButtonContainer: {
    alignItems: "center",
    marginTop: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: PageColors.textWhite,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    position: "relative",
    width: "80%",
    maxWidth: 300,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  closeButtonText: {
    fontSize: 24,
    color: "#333",
  },
  qrMessageText: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#4B5563",
    fontSize: 14,
  },
  profilePicture: {
    width: 65,
    height: 65,
    borderRadius: 40,
    marginTop: 10,
    marginBottom: 10
  },
});

export default PartyLandingScreen;