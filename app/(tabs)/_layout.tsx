import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { ActivityIndicator, View } from 'react-native';
import Colors from '@/constants';

export default function AppLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: Colors.dark.primaryBg,
        }}
      >
        <ActivityIndicator size="large" color={Colors.dark.pink400} />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/" />;
  }

  return (
    <Stack>
      <Stack.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          headerStyle: { backgroundColor: Colors.dark.secondaryBg },
          headerTintColor: Colors.dark.text,
        }}
      />


      <Stack.Screen
        name="party/[partyId]/groups/explore"
        options={{
          headerShown: false,
          animation: 'fade',
        }}
      />

    </Stack>
  );
}