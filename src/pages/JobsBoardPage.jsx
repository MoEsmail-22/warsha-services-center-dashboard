import { useEffect, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Search } from 'lucide-react';
import KanbanColumn from '../components/kanban/KanbanColumn';
import { useJobs, JOB_STAGES } from '../contexts/JobsContext';
import { useAppTranslation } from '../hooks/useAppTranslation';
import CancelBookingModal from '../components/bookings/CancelBookingModal';
import { getJobsBoard } from '../API/jobsApi';
import { isDemoMode } from '../API/client';

export default function JobsBoardPage() {
  const { t } = useAppTranslation('dashboard');
  const { jobs, workflowQuotes, moveJob, reorderJobs, canMoveJob, createWorkflowQuote, cancelJob } =
    useJobs();
  const [search, setSearch] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [workflowMessage, setWorkflowMessage] = useState('');

  // Development only: calls GET /Workshop/jobs-board so its response shows in the browser
  // console ([Jobs API]). The board still doesn't use it until the format is confirmed.
  useEffect(() => {
    if (!import.meta.env.DEV || isDemoMode()) return;
    getJobsBoard().catch(() => {});
  }, []);

  // Filter jobs by search query (vehicle, customer, service)
  const filteredJobs = jobs
    .filter((j) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        j.vehicle.toLowerCase().includes(q) ||
        j.customer.toLowerCase().includes(q) ||
        j.service.toLowerCase().includes(q)
      );
    })
    .map((job) => ({
      ...job,
      quoteStatus: workflowQuotes.find((quote) => quote.jobId === job.id)?.status,
    }));

  // Group filtered jobs by stage
  const jobsByStage = JOB_STAGES.reduce((acc, stage) => {
    acc[stage] = filteredJobs.filter((j) => j.stage === stage);
    return acc;
  }, {});

  // Count pending quotes (mock — set to 2 as in the mockup)
  const pendingQuotes = workflowQuotes.filter((quote) => quote.status === 'draft').length;

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    // Same column → reorder
    if (source.droppableId === destination.droppableId) {
      if (source.index === destination.index) return;
      reorderJobs(source.index, destination.index, source.droppableId);
    } else {
      // Different column → move + reorder
      const jobId = jobsByStage[source.droppableId][source.index].id;
      const permission = canMoveJob(jobId, destination.droppableId);
      if (!permission.allowed) {
        setWorkflowMessage(t(`jobs.workflow.${permission.reason}`));
        return;
      }
      setWorkflowMessage('');
      moveJob(jobId, destination.droppableId);
      // Note: reorder within destination is handled by React state re-render
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

          {/* Pending quotes badge (top-right, orange) */}
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

      {workflowMessage && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {workflowMessage}
        </div>
      )}

      {/* ============ KANBAN BOARD ============ */}
      <div className="flex-1 overflow-x-auto pb-4">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex min-w-max gap-4">
            {JOB_STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                jobs={jobsByStage[stage] ?? []}
                onCancel={setCancelTarget}
                onCreateQuote={(job) => {
                  const result = createWorkflowQuote(job.id);
                  setWorkflowMessage(
                    result.created
                      ? t('jobs.workflow.quoteCreated')
                      : t(`jobs.workflow.${result.reason}`)
                  );
                }}
              />
            ))}
          </div>
        </DragDropContext>
      </div>

      <CancelBookingModal
        open={Boolean(cancelTarget)}
        itemName={cancelTarget?.vehicle}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          cancelJob(cancelTarget.id);
          setCancelTarget(null);
        }}
      />
    </div>
  );
}
