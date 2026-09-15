import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";

import { registerPushToken } from "@/integrations/native/native-bridge";
import { registerDeviceToken } from "@/lib/notifications.functions";

export function usePushRegistration() {
  const registerFn = useServerFn(registerDeviceToken);

  useEffect(() => {
    let cancelled = false;
    registerPushToken().then((result) => {
      if (cancelled || !result.token) return;
      void registerFn({ data: { token: result.token, platform: result.platform } }).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [registerFn]);
}
