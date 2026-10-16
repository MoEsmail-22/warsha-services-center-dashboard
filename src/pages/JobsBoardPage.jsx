import { useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Search } from 'lucide-react';
import KanbanColumn from '../components/kanban/KanbanColumn';
import { useJobs, JOB_STAGES } from '../contexts/JobsContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { useNotify } from '../hooks/useNotify';
import { useErrorMessage } from '../hooks/useErrorMessage';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export default function JobsBoardPage() {
  const { t } = useAppTranslation('dashboard');
  const { jobs, loading, error, refresh, moveJob, reorderJobs } = useJobs();
  const notify = useNotify();
  const { getErrorMessage } = useErrorMessage();
  const [search, setSearch] = useState('');

  // Search by booking number, car, customer or service.
  const query = search.trim().toLowerCase();
  const filteredJobs = query
    ? jobs.filter((job) =>
        [job.number, job.vehicle, job.customer, job.service].some((text) =>
          String(text ?? '')
            .toLowerCase()
            .includes(query)
        )
      )
    : jobs;

  const jobsByStage = JOB_STAGES.reduce((acc, stage) => {
    acc[stage] = filteredJobs.filter((job) => job.stage === stage);
    return acc;
  }, {});

  const pendingQuotes = jobs.filter((job) => job.hasPendingQuote).length;

  const handleDragEnd = async ({ source, destination }) => {
    if (!destination) return;

    // Same column → only the order on screen changes.
    if (source.droppableId === destination.droppableId) {
      if (source.index !== destination.index) {
        reorderJobs(source.index, destination.index, source.droppableId);
      }
      return;
    }

    // Another column → save the new stage; the card goes back if the backend refuses.
    const job = jobsByStage[source.droppableId][source.index];
    try {
      await moveJob(job.id, destination.droppableId);
    } catch (err) {
      notify.error(err, 'jobs.move');
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* ============ HEADER ============ */}
      <div className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1
              className="text-2xl font-bold text-[#15201F]"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {t('jobs.title', { defaultValue: 'Jobs Board' })}
            </h1>
            <p className="mt-1 text-sm text-[#5A6968]">
              {t('jobs.subtitle', {
                defaultValue: 'Drag cars across stages as you work. Customers see updates live.',
              })}
            </p>
          </div>

          {/* Cars with a quote waiting for the customer's answer */}
          {pendingQuotes > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-700">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              {pendingQuotes} {t('jobs.quotesPending', { defaultValue: 'quotes pending' })}
            </div>
          )}
        </div>

        {/* ---- Search bar ---- */}
        <div className="mt-4 flex items-center gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('jobs.search', {
                defaultValue: 'Search bookings, customers, plates...',
              })}
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0E5C5B] focus:ring-2 focus:ring-[#0E5C5B]/10 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ============ KANBAN BOARD ============ */}
      {loading && jobs.length === 0 ? (
        <LoadingScreen variant="section" />
      ) : error && jobs.length === 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center">
          <p className="text-sm text-red-700">{getErrorMessage(error, 'jobs.load')}</p>
          <button
            type="button"
            onClick={() => refresh()}
            className="mt-2 text-sm font-semibold text-[#0E5C5B] hover:underline"
          >
            {t('jobs.retry', { defaultValue: 'Try again' })}
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto pb-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex min-w-max gap-4">
              {JOB_STAGES.map((stage) => (
                <KanbanColumn key={stage} stage={stage} jobs={jobsByStage[stage] ?? []} />
              ))}
            </div>
          </DragDropContext>
        </div>
      )}
    </div>
  );
}
