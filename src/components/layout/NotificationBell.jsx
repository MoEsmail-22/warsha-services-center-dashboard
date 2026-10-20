/**
 * NotificationBell — Topbar bell with an unread badge and a dropdown list.
 * Clicking an unread notification marks it as read.
 */
import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, BellRing, CheckCheck, Volume2, VolumeX } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useNotify } from '@/hooks/useNotify';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useSoundEnabled } from '@/hooks/useSoundEnabled';
import { useBrowserNotificationPermission } from '@/hooks/useBrowserNotificationPermission';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';
import { parseServerTime } from '@/utils/serverTime';

// Largest unit first: the first one that fits is used ("3 hours ago", not "180 minutes ago").
const TIME_UNITS = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
];

/**
 * "5 minutes ago" / «منذ 5 دقائق» with the browser's built-in Intl (no date library needed).
 * Times come in UTC without a zone: parseServerTime reads them as UTC.
 */
function timeAgo(value, lang) {
  const date = parseServerTime(value);
  if (!date) return '';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  for (const [unit, size] of TIME_UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'second'); // "now" / «الآن»
}

export default function NotificationBell() {
  const { t } = useAppTranslation('common');
  const { lang } = useLanguage();
  const notify = useNotify();
  const { getErrorMessage } = useErrorMessage();
  const {
    items,
    unreadCount,
    loading,
    error,
    hasMore,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const { permission, request: requestPermission } = useBrowserNotificationPermission();
  const { soundOn, toggleSound } = useSoundEnabled();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const text = (key, defaultValue, options) =>
    t(`notificationsPanel.${key}`, { defaultValue, ...options });

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const toggle = () => {
    // Opening shows the latest notifications, not the ones from the last minute's check.
    if (!open) refresh();
    setOpen((current) => !current);
  };

  const handleItemClick = async (item) => {
    if (item.isRead) return;
    try {
      await markAsRead(item.id);
    } catch (err) {
      notify.error(err, 'notifications.markRead');
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
    } catch (err) {
      notify.error(err, 'notifications.markRead');
    }
  };

  // The browser only shows its Allow / Block prompt after a click, so this runs from the button.
  const enableDesktopNotifications = async () => {
    if ((await requestPermission()) === 'granted') notify.success('desktopNotificationsOn');
  };

  const badge = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={toggle}
        className="relative rounded-md p-2 text-gray-600 transition hover:bg-gray-100"
        aria-label={text('open', 'Notifications, {{count}} unread', { count: unreadCount })}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-[#15201F]">{text('title', 'Notifications')}</p>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-xs font-semibold text-[#0E5C5B] hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {text('markAllRead', 'Mark all as read')}
                </button>
              )}
              {/* Sound for new notifications and bookings (turning it on plays a sample) */}
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={soundOn}
                title={
                  soundOn
                    ? text('sound.turnOff', 'Turn sound off')
                    : text('sound.turnOn', 'Turn sound on')
                }
                aria-label={
                  soundOn
                    ? text('sound.turnOff', 'Turn sound off')
                    : text('sound.turnOn', 'Turn sound on')
                }
                className={cn(
                  'rounded-md p-1 transition-colors hover:bg-gray-100',
                  soundOn ? 'text-[#0E5C5B]' : 'text-gray-400'
                )}
              >
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Desktop notifications: ask once; explain how to unblock if the user blocked them. */}
          {permission === 'default' && (
            <button
              type="button"
              onClick={enableDesktopNotifications}
              className="flex w-full items-start gap-2.5 border-b border-gray-100 bg-[#F2F8F7] px-4 py-2.5 text-start hover:bg-[#E8F1EF]"
            >
              <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-[#0E5C5B]" aria-hidden="true" />
              <span>
                <span className="block text-xs font-semibold text-[#0E5C5B]">
                  {text('desktop.enable', 'Turn on desktop notifications')}
                </span>
                <span className="block text-xs text-[#5A6968]">
                  {text(
                    'desktop.enableHint',
                    'Get alerts for new bookings and notifications while this tab is in the background.'
                  )}
                </span>
              </span>
            </button>
          )}
          {permission === 'denied' && (
            <p className="flex items-start gap-2.5 border-b border-gray-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
              <BellOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {text(
                'desktop.blocked',
                'Desktop notifications are blocked. To allow them, click the lock icon next to the address bar.'
              )}
            </p>
          )}

          <div className="max-h-[60vh] overflow-y-auto">
            {error && items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-red-600">
                  {getErrorMessage(error, 'notifications.load')}
                </p>
                <button
                  type="button"
                  onClick={refresh}
                  className="mt-2 text-xs font-semibold text-[#0E5C5B] hover:underline"
                >
                  {t('errorPage.retry', { defaultValue: 'Try again' })}
                </button>
              </div>
            ) : loading && items.length === 0 ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <Bell className="h-6 w-6 text-gray-300" />
                <p className="text-sm text-gray-500">{text('empty', 'No notifications yet.')}</p>
              </div>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        'flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-start transition last:border-b-0 hover:bg-gray-50',
                        !item.isRead && 'bg-[#F2F8F7]'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          item.isRead ? 'bg-transparent' : 'bg-[#0E5C5B]'
                        )}
                        aria-label={item.isRead ? undefined : text('unread', 'Unread')}
                      />
                      <span className="min-w-0 flex-1">
                        {(item.title[lang] || item.title.en) && (
                          <span
                            className={cn(
                              'block text-sm text-[#15201F]',
                              !item.isRead && 'font-semibold'
                            )}
                          >
                            {item.title[lang] || item.title.en}
                          </span>
                        )}
                        <span className="block text-sm text-[#5A6968]">
                          {item.message[lang] || item.message.en}
                        </span>
                        <span className="mt-1 block text-xs text-gray-400">
                          {timeAgo(item.createdAt, lang)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hasMore && items.length > 0 && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 border-t border-gray-100 py-2.5 text-xs font-semibold text-[#0E5C5B] hover:bg-gray-50 disabled:opacity-60"
            >
              {loading && <Spinner size="sm" />}
              {text('loadMore', 'Load more')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
