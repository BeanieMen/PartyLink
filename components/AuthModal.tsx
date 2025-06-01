import React, { useState, useCallback, useEffect } from 'react'
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { useClerk, useSSO } from '@clerk/clerk-expo'
import { Ionicons } from '@expo/vector-icons'
import Colors from '@/constants'
import GoogleIcon from './GoogleIcon'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialView?: 'signin' | 'signup'
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialView }) => {
  const { loaded: isClerkLoaded } = useClerk()
  const { startSSOFlow } = useSSO()
  const [provider, setProvider] = useState<'google' | 'discord' | null>(null)

  const handleSSO = useCallback(
    async (strategy: 'oauth_google' | 'oauth_discord') => {
      setProvider(strategy === 'oauth_google' ? 'google' : 'discord')
      try {
        const { createdSessionId, setActive } = await startSSOFlow({ strategy })
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId })
          onClose()
        } else {
          Alert.alert(
            'Authentication Incomplete',
            'Please complete any additional steps required to finish sign-in.',
          )
        }
      } catch (err: any) {
        console.error(`SSO Error (${strategy}):`, err)
        Alert.alert('Authentication Error', err.message || 'Unknown error')
      } finally {
        setProvider(null)
      }
    },
    [startSSOFlow, onClose],
  )

  if (!isOpen || !isClerkLoaded) {
    return null
  }
  const isLoading = provider !== null
  const titleText = initialView === 'signin' ? 'Log In to PartyLink' : 'Join PartyLink'
  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={isOpen}
      onRequestClose={() => !isLoading && onClose()}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          {!isLoading && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={30} color={Colors.dark.text} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.title}>{titleText}</Text>
          <Text style={styles.subtitle}>Continue with your preferred account</Text>

          {isLoading && provider && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.dark.pink500} />
              <Text style={styles.loadingText}>
                Connecting with {provider.charAt(0).toUpperCase() + provider.slice(1)}...
              </Text>
            </View>
          )}

          {!isLoading && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.ssoButton, styles.googleButton]}
                onPress={() => handleSSO('oauth_google')}
              >
                <GoogleIcon size={22} color="#4285F4" />
                <Text style={[styles.ssoText, styles.googleText]}>Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.ssoButton, styles.discordButton]}
                onPress={() => handleSSO('oauth_discord')}
              >
                <Ionicons
                  name="logo-discord"
                  size={22}
                  color={Colors.dark.white}
                  style={styles.icon}
                />
                <Text style={[styles.ssoText, styles.discordText]}>Continue with Discord</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.legal}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.secondaryBg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? 10 : 15,
  },
  closeButton: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.gray300,
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 360,
  },
  ssoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  googleButton: {
    backgroundColor: Colors.dark.white,
    borderWidth: 1,
    borderColor: Colors.dark.gray300,
  },
  discordButton: {
    backgroundColor: '#5865F2',
  },
  iconImage: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  icon: {
    marginRight: 12,
  },
  ssoText: {
    fontSize: 16,
    fontWeight: '500',
  },
  googleText: {
    color: '#333',
  },
  discordText: {
    color: Colors.dark.white,
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.dark.text,
  },
  legal: {
    fontSize: 12,
    color: Colors.dark.gray400,
    textAlign: 'center',
    marginTop: 30,
    paddingHorizontal: 20,
  },
})

export default AuthModal
