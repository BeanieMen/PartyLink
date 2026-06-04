export type ApiMeta = {
  requestId?: string;
  timestamp?: string;
  nextCursor?: string | null;
  hasMore?: boolean;
  limit?: number;
};

export type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
      meta: ApiMeta;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
      meta?: ApiMeta;
    };

export type LocationMeta = {
  name: string;
  address: string | null;
  place_id: string | null;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  } | null;
  distance_km?: number | null;
};

export type PartySummary = {
  party_id: string;
  name: string;
  party_date: string;
  party_time: string;
  location: string;
  location_meta: LocationMeta | null;
  image_url: string | null;
  tickets_left: number;
  total_tickets: number;
  price: number;
  ticket_code?: string | null;
};

export type PartyDetail = PartySummary & {
  description: string | null;
};

export type MeProfile = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  school: string | null;
  has_profile_picture?: boolean;
  profile_complete?: boolean;
};

export type AttendanceRow = PartySummary;

export type AttendResponse = {
  success?: boolean;
  message?: string;
  ticketId?: string;
  ticketCode?: string;
  status?: string;
  partyId?: string;
  alreadyAttending?: boolean;
};
