import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useLanguage } from '@/contexts/LanguageContext';
import { getWeeklyRevenue, toDateKey, weekStartOf } from '@/API/dashboardApi';

const isWeekKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');

/** Moves a "YYYY-MM-DD" Monday by whole weeks. */
function shiftWeek(weekStart, weeks) {
  const [year, month, day] = weekStart.split('-').map(Number);
  return toDateKey(new Date(year, month - 1, day + weeks * 7));
}

/**
 * "Revenue this week": one bar per day (Monday → Sunday) from GET /Workshop/dashboard/revenue.
 * The week shown is in the URL (?week=2026-10-12, its Monday); without it, this week.
 */
export default function WeeklyRevenueCard() {
  const { t } = useAppTranslation('dashboard');
  const { getErrorMessage } = useErrorMessage();
  const { lang, isRTL } = useLanguage();
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const currency = lang === 'ar' ? 'ج.م' : 'EGP';
  const formatAmount = (amount) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount || 0);

  const thisWeek = weekStartOf();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('week');
  // A date that isn't a Monday is moved to its week's Monday; future weeks aren't shown.
  const weekStart =
    isWeekKey(requested) && weekStartOf(new Date(`${requested}T12:00`)) <= thisWeek
      ? weekStartOf(new Date(`${requested}T12:00`))
      : thisWeek;
  const isThisWeek = weekStart === thisWeek;

  const goToWeek = (next) =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next === thisWeek) params.delete('week');
        else params.set('week', next);
        return params;
      },
      { replace: true }
    );

  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRevenue(await getWeeklyRevenue(weekStart));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const today = toDateKey(new Date());
  const days = revenue?.days ?? [];
  const highest = Math.max(...days.map((day) => day.amount), 0);
  const hasRevenue = highest > 0;

  const weekLabel = (() => {
    const [year, month, day] = weekStart.split('-').map(Number);
    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day + 6);
    const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    return `${format.format(start)} – ${format.format(end)}`;
  })();

  // In Arabic the page flows right to left, so "previous" points right.
  const PreviousIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const arrowClass =
    'flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-[#5A6968] transition-colors hover:bg-gray-50 hover:text-[#0E5C5B] disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2"
      style={{ borderRadius: '16px' }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            className="text-lg font-semibold text-[#15201F]"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {isThisWeek
              ? t('revenue.title', { defaultValue: 'Revenue this week' })
              : t('revenue.titleOtherWeek', { defaultValue: 'Revenue' })}
          </h2>
          <p className="mt-0.5 text-xs text-[#5A6968]">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={arrowClass}
            onClick={() => goToWeek(shiftWeek(weekStart, -1))}
            aria-label={t('revenue.previousWeek', { defaultValue: 'Previous week' })}
            title={t('revenue.previousWeek', { defaultValue: 'Previous week' })}
          >
            <PreviousIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={arrowClass}
            onClick={() => goToWeek(shiftWeek(weekStart, 1))}
            disabled={isThisWeek}
            aria-label={t('revenue.nextWeek', { defaultValue: 'Next week' })}
            title={t('revenue.nextWeek', { defaultValue: 'Next week' })}
          >
            <NextIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-5">
        <p
          className="text-2xl font-bold text-[#15201F]"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          {loading || error ? '—' : formatAmount(revenue?.total)}{' '}
          <span className="text-sm font-medium text-[#5A6968]">{currency}</span>
        </p>
        <p className="mt-0.5 text-xs text-[#5A6968]">
          {isThisWeek
            ? t('revenue.totalLabel', { defaultValue: 'Total this week' })
            : t('revenue.totalOtherWeek', { defaultValue: 'Total for the week' })}
        </p>
      </div>

      {error ? (
        <div className="py-8 text-center">
          <p className="text-sm text-red-600">{getErrorMessage(error, 'dashboard.revenue')}</p>
          <button
            type="button"
            onClick={load}
            className="mt-2 text-sm font-semibold text-[#0E5C5B] hover:underline"
          >
            {t('revenue.retry', { defaultValue: 'Try again' })}
          </button>
        </div>
      ) : (
        <>
          {/* One bar per day; the tallest day fills the height. */}
          <div className="flex h-44 gap-2" aria-busy={loading}>
            {(loading ? Array.from({ length: 7 }, () => null) : days).map((day, index) => {
              const height = day && hasRevenue ? Math.max(4, (day.amount / highest) * 100) : 4;
              const isToday = day?.date === today;
              const dayName = day
                ? new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
                    new Date(`${day.date}T12:00`)
                  )
                : '';
              return (
                <div
                  key={day?.date ?? index}
                  className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5"
                  title={day ? `${dayName}: ${formatAmount(day.amount)} ${currency}` : undefined}
                >
                  {/* The bar area: heights are a share of this box only (the labels sit outside),
                      with room on top for the amount. */}
                  <div className="relative flex w-full flex-1 items-end justify-center pt-5">
                    <div
                      className={`relative w-full max-w-9 rounded-t-md transition-all ${
                        loading
                          ? 'animate-pulse bg-gray-100'
                          : isToday
                            ? 'bg-[#0E5C5B]'
                            : day.amount > 0
                              ? 'bg-[#9CC9C4]'
                              : 'bg-[#EEF3F2]'
                      }`}
                      style={{ height: `${loading ? 20 + ((index * 37) % 60) : height}%` }}
                    >
                      {day && day.amount > 0 && (
                        <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap text-[#5A6968]">
                          {formatAmount(day.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs ${isToday ? 'font-bold text-[#0E5C5B]' : 'text-[#9AA7A6]'}`}
                  >
                    {dayName || ' '}
                  </span>
                </div>
              );
            })}
          </div>
          {!loading && !hasRevenue && (
            <p className="mt-3 text-center text-xs text-[#5A6968]">
              {t('revenue.noneThisWeek', { defaultValue: 'No revenue recorded this week yet.' })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
