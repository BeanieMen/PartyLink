import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  MapPin,
  PartyPopper,
  Clock,
  Ticket,
  Share2,
  Heart,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Colors, { API_BASE_URL } from '@/constants'
import { PartyRow } from '@/types/database'

const DboardColors = {
  primaryBg: '#1a0b2e',
  secondaryBg: '#2d1b4e',
  darkerBg: '#58216d',
  cardBg: 'rgba(58, 31, 93, 0.8)',
  inputBg: 'rgba(58, 31, 93, 0.7)',
  pink500: Colors.dark.pink500,
  textWhite: Colors.dark.text,
  textGray400: Colors.dark.gray400,
  textGray300: Colors.dark.gray300,
  borderColor: Colors.dark.gray500,
  greenText: '#48BB78',
  greenBg: 'rgba(72, 187, 120, 0.3)',
  redText: '#F56565',
  redBg: 'rgba(245, 101, 101, 0.3)',
}

const { width: screenWidth } = Dimensions.get('window')

const PartyDetailsScreen: React.FC = () => {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const [party, setParty] = useState<PartyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { userId } = useAuth()
  const loaderScale = useSharedValue(1)
  const loaderOpacity = useSharedValue(0.7)

  useEffect(() => {
    if (loading) {
      loaderScale.value = withRepeat(
        withTiming(1.2, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
      loaderOpacity.value = withRepeat(
        withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
    } else {
      loaderScale.value = withTiming(1)
      loaderOpacity.value = withTiming(1)
    }
  }, [loading, loaderScale, loaderOpacity])

  const animatedLoaderStyle = useAnimatedStyle(() => ({
    transform: [{ scale: loaderScale.value }],
    opacity: loaderOpacity.value,
  }))

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/')
      return
    }

    if (!id) return

    const fetchParty = async () => {
      try {
        setLoading(true)

        const cacheKey = `party_details_${id}`
        try {
          const cached = await AsyncStorage.getItem(cacheKey)
          if (cached) {
            setParty(JSON.parse(cached))
          }
        } catch {
          await AsyncStorage.removeItem(cacheKey)
        }

        const response = await fetch(`${API_BASE_URL}/party/${id}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch party: ${response.status}`)
        }

        const data = await response.json()

        setParty(data)
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data))
      } catch (err: any) {
        console.error('Error:', err)
        setError(`Failed to load party details: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    fetchParty()
  }, [id, isLoaded, isSignedIn, router])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || !id || !party) {
      if (isLoaded && !isSignedIn) {
        router.replace('/')
      }
      return
    }

    const checkAttendanceAndReroute = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/user/${userId}/parties-attending`)

        if (!response.ok) return
        const attendingPartyIds: { party_id: string }[] = await response.json()
        if (attendingPartyIds.map((row) => row.party_id).includes(id as string)) {
          router.replace(`/party/${id}/landing`)
        }
      } catch (err: any) {
        console.error('Error checking user attendance:', err)
      }
    }

    checkAttendanceAndReroute()
  }, [isLoaded, isSignedIn, userId, id, party, router])

  const handleAttend = async () => {
    if (!party || !userId) {
      Alert.alert('Error', 'Party details not loaded or user not identified.')
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/party/${party.party_id}/attend?userId=${userId}`,
      )

      const data = await response.json()

      if (response.ok && data.success) {
        Alert.alert('Success', data.message || "Successfully RSVP'd!")
        router.replace(`/party/${id}/landing`)
      } else {
        Alert.alert('RSVP Failed', data.message || 'Could not RSVP for the party.')
      }
    } catch (err: any) {
      console.error('Error updating attendance:', err)
      Alert.alert('Error', `Failed to RSVP: ${err.message}`)
    }
  }

  if (!isLoaded || (isLoaded && !isSignedIn)) {
    return (
      <LinearGradient
        colors={[DboardColors.primaryBg, DboardColors.secondaryBg, DboardColors.darkerBg]}
        style={styles.loaderContainer}
      >
        <Animated.View style={[styles.loaderContent, animatedLoaderStyle]}>
          <PartyPopper size={64} color={DboardColors.pink500} />
        </Animated.View>
        <Text style={styles.loaderText}>Loading PartyLink...</Text>
      </LinearGradient>
    )
  }

  if (loading && !party) {
    return (
      <LinearGradient
        colors={[DboardColors.primaryBg, DboardColors.secondaryBg, DboardColors.darkerBg]}
        style={styles.loaderContainer}
      >
        <Animated.View style={[styles.loaderContent, animatedLoaderStyle]}>
          <PartyPopper size={64} color={DboardColors.pink500} />
        </Animated.View>
        <Text style={styles.loaderText}>Getting the Party Ready...</Text>
      </LinearGradient>
    )
  }

  if (error) {
    return (
      <LinearGradient
        colors={[DboardColors.primaryBg, DboardColors.secondaryBg, DboardColors.darkerBg]}
        style={styles.errorContainer}
      >
        <View style={styles.errorContent}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.errorButton} onPress={() => router.push('/dashboard')}>
            <Text style={styles.errorButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    )
  }

  if (!party) {
    return (
      <LinearGradient
        colors={[DboardColors.primaryBg, DboardColors.secondaryBg, DboardColors.darkerBg]}
        style={styles.errorContainer}
      >
        <View style={styles.errorContent}>
          <Text style={styles.errorTitle}>Party Not Found</Text>
          <Text style={styles.errorMessage}>
            The party you&apos;re looking for doesn&apos;t exist or has been removed.
          </Text>
          <TouchableOpacity style={styles.errorButton} onPress={() => router.push('/dashboard')}>
            <Text style={styles.errorButtonText}>Explore Other Parties</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    )
  }

  return (
    <LinearGradient
      colors={[DboardColors.primaryBg, DboardColors.secondaryBg, DboardColors.darkerBg]}
      style={styles.container}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.heroContainer}>
        <Image
          source={{ uri: `${API_BASE_URL}/party/${party.party_id}/banner` }}
          style={styles.heroImage}
        />
        <View style={styles.heroGradient} />

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={DboardColors.textWhite} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.partyHeaderCard}>
          <Text style={styles.partyTitle}>{party.name}</Text>

          <View style={styles.partyMetaContainer}>
            <View style={styles.partyMetaItem}>
              <CalendarIcon size={18} color={DboardColors.pink500} style={styles.metaIcon} />
              <Text style={styles.metaText}>{party.party_date}</Text>
            </View>
            <View style={styles.partyMetaItem}>
              <Clock size={18} color={DboardColors.pink500} style={styles.metaIcon} />
              <Text style={styles.metaText}>{party.party_time || '8:00 PM'}</Text>
            </View>
            <View style={styles.partyMetaItem}>
              <MapPin size={18} color={DboardColors.pink500} style={styles.metaIcon} />
              <Text style={styles.metaText}>{party.location}</Text>
            </View>
          </View>
        </View>

        {screenWidth < 768 && (
          <View style={styles.ticketCard}>
            <View style={styles.ticketHeader}>
              <Text style={styles.ticketPrice}>$50</Text>
              <View
                style={[
                  styles.ticketBadge,
                  {
                    backgroundColor:
                      party.tickets_left > 0 ? DboardColors.greenBg : DboardColors.redBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.ticketBadgeText,
                    {
                      color: party.tickets_left > 0 ? DboardColors.greenText : DboardColors.redText,
                    },
                  ]}
                >
                  {party.tickets_left > 0 ? `${party.tickets_left} spots left` : 'Sold Out'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.attendButton,
                {
                  backgroundColor: party.tickets_left > 0 ? DboardColors.pink500 : '#4A5568',
                },
              ]}
              onPress={handleAttend}
              disabled={loading || party.tickets_left === 0}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ticket size={20} color={DboardColors.textWhite} style={{ marginRight: 8 }} />
                  <Text style={styles.attendButtonText}>
                    {party.tickets_left > 0 ? 'RSVP to Party' : 'Sold Out'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.descriptionCard}>
          <Text style={styles.sectionTitle}>About This Party</Text>
          <Text style={styles.descriptionText}>
            {party.description ||
              "Join us for an unforgettable night of music, dancing, and fun! This exclusive party brings together the best DJs, amazing drinks, and a crowd ready to celebrate. Don't miss out on the party of the year!"}
          </Text>
        </View>

        <View style={styles.locationCard}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Text style={styles.locationText}>{party.location}</Text>

          {/* Map Placeholder */}
          <View style={styles.mapPlaceholder}>
            <MapPin size={32} color={DboardColors.pink500} />
            <Text style={styles.mapPlaceholderText}>Map view will be displayed here</Text>
          </View>
        </View>

        {screenWidth >= 768 && (
          <View style={styles.ticketCard}>
            <View style={styles.ticketHeader}>
              <Text style={styles.ticketPrice}>$50</Text>
              <View
                style={[
                  styles.ticketBadge,
                  {
                    backgroundColor:
                      party.tickets_left > 0 ? DboardColors.greenBg : DboardColors.redBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.ticketBadgeText,
                    {
                      color: party.tickets_left > 0 ? DboardColors.greenText : DboardColors.redText,
                    },
                  ]}
                >
                  {party.tickets_left > 0 ? `${party.tickets_left} spots left` : 'Sold Out'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.attendButton,
                {
                  backgroundColor: party.tickets_left > 0 ? DboardColors.pink500 : '#4A5568',
                },
              ]}
              onPress={handleAttend}
              disabled={loading || party.tickets_left === 0}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ticket size={20} color={DboardColors.textWhite} style={{ marginRight: 8 }} />
                  <Text style={styles.attendButtonText}>
                    {party.tickets_left > 0 ? 'RSVP to Party' : 'Sold Out'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity style={styles.actionButton}>
                <Heart size={18} color={DboardColors.textGray300} style={{ marginRight: 8 }} />
                <Text style={styles.actionButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Share2 size={18} color={DboardColors.textGray300} style={{ marginRight: 8 }} />
                <Text style={styles.actionButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 20,
    fontSize: 18,
    color: DboardColors.textWhite,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorContent: {
    backgroundColor: DboardColors.cardBg,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: DboardColors.textWhite,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: DboardColors.textGray300,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: DboardColors.pink500,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  errorButtonText: {
    color: DboardColors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  heroContainer: {
    height: 280,
    width: '100%',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'transparent',
    shadowColor: DboardColors.primaryBg,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
    elevation: 20,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  contentContainer: {
    marginTop: -40,
    paddingHorizontal: 16,
  },
  partyHeaderCard: {
    backgroundColor: DboardColors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  partyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: DboardColors.textWhite,
    marginBottom: 16,
  },
  partyMetaContainer: {
    flexDirection: 'column',
  },
  partyMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaIcon: {
    marginRight: 8,
  },
  metaText: {
    fontSize: 14,
    color: DboardColors.textGray300,
  },
  ticketCard: {
    backgroundColor: DboardColors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ticketPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: DboardColors.textWhite,
  },
  ticketBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  ticketBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  attendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  attendButtonText: {
    color: DboardColors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DboardColors.secondaryBg,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: DboardColors.textGray300,
    fontSize: 14,
    fontWeight: '500',
  },
  descriptionCard: {
    backgroundColor: DboardColors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DboardColors.textWhite,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: DboardColors.textGray300,
  },
  locationCard: {
    backgroundColor: DboardColors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationText: {
    fontSize: 14,
    color: DboardColors.textGray300,
    marginBottom: 16,
  },
  mapPlaceholder: {
    height: 180,
    backgroundColor: '#4A5568',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  mapPlaceholderText: {
    color: DboardColors.textGray300,
    marginLeft: 8,
    fontSize: 14,
  },
})

export default PartyDetailsScreen
