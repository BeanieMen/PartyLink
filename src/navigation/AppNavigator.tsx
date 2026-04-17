import { NavigationContainer, type Theme as NavigationTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';
import { HomeScreen } from '../features/home/HomeScreen';
import { PartyDetailScreen } from '../features/parties/PartyDetailScreen';
import { InboxScreen } from '../features/dm/InboxScreen';
import { ThreadScreen } from '../features/dm/ThreadScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { AccountEditScreen } from '../features/profile/AccountEditScreen';
import { TicketsScreen } from '../features/tickets/TicketsScreen';
import { AuthGateScreen } from '../features/auth/AuthGateScreen';
import type { RootStackParamList } from './types';

const navigationTheme: NavigationTheme = {
  dark: true,
  colors: {
    primary: colors.accentOrange,
    background: colors.gradientTop,
    card: colors.surfaceStrong,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.accentRose,
  },
  fonts: {
    regular: { fontFamily: fonts.body, fontWeight: '400' },
    medium: { fontFamily: fonts.medium, fontWeight: '500' },
    bold: { fontFamily: fonts.bold, fontWeight: '700' },
    heavy: { fontFamily: fonts.display, fontWeight: '400' },
  },
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.gradientTop },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Inbox" component={InboxScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="AccountEdit" component={AccountEditScreen} />
        <Stack.Screen name="Tickets" component={TicketsScreen} />
        <Stack.Screen name="PartyDetail" component={PartyDetailScreen} />
        <Stack.Screen name="ThreadDetail" component={ThreadScreen} />
        <Stack.Screen
          name="AuthGate"
          component={AuthGateScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}