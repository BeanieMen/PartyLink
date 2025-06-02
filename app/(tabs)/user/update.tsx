import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Camera,
  CheckCircle,
  Save,
  UserCircle,
  Edit3,
  ShieldQuestion,
  User,
  CalendarDays,
  Briefcase,
  Link2, // Use Link2 for generic social links
  Image as ImageIcon,
  ArrowLeft,
} from 'lucide-react-native'
import Spinner from 'react-native-loading-spinner-overlay'

import Colors, { API_BASE_URL } from '@/constants'
import InfoPopup from '@/components/InfoPopup'
import { UserRow } from '@/types/database'

interface UserProfileData {
  username: string
  profile_picture_url?: string
  age?: number | string
  school?: string
  portrait_picture_url?: string
  socials?: string
  is_private?: boolean
}

const EditProfileScreen = () => {
  const router = useRouter()
  const { userId, isSignedIn, isLoaded } = useAuth()

  const [currentUsername, setCurrentUsername] = useState('')
  // Removed instagramLink state

  const [profileImage, setProfileImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)

  const [age, setAge] = useState('')
  const [school, setSchool] = useState('')
  const [portraitImage, setPortraitImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [portraitImageUri, setPortraitImageUri] = useState<string | null>(null)
  const [socialsInput, setSocialsInput] = useState('') // This will now hold ALL social links
  const [isPrivate, setIsPrivate] = useState(false)
  const [isPrivateInfoPopupVisible, setIsPrivateInfoPopupVisible] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialDataLoaded, setInitialDataLoaded] = useState(false)

  // Helper to capitalize words in a string
  const capitalizeWords = useCallback((str: string) => {
    if (!str) return '' // Handle null/undefined input
    return str
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }, [])

  const parseUserDescription = useCallback((descriptionString: string | null) => {
    const result = { age: '', school: '' }
    if (!descriptionString) return result

    const parts = descriptionString.split(',')
    parts.forEach((part) => {
      const firstColonIndex = part.indexOf(':')
      if (firstColonIndex === -1) return

      const key = part.substring(0, firstColonIndex).trim()
      const value = part.substring(firstColonIndex + 1).trim()

      if (key === 'age') result.age = value || '' // Ensure empty string if value is null/undefined
      else if (key === 'school') result.school = value || '' // Ensure empty string if value is null/undefined
    })
    return result
  }, [])

  const fetchProfileData = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/user/${userId}`)
      if (response.ok) {
        const data: UserRow = await response.json()

        setCurrentUsername(data.username ?? '')


        const userDescParsed = parseUserDescription(data.description)
        setAge(userDescParsed.age ?? '')
        setSchool(userDescParsed.school ?? '')


        // All socials now go into socialsInput, no special instagram handling
        setSocialsInput(data.socials ?? '')

        setProfileImageUri(
          data.user_id
            ? `${API_BASE_URL}/user/${data.user_id}/profile-picture?timestamp=${new Date().getTime()}`
            : null,
        )
        setPortraitImageUri(
          data.user_id
            ? `${API_BASE_URL}/user/${data.user_id}/portrait?timestamp=${new Date().getTime()}`
            : null,
        )

        setIsPrivate(data.is_private == 1)
        setInitialDataLoaded(true)
      } else if (response.status === 404) {
        Alert.alert(
          'Profile Not Found',
          'No profile data exists for this user. You might need to create one.',
          [{ text: 'OK', onPress: () => router.replace('/create-profile') }],
        )
      } else {
        const errData = await response.json()
        setError(errData.message || 'Failed to load profile data.')
        Alert.alert('Error', errData.message || 'Failed to load profile data.')
      }
    } catch (e: any) {
      console.error('Fetch Profile Error:', e)
      setError('Could not connect to the server or an unexpected error occurred.')
      Alert.alert(
        'Error',
        'Could not connect to the server or an unexpected error occurred. Please check your internet connection.',
      )
    } finally {
      setLoading(false)
    }
  }, [userId, router, parseUserDescription])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn || !userId) {
      router.replace('/')
      return
    }
    fetchProfileData()
  }, [isLoaded, isSignedIn, userId, fetchProfileData, router])

  const pickImage = async (type: 'profile' | 'portrait') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!')
      return
    }

    const aspect: [number, number] = type === 'profile' ? [1, 1] : [3, 4]
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'Images' as ImagePicker.MediaType,
      allowsEditing: true,
      aspect: aspect,
      quality: 0.7,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (type === 'profile') {
        setProfileImage(result.assets[0])
        setProfileImageUri(result.assets[0].uri)
      } else {
        setPortraitImage(result.assets[0])
        setPortraitImageUri(result.assets[0].uri)
      }
    }
  }

  const handleUpdateProfile = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please try logging in again.')
      return
    }

    if (!currentUsername.trim()) {
      Alert.alert('Validation Error', 'Username is required.')
      return
    }

    if (!age.trim()) {
      Alert.alert('Validation Error', 'Age is required.')
      return
    }
    const ageNum = parseInt(age, 10)
    if (isNaN(ageNum) || ageNum <= 10 || ageNum > 100) {
      Alert.alert('Validation Error', 'Please enter a valid age (e.g., 10-100).')
      return
    }

    setSaving(true)
    setError(null)

    const formData = new FormData()
    formData.append('userId', userId)
    formData.append('username', capitalizeWords(currentUsername.trim()))

    // Assuming age and school are now directly updated as separate fields on the backend
    formData.append('age', age.trim())
    formData.append('school', school.trim())

    let finalSocialsArray: string[] = []
    if (socialsInput.trim()) {
      const parsedLinks = socialsInput
        .split(/[\s,;\n]+/) // Split by comma, space, semicolon, or newline
        .map((link) => link.trim())
        .filter(
          (link) =>
            link.length > 0 &&
            (link.startsWith('http://') ||
              link.startsWith('https://') ||
              /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}([:/?#].*)?$/.test(link)), // Basic URL validation
        )
      finalSocialsArray.push(...parsedLinks)
    }
    finalSocialsArray = [...new Set(finalSocialsArray)] // Remove duplicates

    if (finalSocialsArray.length > 0) {
      formData.append('socials', finalSocialsArray.join(','))
    } else {
      formData.append('socials', '')
    }

    formData.append('is_private', isPrivate ? 'true' : 'false')

    if (profileImage && profileImage.uri) {
      const uriParts = profileImage.uri.split('.')
      const fileType = uriParts[uriParts.length - 1]
      const fileName = profileImage.fileName || `profile_${userId}.${fileType}`
      formData.append('profilePicture', {
        uri: Platform.OS === 'android' ? profileImage.uri : profileImage.uri.replace('file://', ''),
        name: fileName,
        type: profileImage.mimeType || `image/${fileType}`,
      } as any)
    }

    if (portraitImage && portraitImage.uri) {
      const uriParts = portraitImage.uri.split('.')
      const fileType = uriParts[uriParts.length - 1]
      const fileName = portraitImage.fileName || `portrait_${userId}.${fileType}`
      formData.append('portraitPicture', {
        uri:
          Platform.OS === 'android' ? portraitImage.uri : portraitImage.uri.replace('file://', ''),
        name: fileName,
        type: portraitImage.mimeType || `image/${fileType}`,
      } as any)
    }

    try {
      const response = await fetch(`${API_BASE_URL}/user/profile/update`, {
        method: 'POST',
        body: formData,
        headers: {
          // 'Content-Type': 'multipart/form-data', // Fetch usually sets this automatically for FormData
        },
      })

      const responseData = await response.json()

      if (response.ok && responseData.success) {
        Alert.alert('Profile Updated!', 'Your changes have been saved.')
        setTimeout(() => fetchProfileData(), 500)
      } else {
        setError(responseData.message || responseData.error || 'Failed to update profile.')
        Alert.alert(
          'Error',
          responseData.message || responseData.error || 'An unknown error occurred.',
        )
      }
    } catch (e: any) {
      console.error('Save Profile Error:', e)
      setError(e.message || 'An unexpected error occurred.')
      Alert.alert('Error', 'Could not connect to the server or an unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  // Placeholder for username input if it's empty
  const usernamePlaceholder = currentUsername.trim() === '' ? 'Your Username' : '';

  if (loading && !initialDataLoaded) {
    return (
      <LinearGradient
        colors={[Colors.dark.primaryBg, Colors.dark.secondaryBg]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={Colors.dark.pink500} />
        <Text style={{ color: Colors.dark.text, marginTop: 10 }}>Loading Profile...</Text>
      </LinearGradient>
    )
  }

  const privateInfoContent = (
    <>
      <Text style={styles.popupText}>
        When your account is <Text style={{ fontWeight: 'bold' }}>private</Text>, your profile and
        activity will only be visible to:
      </Text>
      <Text style={styles.popupList}>• Users you are friends with.</Text>
      <Text style={styles.popupList}>
        • Members of groups you have matched with and are in a group chat with.
      </Text>
      <Text style={styles.popupText}>
        If your account is <Text style={{ fontWeight: 'bold' }}>public</Text>, your profile will be
        visible to all users on the platform.
      </Text>
    </>
  )

  const renderLabel = (text: string, IconComponent?: any, iconSize = 16) => (
    <View style={styles.labelContainer}>
      {IconComponent && (
        <IconComponent size={iconSize} color={Colors.dark.gray200} style={styles.labelIcon} />
      )}
      <Text style={styles.label}>{text}</Text>
    </View>
  )

  return (
    <LinearGradient
      colors={[Colors.dark.primaryBg, Colors.dark.secondaryBg, Colors.dark.darkerBg]}
      style={styles.gradientContainer}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={Colors.dark.gray200} />
            </TouchableOpacity>
            <Edit3 size={40} color={Colors.dark.pink500} />
            <Text style={styles.title}>Edit Profile</Text>
            <Text style={styles.subtitle}>Manage your PartyLink identity.</Text>
          </View>

          {/* --- Section: Visuals --- */}
          <View style={styles.dashboardSection}>
            <Text style={styles.sectionTitle}>Avatar & Portrait</Text>
            <View style={styles.visualsRow}>
              <TouchableOpacity onPress={() => pickImage('profile')} style={styles.imagePicker}>
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} style={styles.profileImagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Camera size={30} color={Colors.dark.gray300} />
                    <Text style={styles.imagePickerTextSmall}>Profile Pic</Text>
                  </View>
                )}
                <View style={styles.editOverlay}>
                  <ImageIcon size={16} color={Colors.dark.white} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => pickImage('portrait')}
                style={styles.portraitImagePicker}
              >
                {portraitImageUri ? (
                  <Image source={{ uri: portraitImageUri }} style={styles.portraitImagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <UserCircle size={30} color={Colors.dark.gray300} />
                    <Text style={styles.imagePickerTextSmall}>Portrait Pic</Text>
                    <Text style={styles.imagePickerSubtextSmall}>(3:4)</Text>
                  </View>
                )}
                <View style={styles.editOverlay}>
                  <ImageIcon size={16} color={Colors.dark.white} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* --- Section: Basic Information --- */}
          <View style={styles.dashboardSection}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <View style={styles.inputGroup}>
              {renderLabel('Name (Username)', User)}
              <TextInput
                style={styles.input}
                value={currentUsername}
                onChangeText={setCurrentUsername}
                editable={true}
                placeholder={usernamePlaceholder}
                placeholderTextColor={Colors.dark.gray400}
                autoCapitalize="words"
              />
              <Text style={styles.inputHint}>Your unique identifier on PartyLink.</Text>
            </View>

            <View style={styles.inputGroup}>
              {renderLabel('Age*', CalendarDays)}
              <TextInput
                style={styles.input}
                placeholder="e.g., 21"
                value={age}
                onChangeText={setAge}
                placeholderTextColor={Colors.dark.gray400}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>

            <View style={styles.inputGroup}>
              {renderLabel('Career/School', Briefcase)}
              <TextInput
                style={styles.input}
                placeholder="e.g., Software Engineer or State University"
                value={school}
                onChangeText={setSchool}
                placeholderTextColor={Colors.dark.gray400}
                autoCapitalize="words"
              />
            </View>

            {/* --- Social Links --- */}
            <View style={styles.socialLinksSection}>
              <Text style={styles.sectionTitle}>Social Links</Text>
              <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                {renderLabel('Your Social Media Links', Link2)} {/* Generic label */}
                <TextInput
                  style={[styles.input]}
                  placeholder="e.g., instagram.com/user, twitter.com/user, tiktok.com/@user" // Updated placeholder
                  value={socialsInput}
                  onChangeText={setSocialsInput}
                  placeholderTextColor={Colors.dark.gray400}
                  multiline
                  numberOfLines={4}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <Text style={styles.inputHint}>
                  Enter full URLs for your social media profiles. Separate multiple links with a
                  comma, space, or new line.
                </Text>
              </View>
            </View>
            {/* --- End Social Links Section --- */}
          </View>

          {/* --- Section: Account Settings --- */}
          <View style={styles.dashboardSection}>
            <Text style={styles.sectionTitle}>Account Settings</Text>
            <View style={[styles.inputGroup, styles.privateToggleContainer]}>
              <TouchableOpacity
                onPress={() => setIsPrivate(!isPrivate)}
                style={[styles.checkbox, isPrivate && styles.checkboxChecked]}
              >
                {isPrivate && <CheckCircle size={18} color={Colors.dark.pink500} />}
              </TouchableOpacity>
              <Text style={styles.privateToggleText}>Make my account private</Text>
              <TouchableOpacity
                onPress={() => setIsPrivateInfoPopupVisible(true)}
                style={styles.helpButton}
              >
                <ShieldQuestion size={20} color={Colors.dark.gray300} />
              </TouchableOpacity>
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.saveButton, (saving || loading) && styles.saveButtonDisabled]}
            onPress={handleUpdateProfile}
            disabled={saving || loading}
          >
            {saving ? (
              <ActivityIndicator color={Colors.dark.white} />
            ) : (
              <>
                <Save size={20} color={Colors.dark.white} style={{ marginRight: 10 }} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Spinner
        visible={saving || (loading && !initialDataLoaded)}
        textContent={saving ? 'Saving Profile...' : 'Loading Profile...'}
        textStyle={styles.spinnerTextStyle}
        overlayColor="rgba(0,0,0,0.75)"
        animation="fade"
      />

      <InfoPopup
        isVisible={isPrivateInfoPopupVisible}
        onClose={() => setIsPrivateInfoPopupVisible(false)}
        title="About Private Accounts"
        content={privateInfoContent}
      />
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 20 : 20,
    paddingBottom: 40,
    paddingHorizontal: 15,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 25,
    width: '100%',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    padding: 10,
    zIndex: 1,
    top: Platform.OS === 'ios' ? 0 : 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginTop: 12,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.gray300,
    textAlign: 'center',
    marginBottom: 15,
  },
  dashboardSection: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: Colors.dark.inputBg,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.gray700,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.gray600,
  },
  visualsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 10,
  },
  imagePicker: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.dark.gray800,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.pink300,
    overflow: 'hidden',
    position: 'relative',
  },
  profileImagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 55,
  },
  portraitImagePicker: {
    width: 110,
    aspectRatio: 3 / 4,
    backgroundColor: Colors.dark.gray800,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.blue300,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  portraitImagePreview: {
    width: '100%',
    height: '100%',
  },
  editOverlay: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
    width: '100%',
    height: '100%',
    borderRadius: 55,
  },
  imagePickerTextSmall: {
    marginTop: 6,
    color: Colors.dark.gray400,
    fontSize: 12,
    textAlign: 'center',
  },
  imagePickerSubtextSmall: {
    marginTop: 2,
    color: Colors.dark.gray500,
    fontSize: 10,
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelIcon: {
    marginRight: 8,
  },
  label: {
    fontSize: 15,
    color: Colors.dark.gray200,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.dark.gray800,
    color: Colors.dark.text,
    height: 52,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.gray600,
  },
  readOnlyInput: {
    backgroundColor: Colors.dark.gray700,
    color: Colors.dark.gray300,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.dark.gray400,
    marginTop: 6,
    marginLeft: 2,
  },
  textArea: {
    textAlignVertical: 'top',
    paddingTop: 15,
  },
  socialLinksSection: {
    marginTop: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.gray600,
  },
  privateToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.gray500,
    backgroundColor: Colors.dark.gray700,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: Colors.dark.pink500,
    backgroundColor: Colors.dark.gray800,
  },
  privateToggleText: {
    color: Colors.dark.gray200,
    fontSize: 15,
    flex: 1,
  },
  helpButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 20,
  },
  saveButton: {
    backgroundColor: Colors.dark.pink500,
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 450,
    marginTop: 20,
    shadowColor: Colors.dark.pink700,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.dark.pink300,
    elevation: 0,
    shadowOpacity: 0,
  },
  saveButtonText: {
    color: Colors.dark.white,
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.dark.red,
    textAlign: 'center',
    marginBottom: 15,
    width: '100%',
    maxWidth: 450,
  },
  spinnerTextStyle: {
    color: '#FFF',
    fontSize: 16,
  },
  popupText: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'left',
    color: Colors.dark.gray200,
    lineHeight: 23,
  },
  popupList: {
    fontSize: 15,
    marginBottom: 8,
    textAlign: 'left',
    color: Colors.dark.gray300,
    lineHeight: 21,
    marginLeft: 10,
  },
})

export default EditProfileScreen