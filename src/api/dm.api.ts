import { apiRequest, apiRequestWithMeta } from './client';
import { endpoint } from './endpoints';
import type { ApiMeta, CursorPage } from './types';

export interface DmThread {
  id: string;
  party_id: string | null;
  participant_a: string;
  participant_b: string;
  status: string;
  updated_at: string;
}

export interface DmMessage {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
}

const pageFromMeta = <T>(items: T[], meta: ApiMeta, requestedLimit: number): CursorPage<T> => ({
  items,
  nextCursor: typeof meta.nextCursor === 'string' ? meta.nextCursor : null,
  hasMore: Boolean(meta.hasMore),
  limit: typeof meta.limit === 'number' ? meta.limit : requestedLimit,
});

export async function fetchDmThreads(params?: { limit?: number; cursor?: string }) {
  const limit = params?.limit ?? 20;
  const response = await apiRequestWithMeta<DmThread[]>({
    method: 'GET',
    url: endpoint.dmThreads,
    params: {
      limit,
      cursor: params?.cursor,
    },
  });

  return pageFromMeta(response.data, response.meta, limit);
}

export async function createDmThread(payload: { targetUserId: string; partyId?: string }) {
  return apiRequest<{ threadId: string; existing?: boolean; status?: string }>({
    method: 'POST',
    url: endpoint.dmThreads,
    data: payload,
  });
}

export async function updateDmThreadStatus(threadId: string, action: 'accept' | 'decline' | 'block' | 'close') {
  return apiRequest<{ updated: true; status: string }>({
    method: 'PATCH',
    url: endpoint.dmThread(threadId),
    data: { action },
  });
}

export async function fetchThreadMessages(threadId: string, params?: { limit?: number; cursor?: string }) {
  const limit = params?.limit ?? 30;
  const response = await apiRequestWithMeta<DmMessage[]>({
    method: 'GET',
    url: endpoint.dmMessages(threadId),
    params: {
      limit,
      cursor: params?.cursor,
    },
  });

  return pageFromMeta(response.data, response.meta, limit);
}

export async function sendThreadMessage(threadId: string, body: string) {
  return apiRequest<{ id: string; threadId: string; senderUserId: string; body: string }>({
    method: 'POST',
    url: endpoint.dmMessages(threadId),
    data: { body },
  });
}