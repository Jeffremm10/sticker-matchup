import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.swapstrat.app",
  appName: "SwapStrat",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
  ios: {
    scheme: "io.swapstrat.app",
  },
};

export default config;
