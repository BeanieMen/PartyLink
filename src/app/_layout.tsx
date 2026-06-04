import { DarkTheme, DefaultTheme, ThemeProvider, Slot } from 'expo-router';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

WebBrowser.maybeCompleteAuthSession();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error(
    'Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env',
  );
}

const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch (error) {
      console.error('SecureStore get item error: ', error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch {
      return;
    }
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();

  const content = (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Slot />
    </ThemeProvider>
  );

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ClerkLoaded>
        <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
