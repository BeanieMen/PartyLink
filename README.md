# PartyLink Mobile

Next.js + Capacitor + Clerk frontend for PartyLink event discovery and ticketing.

## Run locally

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:8081`, matching the backend CORS default.

## Environment

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key_here
```

## Capacitor

```bash
npm run cap:sync
npm run cap:open:ios
npm run cap:open:android
```

`next build` exports the web bundle into `out/`, and Capacitor uses that folder
as `webDir`.
