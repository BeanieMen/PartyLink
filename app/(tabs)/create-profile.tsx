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

import Colors, { API_BASE_URL } from '@/constants' // Assuming these are correctly set up
import InfoPopup from '@/components/InfoPopup'; // Assuming this is correctly set up

const CreateProfileScreen = () => {
  const router = useRouter()
  const { userId, isSignedIn, isLoaded, signOut } = useAuth()

  const [username, setUsername] = useState('')
  const [profileImage, setProfileImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)

  const [age, setAge] = useState('')
  const [school, setSchool] = useState('')
  const [portraitImage, setPortraitImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [portraitImageUri, setPortraitImageUri] = useState<string | null>(null)
  
  // New state for Instagram link
  const [instagramLink, setInstagramLink] = useState('');
  const [socialsInput, setSocialsInput] = useState('') // For other social links
  
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
        // Check if user profile already exists
        const userRes = await fetch(`${API_BASE_URL}/user/${userId}`);
        if (userRes.ok && userRes.headers.get("content-type")?.includes("application/json")) {
          const userData = await userRes.json();
          // If user data exists (e.g., has a username or more than just a default ID field), redirect
          if (userData && (Object.keys(userData).length > 1 || userData.username)) { 
            router.replace('/dashboard'); // Or your main app screen
          }
        } else if (userRes.status === 404) {
          // User not found, normal flow for create profile
        } else {
          // Handle other non-OK statuses or unexpected responses
          console.warn("Failed to fetch user data or unexpected response format:", userRes.status);
        }
      } catch (e) {
        console.error("Error checking user status:", e);
        // Potentially alert user or handle gracefully
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (/\s/.test(uname)) return 'Name cannot contain spaces.'
    if (uname.length < 3) return 'Name must be at least 3 characters long.'
    if (uname.length > 20) return 'Name cannot exceed 20 characters.'
    if (!/^[a-zA-Z0-9_]+$/.test(uname)) return 'Name can only contain letters, numbers, and underscores.'
    return null
  }

  const handleSaveProfile = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please try logging in again.')
      return
    }

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
    formData.append('username', username.trim().toLowerCase())

    if (age.trim()) {
      const ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum <= 10 || ageNum > 100) {
        Alert.alert('Validation Error', 'Please enter a valid age (e.g., 11-99), or leave it blank.');
        setLoading(false);
        return;
      }
      formData.append('age', age.trim());
    }

    if (school.trim()) formData.append('school', school.trim());

    // Append Instagram link
    if (instagramLink.trim()) {
      formData.append('instagram_link', instagramLink.trim());
    }

    // Append other social links
    if (socialsInput.trim()) {
      const linksArray = socialsInput
        .split(/[\s,;\n]+/)
        .map(link => link.trim())
        .filter(
          link =>
            link.length > 0 &&
            (link.startsWith('http://') ||
              link.startsWith('https://') ||
              /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}([:/?#].*)?$/.test(link)) // Basic URL-like pattern
        );

      if (linksArray.length > 0) {
        formData.append('socials', linksArray.join(','));
      }
    }
    formData.append('is_private', isPrivate.toString()) // Send as 'true' or 'false' string

    if (profileImage && profileImage.uri) {
      const uriParts = profileImage.uri.split('.')
      const fileType = uriParts[uriParts.length - 1]
      const fileName = profileImage.fileName || `profile_${userId}_${Date.now()}.${fileType}`

      formData.append('profilePicture', {
        uri: Platform.OS === 'android' ? profileImage.uri : profileImage.uri.replace('file://', ''),
        name: fileName,
        type: profileImage.mimeType || `image/${fileType}`,
      } as any)
    }

    if (portraitImage && portraitImage.uri) {
      const uriParts = portraitImage.uri.split('.')
      const fileType = uriParts[uriParts.length - 1]
      const fileName = portraitImage.fileName || `portrait_${userId}_${Date.now()}.${fileType}`

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
        // Add headers if needed, e.g., for auth token if not handled by a global interceptor
      })

      const responseData = await response.json().catch(() => ({ success: false, message: "Invalid JSON response"}));

      if (response.ok && responseData.success) {
        Alert.alert('Profile Created!', 'Your profile has been successfully set up.')
        router.replace('/dashboard') // Navigate to dashboard or main app screen
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
        colors={[Colors.dark.primaryBg, Colors.dark.secondaryBg]} // Ensure Colors are defined
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
      <Text style={styles.popupListItem}>
        • Users you are friends with.
      </Text>
      <Text style={styles.popupListItem}>
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
            placeholder="e.g., Alex_Link"
            value={username}
            // onChangeText={(text) => setUsername(text.charAt(0).toUpperCase() + text.slice(1))}
            onChangeText={(text) => setUsername(text)} // Let users type freely, validation handles format.
            placeholderTextColor={Colors.dark.gray400}
            // autoCapitalize="words" - Username might not need this, or could be "none"
            autoCapitalize="none"
          />
          <Text style={styles.inputHint}>3-20 characters. Letters, numbers, underscores. No spaces.</Text>
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

        {/* New Instagram Link Section */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Instagram Link (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., instagram.com/yourprofile or your_username"
            value={instagramLink}
            onChangeText={setInstagramLink}
            placeholderTextColor={Colors.dark.gray400}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Other Social Links (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea, { height: 120 }]}
            placeholder="e.g., twitter.com/user, linkedin.com/in/user"
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

        <View style={[styles.inputGroup, styles.privateToggleOuterContainer]}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setIsPrivate(!isPrivate)}
            style={styles.privateToggleInnerContainer}
          >
            <View style={[styles.checkbox, isPrivate && styles.checkboxChecked]}>
              {isPrivate && <CheckCircle size={16} color={Colors.dark.primaryBg} />}
            </View>
            <Text style={styles.privateToggleText}>
              Make my account private
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsPrivateInfoPopupVisible(true)} style={styles.helpButton}>
            <HelpCircle size={22} color={Colors.dark.gray300} />
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
    // paddingTop: 20, // Removed, handled by ScrollView or safe area
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 70 : 50, // Increased top padding
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  signOutButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 10,
    padding: 5, // Easier to tap
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
    marginBottom: 15, // Increased margin
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.gray100, // Ensure Colors.dark.gray100 is defined
    alignSelf: 'flex-start',
    maxWidth: 400,
    width: '100%',
    marginBottom: 10,
    marginTop: 20, // Increased margin
  },
  imagePicker: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.dark.inputBg, // Ensure Colors.dark.inputBg is defined
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25, // Increased margin
    borderWidth: 2,
    borderColor: Colors.dark.pink300, // Ensure Colors.dark.pink300 is defined
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
    borderColor: Colors.dark.blue300, // Ensure Colors.dark.blue300 is defined
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
    color: Colors.dark.gray400, // Ensure Colors.dark.gray400 is defined
    fontSize: 11,
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 20, // Increased margin
  },
  label: {
    fontSize: 14,
    color: Colors.dark.gray200, // Ensure Colors.dark.gray200 is defined
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.dark.inputBg,
    color: Colors.dark.text,
    height: 52, // Slightly taller
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.gray700, // Ensure Colors.dark.gray700 is defined
  },
  inputHint: {
    fontSize: 12,
    color: Colors.dark.gray400,
    marginTop: 6, // Increased margin
    marginLeft: 2,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 15,
  },
  privateToggleOuterContainer: { // Renamed for clarity
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Help icon to the right
    width: '100%',
    maxWidth: 400,
    marginBottom: 25, // Increased margin
    paddingVertical: 5,
  },
  privateToggleInnerContainer: { // For checkbox and text
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.dark.gray500, // Ensure Colors.dark.gray500 is defined
    backgroundColor: 'transparent',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.dark.pink500,
    borderColor: Colors.dark.pink500,
  },
  privateToggleText: {
    color: Colors.dark.gray200,
    fontSize: 15, // Slightly larger
    // marginRight: 10, // Handled by space-between on outer container
  },
  helpButton: {
    padding: 8, // Increased tap area
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
    shadowColor: Colors.dark.pink700, // Ensure Colors.dark.pink700 is defined
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.dark.pink300, // Ensure Colors.dark.pink300 is defined
    elevation: 0,
    shadowOpacity: 0,
  },
  saveButtonText: {
    color: Colors.dark.white, // Ensure Colors.dark.white is defined
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.dark.red, // Ensure Colors.dark.red is defined
    textAlign: 'center',
    marginBottom: 15,
    marginTop: -10, // Adjusted
    width: '100%',
    maxWidth: 400,
    fontSize: 14,
  },
  spinnerTextStyle: {
    color: '#FFF',
    fontSize: 16,
  },
  popupText: {
    fontSize: 15,
    marginBottom: 10,
    textAlign: 'left',
    color: Colors.dark.gray300,
    lineHeight: 22,
  },
  popupListItem: {
    fontSize: 15,
    color: Colors.dark.gray300,
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 5,
    textAlign: 'left',
  }
})

export default CreateProfileScreen