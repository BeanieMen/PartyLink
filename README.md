# PartyLink Mobile (React Native + Expo)

Skillbox-inspired PartyLink mobile app with a bold event UI, cursor-based API integrations, and optional local login.

## Stack

- Expo + React Native + TypeScript
- React Navigation (native stack)
- TanStack Query
- Zustand (persisted session)
- Axios API client with typed envelope parsing
- React Hook Form + Zod

## Key Product Behavior

- Guest mode by default (no mandatory login on app launch)
- Login only when users try to enter protected party flows
- Session identity is added automatically on protected requests
- Party-like gradient visual system inspired by Skillbox layout language
- Auto-detects a reachable local backend URL on startup in development

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env
```

3. Start app:

```bash
npm run start
```

Then run with `a` (Android), `i` (iOS simulator on macOS), or scan QR in Expo Go.

## Local Backend

- Default API URL: `http://localhost:4000`
- Health endpoint: `/health/live`

If running on a physical phone, set `EXPO_PUBLIC_API_BASE_URL` to your machine LAN IP, for example:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:4000
```

## Notes

- The app expects PartyLink backend envelope responses for `/v1/*` routes.
- Group join requests are supported by direct group ID input because no public list-groups endpoint currently exists.
- Token auth is not required in this build; architecture is ready to evolve from `x-user-id` to bearer tokens.
