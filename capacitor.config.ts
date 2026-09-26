import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // appId follows reverse-domain convention. You don't own tally.app or
  // similar, so this is a placeholder — change it before you ever publish
  // anywhere, since it CANNOT be changed after a first Play Store upload.
  appId: 'com.tally.app',
  appName: 'Tally',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
