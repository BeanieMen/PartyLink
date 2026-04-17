import { apiRequest } from './client';
import { absoluteUrl, endpoint } from './endpoints';

export interface MeProfile {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  school: string | null;
  is_private: number;
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  school: string | null;
}

export interface UpdateProfilePayload {
  displayName?: string;
  bio?: string;
  school?: string;
  isPrivate?: boolean;
  instagramUrl?: string;
  socialLinks?: string[];
}

function buildImageFormData(imageUri: string) {
  const extMatch = imageUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = extMatch?.[1]?.toLowerCase() ?? 'jpg';

  const normalizedExt = ext === 'png' || ext === 'webp' || ext === 'jpeg' || ext === 'jpg' ? ext : 'jpg';
  const mimeType = normalizedExt === 'png' ? 'image/png' : normalizedExt === 'webp' ? 'image/webp' : 'image/jpeg';

  const formData = new FormData();
  formData.append(
    'image',
    {
      uri: imageUri,
      name: `upload.${normalizedExt}`,
      type: mimeType,
    } as unknown as Blob,
  );

  return formData;
}

export function userProfilePictureUrl(userId: string) {
  return absoluteUrl(endpoint.userProfilePicture(userId));
}

export function userPortraitUrl(userId: string) {
  return absoluteUrl(endpoint.userPortrait(userId));
}

export async function fetchMeProfile() {
  return apiRequest<MeProfile>({
    method: 'GET',
    url: endpoint.me,
  });
}

export async function updateMeProfile(payload: UpdateProfilePayload) {
  return apiRequest<{ updated: true }>({
    method: 'PATCH',
    url: endpoint.meProfile,
    data: payload,
  });
}

export async function uploadMeProfilePicture(imageUri: string) {
  const formData = buildImageFormData(imageUri);
  return apiRequest<{ updated: true }>({
    method: 'POST',
    url: endpoint.meProfilePicture,
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export async function uploadMePortrait(imageUri: string) {
  const formData = buildImageFormData(imageUri);
  return apiRequest<{ updated: true }>({
    method: 'POST',
    url: endpoint.mePortrait,
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export async function fetchPublicProfile(userId: string) {
  return apiRequest<PublicProfile>({
    method: 'GET',
    url: endpoint.publicUser(userId),
  });
}

export async function fetchMyAttendingParties(userId: string) {
  const rows = await apiRequest<Array<{ party_id: string }>>({
    method: 'GET',
    url: endpoint.userAttending(userId),
  });

  return rows.map((row) => row.party_id);
}