/**
 * Desktop (system) notifications through the browser's Notification API.
 *
 * They work while the dashboard tab is open, also when it's in the background or
 * minimized. Notifications while the site is closed would need Web Push from the backend.
 */
import logo from '@/assets/warsha-logo-sm.png';

/** Fired on window after the permission changes from inside the app. */
export const BROWSER_NOTIFICATIONS_CHANGED = 'browser-notifications:changed';

export const browserNotificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

/** 'default' (not asked yet), 'granted', 'denied' (blocked), or 'unsupported'. */
export function getBrowserNotificationPermission() {
  return browserNotificationsSupported() ? Notification.permission : 'unsupported';
}

/** Shows the browser's Allow / Block prompt. Call it from a click: browsers block it otherwise. */
export async function requestBrowserNotificationPermission() {
  if (!browserNotificationsSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  window.dispatchEvent(new Event(BROWSER_NOTIFICATIONS_CHANGED));
  return permission;
}

/**
 * Shows a desktop notification when the tab is in the background and permission was given.
 * Returns true if it was shown; false means "show the in-app toast instead".
 * `tag` stops the same item from showing twice.
 */
export function notifyInBackground({ tag, title, body }) {
  if (!document.hidden) return false;
  return showDesktopNotification({ tag, title, body });
}

/**
 * Shows a desktop notification whether or not the tab is in front (needs permission).
 * `sticky` keeps it on screen until it's clicked or closed, instead of fading after a few seconds.
 */
export function showDesktopNotification({ tag, title, body, sticky = false }) {
  if (getBrowserNotificationPermission() !== 'granted') return false;

  try {
    const notification = new Notification(title, {
      body,
      tag,
      icon: logo,
      requireInteraction: sticky,
    });
    notification.onclick = () => {
      window.focus(); // bring the dashboard tab to the front
      notification.close();
    };
    return true;
  } catch {
    // e.g. Chrome on Android only allows notifications from a service worker.
    return false;
  }
}
