import { Droppable } from '@hello-pangea/dnd';
import KanbanCard from './KanbanCard';
import { useAppTranslation } from '../../hooks/useAppTranslation';

// `label` is the English fallback; the shown name comes from dashboard.json → jobs.stages.
const STAGE_META = {
  new: { label: 'New', icon: '✦', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  diagnosing: {
    label: 'Confirmed',
    icon: '🔧',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
  },
  in_progress: {
    label: 'In progress',
    icon: '⚙️',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
  },
  ready: { label: 'Ready', icon: '✅', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
};

export default function KanbanColumn({ stage, jobs }) {
  const { t } = useAppTranslation('dashboard');
  const meta = STAGE_META[stage] ?? STAGE_META.new;

  return (
    <div className="flex w-64 shrink-0 flex-col">
      {/* ---- Column header ---- */}
      <div className="mb-3 flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-md text-xs ${meta.iconBg} ${meta.iconColor}`}
          >
            {meta.icon}
          </span>
          <span className="text-sm font-semibold text-gray-900">
            {t(`jobs.stages.${stage}`, { defaultValue: meta.label })}
          </span>
        </div>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-semibold text-gray-700">
          {jobs.length}
        </span>
      </div>

      {/* ---- Droppable area (WHITE background) ---- */}
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 space-y-2.5 rounded-xl p-2 transition-colors ${
              snapshot.isDraggingOver ? 'bg-teal-50' : 'bg-white'
            }`}
            style={{ minHeight: '200px' }}
          >
            {jobs.map((job, index) => (
              <KanbanCard key={job.id} job={job} index={index} />
            ))}
            {provided.placeholder}

            {jobs.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-xs text-gray-400">
                {t('jobs.dropHere', { defaultValue: 'Drop jobs here' })}
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
