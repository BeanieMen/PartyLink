'use client';

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function configureNativeShell() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0a0a0a' });
    await SplashScreen.hide();
  } catch {
    // Native plugins are unavailable during regular web development.
  }
}

export async function impact() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics are a progressive enhancement.
  }
}
