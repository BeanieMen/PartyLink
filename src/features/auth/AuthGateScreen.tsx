import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import type { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/session-store';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';

const authGateSchema = z.object({
  identity: z.string().trim().min(1, 'Enter email or mobile number'),
});

type AuthGateValues = z.infer<typeof authGateSchema>;

type Props = NativeStackScreenProps<RootStackParamList, 'AuthGate'>;

export function AuthGateScreen({ navigation, route }: Props) {
  const setCurrentUserId = useSessionStore((state) => state.setCurrentUserId);
  const queryClient = useQueryClient();

  const completeSignIn = async (rawIdentity: string) => {
    const normalized = rawIdentity.trim().toLowerCase().slice(0, 128);
    setCurrentUserId(normalized);
    await queryClient.invalidateQueries();

    if (route.params?.partyId) {
      navigation.replace('PartyDetail', { partyId: route.params.partyId });
      return;
    }

    navigation.goBack();
  };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthGateValues>({
    resolver: zodResolver(authGateSchema),
    defaultValues: {
      identity: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await completeSignIn(values.identity);
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#171717" />
          </Pressable>
          <Text style={styles.headerTitle}>Login</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <Text style={styles.fieldLabel}>Email or mobile number</Text>
          <Controller
            control={control}
            name="identity"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Enter email or mobile number"
                placeholderTextColor="#8D8D8D"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            )}
          />
          {errors.identity ? <Text style={styles.error}>{errors.identity.message}</Text> : null}

          <Pressable style={styles.primaryButton} onPress={onSubmit} disabled={isSubmitting}>
            <Text style={styles.primaryButtonText}>{isSubmitting ? 'Please wait...' : 'Get OTP'}</Text>
          </Pressable>

          <Text style={styles.secondaryLink}>Login with Password</Text>

          <View style={styles.divider} />

          <Text style={styles.signupText}>
            Don't have an account? <Text style={styles.signupStrong}>[Sign Up]</Text>
          </Text>
          <Text style={styles.orText}>or</Text>

          <Pressable style={styles.googleButton} onPress={() => completeSignIn('google-user')}>
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  root: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 30,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#1D1D1D',
    fontFamily: fonts.bold,
    fontSize: 36,
    lineHeight: 36,
  },
  headerSpacer: {
    width: 34,
  },
  content: {
    marginTop: 12,
    gap: 14,
  },
  fieldLabel: {
    color: '#2A2A2A',
    fontFamily: fonts.medium,
    fontSize: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    color: '#222222',
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  error: {
    color: '#B3261E',
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 14,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  secondaryLink: {
    marginTop: 8,
    textAlign: 'center',
    color: '#7A7A7A',
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  divider: {
    marginTop: 10,
    height: 1,
    backgroundColor: '#CFCFCF',
  },
  signupText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#555555',
    fontFamily: fonts.body,
    fontSize: 16,
  },
  signupStrong: {
    color: '#121212',
    fontFamily: fonts.bold,
  },
  orText: {
    textAlign: 'center',
    color: '#5A5A5A',
    fontFamily: fonts.bold,
    fontSize: 20,
    marginTop: -2,
  },
  googleButton: {
    marginTop: 2,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8D8D8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleButtonText: {
    color: '#151515',
    fontFamily: fonts.medium,
    fontSize: 21,
  },
});