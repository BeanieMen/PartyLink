import React, { useState, useEffect } from 'react'
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
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { Camera, CheckCircle, Save, UserCircle, HelpCircle, LogOut } from 'lucide-react-native'
import Spinner from 'react-native-loading-spinner-overlay'

import Colors, { API_BASE_URL } from '@/constants'
import InfoPopup from '@/components/InfoPopup';

const CreateProfileScreen = () => {
  const router = useRouter()
  const { userId, isSignedIn, isLoaded, signOut } = useAuth()

  const [username, setUsername] = useState('')
  // Removed description state
  const [profileImage, setProfileImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)

  const [age, setAge] = useState('')
  const [school, setSchool] = useState('')
  const [portraitImage, setPortraitImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [portraitImageUri, setPortraitImageUri] = useState<string | null>(null)
  const [socialsInput, setSocialsInput] = useState('') // Consolidated social links
  const [isPrivate, setIsPrivate] = useState(false)
  const [isPrivateInfoPopupVisible, setIsPrivateInfoPopupVisible] = useState(false);

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      if (!isLoaded) return;

      if (!isSignedIn || !userId) {
        router.replace('/');
        return;
      }
      try {
        const userRes = await fetch(`${API_BASE_URL}/user/${userId}`);
        if (userRes.ok && userRes.headers.get("content-type")?.includes("application/json")) {
          const userData = await userRes.json();
          if (userData && (Object.keys(userData).length > 1 || userData.username)) {
            router.replace('/dashboard');
          }
        } else if (userRes.status === 404) {
          // User not found, proceed to create profile
        } else {
          console.warn("Failed to fetch user data or unexpected response format:", userRes.status);
        }
      } catch (e) {
        console.error("Error checking user status:", e);
      }
    }
    checkStatus()
  }, [isLoaded, isSignedIn, userId, router])

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!')
      return
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Corrected type
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfileImage(result.assets[0])
      setProfileImageUri(result.assets[0].uri)
    }
  }

  const pickPortraitImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!')
      return
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Corrected type
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setPortraitImage(result.assets[0])
      setPortraitImageUri(result.assets[0].uri)
    }
  }

  const validateUsername = (uname: string) => {
    if (!uname.trim()) return 'Name is required.'
    if (/\s/.test(uname)) return 'Name cannot contain spaces.' // Assuming "Name" implies a single word like username
    if (uname.length < 3) return 'Name must be at least 3 characters long.'
    if (uname.length > 20) return 'Name cannot exceed 20 characters.'
    return null
  }

  const handleSaveProfile = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please try logging in again.')
      return
    }

    // Validation for required fields
    const usernameError = validateUsername(username)
    if (usernameError) {
      Alert.alert('Validation Error', usernameError)
      return
    }

    if (!profileImageUri) {
      Alert.alert('Validation Error', 'Profile Picture (Avatar) is required.')
      return
    }

    if (!portraitImageUri) {
      Alert.alert('Validation Error', 'Portrait Picture is required.')
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('userId', userId)
    formData.append('username', username.trim().toLowerCase()) // Keep lowercase for storage/lookup

    if (age.trim()) {
      const ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum <= 10 || ageNum > 100) {
        Alert.alert('Validation Error', 'Please enter a valid age (e.g., 10-100), or leave it blank.');
        setLoading(false);
        return;
      }
      formData.append('age', age.trim());
    }

    // description is removed
    if (school.trim()) formData.append('school', school.trim());

    if (socialsInput.trim()) {
      const linksArray = socialsInput
        .split(/[\s,;\n]+/)
        .map(link => link.trim())
        .filter(
          link =>
            link.length > 0 &&
            (link.startsWith('http://') ||
              link.startsWith('https://') ||
              /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}([:/?#].*)?$/.test(link))
        );

      if (linksArray.length > 0) {
        formData.append('socials', linksArray.join(','));
      }
    }
    formData.append('is_private', isPrivate ? 'true' : 'false')

    // Profile Picture (Avatar)
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

    // Portrait Picture
    if (portraitImage && portraitImage.uri) {
      const uriParts = portraitImage.uri.split('.')
      const fileType = uriParts[uriParts.length - 1]
      const fileName = portraitImage.fileName || `portrait_${userId}.${fileType}`

      formData.append('portraitPicture', {
        uri: Platform.OS === 'android' ? portraitImage.uri : portraitImage.uri.replace('file://', ''),
        name: fileName,
        type: portraitImage.mimeType || `image/${fileType}`,
      } as any)
    }

    try {
      const response = await fetch(`${API_BASE_URL}/user/profile/create`, {
        method: 'POST',
        body: formData,
      })

      const responseData = await response.json()

      if (response.ok && responseData.success) {
        Alert.alert('Profile Created!', 'Your profile has been successfully set up.')
        router.replace('/dashboard')
      } else {
        setError(responseData.message || responseData.error || 'Failed to create profile. Please try again.')
        Alert.alert('Error', responseData.message || responseData.error || 'An unknown error occurred.')
      }
    } catch (e: any) {
      console.error('Save Profile Error:', e)
      setError(e.message || 'An unexpected error occurred.')
      Alert.alert('Error', 'Could not connect to the server or an unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded || (isLoaded && !isSignedIn && !userId)) {
    return (
      <LinearGradient
        colors={[Colors.dark.primaryBg, Colors.dark.secondaryBg]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={Colors.dark.pink500} />
      </LinearGradient>
    )
  }

  const privateInfoContent = (
    <>
      <Text style={styles.popupText}>
        When your account is **private**, your profile and activity will only be visible to:
      </Text>
      <Text style={styles.popupText}>
        • Users you are friends with.
      </Text>
      <Text style={styles.popupText}>
        • Members of groups you have matched with and are in a group chat with.
      </Text>
      <Text style={styles.popupText}>
        If your account is **public**, your profile will be visible to all users on the platform.
      </Text>
    </>
  );

  return (
    <LinearGradient
      colors={[Colors.dark.primaryBg, Colors.dark.secondaryBg, Colors.dark.darkerBg]}
      style={styles.gradientContainer}
    >
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={() => {
          Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Sign Out", style: "destructive", onPress: () => signOut() }
            ]
          )
        }}
      >
        <LogOut size={24} color={Colors.dark.gray300} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerContainer}>
          <CheckCircle size={48} color={Colors.dark.pink500} />
          <Text style={styles.title}>Create Your Profile</Text>
          <Text style={styles.subtitle}>Let's get your PartyLink identity set up!</Text>
        </View>

        <Text style={styles.sectionTitle}>Avatar (Required, Square)</Text>
        <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={styles.profileImagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Camera size={40} color={Colors.dark.gray300} />
              <Text style={styles.imagePickerText}>Upload Profile Picture</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Portrait Picture (Required, 3:4 Ratio)</Text>
        <TouchableOpacity onPress={pickPortraitImage} style={styles.portraitImagePicker}>
          {portraitImageUri ? (
            <Image source={{ uri: portraitImageUri }} style={styles.portraitImagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <UserCircle size={40} color={Colors.dark.gray300} />
              <Text style={styles.imagePickerText}>Upload Portrait Picture</Text>
              <Text style={styles.imagePickerSubtext}>(Recommended: 3:4 ratio)</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name*</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Alex"
            value={username}
            onChangeText={(text) => setUsername(text.charAt(0).toUpperCase() + text.slice(1))} // Auto-capitalize first letter
            placeholderTextColor={Colors.dark.gray400}
            autoCapitalize="words" // Capitalize first letter of each word
          />
          <Text style={styles.inputHint}>3-20 characters, no spaces.</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Age (Optional)</Text>
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
          <Text style={styles.label}>Career/School (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Software Engineer or State University"
            value={school}
            onChangeText={setSchool}
            placeholderTextColor={Colors.dark.gray400}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Social Links (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea, { height: 120 }]}
            placeholder="e.g., instagram.com/yourprofile, twitter.com/user"
            value={socialsInput}
            onChangeText={setSocialsInput}
            placeholderTextColor={Colors.dark.gray400}
            multiline
            numberOfLines={4}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={styles.inputHint}>Separate multiple links with a comma, space, or new line.</Text>
        </View>

        <View style={[styles.inputGroup, styles.privateToggleContainer]}>
          <TouchableOpacity
            onPress={() => setIsPrivate(!isPrivate)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              borderWidth: 2,
              borderColor: Colors.dark.gray500,
              backgroundColor: isPrivate ? Colors.dark.pink500 : 'transparent',
              marginRight: 12,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {isPrivate && <CheckCircle size={18} color={Colors.dark.white} />}
          </TouchableOpacity>
          <Text style={styles.privateToggleText}>
            Make my account private
          </Text>
          <TouchableOpacity onPress={() => setIsPrivateInfoPopupVisible(true)} style={styles.helpButton}>
            <HelpCircle size={20} color={Colors.dark.gray300} />
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.dark.white} />
          ) : (
            <>
              <Save size={20} color={Colors.dark.white} style={{ marginRight: 10 }} />
              <Text style={styles.saveButtonText}>Save & Continue</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
      <Spinner
        visible={loading}
        textContent={'Saving Profile...'}
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
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  signOutButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 10,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginTop: 15,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.gray300,
    textAlign: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.gray100,
    alignSelf: 'flex-start',
    maxWidth: 400,
    width: '100%',
    marginBottom: 10,
    marginTop: 15,
  },
  imagePicker: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.dark.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.dark.pink300,
    overflow: 'hidden',
  },
  profileImagePreview: {
    width: '100%',
    height: '100%',
  },
  portraitImagePicker: {
    width: '80%',
    maxWidth: 250,
    aspectRatio: 3 / 4,
    backgroundColor: Colors.dark.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: Colors.dark.blue300,
    borderRadius: 10,
    overflow: 'hidden',
  },
  portraitImagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  imagePickerText: {
    marginTop: 8,
    color: Colors.dark.gray300,
    fontSize: 13,
    textAlign: 'center',
  },
  imagePickerSubtext: {
    marginTop: 4,
    color: Colors.dark.gray400,
    fontSize: 11,
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    color: Colors.dark.gray200,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.dark.inputBg,
    color: Colors.dark.text,
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.gray700,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.dark.gray400,
    marginTop: 5,
    marginLeft: 2,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 15,
  },
  privateToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    maxWidth: 400,
    marginBottom: 20,
  },
  privateToggleText: {
    color: Colors.dark.gray200,
    fontSize: 14,
    marginRight: 10,
  },
  helpButton: {
    padding: 5,
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
    maxWidth: 400,
    marginTop: 25,
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
    marginTop: -5,
    width: '100%',
    maxWidth: 400,
  },
  spinnerTextStyle: {
    color: '#FFF',
    fontSize: 16,
  },
  popupText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
    color: Colors.dark.gray300,
    lineHeight: 22,
  }
})

export default CreateProfileScreen