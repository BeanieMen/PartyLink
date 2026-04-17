import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { prepareApiClient } from './src/api/client';
import { LaunchCurtain } from './src/components/LaunchCurtain';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppProviders } from './src/providers/AppProviders';

export default function App() {
  const [isApiReady, setIsApiReady] = useState(false);
  const [isCurtainDone, setIsCurtainDone] = useState(false);

  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    let isMounted = true;

    prepareApiClient()
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) {
          setIsApiReady(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isAppReady = fontsLoaded && isApiReady;

  return (
    <AppProviders>
      <StatusBar style="light" />

      {isAppReady ? <AppNavigator /> : null}

      {!isCurtainDone ? <LaunchCurtain canReveal={isAppReady} onRevealComplete={() => setIsCurtainDone(true)} /> : null}
    </AppProviders>
  );
}
