import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;
const HEALTH_PATH = '/health/live';
const CHECK_TIMEOUT_MS = 2500;

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

let activeBaseUrl = normalizeBaseUrl(envBaseUrl || 'http://localhost:4000');
let isResolved = false;

function dedupe(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))];
}

function readExpoHostCandidate() {
  const fallbackSource = Constants as unknown as {
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
  };

  const hostUri = Constants.expoConfig?.hostUri ?? fallbackSource.manifest2?.extra?.expoClient?.hostUri;

  if (!hostUri) return null;
  const host = hostUri.split(':')[0]?.trim();
  if (!host) return null;

  return `http://${host}:${API_PORT}`;
}

async function canReachBackend(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${HEALTH_PATH}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function getApiBaseUrl() {
  return activeBaseUrl;
}

export async function resolveApiBaseUrl() {
  if (isResolved) return activeBaseUrl;

  const candidates = dedupe([
    envBaseUrl ? normalizeBaseUrl(envBaseUrl) : null,
    readExpoHostCandidate(),
    Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : null,
    `http://localhost:${API_PORT}`,
    `http://127.0.0.1:${API_PORT}`,
  ]);

  if (candidates.length > 0) {
    activeBaseUrl = candidates[0]!;
  }

  for (const candidate of candidates) {
    if (await canReachBackend(candidate)) {
      activeBaseUrl = candidate;
      isResolved = true;
      return activeBaseUrl;
    }
  }

  isResolved = true;
  return activeBaseUrl;
}