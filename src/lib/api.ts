import type {
  ApiEnvelope,
  AttendanceRow,
  AttendResponse,
  MeProfile,
  PartyDetail,
  PartySummary,
} from '@/types/domain';
import { Platform } from 'react-native';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000';

type RequestOptions = {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  userId?: string;
};

export class ApiError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(message: string, code = 'REQUEST_ERROR', status = 0, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function makeUrl(path: string, query?: RequestOptions['query']) {
  let url = `${API_BASE_URL}${path}`;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  return url;
}

export function assetUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export async function requestJson<T>({ path, method = 'GET', query, body, userId }: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (userId) headers['x-user-id'] = userId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    const fullUrl = makeUrl(path, query);
    response = await fetch(fullUrl, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : 'Unable to reach the PARTYLINK backend', 'NETWORK_ERROR');
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as ApiEnvelope<T> | T | { error?: string }) : null;

  if (!response.ok) {
    if (payload && typeof payload === 'object' && 'success' in payload && payload.success === false) {
      throw new ApiError(payload.error.message, payload.error.code, response.status, payload.error.details);
    }

    if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
      throw new ApiError(payload.error, 'REQUEST_ERROR', response.status);
    }

    throw new ApiError(`Request failed with ${response.status}`, 'REQUEST_ERROR', response.status);
  }

  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (payload.success) return payload.data;
    throw new ApiError(payload.error.message, payload.error.code, response.status, payload.error.details);
  }

  return payload as T;
}

export async function uploadImage(userId: string, path: string, fileUri: string) {
  const formData = new FormData();
  const filename = fileUri.split('/').pop() || 'profile.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const extension = match?.[1]?.toLowerCase();
  const type = extension === 'png' || extension === 'webp' ? `image/${extension}` : 'image/jpeg';

  if (Platform.OS === 'web') {
    const localResponse = await fetch(fileUri);
    const blob = await localResponse.blob();
    formData.append('image', blob, filename);
  } else {
    formData.append('image', {
      uri: fileUri,
      name: filename,
      type,
    } as unknown as Blob);
  }

  const { status, text } = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.onload = () => resolve({ status: request.status, text: request.responseText });
    request.onerror = () => reject(new ApiError('Unable to upload image', 'NETWORK_ERROR'));
    request.ontimeout = () => reject(new ApiError('Image upload timed out', 'NETWORK_ERROR'));

    request.open('POST', makeUrl(path));
    request.setRequestHeader('Accept', 'application/json');
    request.setRequestHeader('x-user-id', userId);
    request.send(formData);
  });

  const payload = text ? (JSON.parse(text) as ApiEnvelope<{ updated: true }>) : null;

  if (status < 200 || status >= 300 || !payload || !payload.success) {
    const message = payload && !payload.success ? payload.error.message : `Upload failed with ${status}`;
    const code = payload && !payload.success ? payload.error.code : 'UPLOAD_ERROR';
    throw new ApiError(message, code, status);
  }

  return payload.data;
}

export const api = {
  listParties: () => requestJson<PartySummary[]>({ path: '/v1/parties', query: { limit: 30 } }),
  getParty: (userId: string, partyId: string) => requestJson<PartyDetail>({ path: `/v1/parties/${partyId}`, userId }),
  partyBanner: (partyId: string) => assetUrl(`/v1/parties/${partyId}/banner`),
  getMe: (userId: string) => requestJson<MeProfile>({ path: '/v1/users/me', userId }),
  updateMe: (userId: string, body: { username?: string; displayName?: string; bio?: string; school?: string }) =>
    requestJson<{ updated: true }>({ path: '/v1/users/me/profile', method: 'PATCH', body, userId }),
  profilePicture: (userId: string) => assetUrl(`/v1/users/${userId}/profile-picture`),
  uploadProfilePicture: (userId: string, fileUri: string) => uploadImage(userId, '/v1/users/me/profile-picture', fileUri),
  getAttending: (userId: string) =>
    requestJson<AttendanceRow[]>({ path: `/v1/users/${userId}/parties-attending`, userId }),
  attendParty: (userId: string, partyId: string) =>
    requestJson<AttendResponse>({ path: `/v1/parties/${partyId}/attend`, method: 'POST', userId }),
};

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
