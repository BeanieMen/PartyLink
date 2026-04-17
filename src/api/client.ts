import axios, { AxiosHeaders } from 'axios';
import type { AxiosError, AxiosRequestConfig } from 'axios';
import { useSessionStore } from '../store/session-store';
import { getApiBaseUrl, resolveApiBaseUrl } from './runtime-base-url';
import { ApiClientError, type ApiEnvelope, type ApiErrorEnvelope, type ApiMeta } from './types';

export interface ApiResponseWithMeta<T> {
  data: T;
  meta: ApiMeta;
  status: number;
}

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
});

let apiClientPrepared = false;

export async function prepareApiClient() {
  if (apiClientPrepared) return getApiBaseUrl();
  const resolvedBaseUrl = await resolveApiBaseUrl();
  apiClient.defaults.baseURL = resolvedBaseUrl;
  apiClientPrepared = true;
  return resolvedBaseUrl;
}

apiClient.interceptors.request.use((config) => {
  const userId = useSessionStore.getState().currentUserId;
  if (userId) {
    if (config.headers && typeof (config.headers as { set?: unknown }).set === 'function') {
      (config.headers as { set: (name: string, value: string) => void }).set('x-user-id', userId);
    } else {
      const headers = new AxiosHeaders(config.headers);
      headers.set('x-user-id', userId);
      config.headers = headers;
    }
  }
  return config;
});

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
  return isObject(payload) && typeof payload.success === 'boolean';
}

function toApiError(error: unknown): ApiClientError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorEnvelope | { message?: string; code?: string }>;
    const status = axiosError.response?.status ?? 500;
    const body = axiosError.response?.data;

    if (!axiosError.response) {
      return new ApiClientError(
        0,
        'NETWORK_ERROR',
        'Unable to load events right now. Please check your connection and try again.',
      );
    }

    if (isApiEnvelope<never>(body) && body.success === false) {
      return new ApiClientError(status, body.error.code, body.error.message, body.error.details, body.meta?.requestId as string | undefined);
    }

    const fallbackMessage = isObject(body) && typeof body.message === 'string' ? body.message : axiosError.message;
    const fallbackCode = isObject(body) && typeof body.code === 'string' ? body.code : 'INTERNAL_ERROR';

    if (status === 401 || status === 403) {
      return new ApiClientError(status, fallbackCode, 'Please sign in to continue.');
    }

    if (status === 404) {
      return new ApiClientError(status, fallbackCode, 'We could not find that page.');
    }

    if (status === 409) {
      return new ApiClientError(status, fallbackCode, 'That action is no longer available.');
    }

    if (status === 429) {
      return new ApiClientError(status, fallbackCode, 'Too many attempts. Please wait a moment and try again.');
    }

    if (status >= 500) {
      return new ApiClientError(status, fallbackCode, 'We hit a temporary issue. Please try again shortly.');
    }

    return new ApiClientError(status, fallbackCode, fallbackMessage || 'Request failed');
  }

  if (error instanceof Error) {
    return new ApiClientError(500, 'INTERNAL_ERROR', error.message);
  }

  return new ApiClientError(500, 'INTERNAL_ERROR', 'Unknown request error');
}

export async function apiRequestWithMeta<T>(config: AxiosRequestConfig): Promise<ApiResponseWithMeta<T>> {
  try {
    const response = await apiClient.request<ApiEnvelope<T> | T>(config);
    const payload = response.data;

    if (isApiEnvelope<T>(payload)) {
      if (payload.success) {
        return {
          data: payload.data,
          meta: payload.meta ?? {},
          status: response.status,
        };
      }

      throw new ApiClientError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.details,
        payload.meta?.requestId as string | undefined,
      );
    }

    return {
      data: payload as T,
      meta: {},
      status: response.status,
    };
  } catch (error) {
    throw toApiError(error);
  }
}

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await apiRequestWithMeta<T>(config);
  return response.data;
}