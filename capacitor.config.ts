// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tuapp.ejemplo',
  appName: 'VentasPro',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    compileOptions: {
      sourceCompatibility: 17,
      targetCompatibility: 17
    },
    kotlinOptions: {
      jvmTarget: '17'
    }
  }
};

export default config;
