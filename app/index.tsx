import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  TextInput,
  Alert,
} from 'react-native'
import { useAuth, useSignIn, useSignUp, useSSO } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
  withDelay,
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { PartyPopper, ArrowLeft } from 'lucide-react-native'
import { Ionicons } from '@expo/vector-icons'
import Spinner from 'react-native-loading-spinner-overlay'
import * as Linking from 'expo-linking'
import Colors, { API_BASE_URL } from '@/constants'
const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

const AnimatedParticle = ({ index }: { index: number }) => {
  const x = useSharedValue(Math.random() * screenWidth)
  const y = useSharedValue(Math.random() * screenHeight)
  const scale = useSharedValue(0.5 + Math.random() * 5)
  const opacity = useSharedValue(0.1 + Math.random() * 0.2)

  useEffect(() => {
    const randomDelay = Math.random() * 1000
    const duration = 10000 + Math.random() * 10000
    x.value = withDelay(
      randomDelay,
      withRepeat(
        withTiming(Math.random() * screenWidth, { duration, easing: Easing.linear }),
        -1,
        true,
      ),
    )
    y.value = withDelay(
      randomDelay,
      withRepeat(
        withTiming(Math.random() * screenHeight, { duration, easing: Easing.linear }),
        -1,
        true,
      ),
    )
    scale.value = withDelay(
      randomDelay,
      withRepeat(withTiming(0.5 + Math.random() * 0.5, { duration: duration / 2 }), -1, true),
    )
  }, [x, y, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
    opacity: opacity.value,
  }))

  const particleSize = Math.random() * 30 + 20
  const particleColors = [Colors.dark.pink500, '#AF00FF', '#00E0FF', Colors.dark.yellow400]

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: particleSize,
          height: particleSize,
          backgroundColor: particleColors[index % particleColors.length],
        },
        animatedStyle,
      ]}
    />
  )
}

const IndexPage = () => {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const router = useRouter()

  const [authView, setAuthView] = useState<'landing' | 'signin' | 'signup' | 'verify'>('landing')
  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false) // For email/pass actions
  const [ssoProviderLoading, setSsoProviderLoading] = useState<'google' | 'discord' | null>(null) // For SSO loading

  const { signIn, setActive: setActiveSignIn, isLoaded: isSignInLoaded } = useSignIn()
  const { signUp, setActive: setActiveSignUp, isLoaded: isSignUpLoaded } = useSignUp()
  const { startSSOFlow } = useSSO()

  useEffect(() => {
    const fetchUserData = async () => {
      if (isLoaded && isSignedIn) {
        const response = await fetch(`${API_BASE_URL}/user/${userId}`)
        const userData = await response.json()

        if (Object.keys(userData).length === 0) {
          router.replace('/create-profile')
        } else {
          router.replace('/dashboard')
        }
      }
    }

    fetchUserData()
  }, [isLoaded, isSignedIn, userId, router])

  const clearForm = useCallback(() => {
    setEmailAddress('')
    setPassword('')
    setCode('')
  }, [])

  const handleOAuth = useCallback(
    async (strategy: 'oauth_google' | 'oauth_discord') => {
      setSsoProviderLoading(strategy === 'oauth_google' ? 'google' : 'discord')
      try {
        const redirectUrl = Linking.createURL('/oauth-callback')

        const { createdSessionId, setActive, signIn, signUp } = await startSSOFlow({
          strategy,
          redirectUrl,
        })

        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId })
          setAuthView('landing')
          clearForm()
        } else if (signIn || signUp) {
          let message = 'Please complete the authentication process.'
          if (signIn) {
            console.log('SSO requires further sign-in steps. Status:', signIn.status)
          }
          if (signUp) {
            console.log('SSO requires further sign-up steps. Status:', signUp.status)
          }
          Alert.alert('Authentication Incomplete', message)
        } else {
          console.warn('SSO flow did not result in a session or further specific steps.')
          Alert.alert(
            'Authentication Issue',
            'The authentication process could not be completed as expected.',
          )
        }
      } catch (err: any) {
        console.error(`SSO Error (${strategy}):`, JSON.stringify(err))
        const errorMessage =
          err.errors?.[0]?.longMessage ||
          err.errors?.[0]?.message ||
          err.message ||
          'An unknown error occurred during SSO.'
        Alert.alert('Authentication Error', errorMessage)
      } finally {
        setSsoProviderLoading(null)
      }
    },
    [startSSOFlow, clearForm, setAuthView],
  )

  const handleSignIn = async () => {
    if (!isSignInLoaded) return
    setLoading(true)
    try {
      const completeSignIn = await signIn.create({
        identifier: emailAddress,
        password,
      })
      await setActiveSignIn({ session: completeSignIn.createdSessionId })
      setAuthView('landing')
      clearForm()
    } catch (err: any) {
      console.error('Sign In Error:', JSON.stringify(err))
      Alert.alert(
        'Sign In Error',
        err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Invalid email or password.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    if (!isSignUpLoaded) return
    setLoading(true)
    try {
      await signUp.create({
        emailAddress,
        password,
      })
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setAuthView('verify')
      Alert.alert('Verification Code Sent', 'Please check your email for a verification code.')
    } catch (err: any) {
      console.error('Sign Up Error:', JSON.stringify(err))
      Alert.alert(
        'Sign Up Error',
        err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Could not create account.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleVerification = async () => {
    if (!isSignUpLoaded) return
    setLoading(true)
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({ code })
      if (completeSignUp.status === 'complete') {
        await setActiveSignUp({ session: completeSignUp.createdSessionId })
        setAuthView('landing')
        clearForm()
      } else {
        console.warn('Verification not complete:', JSON.stringify(completeSignUp))
        Alert.alert(
          'Verification Incomplete',
          'The code is incorrect or has expired. Please try again.',
        )
      }
    } catch (err: any) {
      console.error('Verification Error:', JSON.stringify(err))
      Alert.alert(
        'Verification Error',
        err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Invalid verification code.',
      )
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded && !isSignedIn) {
    return (
      <LinearGradient
        colors={[Colors.dark.primaryBg, Colors.dark.secondaryBg, Colors.dark.darkerBg]}
        style={styles.fullScreenLoadingContainer}
      >
        <ActivityIndicator size="large" color={Colors.dark.pink400} />
        <Text style={styles.loadingText}>Initializing PartyLink...</Text>
      </LinearGradient>
    )
  }

  const renderLandingContent = () => (
    <>
      <Animated.View entering={FadeInUp.duration(600).delay(200)} style={styles.logoContainer}>
        <PartyPopper size={72} color={Colors.dark.pink500} />
        <Text style={styles.appName}>PartyLink</Text>
      </Animated.View>
      <Animated.Text entering={FadeInUp.duration(600).delay(400)} style={styles.tagline}>
        Discover, Connect, Celebrate.
      </Animated.Text>
      <Animated.Text entering={FadeInUp.duration(600).delay(500)} style={styles.subTagline}>
        Your ultimate party playground.
      </Animated.Text>
      <Animated.View entering={FadeIn.duration(800).delay(700)} style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.signUpButton]}
          onPress={() => {
            clearForm()
            setAuthView('signup')
          }}
        >
          <Text style={styles.buttonText}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.loginButton]}
          onPress={() => {
            clearForm()
            setAuthView('signin')
          }}
        >
          <Text style={[styles.buttonText, styles.loginButtonText]}>Log In</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  )

  const renderAuthFormBase = (
    title: string,
    children: React.ReactNode,
    backView: 'landing' | 'signup' = 'landing',
  ) => (
    <View style={styles.authFormContainer}>
      <TouchableOpacity
        onPress={() => {
          clearForm()
          setAuthView(backView)
        }}
        style={styles.backToHomeButton}
      >
        <ArrowLeft size={24} color={Colors.dark.text} />
        <Text style={styles.backToHomeButtonText}>
          {backView === 'landing' ? 'Back to Home' : 'Back to Sign Up'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.authTitle}>{title}</Text>
      {children}
    </View>
  )

  const renderSignInContent = () =>
    renderAuthFormBase(
      'Log In to PartyLink',
      <>
        <TextInput
          placeholder="Email Address"
          value={emailAddress}
          onChangeText={setEmailAddress}
          style={styles.inputField}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={Colors.dark.gray400}
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          style={styles.inputField}
          secureTextEntry
          placeholderTextColor={Colors.dark.gray400}
        />
        <TouchableOpacity
          style={[styles.authButtonInternal, styles.submitButton]}
          onPress={handleSignIn}
          disabled={loading || ssoProviderLoading !== null}
        >
          <Text style={styles.authButtonText}>Log In</Text>
        </TouchableOpacity>
        <Text style={styles.orText}>OR</Text>
        <TouchableOpacity
          style={[styles.authButtonInternal, styles.googleButton]}
          onPress={() => handleOAuth('oauth_google')}
          disabled={loading || ssoProviderLoading !== null}
        >
          <Ionicons name="logo-google" size={20} color="#fff" style={styles.oauthIcon} />
          <Text style={[styles.authButtonText, styles.googleButtonText]}>Continue with Google</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.authButtonInternal, styles.discordButton]}
          onPress={() => handleOAuth('oauth_discord')}
          disabled={loading || ssoProviderLoading !== null}
        >
          <Ionicons
            name="logo-discord"
            size={20}
            color={Colors.dark.white}
            style={styles.oauthIcon}
          />
          <Text style={[styles.authButtonText, styles.discordButtonText]}>
            Continue with Discord
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            clearForm()
            setAuthView('signup')
          }}
          style={styles.switchAuthLink}
        >
          <Text style={styles.switchAuthText}>Don&apos;t have an account? Sign Up</Text>
        </TouchableOpacity>
      </>,
    )

  const renderSignUpContent = () =>
    renderAuthFormBase(
      'Create your PartyLink Account',
      <>
        <TextInput
          placeholder="Email Address"
          value={emailAddress}
          onChangeText={setEmailAddress}
          style={styles.inputField}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={Colors.dark.gray400}
        />
        <TextInput
          placeholder="Password (min. 8 characters)"
          value={password}
          onChangeText={setPassword}
          style={styles.inputField}
          secureTextEntry
          placeholderTextColor={Colors.dark.gray400}
        />
        <TouchableOpacity
          style={[styles.authButtonInternal, styles.submitButton]}
          onPress={handleSignUp}
          disabled={loading || ssoProviderLoading !== null}
        >
          <Text style={styles.authButtonText}>Create Account</Text>
        </TouchableOpacity>
        <Text style={styles.orText}>OR</Text>
        <TouchableOpacity
          style={[styles.authButtonInternal, styles.googleButton]}
          onPress={() => handleOAuth('oauth_google')}
          disabled={loading || ssoProviderLoading !== null}
        >
          <Ionicons name="logo-google" size={20} color="#fff" style={styles.oauthIcon} />
          <Text style={[styles.authButtonText, styles.googleButtonText]}>Sign Up with Google</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.authButtonInternal, styles.discordButton]}
          onPress={() => handleOAuth('oauth_discord')}
          disabled={loading || ssoProviderLoading !== null}
        >
          <Ionicons
            name="logo-discord"
            size={20}
            color={Colors.dark.white}
            style={styles.oauthIcon}
          />
          <Text style={[styles.authButtonText, styles.discordButtonText]}>
            Sign Up with Discord
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            clearForm()
            setAuthView('signin')
          }}
          style={styles.switchAuthLink}
        >
          <Text style={styles.switchAuthText}>Already have an account? Log In</Text>
        </TouchableOpacity>
      </>,
    )

  const renderVerificationContent = () =>
    renderAuthFormBase(
      'Verify Your Email',
      <>
        <Text style={styles.verificationSubtitle}>Enter the code sent to {emailAddress}</Text>
        <TextInput
          placeholder="Verification Code"
          value={code}
          onChangeText={setCode}
          style={styles.inputField}
          keyboardType="number-pad"
          placeholderTextColor={Colors.dark.gray400}
        />
        <TouchableOpacity
          style={[styles.authButtonInternal, styles.submitButton]}
          onPress={handleVerification}
          disabled={loading}
        >
          <Text style={styles.authButtonText}>Verify Email</Text>
        </TouchableOpacity>
      </>,
      'signup',
    )

  return (
    <LinearGradient
      colors={[Colors.dark.primaryBg, Colors.dark.secondaryBg, Colors.dark.darkerBg]}
      style={styles.container}
    >
      {[...Array(5)].map((_, i) => (
        <AnimatedParticle key={`particle-${i}`} index={i} />
      ))}

      <View style={styles.contentContainer}>
        {authView === 'landing' && renderLandingContent()}
        {authView === 'signin' && renderSignInContent()}
        {authView === 'signup' && renderSignUpContent()}
        {authView === 'verify' && renderVerificationContent()}
      </View>
      <Spinner
        visible={loading || ssoProviderLoading !== null}
        textContent={
          ssoProviderLoading
            ? `Connecting with ${ssoProviderLoading.charAt(0).toUpperCase() + ssoProviderLoading.slice(1)}...`
            : 'Processing...'
        }
        textStyle={styles.spinnerTextStyle}
        overlayColor="rgba(0,0,0,0.6)"
      />
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fullScreenLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: Colors.dark.text,
    fontSize: 16,
  },
  particle: {
    position: 'absolute',
    borderRadius: 50,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    zIndex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  appName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginTop: 10,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 22,
    color: Colors.dark.gray300,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 5,
    fontWeight: '600',
  },
  subTagline: {
    fontSize: 18,
    color: Colors.dark.gray400,
    textAlign: 'center',
    marginBottom: 50,
  },
  buttonContainer: {
    width: '90%',
    maxWidth: 400,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  signUpButton: {
    backgroundColor: Colors.dark.pink500,
  },
  loginButton: {
    backgroundColor: 'transparent',
    borderColor: Colors.dark.pink500,
    borderWidth: 2,
  },
  buttonText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '600',
  },
  loginButtonText: {
    color: Colors.dark.pink500,
  },
  authFormContainer: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    paddingTop: 60,
    backgroundColor: Colors.dark.secondaryBgTransparent,
    borderRadius: 15,
    alignItems: 'center',
  },

  authTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 25,
    textAlign: 'center',
  },
  inputField: {
    width: '100%',
    backgroundColor: Colors.dark.inputBg,
    color: Colors.dark.text,
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.dark.gray500,
  },
  authButtonInternal: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    flexDirection: 'row',
  },
  submitButton: {
    backgroundColor: Colors.dark.pink500,
  },
  authButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    color: Colors.dark.gray300,
    marginVertical: 10,
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  googleButtonText: {
    color: '#ffffff',
  },
  discordButton: {
    backgroundColor: '#5865F2',
  },
  discordButtonText: {
    color: Colors.dark.white,
  },
  oauthIcon: {
    marginRight: 10,
  },
  switchAuthLink: {
    marginTop: 15,
  },
  switchAuthText: {
    color: Colors.dark.pink300,
    fontSize: 14,
    textAlign: 'center',
  },
  verificationSubtitle: {
    color: Colors.dark.gray300,
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
    paddingHorizontal: 10,
  },
  spinnerTextStyle: {
    color: '#FFF',
  },
  backToHomeButton: {
    position: 'absolute',
    top: 15,
    left: 15,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    zIndex: 10,
  },
  backToHomeButtonText: {
    color: Colors.dark.text,
    marginLeft: 5,
    fontSize: 14,
  },
})

export default IndexPage
