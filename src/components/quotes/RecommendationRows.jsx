import { Plus, Trash2 } from 'lucide-react';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { DEFAULT_PRIORITY, RECOMMENDATION_PRIORITIES } from '@/API/recommendationsApi';

/** A new, empty recommendation row (not on the backend yet). */
export const newRecommendation = () => ({
  id: `new-${Date.now()}-${Math.random()}`,
  saved: false,
  title: '',
  description: '',
  priority: DEFAULT_PRIORITY,
});

const PRIORITY_KEYS = { 1: 'low', 2: 'medium', 3: 'high' };
const inputClass =
  'h-10 min-w-0 rounded-md border border-gray-200 px-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#0E5C5B] focus:ring-2 focus:ring-[#0E5C5B]/10 focus:outline-none';

/**
 * Future repairs / recommendations: one row per item (title, priority, details), sent with
 * the quote (POST / PUT / DELETE /Workshop/recommendations). Used by the quote builder and
 * the Edit quote window. `rows` / `onChange(nextRows)` are controlled by the parent.
 */
export default function RecommendationRows({ rows, onChange, disabled = false }) {
  const { t } = useAppTranslation('quotes');
  const update = (id, field, value) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  const remove = (id) => onChange(rows.filter((row) => row.id !== id));

  return (
    <div className="mt-5 rounded-xl border border-[#CFE2DF] bg-[#F7FBFA] p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold tracking-wide text-[#0E5C5B] uppercase">
            {t('futureRepairs', { defaultValue: 'Future repairs or recommendations' })}
          </p>
          <p className="mt-1 text-sm text-[#5A6968]">
            {t('futureRepairsSubtitle', {
              defaultValue: 'Optional suggestions sent to the customer with the quote.',
            })}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#0E5C5B]">
          {t('optional', { defaultValue: 'Optional' })}
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="space-y-2 rounded-lg border border-[#D9E7E5] bg-white p-2.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={row.title}
                disabled={disabled}
                onChange={(event) => update(row.id, 'title', event.target.value)}
                placeholder={t('recommendation.titlePlaceholder', {
                  defaultValue: 'e.g. Replace the front brake discs',
                })}
                aria-label={t('recommendation.title', { defaultValue: 'Recommendation' })}
                className={`${inputClass} flex-1`}
              />
              <select
                value={row.priority}
                disabled={disabled}
                onChange={(event) => update(row.id, 'priority', Number(event.target.value))}
                aria-label={t('recommendation.priority', { defaultValue: 'Priority' })}
                className={`${inputClass} w-28 shrink-0 bg-white`}
              >
                {RECOMMENDATION_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(`recommendation.priorities.${PRIORITY_KEYS[priority]}`, {
                      defaultValue: PRIORITY_KEYS[priority],
                    })}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(row.id)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                aria-label={t('removeFutureRepair', { defaultValue: 'Remove suggestion' })}
                title={t('removeFutureRepair', { defaultValue: 'Remove suggestion' })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={row.description}
              disabled={disabled}
              onChange={(event) => update(row.id, 'description', event.target.value)}
              placeholder={t('recommendation.detailsPlaceholder', {
                defaultValue: 'Details (optional), e.g. within the next 5,000 km',
              })}
              aria-label={t('recommendation.details', { defaultValue: 'Details' })}
              className={`${inputClass} w-full`}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...rows, newRecommendation()])}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#8FB9B4] bg-white px-3.5 py-2 text-sm font-semibold text-[#0E5C5B] transition-colors hover:border-[#0E5C5B] hover:bg-[#EDF7F5] disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" />
        {t('addFutureRepair', { defaultValue: 'Add recommendation' })}
      </button>
    </div>
  );
}
