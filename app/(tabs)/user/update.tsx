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
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { Camera, CheckCircle, Save, UserCircle, HelpCircle, Edit3, ShieldQuestion } from 'lucide-react-native' // Added Edit3, ShieldQuestion
import Spinner from 'react-native-loading-spinner-overlay'

import Colors, { API_BASE_URL } from '@/constants' // Assuming API_BASE_URL is here
import InfoPopup from '@/components/InfoPopup'   // Assuming InfoPopup is in this path

// Mock User Data Structure (for fetching)
interface UserProfileData {
  username: string;
  description?: string;
  instagram_link?: string; // Assuming snake_case from backend
  profile_picture_url?: string;
  age?: number | string;
  school?: string;
  portrait_picture_url?: string;
  socials?: string; // Comma-separated string
  is_private?: boolean;
}


const EditProfileScreen = () => {
  const router = useRouter()
  const { userId, isSignedIn, isLoaded } = useAuth()

  // Form States
  const [currentUsername, setCurrentUsername] = useState('') // For display, if username isn't editable
  const [username, setUsername] = useState('') // If you allow username editing
  const [description, setDescription] = useState('')
  const [instagramLink, setInstagramLink] = useState('')
  const [profileImage, setProfileImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null)

  const [age, setAge] = useState('')
  const [school, setSchool] = useState('')
  const [portraitImage, setPortraitImage] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [portraitImageUri, setPortraitImageUri] = useState<string | null>(null)
  const [socialsInput, setSocialsInput] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isPrivateInfoPopupVisible, setIsPrivateInfoPopupVisible] = useState(false)

  const [loading, setLoading] = useState(true) // Start loading true to fetch data
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);


  // Fetch existing profile data
  const fetchProfileData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/user/${userId}`); // Assuming this endpoint
      if (response.ok) {
        const data: UserProfileData = await response.json();
        setUsername(data.username || ''); // Or setCurrentUsername if not editable
        setCurrentUsername(data.username || '');
        setDescription(data.description || '');
        setInstagramLink(data.instagram_link || '');
        setProfileImageUri(data.profile_picture_url || null);
        setAge(data.age?.toString() || '');
        setSchool(data.school || '');
        setPortraitImageUri(data.portrait_picture_url || null);
        setSocialsInput(data.socials || '');
        setIsPrivate(data.is_private || false);
        setInitialDataLoaded(true);
      } else if (response.status === 404) {
        Alert.alert("Profile Not Found", "No profile data exists. Redirecting to create profile.", [
          { text: "OK", onPress: () => router.replace('/create-profile') } // Or your create profile route
        ]);
      } else {
        const errData = await response.json();
        setError(errData.message || "Failed to load profile data.");
        Alert.alert("Error", errData.message || "Failed to load profile data.");
      }
    } catch (e: any) {
      console.error("Fetch Profile Error:", e);
      setError("Could not connect to the server or an unexpected error occurred.");
      Alert.alert("Error", "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, [userId, router]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !userId) {
      router.replace('/'); // Redirect to login if not signed in
      return;
    }
    fetchProfileData();
  }, [isLoaded, isSignedIn, userId, fetchProfileData, router]);


  const pickImage = async (type: 'profile' | 'portrait') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const aspect: [number, number] = type === 'profile' ? [1, 1] : [3, 4];
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "Images" as ImagePicker.MediaType,
      allowsEditing: true,
      aspect: aspect,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (type === 'profile') {
        setProfileImage(result.assets[0]);
        setProfileImageUri(result.assets[0].uri);
      } else {
        setPortraitImage(result.assets[0]);
        setPortraitImageUri(result.assets[0].uri);
      }
    }
  };

  const handleUpdateProfile = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please try logging in again.');
      return;
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

    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('age', age.trim());

    if (description.trim()) formData.append('description', description.trim());
    if (school.trim()) formData.append('school', school.trim());

    if (socialsInput.trim() || instagramLink.trim()) {
      const linksArray = socialsInput
        .split(/[\s,;\n]+/)
        .map(link => link.trim())
        .filter(link => link.length > 0 && (link.startsWith('http://') || link.startsWith('https://') || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}([:/?#].*)?$/.test(link)));

      const trimmedInstagramLink = instagramLink.trim();
      if (trimmedInstagramLink && (trimmedInstagramLink.startsWith('http://') || trimmedInstagramLink.startsWith('https://') || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}([:/?#].*)?$/.test(trimmedInstagramLink))) {
        // Prevent duplicates if insta link is also in general socials
        if (!linksArray.some(link => link.includes(trimmedInstagramLink.replace(/^https?:\/\/(www\.)?instagram\.com\//, '')))) {
             linksArray.push(trimmedInstagramLink);
        }
      }
      if (linksArray.length > 0) {
        formData.append('socials', linksArray.join(','));
      } else {
        formData.append('socials', ''); // Send empty if all cleared
      }
    } else {
        formData.append('socials', ''); // Send empty if initially empty and not touched
    }
    formData.append('is_private', isPrivate ? 'true' : 'false');

    if (profileImage && profileImage.uri) {
      const uriParts = profileImage.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      const fileName = profileImage.fileName || `profile_${userId}.${fileType}`;
      formData.append('profilePicture', {
        uri: Platform.OS === 'android' ? profileImage.uri : profileImage.uri.replace('file://', ''),
        name: fileName,
        type: profileImage.mimeType || `image/${fileType}`,
      } as any);
    }

    if (portraitImage && portraitImage.uri) {
      const uriParts = portraitImage.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      const fileName = portraitImage.fileName || `portrait_${userId}.${fileType}`;
      formData.append('portraitPicture', {
        uri: Platform.OS === 'android' ? portraitImage.uri : portraitImage.uri.replace('file://', ''),
        name: fileName,
        type: portraitImage.mimeType || `image/${fileType}`,
      } as any);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/user/profile/update`, {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        Alert.alert('Profile Updated!', 'Your changes have been saved.');
        await fetchProfileData()

      } else {
        setError(responseData.message || responseData.error || 'Failed to update profile.');
        Alert.alert('Error', responseData.message || responseData.error || 'An unknown error occurred.');
      }
    } catch (e: any) {
      console.error('Save Profile Error:', e);
      setError(e.message || 'An unexpected error occurred.');
      Alert.alert('Error', 'Could not connect to the server or an unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !initialDataLoaded) {
    return (
      <LinearGradient colors={[Colors.dark.primaryBg, Colors.dark.secondaryBg]} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.pink500} />
        <Text style={{ color: Colors.dark.text, marginTop: 10 }}>Loading Profile...</Text>
      </LinearGradient>
    );
  }


  const privateInfoContent = (
    <>
      <Text style={styles.popupText}>
        When your account is <Text style={{fontWeight: 'bold'}}>private</Text>, your profile and activity will only be visible to:
      </Text>
      <Text style={styles.popupText}>• Users you are friends with.</Text>
      <Text style={styles.popupText}>• Members of groups you have matched with and are in a group chat with.</Text>
      <Text style={styles.popupText}>If your account is <Text style={{fontWeight: 'bold'}}>public</Text>, your profile will be visible to all users on the platform.</Text>
    </>
  );

  return (
    <LinearGradient colors={[Colors.dark.primaryBg, Colors.dark.secondaryBg, Colors.dark.darkerBg]} style={styles.gradientContainer}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.headerContainer}>
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
              <View style={styles.editOverlay}><Camera size={16} color={Colors.dark.white} /></View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => pickImage('portrait')} style={styles.portraitImagePicker}>
              {portraitImageUri ? (
                <Image source={{ uri: portraitImageUri }} style={styles.portraitImagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <UserCircle size={30} color={Colors.dark.gray300} />
                  <Text style={styles.imagePickerTextSmall}>Portrait Pic</Text>
                  <Text style={styles.imagePickerSubtextSmall}>(3:4)</Text>
                </View>
              )}
              <View style={styles.editOverlay}><Camera size={16} color={Colors.dark.white} /></View>
            </TouchableOpacity>
          </View>
        </View>

        {/* --- Section: Basic Information --- */}
        <View style={styles.dashboardSection}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name (Username)</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]} // Make non-editable for now
              value={currentUsername} // Display current username
              editable={false} // Disable editing
              placeholderTextColor={Colors.dark.gray400}
            />
             <Text style={styles.inputHint}>Usernames cannot be changed after creation.</Text>
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
            <Text style={styles.label}>Career/School</Text>
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
            <Text style={styles.label}>Bio / Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, {minHeight: 80}]}
              placeholder="Tell us a bit about yourself..."
              value={description}
              onChangeText={setDescription}
              placeholderTextColor={Colors.dark.gray400}
              multiline
              numberOfLines={3}
              maxLength={150}
            />
          </View>
        </View>

        {/* --- Section: Social Links --- */}
        <View style={styles.dashboardSection}>
          <Text style={styles.sectionTitle}>Social Links</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Instagram Link</Text>
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
            <Text style={styles.label}>Other Social Links</Text>
            <TextInput
              style={[styles.input, styles.textArea, { minHeight: 100 }]}
              placeholder="e.g., twitter.com/user, linkedin.com/in/user"
              value={socialsInput}
              onChangeText={setSocialsInput}
              placeholderTextColor={Colors.dark.gray400}
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Text style={styles.inputHint}>Separate multiple links with a comma, space, or new line.</Text>
          </View>
        </View>

         {/* --- Section: Account Settings --- */}
        <View style={styles.dashboardSection}>
            <Text style={styles.sectionTitle}>Account Settings</Text>
            <View style={[styles.inputGroup, styles.privateToggleContainer]}>
                <TouchableOpacity
                    onPress={() => setIsPrivate(!isPrivate)}
                    style={styles.checkbox}
                >
                    {isPrivate && <CheckCircle size={18} color={Colors.dark.white} />}
                </TouchableOpacity>
                <Text style={styles.privateToggleText}>
                    Make my account private
                </Text>
                <TouchableOpacity onPress={() => setIsPrivateInfoPopupVisible(true)} style={styles.helpButton}>
                    <ShieldQuestion size={20} color={Colors.dark.gray300} />
                </TouchableOpacity>
            </View>
        </View>


        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
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

      <Spinner
        visible={saving || (loading && !initialDataLoaded)} // Show spinner for initial load too
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
  );
};

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
    paddingHorizontal: 15, // Adjusted for section padding
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 25,
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
  // --- Dashboard Section Styling ---
  dashboardSection: {
    width: '100%',
    maxWidth: 500, // Max width for content sections
    backgroundColor: Colors.dark.inputBg, // Or a slightly different shade
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.gray700, // Subtle border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: { // For titles within sections
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
    backgroundColor: Colors.dark.gray800, // Darker placeholder bg
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.pink300,
    overflow: 'hidden',
    position: 'relative', // For edit overlay
  },
  profileImagePreview: {
    width: '100%',
    height: '100%',
  },
  portraitImagePicker: {
    width: 110, // Adjust as needed, e.g. width: '45%' for responsiveness
    aspectRatio: 3 / 4,
    backgroundColor: Colors.dark.gray800,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.blue300,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative', // For edit overlay
  },
  portraitImagePreview: {
    width: '100%',
    height: '100%',
  },
  editOverlay: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 5,
    borderRadius: 15,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
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
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    color: Colors.dark.gray200,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.dark.gray800, // Slightly different from section bg
    color: Colors.dark.text,
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.gray600,
  },
  readOnlyInput: {
    backgroundColor: Colors.dark.gray700, // Darker for readonly
    color: Colors.dark.gray300,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.dark.gray400,
    marginTop: 5,
    marginLeft: 2,
  },
  textArea: {
    textAlignVertical: 'top',
    paddingTop: 15,
  },
  privateToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.dark.gray500,
    backgroundColor: 'transparent',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privateToggleText: {
    color: Colors.dark.gray200,
    fontSize: 15,
    flex: 1, // Allow text to take space
  },
  helpButton: {
    padding: 8,
    marginLeft: 8,
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
    maxWidth: 450, // Consistent with section width
    marginTop: 15, // Reduced margin as it's outside sections
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
    marginBottom: 10,
    textAlign: 'center',
    color: Colors.dark.gray300,
    lineHeight: 22,
  }
});

export default EditProfileScreen;