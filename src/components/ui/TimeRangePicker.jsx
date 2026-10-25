import { Input } from './Input';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * "Starts: Now / Later" + "For how long?" quick buttons, with Custom for an exact end.
 *
 *   const [range, setRange] = useState(() => createTimeRange({ duration: 60 }));
 *   <TimeRangePicker id="busy" value={range} onChange={setRange} presets={[30, 60, 'restOfDay']} />
 *   const { start, end } = timeRangeOf(range); // end is null while the range is invalid
 *
 * Presets are minutes (60, DAY, WEEK…), 'restOfDay' (until 23:59) or 'month' (same time
 * next month). Custom is always offered last.
 */

export const HOUR = 60;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** A fresh picker value. "Later" and "Custom" fields are pre-filled so they're never blank. */
export function createTimeRange({ duration = HOUR, customEndIn = 2 * HOUR } = {}) {
  const now = new Date();
  const customEnd = new Date(now.getTime() + customEndIn * 60_000);
  return {
    startMode: 'now',
    startDate: toDateInput(now),
    startTime: toTimeInput(now),
    duration,
    endDate: toDateInput(customEnd),
    endTime: toTimeInput(customEnd),
  };
}

/** The period the value describes, as { start, end } Dates; end is null if it's not after start. */
export function timeRangeOf(value, now = new Date()) {
  const start =
    value.startMode === 'now'
      ? now
      : value.startDate && value.startTime
        ? new Date(`${value.startDate}T${value.startTime}`)
        : null;
  if (!start || Number.isNaN(start.getTime())) return null;

  let end = null;
  if (value.duration === 'restOfDay') {
    end = new Date(start);
    end.setHours(23, 59, 0, 0);
  } else if (value.duration === 'month') {
    end = new Date(start);
    end.setMonth(end.getMonth() + 1);
  } else if (value.duration === 'custom') {
    end = value.endDate && value.endTime ? new Date(`${value.endDate}T${value.endTime}`) : null;
  } else {
    end = new Date(start.getTime() + Number(value.duration) * 60_000);
  }
  if (!end || Number.isNaN(end.getTime()) || end <= start) return { start, end: null };
  return { start, end };
}

/** "19 Oct 2026 3:45 pm" (12-hour, ص/م in Arabic). */
function formatDateTime(date, lang) {
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${day} ${time}`;
}

const chipClass = (active) =>
  `rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
    active
      ? 'border-[#0E5C5B] bg-[#0E5C5B] text-white'
      : 'border-[#E8E2D8] bg-white text-[#1C1712] hover:bg-[#F6F3EE]'
  }`;

export function TimeRangePicker({
  id,
  value,
  onChange,
  presets = [30, HOUR, 2 * HOUR, 4 * HOUR, 'restOfDay'],
  startLabel,
  durationLabel,
  summaryLabel,
  // true when editing something that may already have started (its start date is in the past)
  allowPastStart = false,
}) {
  const { t } = useAppTranslation('common');
  const { lang } = useLanguage();
  const text = (key, defaultValue, options) => t(`timeRange.${key}`, { defaultValue, ...options });

  const update = (field, fieldValue) => onChange({ ...value, [field]: fieldValue });

  const presetLabel = (preset) => {
    if (preset === 'restOfDay') return text('restOfDay', 'Rest of the day');
    if (preset === 'month') return text('month', '1 month');
    if (preset % WEEK === 0) return text('weeks', '{{count}} weeks', { count: preset / WEEK });
    if (preset % DAY === 0) return text('days', '{{count}} days', { count: preset / DAY });
    if (preset % HOUR === 0) return text('hours', '{{count}} hours', { count: preset / HOUR });
    return text('minutes', '{{count}} min', { count: preset });
  };

  const range = timeRangeOf(value);
  const today = toDateInput(new Date());

  return (
    <div className="space-y-5">
      {/* When it starts */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-[#1C1712]">
          {startLabel ?? text('starts', 'Starts')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {['now', 'later'].map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={value.startMode === mode}
              className={chipClass(value.startMode === mode)}
              onClick={() => update('startMode', mode)}
            >
              {mode === 'now' ? text('now', 'Now') : text('later', 'Later')}
            </button>
          ))}
        </div>
        {value.startMode === 'later' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input
              id={`${id}-start-date`}
              type="date"
              label={text('date', 'Date')}
              value={value.startDate}
              min={allowPastStart ? undefined : today}
              onChange={(event) => update('startDate', event.target.value)}
            />
            <Input
              id={`${id}-start-time`}
              type="time"
              label={text('time', 'Time')}
              value={value.startTime}
              onChange={(event) => update('startTime', event.target.value)}
            />
          </div>
        )}
      </fieldset>

      {/* How long */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-[#1C1712]">
          {durationLabel ?? text('howLong', 'For how long?')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {[...presets, 'custom'].map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={value.duration === preset}
              className={chipClass(value.duration === preset)}
              onClick={() => update('duration', preset)}
            >
              {preset === 'custom' ? text('custom', 'Custom') : presetLabel(preset)}
            </button>
          ))}
        </div>
        {value.duration === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input
              id={`${id}-end-date`}
              type="date"
              label={text('endDate', 'Until date')}
              value={value.endDate}
              min={
                value.startMode === 'later' ? value.startDate : allowPastStart ? undefined : today
              }
              onChange={(event) => update('endDate', event.target.value)}
            />
            <Input
              id={`${id}-end-time`}
              type="time"
              label={text('endTime', 'Until time')}
              value={value.endTime}
              onChange={(event) => update('endTime', event.target.value)}
            />
          </div>
        )}
      </fieldset>

      {/* What will be saved */}
      <p
        className={`rounded-lg px-3 py-2.5 text-sm ${
          range?.end ? 'bg-[#F2F8F7] text-[#0E5C5B]' : 'bg-amber-50 text-amber-800'
        }`}
      >
        {range?.end
          ? `${summaryLabel ?? text('summary', 'From')}: ${formatDateTime(range.start, lang)} → ${formatDateTime(range.end, lang)}`
          : text('invalidRange', 'Choose an end time after the start time.')}
      </p>
    </div>
  );
}

export default TimeRangePicker;
