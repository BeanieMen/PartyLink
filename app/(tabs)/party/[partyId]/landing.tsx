import React, { useEffect, useState } from 'react'
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
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { ArrowLeft, CalendarDays, MapPin, Clock } from 'lucide-react-native'
import QRCodeSVG from 'react-native-qrcode-svg'
import Colors, { API_BASE_URL } from '@/constants'
import { PartyRow, UserRow, GroupRow } from '@/types/database'

const AppColors = Colors.dark
const { width: screenWidth } = Dimensions.get('window')

const PartyLandingScreen: React.FC = () => {
  const { partyId } = useLocalSearchParams<{ partyId: string }>()
  const router = useRouter()
  const [party, setParty] = useState<PartyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrValue, setQrValue] = useState('')
  const [showQR, setShowQR] = useState(false)
  const { isSignedIn, isLoaded: userLoaded } = useUser()
  const { userId, isLoaded: authLoaded } = useAuth()
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserRow | null>(null)
  const [userGroup, setUserGroup] = useState<GroupRow | undefined>(undefined)
  const [checkingGroup, setCheckingGroup] = useState(true)

  useEffect(() => {
    if (!partyId) {
      setLoading(false)
      console.error('Party ID is missing')
      return
    }

    if (!userLoaded || !authLoaded) {
      return
    }

    fetch(`${API_BASE_URL}/party/${partyId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch party: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        setParty(data)
      })
      .catch(console.error)

    if (isSignedIn && userId) {
      fetch(`${API_BASE_URL}/user/${userId}`)
        .then((res) => {
          if (!res.ok) {
            console.warn(`User ${userId} not found in DB, proceeding without user details.`)
            return null
          }
          return res.json()
        })
        .then((data: UserRow | null) => {
          setCurrentUser(data)
        })
        .catch(console.error)

      setCheckingGroup(true)
      fetch(`${API_BASE_URL}/user/${userId}/party/${partyId}/group`)
        .then((res) => {
          if (res.status === 404) {
            return null
          }
          if (!res.ok) {
            throw new Error(`Failed to fetch user group: ${res.status}`)
          }
          return res.json()
        })
        .then((data: GroupRow | undefined) => {
          setUserGroup(data)
        })
        .catch(console.error)
        .finally(() => {
          setCheckingGroup(false)
          setLoading(false)
        })
    } else {
      setCheckingGroup(false)
      setLoading(false)
    }
  }, [partyId, userLoaded, authLoaded, userId, isSignedIn])

  const handleTicket = () => {
    if (!partyId) return
    const userIdPart = currentUser?.user_id || (isSignedIn ? userId : 'guest')
    const code = `${partyId}-${userIdPart}`
    setQrValue(code)
    setShowQR(true)
  }

  const handleCreateGroup = async () => {
    if (!isSignedIn || !userId || !partyId || !currentUser) {
      Alert.alert('Error', 'You must be signed in and user data loaded to create a group.')
      return
    }
    setIsCreatingGroup(true)
    try {
      const response = await fetch(`${API_BASE_URL}/party/${partyId}/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creator_user_id: userId,
          creator_username: currentUser.username,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to create group: ${response.status}`)
      }

      const newGroup = await response.json()

      if (newGroup && newGroup.group_id) {
        router.replace(`/party/${partyId}/groups`)
      } else {
        throw new Error('Group ID not returned from API.')
      }
    } catch (error) {
      console.error('Create Group Error:', error)
      Alert.alert(
        'Error Creating Group',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      )
    } finally {
      setIsCreatingGroup(false)
    }
  }

  const handleViewYourGroup = () => {
    if (userGroup?.group_id) {
      router.push(`/party/${partyId}/groups`)
    } else {
      Alert.alert('Error', 'Could not find your group details.')
    }
  }

  const handleExploreScene = () => {
    router.push(`/party/${partyId}/groups/explore`)
  }

  if (loading || checkingGroup) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={AppColors.white} />
        <Text style={styles.loaderText}>Loading party details...</Text>
      </View>
    )
  }

  if (!party) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>Party details could not be loaded.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonContainerError}>
          <ArrowLeft size={20} color={AppColors.white} />
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonContainer}>
          <ArrowLeft size={20} color={AppColors.gray300} />
          <Text style={styles.backButtonText}>Back to Events</Text>
        </TouchableOpacity>
      </View>

      {isSignedIn && userId && currentUser && (
        <View style={styles.profileHeader}>
          <View style={styles.userButtonWrapper}>
            <Image
              source={{ uri: `${API_BASE_URL}/user/${userId}/profile-picture` }}
              style={styles.profilePicture}
              onError={(e) => console.log('Profile Image Load Error:', e.nativeEvent.error)}
            />
          </View>
        </View>
      )}

      <View style={styles.eventSummaryCard}>
        <View style={styles.eventDetails}>
          <Text style={styles.eventName}>{party.name.toUpperCase()}</Text>
          <View style={styles.eventMeta}>
            <View style={styles.metaItem}>
              <CalendarDays size={18} color={AppColors.gray300} />
              <Text style={styles.metaText}>{party.party_date}</Text>
            </View>
            <View style={styles.metaItem}>
              <MapPin size={18} color={AppColors.gray300} />
              <Text style={styles.metaText}>{party.location}</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={18} color={AppColors.gray300} />
              <Text style={styles.metaText}>{party.party_time || '6:00 PM'}</Text>
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
        {userGroup ? (
          <>
            <Text style={styles.ctaText}>You are already part of a group for this party!</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleViewYourGroup}>
              <Text style={styles.primaryButtonText}>View Your Group</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleExploreScene}>
              <Text style={styles.primaryButtonText}>Explore the Scene</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.ctaText}>
              Before Connecting With Others,
              {'\n'}
              Establish Who You are Going With!
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, isCreatingGroup && styles.disabledButton]}
              onPress={handleCreateGroup}
              disabled={isCreatingGroup}
            >
              {isCreatingGroup ? (
                <ActivityIndicator color={AppColors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Create Group</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                router.push(`/party/${partyId}/groups/join`)
              }}
            >
              <Text style={styles.primaryButtonText}>Join Group</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.ticketButtonContainer}>
        <TouchableOpacity onPress={handleTicket} style={styles.primaryButton}>
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
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowQR(false)}>
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContentContainer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background,
  },
  loaderText: {
    marginTop: 10,
    fontSize: 16,
    color: AppColors.white,
  },
  errorText: {
    fontSize: 18,
    color: AppColors.white,
    textAlign: 'center',
    marginBottom: 20,
  },
  headerActions: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
  },
  backButtonContainerError: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: AppColors.cardBg,
    borderRadius: 25,
    marginTop: 20,
  },
  backButtonText: {
    marginLeft: 6,
    color: AppColors.gray300,
    fontSize: 14,
    fontWeight: '500',
  },
  profileHeader: {
    width: '100%',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  userButtonWrapper: {},
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: AppColors.gray300,
  },
  eventSummaryCard: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    marginHorizontal: 20,
    width: screenWidth - 40,
    overflow: 'hidden',
    marginBottom: 30,
    elevation: 5,
    shadowColor: AppColors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  eventImageContainer: {
    width: '100%',
    height: 180,
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  eventDetails: {
    padding: 20,
  },
  eventName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: 15,
  },
  eventMeta: {},
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 15,
    color: AppColors.gray300,
    marginLeft: 10,
  },
  ctaContainer: {
    width: '100%',
    paddingHorizontal: 30,
    alignItems: 'center',
    marginBottom: 30,
  },
  ctaText: {
    fontSize: 16,
    color: AppColors.gray300,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: AppColors.primaryBg,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    marginBottom: 15,
    minHeight: 50,
  },
  disabledButton: {
    backgroundColor: AppColors.gray600,
  },
  primaryButtonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  ticketButtonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: AppColors.cardBg,
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    width: '85%',
    maxWidth: 350,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 15,
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: AppColors.white,
    fontWeight: 'bold',
  },
  qrMessageText: {
    marginTop: 20,
    fontSize: 18,
    color: AppColors.white,
    textAlign: 'center',
  },
})

export default PartyLandingScreen
