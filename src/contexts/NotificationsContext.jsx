/**
 * NotificationsContext — the workshop's notifications for the Topbar bell.
 *
 * Loads only while someone is signed in (never on the login page), checks for
 * new ones every POLLING.notifications.intervalMs, and marks items as read right away
 * on screen, undoing that if the API call fails. New ones show as a toast, or as a
 * desktop notification when the tab is in the background and the user allowed them.
 *
 * Exposes:
 *   { items, unreadCount, loading, error, hasMore, refresh, loadMore, markAsRead, markAllAsRead }
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getNotifications, markNotificationRead } from '@/API/notificationsApi';
import { isDemoMode } from '@/API/client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useTranslation } from 'react-i18next';
import { usePolling } from '@/hooks/usePolling';
import { notifyInBackground } from '@/utils/browserNotifications';
import { playChime } from '@/utils/notificationSound';
import { POLLING } from '@/constants/polling';

const NotificationsContext = createContext(null);

const PAGE_SIZE = 20;

/** Backend field names may vary, so read each one from the likely candidates. */
function normalizeNotification(item) {
  const readAt = item.readAt ?? item.readDate ?? null;

  return {
    id: item.id ?? item.notificationId,
    title: { en: item.titleEn ?? item.title ?? '', ar: item.titleAr ?? item.title ?? '' },
    message: {
      en: item.messageEn ?? item.bodyEn ?? item.message ?? item.body ?? item.content ?? '',
      ar: item.messageAr ?? item.bodyAr ?? item.message ?? item.body ?? item.content ?? '',
    },
    type: item.type ?? item.notificationType ?? '',
    isRead: Boolean(item.isRead ?? item.read ?? readAt),
    createdAt: item.createdAt ?? item.createdOn ?? item.sentAt ?? item.date ?? null,
  };
}

/** Accepts a plain array or a paged object ({ items, hasNextPage, unreadCount, ... }). */
function readPage(result) {
  const data = result?.data ?? result;
  const rows = Array.isArray(data)
    ? data
    : (data?.items ?? data?.notifications ?? data?.data ?? []);
  const meta = Array.isArray(data) ? {} : (data ?? {});

  return {
    items: (Array.isArray(rows) ? rows : []).map(normalizeNotification),
    hasMore: meta.hasNextPage ?? (Array.isArray(rows) && rows.length === PAGE_SIZE),
    unreadCount: meta.unreadCount ?? meta.unReadCount ?? null,
  };
}

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [serverUnread, setServerUnread] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const latestRequest = useRef(0);
  const { showToast } = useToast();
  const { t, i18n } = useTranslation('common', { useSuspense: false });

  // IDs seen so far; null until the first load, so existing notifications don't pop up.
  const seenIds = useRef(null);

  /** Shows a toast for unread notifications that weren't there at the last check. */
  const announceNew = (items) => {
    const lang = i18n.language?.startsWith('ar') ? 'ar' : 'en';
    if (seenIds.current) {
      const fresh = items.filter((item) => !item.isRead && !seenIds.current.has(item.id));
      if (fresh.length > 0) playChime('notification');
      // Tab in the background → desktop notification; otherwise (or if that fails) the toast.
      if (fresh.length === 1) {
        const [item] = fresh;
        const message = item.message[lang] || item.message.en;
        const title = item.title[lang] || item.title.en;
        const shown = notifyInBackground({
          tag: `notification-${item.id}`,
          title: title || t('notificationsPanel.title', { defaultValue: 'Notifications' }),
          body: message,
        });
        if (!shown) {
          showToast('notification', message || title, { title: message ? title : undefined });
        }
      } else if (fresh.length > 1) {
        const summary = t('notificationsPanel.newCount', {
          count: fresh.length,
          defaultValue: `You have ${fresh.length} new notifications`,
        });
        const shown = notifyInBackground({
          tag: `notifications-${fresh.map((item) => item.id).join('-')}`,
          title: t('brand.name', { ns: 'nav', defaultValue: 'Warsha' }),
          body: summary,
        });
        if (!shown) showToast('notification', summary);
      }
    }
    seenIds.current = new Set([...(seenIds.current ?? []), ...items.map((item) => item.id)]);
  };

  const enabled = Boolean(user) && !isDemoMode();

  // Reload the first page (used on login, by the timer and by "Try again").
  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);

    try {
      const result = readPage(await getNotifications({ page: 1, pageSize: PAGE_SIZE }));
      if (requestId !== latestRequest.current) return true;
      announceNew(result.items);
      setItems(result.items);
      setHasMore(result.hasMore);
      setServerUnread(result.unreadCount);
      setPage(1);
      return true;
    } catch (err) {
      if (requestId === latestRequest.current) setError(err);
      return false;
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    setLoading(true);
    try {
      const result = readPage(await getNotifications({ page: nextPage, pageSize: PAGE_SIZE }));
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.items.filter((item) => !known.has(item.id))];
      });
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    if (!enabled) {
      // Signed out: forget the previous account's notifications.
      seenIds.current = null;
      setItems([]);
      setServerUnread(null);
      setError(null);
      return undefined;
    }

    refresh();
    return undefined;
  }, [enabled, user?.id, refresh]);

  // Always checking, also while the tab is in the background (no real-time channel).
  usePolling(
    async () => {
      if (!(await refresh())) throw new Error('Notifications check failed');
    },
    { ...POLLING.notifications, enabled, runWhenHidden: true }
  );

  const setReadState = (ids, isRead) =>
    setItems((current) =>
      current.map((item) => (ids.includes(item.id) ? { ...item, isRead } : item))
    );

  const markAsRead = useCallback(async (id) => {
    setReadState([id], true);
    setServerUnread((count) => (count == null ? count : Math.max(0, count - 1)));
    try {
      await markNotificationRead(id);
    } catch (err) {
      setReadState([id], false);
      setServerUnread((count) => (count == null ? count : count + 1));
      throw err;
    }
  }, []);

  // There is no "read all" endpoint, so mark the loaded unread items one by one.
  const markAllAsRead = useCallback(async () => {
    const unreadIds = items.filter((item) => !item.isRead).map((item) => item.id);
    if (unreadIds.length === 0) return;

    setReadState(unreadIds, true);
    const results = await Promise.allSettled(unreadIds.map((id) => markNotificationRead(id)));
    const failedIds = unreadIds.filter((_, index) => results[index].status === 'rejected');

    if (failedIds.length) {
      setReadState(failedIds, false);
      throw results.find((result) => result.status === 'rejected').reason;
    }
    await refresh();
  }, [items, refresh]);

  const unreadCount = serverUnread ?? items.filter((item) => !item.isRead).length;

  return (
    <NotificationsContext.Provider
      value={{
        items,
        unreadCount,
        loading,
        error,
        hasMore,
        refresh,
        loadMore,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used inside a <NotificationsProvider>');
  return context;
}
