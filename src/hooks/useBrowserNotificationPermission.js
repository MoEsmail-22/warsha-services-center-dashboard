import { useCallback, useEffect, useState } from 'react';
import {
  BROWSER_NOTIFICATIONS_CHANGED,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '@/utils/browserNotifications';

/**
 * The desktop-notification permission, kept up to date:
 *   const { permission, request } = useBrowserNotificationPermission();
 *   permission: 'default' | 'granted' | 'denied' | 'unsupported'
 *   request(): shows the browser prompt (call it from a click)
 */
export function useBrowserNotificationPermission() {
  const [permission, setPermission] = useState(getBrowserNotificationPermission);

  useEffect(() => {
    const update = () => setPermission(getBrowserNotificationPermission());

    // Changed from inside the app (any component that asked).
    window.addEventListener(BROWSER_NOTIFICATIONS_CHANGED, update);
    // Changed from the browser's site settings (lock icon next to the address bar).
    document.addEventListener('visibilitychange', update);
    let status = null;
    navigator.permissions
      ?.query({ name: 'notifications' })
      .then((result) => {
        status = result;
        status.addEventListener('change', update);
      })
      .catch(() => {});

    return () => {
      window.removeEventListener(BROWSER_NOTIFICATIONS_CHANGED, update);
      document.removeEventListener('visibilitychange', update);
      status?.removeEventListener('change', update);
    };
  }, []);

  const request = useCallback(async () => {
    const result = await requestBrowserNotificationPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, request };
}

export default useBrowserNotificationPermission;
