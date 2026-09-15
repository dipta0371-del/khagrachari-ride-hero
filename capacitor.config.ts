import type { CapacitorConfig } from "@capacitor/core";

const config: CapacitorConfig = {
  appId: "com.chtgari.app",
  appName: "CHT GARI",
  webDir: "dist",
  server: {
    url: "https://khagrachari-ride-hero.lovable.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#2F5D3C",
    },
  },
};

export default config;
