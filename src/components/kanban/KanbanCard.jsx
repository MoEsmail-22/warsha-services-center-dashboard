import { Draggable } from '@hello-pangea/dnd';
import { Link, useParams } from 'react-router-dom';
import { Clock, FilePlus2, FileText } from 'lucide-react';
import { useAppTranslation } from '../../hooks/useAppTranslation';

/** "Oct 18 · 07:30" / «١٨ أكتوبر · ٠٧:٣٠» from the booking's scheduled time. */
function formatSchedule(value, lang) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
  const day = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  return `${day} · ${time}`;
}

export default function KanbanCard({ job, index }) {
  const { t } = useAppTranslation('bookings');
  const { lang = 'en' } = useParams();
  const schedule = formatSchedule(job.scheduledAt, lang);

  return (
    <Draggable draggableId={job.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="group cursor-grab rounded-xl border border-gray-200 p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing"
          style={{
            ...provided.draggableProps.style,
            // Card background: #F1F6F5 (light teal tint)
            // When dragging, keep it slightly elevated with the same tint
            backgroundColor: snapshot.isDragging ? '#E8F2F0' : '#F1F6F5',
            boxShadow: snapshot.isDragging
              ? '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.08)'
              : undefined,
          }}
        >
          {job.number && (
            <p className="text-[11px] font-semibold tracking-wide text-[#5A6968]">{job.number}</p>
          )}
          <p className="min-w-0 text-sm font-bold text-gray-900">{job.vehicle}</p>

          {/* ---- Services (gray, below the car) ---- */}
          {job.service && <p className="mt-0.5 text-xs text-gray-500">{job.service}</p>}

          {/* A quote waiting for the customer's answer */}
          {job.hasPendingQuote && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {t('board.quotePending', { defaultValue: 'Quote pending' })}
            </span>
          )}

          {/* The backend only accepts quotes while the job is in progress. */}
          {job.stage === 'in_progress' && !job.hasPendingQuote && (
            <Link
              to={`/${lang}/quotes?booking=${encodeURIComponent(job.bookingId)}`}
              onPointerDown={(event) => event.stopPropagation()}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('workflow.createQuote', { defaultValue: 'Create quote' })}
            </Link>
          )}

          {/* ---- Customer + date (bottom row) ---- */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            {job.customer && (
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-[#0E5C5B]">
                  {job.initials}
                </span>
                <span className="truncate text-xs font-medium text-[#0E5C5B]">{job.customer}</span>
              </div>
            )}
            {schedule && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {schedule}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
