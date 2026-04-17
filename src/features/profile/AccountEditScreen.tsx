import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  fetchMeProfile,
  updateMeProfile,
  uploadMePortrait,
  uploadMeProfilePicture,
  userPortraitUrl,
  userProfilePictureUrl,
} from '../../api/user.api';
import { queryKeys } from '../../api/query-keys';
import { AuthPromptCard } from '../../components/AuthPromptCard';
import { GlassCard } from '../../components/GlassCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StateView } from '../../components/StateView';
import type { RootStackParamList } from '../../navigation/types';
import { useSessionStore } from '../../store/session-store';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { profileFormSchema, toProfilePayload, type ProfileFormValues } from '../../validation/profile';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountEdit'>;

const defaultValues: ProfileFormValues = {
  displayName: '',
  bio: '',
  school: '',
  isPrivate: false,
  instagramUrl: '',
  socialLinks: '',
};

export function AccountEditScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const currentUserId = useSessionStore((state) => state.currentUserId);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [imageVersion, setImageVersion] = useState(0);

  const meQuery = useQuery({
    queryKey: queryKeys.me(currentUserId),
    queryFn: () => fetchMeProfile(),
    enabled: Boolean(currentUserId),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ProfileFormValues) => updateMeProfile(toProfilePayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me(currentUserId) });
      if (currentUserId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.publicUser(currentUserId) });
      }
    },
  });

  const uploadProfilePictureMutation = useMutation({
    mutationFn: (imageUri: string) => uploadMeProfilePicture(imageUri),
    onSuccess: async () => {
      setImageVersion((value) => value + 1);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me(currentUserId) });
      if (currentUserId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.publicUser(currentUserId) });
      }
    },
  });

  const uploadPortraitMutation = useMutation({
    mutationFn: (imageUri: string) => uploadMePortrait(imageUri),
    onSuccess: async () => {
      setImageVersion((value) => value + 1);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me(currentUserId) });
      if (currentUserId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.publicUser(currentUserId) });
      }
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!meQuery.data) return;

    reset({
      displayName: meQuery.data.display_name ?? '',
      bio: meQuery.data.bio ?? '',
      school: meQuery.data.school ?? '',
      isPrivate: Boolean(meQuery.data.is_private),
      instagramUrl: '',
      socialLinks: '',
    });
  }, [meQuery.data, reset]);

  const pictureUri = useMemo(() => {
    if (!currentUserId) return null;
    return `${userProfilePictureUrl(currentUserId)}?v=${imageVersion}`;
  }, [currentUserId, imageVersion]);

  const portraitUri = useMemo(() => {
    if (!currentUserId) return null;
    return `${userPortraitUrl(currentUserId)}?v=${imageVersion}`;
  }, [currentUserId, imageVersion]);

  const pickAndUpload = async (target: 'profile-picture' | 'portrait') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickerError('Allow photo access to upload your images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });

    if (result.canceled) return;

    const selected = result.assets?.[0];
    if (!selected?.uri) {
      setPickerError('Could not read that image. Try another one.');
      return;
    }

    setPickerError(null);

    if (target === 'profile-picture') {
      uploadProfilePictureMutation.mutate(selected.uri);
      return;
    }

    uploadPortraitMutation.mutate(selected.uri);
  };

  if (!currentUserId) {
    return (
      <ScreenContainer>
        <Text style={styles.pageTitle}>Edit Account</Text>
        <Text style={styles.pageHint}>Sign in to edit your account.</Text>
        <AuthPromptCard
          title="Sign in to edit your account"
          description="Your profile picture and portrait can be updated after sign in."
          onPressLogin={() => navigation.navigate('AuthGate', { reason: 'Sign in to edit your account.' })}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Edit Account</Text>
        <View style={styles.iconButton} />
      </View>

      {meQuery.isLoading ? <StateView loading /> : null}
      {meQuery.isError ? <StateView errorMessage={(meQuery.error as Error).message} onRetry={meQuery.refetch} /> : null}

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Images</Text>
        <Text style={styles.sectionHint}>Upload both image types so your profile and card previews look correct.</Text>

        <View style={styles.uploadRow}>
          <View style={styles.uploadItem}>
            <Text style={styles.uploadLabel}>Profile Picture</Text>
            {pictureUri ? <Image source={{ uri: pictureUri }} style={styles.squarePreview} /> : null}
            <PrimaryButton
              label="Upload Profile Picture"
              variant="outline"
              loading={uploadProfilePictureMutation.isPending}
              onPress={() => {
                void pickAndUpload('profile-picture');
              }}
            />
          </View>

          <View style={styles.uploadItem}>
            <Text style={styles.uploadLabel}>Portrait</Text>
            {portraitUri ? <Image source={{ uri: portraitUri }} style={styles.portraitPreview} /> : null}
            <PrimaryButton
              label="Upload Portrait"
              variant="outline"
              loading={uploadPortraitMutation.isPending}
              onPress={() => {
                void pickAndUpload('portrait');
              }}
            />
          </View>
        </View>

        {pickerError ? <Text style={styles.error}>{pickerError}</Text> : null}
        {uploadProfilePictureMutation.isError ? (
          <Text style={styles.error}>{(uploadProfilePictureMutation.error as Error).message}</Text>
        ) : null}
        {uploadPortraitMutation.isError ? <Text style={styles.error}>{(uploadPortraitMutation.error as Error).message}</Text> : null}
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Public Details</Text>

        <Field label="Display name" error={errors.displayName?.message}>
          <Controller
            control={control}
            name="displayName"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={styles.input}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Your display name"
                placeholderTextColor="rgba(255,255,255,0.54)"
              />
            )}
          />
        </Field>

        <Field label="Bio" error={errors.bio?.message}>
          <Controller
            control={control}
            name="bio"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Write something people should know"
                placeholderTextColor="rgba(255,255,255,0.54)"
                multiline
              />
            )}
          />
        </Field>

        <Field label="School" error={errors.school?.message}>
          <Controller
            control={control}
            name="school"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={styles.input}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="School / college"
                placeholderTextColor="rgba(255,255,255,0.54)"
              />
            )}
          />
        </Field>

        <Controller
          control={control}
          name="isPrivate"
          render={({ field: { value, onChange } }) => (
            <Pressable style={styles.toggle} onPress={() => onChange(!value)}>
              <View style={[styles.toggleDot, value && styles.toggleDotOn]} />
              <Text style={styles.toggleLabel}>Private account</Text>
            </Pressable>
          )}
        />

        {updateMutation.isError ? <Text style={styles.error}>{(updateMutation.error as Error).message}</Text> : null}

        <PrimaryButton
          label="Save Changes"
          loading={updateMutation.isPending}
          onPress={handleSubmit((values: ProfileFormValues) => updateMutation.mutate(values))}
        />
      </GlassCard>
    </ScreenContainer>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 14,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
    letterSpacing: 1,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 46,
    marginTop: 8,
  },
  pageHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: 12,
  },
  card: {
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  sectionHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  uploadRow: {
    gap: 10,
  },
  uploadItem: {
    gap: 8,
  },
  uploadLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  squarePreview: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1,
    borderColor: colors.border,
  },
  portraitPreview: {
    width: '100%',
    height: 210,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  textArea: {
    minHeight: 78,
    textAlignVertical: 'top',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  toggleDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  toggleDotOn: {
    backgroundColor: colors.accentOrange,
    borderColor: colors.accentOrange,
  },
  toggleLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
});
