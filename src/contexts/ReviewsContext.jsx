import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { isDemoMode } from '../API/client';
import { getAllReviews, REVIEW_TYPES } from '../API/reviewsApi';

const ReviewsContext = createContext(null);

const emptyList = { items: [], loading: false, loaded: false, error: null };

/**
 * Workshop reviews (type 1) and service reviews (type 2), each loaded once and kept here,
 * so the Dashboard rating and the Reviews page share them.
 */
export function ReviewsProvider({ children }) {
  const { user } = useAuth();
  const enabled = Boolean(user) && !isDemoMode();
  const [lists, setLists] = useState({
    [REVIEW_TYPES.workshop]: emptyList,
    [REVIEW_TYPES.service]: emptyList,
  });

  const patch = (type, changes) =>
    setLists((current) => ({ ...current, [type]: { ...current[type], ...changes } }));

  // One request per type at a time (the Dashboard and the Reviews page can both ask).
  const inFlight = useRef({});
  const loadReviews = useCallback(
    (type) => {
      if (!enabled) {
        patch(type, { loaded: true });
        return Promise.resolve();
      }
      if (inFlight.current[type]) return inFlight.current[type];

      patch(type, { loading: true, error: null });
      inFlight.current[type] = getAllReviews(type)
        .then((items) => patch(type, { items, loading: false, loaded: true }))
        .catch((error) => patch(type, { loading: false, loaded: true, error }))
        .finally(() => {
          inFlight.current[type] = null;
        });
      return inFlight.current[type];
    },
    [enabled]
  );

  // The Dashboard shows the workshop's own rating, so those load right after login.
  useEffect(() => {
    if (enabled) loadReviews(REVIEW_TYPES.workshop);
    else setLists({ [REVIEW_TYPES.workshop]: emptyList, [REVIEW_TYPES.service]: emptyList });
  }, [enabled, user?.id, loadReviews]);

  const workshopReviews = lists[REVIEW_TYPES.workshop].items;
  const value = useMemo(() => {
    const totalReviews = workshopReviews.length;
    const avgRating = totalReviews
      ? Number(
          (workshopReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews).toFixed(
            1
          )
        )
      : 0;
    return { lists, loadReviews, avgRating, totalReviews };
  }, [lists, loadReviews, workshopReviews]);

  return <ReviewsContext.Provider value={value}>{children}</ReviewsContext.Provider>;
}

export function useReviews() {
  const context = useContext(ReviewsContext);

  if (!context) {
    throw new Error('useReviews must be used inside a <ReviewsProvider>');
  }

  return context;
}
