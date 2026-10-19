import { useCallback, useEffect, useState } from 'react';
import { Clock3, Plus, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotify } from '@/hooks/useNotify';
import {
  Button,
  Card,
  createTimeRange,
  HOUR,
  LoadingScreen,
  Modal,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TimeRangePicker,
  timeRangeOf,
  TR,
} from '@/components/ui';
import { EmptyState } from '@/components/widgets/EmptyState';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { clearWorkshopBusy, getWorkshopBusy, setWorkshopBusy } from '@/API/busyApi';

// Quick lengths for the "For how long?" buttons.
const BUSY_PRESETS = [30, HOUR, 2 * HOUR, 4 * HOUR, 'restOfDay'];
const newBusyRange = () => createTimeRange({ duration: HOUR });
// Older versions kept a copy of the busy period in the browser; it's removed on load.
const OLD_STORAGE_KEY = 'workshop_busy_times';

function formatDate(value, language) {
  const date = new Date(value);
  const locale = language === 'ar' ? 'ar-EG' : 'en-GB';

  return {
    date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date),
    // 12-hour with AM/PM (ص/م in Arabic), e.g. 1:23 AM.
    time: new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date),
  };
}

export default function BusyTime() {
  const { t } = useAppTranslation('services');
  const { isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const busyText = (key, defaultValue) => t(`busyTime.${key}`, { defaultValue });
  const notify = useNotify();
  const { getErrorMessage } = useErrorMessage();
  // GET /Workshop/busy: the current busy period (an empty list when not busy).
  const [busyTimes, setBusyTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(newBusyRange);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const isFormValid = Boolean(timeRangeOf(form)?.end);

  useEffect(() => {
    if (location.hash === '#busy-time') {
      document.getElementById('busy-time')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  // silent: refresh after saving or removing, without the loading state.
  const loadBusyTimes = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      setBusyTimes(await getWorkshopBusy());
    } catch (error) {
      if (!silent) setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadBusyTimes();
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(OLD_STORAGE_KEY))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage unavailable: nothing to clean up.
    }
  }, [user, loadBusyTimes]);

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setForm(newBusyRange());
  };

  const addBusyTime = async (event) => {
    event.preventDefault();
    if (!isFormValid || saving) return;

    setSaving(true);

    try {
      // "Now" means the moment of saving, not when the window was opened.
      const { start, end } = timeRangeOf(form);
      const period = { startAt: start, endAt: end };
      await setWorkshopBusy(period);
      setModalOpen(false);
      setForm(newBusyRange());
      notify.success('busySet');
      await loadBusyTimes({ silent: true });
    } catch (error) {
      // The dialog stays open so the user can fix the times and retry.
      notify.error(error, 'busy.set');
    } finally {
      setSaving(false);
    }
  };

  const removeBusyTime = async (id) => {
    if (removingId) return;

    setRemovingId(id);

    try {
      await clearWorkshopBusy();
      setBusyTimes((current) => current.filter((item) => item.id !== id));
      notify.success('busyRemoved');
      await loadBusyTimes({ silent: true });
    } catch (error) {
      notify.error(error, 'busy.remove');
    } finally {
      setRemovingId(null);
    }
  };

  const openModal = () => {
    setForm(newBusyRange());
    setModalOpen(true);
  };

  return (
    <section
      id="busy-time"
      className="w-full min-w-0 flex-1 scroll-mt-20 border-t border-[#E8E2D8] pt-7"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E8F1EF] text-[#0E5C5B]">
            <Clock3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#15201F]">{busyText('title', 'Busy time')}</h2>
            <p className="mt-1 text-xs text-[#5A6968]">
              {busyText('subtitle', 'Manage workshop unavailable times.')}
            </p>
          </div>
        </div>
        <Button onClick={openModal} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          {busyText('add', 'Add busy time')}
        </Button>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto px-4 pb-4">
          <Table className={busyTimes.length ? 'w-full min-w-[680px]' : 'w-full'}>
            <THead>
              <TR className="hover:bg-gray-50">
                <TH className="px-4 py-3 text-start text-xs font-semibold whitespace-nowrap text-[#5A6968]">
                  {busyText('table.startAt', 'Starts at')}
                </TH>
                <TH className="px-4 py-3 text-start text-xs font-semibold whitespace-nowrap text-[#5A6968]">
                  {busyText('table.duration', 'Duration')}
                </TH>
                <TH className="px-4 py-3 text-start text-xs font-semibold whitespace-nowrap text-[#5A6968]">
                  {busyText('table.endAt', 'Ends at')}
                </TH>
                <TH className="px-4 py-3 text-end text-xs font-semibold whitespace-nowrap text-[#5A6968]">
                  {busyText('table.actions', 'Actions')}
                </TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={4}>
                    <LoadingScreen variant="section" />
                  </TD>
                </TR>
              ) : loadError ? (
                <TR>
                  <TD colSpan={4} className="py-10 text-center">
                    <p className="text-sm text-red-600">
                      {getErrorMessage(loadError, 'busy.load')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => loadBusyTimes()}
                    >
                      {busyText('retry', 'Try again')}
                    </Button>
                  </TD>
                </TR>
              ) : busyTimes.length === 0 ? (
                <TR>
                  <TD colSpan={4}>
                    <EmptyState
                      icon={<Clock3 />}
                      title={busyText('empty', 'No busy times added.')}
                      description={busyText(
                        'emptyDescription',
                        'Customers can book you anytime during your working hours.'
                      )}
                    />
                  </TD>
                </TR>
              ) : (
                busyTimes.map((busyTime) => {
                  const durationHours =
                    (Date.parse(busyTime.busyUntil) - Date.parse(busyTime.busyFrom)) / 3600000;
                  const duration = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
                    maximumFractionDigits: 2,
                  }).format(durationHours);
                  const durationUnit =
                    durationHours === 1
                      ? busyText('units.hour', 'hour')
                      : busyText('units.hours', 'hours');
                  const start = formatDate(busyTime.busyFrom, lang);
                  const end = formatDate(busyTime.busyUntil, lang);

                  return (
                    <TR key={busyTime.id} className="transition-colors hover:bg-[#FAF9F6]">
                      <TD className="px-4 py-3 whitespace-nowrap">
                        <time dateTime={busyTime.busyFrom} className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[#1C1712]">{start.date}</span>
                          <span className="text-xs text-[#7D7166]">{start.time}</span>
                        </time>
                      </TD>
                      <TD className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex rounded-full bg-[#E8F1EF] px-3 py-1 text-sm font-semibold text-[#0E5C5B]">
                          {duration} {durationUnit}
                        </span>
                      </TD>
                      <TD className="px-4 py-3 whitespace-nowrap">
                        <time dateTime={busyTime.busyUntil} className="flex flex-col gap-0.5">
                          <span className="font-medium text-[#1C1712]">{end.date}</span>
                          <span className="text-xs text-[#7D7166]">{end.time}</span>
                        </time>
                      </TD>
                      <TD className="px-4 py-3 text-end whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => removeBusyTime(busyTime.id)}
                          disabled={removingId !== null}
                          className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={busyText('actions.delete', 'Delete busy time')}
                          title={busyText('actions.delete', 'Delete busy time')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={busyText('modal.title', 'Add busy time')}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
              {busyText('actions.cancel', 'Cancel')}
            </Button>
            <Button type="submit" form="busy-time-form" disabled={!isFormValid || saving}>
              {saving ? busyText('saving', 'Saving…') : busyText('add', 'Set as busy')}
            </Button>
          </>
        }
      >
        <form id="busy-time-form" onSubmit={addBusyTime}>
          <TimeRangePicker
            id="busy"
            value={form}
            onChange={setForm}
            presets={BUSY_PRESETS}
            summaryLabel={busyText('summary', 'Busy')}
          />
        </form>
      </Modal>
    </section>
  );
}
