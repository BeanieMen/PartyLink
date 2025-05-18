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
import { Camera, CheckCircle, Save } from 'lucide-react-native'
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

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      if ((isLoaded && !isSignedIn) || !userId) {
        router.replace('/')
      }
      const userRes = await fetch(`${API_BASE_URL}/user/${userId}`)
      const userData = await userRes.json()

      if (Object.keys(userData).length !== 0) {
        router.replace('/dashboard')
      }
    }
    checkStatus()
  }, [isLoaded, isSignedIn, router, userId])

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!')
      return
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setProfileImage(result.assets[0])
      setProfileImageUri(result.assets[0].uri)
    }
  }

  const validateUsername = (uname: string) => {
    if (!uname.trim()) return 'Username is required.'
    if (/\s/.test(uname)) return 'Username cannot contain spaces.'
    if (uname.length < 3) return 'Username must be at least 3 characters.'
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

    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('userId', userId)
    formData.append('username', username.trim())
    if (description.trim()) formData.append('description', description.trim())
    if (instagramLink.trim()) formData.append('instagramLink', instagramLink.trim())

    if (profileImage && profileImage.uri) {
      const uriParts = profileImage.uri.split('.')
      const fileType = uriParts[uriParts.length - 1]
      const fileName = profileImage.fileName || `profile.${fileType}`

      formData.append('profilePicture', {
        uri: Platform.OS === 'android' ? profileImage.uri : profileImage.uri.replace('file://', ''),
        name: fileName,
        type: profileImage.mimeType || `image/${fileType}`,
      } as any)
    }

    try {
      const response = await fetch(`${API_BASE_URL}/user/profile/create`, {
        method: 'POST',
        body: formData,
        headers: {},
      })

      const responseData = await response.json()

      if (response.ok && responseData.success) {
        Alert.alert('Profile Created!', 'Your profile has been successfully set up.')
        router.replace('/dashboard')
      } else {
        setError(responseData.error || 'Failed to create profile. Please try again.')
        Alert.alert('Error', responseData.error || 'An unknown error occurred.')
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
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.headerContainer}>
          <CheckCircle size={48} color={Colors.dark.pink500} />
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>Let&apos;s get your PartyLink identity set up!</Text>
        </View>

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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username*</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., PartyAnimal99"
            value={username}
            onChangeText={setUsername}
            placeholderTextColor={Colors.dark.gray400}
            autoCapitalize="none"
          />
          <Text style={styles.inputHint}>Min 3 chars, no spaces.</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bio / Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell us a bit about yourself..."
            value={description}
            onChangeText={setDescription}
            placeholderTextColor={Colors.dark.gray400}
            multiline
            numberOfLines={3}
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

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.dark.text} />
          ) : (
            <>
              <Save size={20} color={Colors.dark.text} style={{ marginRight: 10 }} />
              <Text style={styles.saveButtonText}>Save & Continue</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
      <Spinner
        visible={loading}
        textContent={'Saving Profile...'}
        textStyle={styles.spinnerTextStyle}
        overlayColor="rgba(0,0,0,0.7)"
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
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
    marginBottom: 20,
  },
  imagePicker: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: Colors.dark.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 2,
    borderColor: Colors.dark.pink300,
    overflow: 'hidden',
  },
  profileImagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerText: {
    marginTop: 8,
    color: Colors.dark.gray300,
    fontSize: 12,
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: Colors.dark.gray300,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.dark.inputBg,
    color: Colors.dark.text,
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.gray500,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.dark.gray400,
    marginTop: 4,
    marginLeft: 2,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 15,
  },
  saveButton: {
    backgroundColor: Colors.dark.pink500,
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 400,
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.dark.pink300,
  },
  saveButtonText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: Colors.dark.red,
    textAlign: 'center',
    marginBottom: 15,
    marginTop: -5,
  },
  spinnerTextStyle: {
    color: '#FFF',
  },
})

export default CreateProfileScreen
