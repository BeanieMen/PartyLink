import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
  Platform,
  Image
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import {
  MessageCirclePlus,
  UserCircle,
  BookOpen,
  Cake,
  GraduationCap,
  Link as LinkIcon,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'

import Colors, { API_BASE_URL } from '@/constants'
import { useAuth } from '@clerk/clerk-expo'

const AppColors = Colors.dark

export interface UserRow {
  user_id: string
  username: string
  description: string | null
  socials: string | null
  is_private: number // 0 for public, 1 for private
  created_at: string
  updated_at: string
}

interface ParsedDescription {
  bio: string
  age: string
  school: string
}

const parseUserDescription = (descriptionString: string | null): ParsedDescription => {
  const result: ParsedDescription = { bio: '', age: '', school: '' }
  if (!descriptionString) return result

  const parts = descriptionString.split(',')
  parts.forEach((part) => {
    const firstColonIndex = part.indexOf(':')
    if (firstColonIndex === -1) return;

    const key = part.substring(0, firstColonIndex)
    const value = part.substring(firstColonIndex + 1)

    if (key === 'description' && value) result.bio = value.trim()
    else if (key === 'age' && value) result.age = value.trim()
    else if (key === 'school' && value) result.school = value.trim()
  })
  return result
}

const UserProfileScreen: React.FC = () => {
  const router = useRouter()
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { userId: myUserId } = useAuth() // This is the current logged-in user's ID

  const [user, setUser] = useState<UserRow | null>(null)
  const [parsedDescription, setParsedDescription] = useState<ParsedDescription | null>(null)
  const [socialLinks, setSocialLinks] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // State to hold the chat session status
  const [chatStatus, setChatStatus] = useState<'none' | 'pending' | 'accepted' | 'declined' | null>(null);
  const [chatSessionId, setChatSessionId] = useState<string>()
  // Effect to fetch user data
  useEffect(() => {
    if (!userId) {
      setError('User ID is missing.')
      setIsLoading(false)
      return
    }

    const fetchUserData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE_URL}/user/${userId}`)
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('User not found.')
          }
          throw new Error(`Failed to fetch user data. Status: ${response.status}`)
        }
        const userData: UserRow = await response.json()
        setUser(userData)
        setParsedDescription(parseUserDescription(userData.description))
        setSocialLinks(userData.socials ? userData.socials.split(',').map(s => s.trim()).filter(s => s) : [])
      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred.')
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [userId])

  // Effect to fetch chat session status
  useEffect(() => {
    if (!userId || !myUserId || userId === myUserId) {
      // Don't fetch status if userId is missing, myUserId is missing, or it's the current user's profile
      setChatStatus('none'); // Assume 'none' if it's the current user's profile or missing IDs
      return;
    }

    const fetchChatStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/chat/status?user1_id=${myUserId}&user2_id=${userId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setChatStatus('none'); // No session found
          } else {
            // Log other errors but don't block the UI
            console.error(`Failed to fetch chat status: ${response.status}`);
            setChatStatus('none'); // Default to none on error
          }
          return;
        }
        const data = await response.json();
        setChatStatus(data.status);
        setChatSessionId(data.chatSessionId)
      } catch (e) {
        console.error('Error fetching chat status:', e);
        setChatStatus('none'); // Default to none on network error
      }
    };

    fetchChatStatus();
  }, [userId, myUserId]); // Re-run when userId or myUserId changes

  const handleRequestToChat = async () => {
    if (!userId || !myUserId) {
      Alert.alert('Error', 'User ID or your ID not available.')
      return
    }

    // Prevent sending request if already pending or accepted
    if (chatStatus === 'pending') {
      Alert.alert('Info', 'Chat request is already pending.');
      return;
    }
    if (chatStatus === 'accepted') {
      Alert.alert('Info', 'You are already chatting with this user.');
      // Optionally navigate to chat screen here
      router.push(`/chat/${chatSessionId}`);
      return;
    }

    try {
      // Set status to 'pending' immediately on the client side
      setChatStatus('pending');

      const response = await fetch(`${API_BASE_URL}/chat/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requester_user_id: myUserId, requestee_user_id: userId })
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // If API call fails, revert status or handle error gracefully
        setChatStatus('none'); // Or 'declined' if the API provides that context
        throw new Error(errorData.message || `Failed to send chat request. Status: ${response.status}`)
      }
      const responseData = await response.json();
      // The API response might confirm the status, but we already set it to 'pending'
      // If the API returns a different status (e.g., 'accepted' immediately), update it
      if (responseData.status) {
        setChatStatus(responseData.status);
      }
      Alert.alert('Success', 'Chat request sent successfully!');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send chat request.')
      setChatStatus('none'); // Revert status if there was an error
    }
  }

  const openLink = (url: string) => {
    let fullUrl = url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = `https://${url}`
    }
    Linking.canOpenURL(fullUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(fullUrl)
        } else {
          Alert.alert('Error', `Cannot open this URL: ${fullUrl}`)
        }
      })
      .catch(() => Alert.alert('Error', `Failed to try opening URL: ${fullUrl}`))
  }

  if (isLoading) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg]}
        style={styles.centeredStatusContainer}
      >
        <ActivityIndicator size="large" color={AppColors.pink500} />
        <Text style={styles.statusText}>Loading profile...</Text>
      </LinearGradient>
    )
  }

  if (error) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg]}
        style={styles.centeredStatusContainer}
      >
        <Stack.Screen
          options={{
            headerShown: false, // Hide default header
          }}
        />
        <View style={styles.topBackArrowContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={AppColors.white} />
          </TouchableOpacity>
        </View>
        <AlertCircle size={48} color={AppColors.gray400} />
        <Text style={styles.statusText}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    )
  }

  if (!user) {
    return (
      <LinearGradient
        colors={[AppColors.primaryBg, AppColors.secondaryBg]}
        style={styles.centeredStatusContainer}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.topBackArrowContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={AppColors.white} />
          </TouchableOpacity>
        </View>
        <UserCircle size={48} color={AppColors.gray400} />
        <Text style={styles.statusText}>User profile not available.</Text>
      </LinearGradient>
    )
  }

  // Determine if the profile has a "role" or a generic "actor" type
  const userRole = parsedDescription?.bio?.includes('Actor') ? 'Actor' : '';
  const ageString = parsedDescription?.age ? `${parsedDescription.age} years old` : '';
  const socialInstagram = socialLinks.find(link => link.includes('instagram.com') || link.includes('insta:'));
  const displayInstagram = socialInstagram ? `insta: ${socialInstagram.replace(/(https?:\/\/)?(www\.)?instagram\.com\//, '').replace(/\//g, '')}` : '';

  // Determine button text and style based on chat status
  let chatButtonText = 'Request to Chat';
  let chatButtonStyles = styles.requestedButton; // Default style
  let chatButtonTextStyle = styles.requestedButtonText;
  let isChatButtonDisabled = false;

  if (userId === myUserId) {
    // If it's the current user's own profile, hide the button
    chatButtonText = ''; // No text
    isChatButtonDisabled = true; // Disable it
  } else if (chatStatus === 'pending') {
    chatButtonText = 'Requested';
    chatButtonStyles = { ...styles.requestedButton, backgroundColor: AppColors.gray400 }; // Change color
    chatButtonTextStyle = { ...styles.requestedButtonText, color: AppColors.white }; // Change text color
    isChatButtonDisabled = true; // Disable button
  } else if (chatStatus === 'accepted') {
    chatButtonText = 'Chat Now';
    chatButtonStyles = { ...styles.requestedButton, backgroundColor: AppColors.blue500 }; // Different color for accepted
    chatButtonTextStyle = { ...styles.requestedButtonText, color: AppColors.white };
    isChatButtonDisabled = false; // Allow clicking to chat
  } else if (chatStatus === 'declined') {
    chatButtonText = 'Request Again';
    chatButtonStyles = { ...styles.requestedButton, backgroundColor: AppColors.pink500 }; // Allow requesting again
    chatButtonTextStyle = { ...styles.requestedButtonText, color: AppColors.white };
    isChatButtonDisabled = false;
  }


  return (
    <LinearGradient
      colors={['#3A2E5B', '#3A2E5B']} // Solid deep purple for the background
      style={styles.outerContainer}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBackArrowContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.cardHeader}>
          <Image
            source={{ uri: `${API_BASE_URL}/user/${userId}/profile-picture` || 'https://via.placeholder.com/100/A020F0/FFFFFF?text=P' }}
            style={styles.smallAvatar}
          />
          {/* Conditionally render and style the chat request button */}
          {chatButtonText !== '' && ( // Only show if not empty (i.e., not self-profile)
            <TouchableOpacity
              onPress={handleRequestToChat}
              style={chatButtonStyles}
              disabled={isChatButtonDisabled}
            >
              <Text style={chatButtonTextStyle}>{chatButtonText}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.userInfoSection}>
          <Text style={styles.username}>{user.username}</Text>
          {/* Display school right below username */}
          {parsedDescription?.school ? <Text style={styles.userDetailText}>{parsedDescription.school}</Text> : null}
          {userRole ? <Text style={styles.userRole}>{userRole}</Text> : null}
          {ageString ? <Text style={styles.userDetailText}>{ageString}</Text> : null}
          {displayInstagram ? (
            <TouchableOpacity onPress={() => openLink(socialInstagram!)}>
              <Text style={styles.userDetailText}>{displayInstagram}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.mainPortraitContainer}>
          <Image
            source={{ uri: `${API_BASE_URL}/user/${userId}/portrait` || 'https://via.placeholder.com/300/A020F0/FFFFFF?text=Portrait' }}
            style={styles.mainPortrait}
          />
        </View>

        {parsedDescription?.bio && !userRole && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <BookOpen size={20} color={AppColors.blue500} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>About Me</Text>
            </View>
            <Text style={styles.sectionContentText}>{parsedDescription.bio}</Text>
          </View>
        )}

        {(parsedDescription?.age || parsedDescription?.school) && (!ageString && !parsedDescription?.school) && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              {(parsedDescription?.age && !parsedDescription?.school) && <Cake size={20} color={AppColors.blue500} style={styles.sectionIcon} />}
              {(!parsedDescription?.age && parsedDescription?.school) && <GraduationCap size={20} color={AppColors.blue500} style={styles.sectionIcon} />}
              {(parsedDescription?.age && parsedDescription?.school) && <UserCircle size={20} color={AppColors.blue500} style={styles.sectionIcon} />}
              <Text style={styles.sectionTitle}>Details</Text>
            </View>
            {parsedDescription.age && (
              <View style={styles.detailItem}>
                <Cake size={18} color={AppColors.gray300} style={styles.detailIcon} />
                <Text style={styles.sectionContentText}>Age: {parsedDescription.age}</Text>
              </View>
            )}
            {parsedDescription.school && (
              <View style={styles.detailItem}>
                <GraduationCap size={18} color={AppColors.gray300} style={styles.detailIcon} />
                <Text style={styles.sectionContentText}>School: {parsedDescription.school}</Text>
              </View>
            )}
          </View>
        )}

        {socialLinks.length > 0 && !displayInstagram && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <LinkIcon size={20} color={AppColors.blue500} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Connect</Text>
            </View>
            {socialLinks.map((link, index) => (
              <TouchableOpacity key={index} onPress={() => openLink(link)} style={styles.socialLinkItem}>
                <LinkIcon size={16} color={AppColors.pink500} style={styles.detailIcon} />
                <Text style={styles.socialLinkText} numberOfLines={1}>{link}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>Joined: {new Date(user.created_at).toLocaleDateString()}</Text>
        </View>

      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 30 : 50,
  },
  topBackArrowContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingRight: 10,
  },
  backButtonText: {
    color: AppColors.white,
    fontSize: 16,
    marginLeft: 5,
  },
  profileCard: {
    flex: 1,
    backgroundColor: '#3A2E5B',
    borderRadius: 30,
    paddingBottom: 20,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 20,
  },
  smallAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: AppColors.white,
  },
  requestedButton: {
    backgroundColor: AppColors.white,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  requestedButtonText: {
    color: '#3A2E5B',
    fontWeight: 'bold',
    fontSize: 14,
  },
  userInfoSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  username: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: 5,
  },
  userRole: {
    fontSize: 18,
    color: AppColors.gray300,
    marginBottom: 5,
  },
  userDetailText: {
    fontSize: 16,
    color: AppColors.gray300,
    marginBottom: 3,
  },
  mainPortraitContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  mainPortrait: {
    width: '100%',
    aspectRatio: 1 / 1,
    borderRadius: 15,
  },
  centeredStatusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusText: {
    marginTop: 15,
    fontSize: 18,
    color: AppColors.gray300,
    textAlign: 'center',
  },
  errorButton: {
    marginTop: 20,
    backgroundColor: AppColors.pink500,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  errorButtonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContainer: {
    backgroundColor: AppColors.cardBg,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionIcon: {
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: AppColors.white,
  },
  sectionContentText: {
    fontSize: 16,
    color: AppColors.gray300,
    lineHeight: 24,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailIcon: {
    marginRight: 10,
  },
  socialLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.inputBg,
  },
  socialLinkText: {
    fontSize: 15,
    color: AppColors.pink500,
    flexShrink: 1,
  },
  footerInfo: {
    marginTop: 10,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: AppColors.gray400,
  }
})

export default UserProfileScreen