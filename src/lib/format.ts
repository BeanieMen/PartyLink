export function formatMoney(cents: number) {
  if (cents <= 0) return 'Free';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatPartyDate(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return `${date} at ${time}`;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

export function compactId(value: string, size = 6) {
  if (value.length <= size * 2 + 1) return value;
  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

export function displayName(profile?: { display_name?: string | null; username?: string | null } | null) {
  return profile?.display_name?.trim() || profile?.username?.trim() || 'PARTYLINK user';
}

export function isPrivateFlag(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

export function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)}m away`;
  return `${km.toFixed(1)}km away`;
}
