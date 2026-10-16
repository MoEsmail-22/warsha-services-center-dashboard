/**
 * JobsContext — the Jobs Board's cards from GET /Workshop/jobs-board.
 *
 * Loads after login and checks for changes every POLLING.jobs.intervalMs (the
 * bookings are checked more often). Moving a card changes the job stage on the backend (PATCH .../status with the
 * stage number); the card moves right away and goes back if the backend refuses.
 *
 * Exposes: { jobs, loading, error, refresh, moveJob, reorderJobs }
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getJobsBoard } from '@/API/jobsApi';
import { isDemoMode } from '@/API/client';
import { usePolling } from '@/hooks/usePolling';
import { POLLING } from '@/constants/polling';
import { useAuth } from './AuthContext';
import { useBookings } from './BookingsContext';

export { JOB_STAGES } from '@/constants/jobStages';

const JobsContext = createContext(null);

export function JobsProvider({ children }) {
  const { user } = useAuth();
  const { changeJobStage } = useBookings();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const enabled = Boolean(user) && !isDemoMode();

  /** Loads the board; `silent` = background check (no loading state, keeps the cards on error). */
  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const next = await getJobsBoard();
      // Keep the order the user arranged within a column; new cards go at the end.
      setJobs((current) => {
        const position = new Map(current.map((job, index) => [job.id, index]));
        return [...next].sort(
          (a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity)
        );
      });
      setError(null);
      return true;
    } catch (err) {
      if (!silent) setError(err);
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setJobs([]);
      setError(null);
      return;
    }
    refresh();
  }, [enabled, user?.id, refresh]);

  usePolling(
    async () => {
      if (!(await refresh({ silent: true }))) throw new Error('Jobs board check failed');
    },
    { ...POLLING.jobs, enabled }
  );

  /** Moves a card to another stage. Throws (after moving it back) if the backend refuses. */
  const moveJob = useCallback(
    async (jobId, newStage) => {
      const job = jobs.find((item) => item.id === jobId);
      if (!job || job.stage === newStage) return;

      const setStage = (stage) =>
        setJobs((current) =>
          current.map((item) => (item.id === jobId ? { ...item, stage } : item))
        );
      setStage(newStage);
      try {
        await changeJobStage(job.bookingId, newStage, job.stage);
      } catch (err) {
        // Back to where the job really is (a jump forward may have saved some steps).
        setStage(err.reachedStage ?? job.stage);
        throw err;
      }
    },
    [jobs, changeJobStage]
  );

  /** Reorders cards inside one column (only on this screen; the API has no order). */
  const reorderJobs = useCallback((sourceIndex, destIndex, stage) => {
    setJobs((current) => {
      const stageJobs = current.filter((job) => job.stage === stage);
      const otherJobs = current.filter((job) => job.stage !== stage);
      const [moved] = stageJobs.splice(sourceIndex, 1);
      stageJobs.splice(destIndex, 0, moved);
      return [...otherJobs, ...stageJobs];
    });
  }, []);

  const value = useMemo(
    () => ({ jobs, loading, error, refresh, moveJob, reorderJobs }),
    [jobs, loading, error, refresh, moveJob, reorderJobs]
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs() {
  const context = useContext(JobsContext);
  if (!context) throw new Error('useJobs must be used inside a <JobsProvider>');
  return context;
}
