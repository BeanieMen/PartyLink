'use client';

import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: '#e11d48',
          colorText: '#f8fafc',
          colorTextSecondary: '#b8c4d1',
          colorBackground: '#0a0a0a',
          colorInputBackground: '#18181b',
          colorInputText: '#f8fafc',
          borderRadius: '8px',
        },
        elements: {
          cardBox: 'auth-card-box',
          card: 'auth-card',
          footer: 'auth-footer',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ClerkProvider>
  );
}
