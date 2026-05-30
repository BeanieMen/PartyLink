import type {
  ApiEnvelope,
  AttendanceRow,
  AttendResponse,
  MeProfile,
  PartyDetail,
  PartySummary,
} from '@/types/domain';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:4000';

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
  const url = new URL(path, API_BASE_URL);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

export function assetUrl(path: string) {
  return makeUrl(path);
}

export async function requestJson<T>({ path, method = 'GET', query, body, userId }: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (userId) headers['x-user-id'] = userId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(makeUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : 'Unable to reach the PartyLink backend', 'NETWORK_ERROR');
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

export async function uploadImage(userId: string, path: string, file: File) {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch(makeUrl(path), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'x-user-id': userId,
    },
    body: formData,
  });

  const payload = (await response.json()) as ApiEnvelope<{ updated: true }>;
  if (!response.ok || !payload.success) {
    const message = payload.success ? `Upload failed with ${response.status}` : payload.error.message;
    const code = payload.success ? 'UPLOAD_ERROR' : payload.error.code;
    throw new ApiError(message, code, response.status);
  }

  return payload.data;
}

export const api = {
  listParties: () => requestJson<PartySummary[]>({ path: '/v1/parties', query: { limit: 30 } }),
  getParty: (userId: string, partyId: string) => requestJson<PartyDetail>({ path: `/v1/parties/${partyId}`, userId }),
  partyBanner: (partyId: string) => assetUrl(`/v1/parties/${partyId}/banner`),
  getMe: (userId: string) => requestJson<MeProfile>({ path: '/v1/users/me', userId }),
  updateMe: (userId: string, body: { displayName?: string; bio?: string; school?: string }) =>
    requestJson<{ updated: true }>({ path: '/v1/users/me/profile', method: 'PATCH', body, userId }),
  profilePicture: (userId: string) => assetUrl(`/v1/users/${userId}/profile-picture`),
  uploadProfilePicture: (userId: string, file: File) => uploadImage(userId, '/v1/users/me/profile-picture', file),
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
