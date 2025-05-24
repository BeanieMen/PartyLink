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
import { Camera, CheckCircle, Save, UserCircle, Link2 } from 'lucide-react-native' // Added Link2 for socials
import Spinner from 'react-native-loading-spinner-overlay'

import Colors, { API_BASE_URL } from '@/constants'

const CreateProfileScreen = () => {
  const router = useRouter()
  const { userId, isSignedIn, isLoaded } = useAuth()

  const [username, setUsername] = useState('')
  const [description, setDescription] = useState('')
  const [instagramLink, setInstagramLink] = useState('')
  const [profileImage, setProfileImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)

  const [age, setAge] = useState('')
  const [school, setSchool] = useState('') // Label changed to Career/School
  const [portraitImage, setPortraitImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [portraitImageUri, setPortraitImageUri] = useState<string | null>(null)
  const [socialsInput, setSocialsInput] = useState('') // New state for socials
  const [isPrivate, setIsPrivate] = useState(false)

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
      mediaTypes:  "Images" as ImagePicker.MediaType,
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
      mediaTypes:  "Images" as ImagePicker.MediaType,
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
    if (!uname.trim()) return 'Username is required.'
    if (/\s/.test(uname)) return 'Username cannot contain spaces.'
    if (uname.length < 3) return 'Username must be at least 3 characters long.'
    if (uname.length > 20) return 'Username cannot exceed 20 characters.'
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

    if (!age.trim()) {
      Alert.alert('Validation Error', 'Age is required.');
      return;
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum <= 10 || ageNum > 100) {
      Alert.alert('Validation Error', 'Please enter a valid age (e.g., 10-100).');
      return;
    }

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('userId', userId)
    formData.append('username', username.trim().toLowerCase())
    formData.append('age', age.trim());

    if (description.trim()) formData.append('description', description.trim())
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

      const trimmedInstagramLink = instagramLink.trim();
      if (
        trimmedInstagramLink &&
        (trimmedInstagramLink.startsWith('http://') ||
          trimmedInstagramLink.startsWith('https://') ||
          /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}([:/?#].*)?$/.test(trimmedInstagramLink))
      ) {
        linksArray.push(trimmedInstagramLink);
      }

      if (linksArray.length > 0) {
        formData.append('socials', linksArray.join(','));
      }
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

  return (
    <LinearGradient
      colors={[Colors.dark.primaryBg, Colors.dark.secondaryBg, Colors.dark.darkerBg]}
      style={styles.gradientContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerContainer}>
          <CheckCircle size={48} color={Colors.dark.pink500} />
          <Text style={styles.title}>Create Your Profile</Text>
          <Text style={styles.subtitle}>Let's get your PartyLink identity set up!</Text>
        </View>

        <Text style={styles.sectionTitle}>Avatar (Square)</Text>
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

        <Text style={styles.sectionTitle}>Portrait Picture (Optional)</Text>
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
            placeholder="e.g., alextaylor99"
            value={username}
            onChangeText={setUsername}
            placeholderTextColor={Colors.dark.gray400}
            autoCapitalize="none"
          />
          <Text style={styles.inputHint}>3-20 characters, no spaces.</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Age*</Text>
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
          <Text style={styles.label}>Bio / Description (Optional)</Text>
          <TextInput
            style={[styles.input]}
            placeholder="Tell us a bit about yourself..."
            value={description}
            onChangeText={setDescription}
            placeholderTextColor={Colors.dark.gray400}
            multiline
            numberOfLines={3}
            maxLength={150}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Instagram Link (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://instagram.com/yourprofile"
            value={instagramLink}
            onChangeText={setInstagramLink}
            placeholderTextColor={Colors.dark.gray400}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Other Social Links (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea, { height: 120 }]} // Slightly taller for multiple links
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

        <View style={[styles.inputGroup, { flexDirection: 'row', alignItems: 'center' }]}>
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
          <Text style={{ color: Colors.dark.gray200, fontSize: 14 }}>
            Make my account private
          </Text>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 20,
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
    minHeight: 100, // Use minHeight for multiline
    textAlignVertical: 'top',
    paddingTop: 15,
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
    color: Colors.dark.red, // Make sure Colors.dark.red is defined
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
})

export default CreateProfileScreen