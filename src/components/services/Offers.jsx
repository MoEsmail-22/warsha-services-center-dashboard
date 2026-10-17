import { useCallback, useEffect, useState } from 'react';
import { BadgePercent, Plus, Trash2 } from 'lucide-react';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotify } from '@/hooks/useNotify';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { loadAllServiceOptions } from '@/contexts/ServicesContext';
import { PAGE_SIZE_OPTIONS, usePaginationParams } from '@/hooks/usePaginationParams';
import Pagination from '@/components/widgets/Pagination';
import { EmptyState } from '@/components/widgets/EmptyState';
import {
  Button,
  Card,
  Input,
  LoadingScreen,
  Modal,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  Toggle,
  TR,
} from '@/components/ui';
import { createOffer, deleteOffer, getOffers } from '@/API/offersApi';

const EMPTY_FORM = {
  serviceId: '',
  allServices: false,
  discountPercentage: '',
  startAt: '',
  endAt: '',
};

// Same header style as the Busy Mode table below
const HEADER_CLASS = 'px-3 py-3 text-start text-xs font-semibold whitespace-nowrap text-[#5A6968]';

/** "7 Oct 2026" on top, "10:00" underneath — keeps the date columns narrow. */
function formatDate(value, language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '—', time: '' };

  const locale = language === 'ar' ? 'ar-EG' : 'en-GB';

  return {
    date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date),
    time: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date),
  };
}

function OfferDate({ value, lang }) {
  const { date, time } = formatDate(value, lang);

  return (
    <time dateTime={value} className="flex flex-col gap-0.5">
      <span className="font-medium text-[#1C1712]">{date}</span>
      {time && <span className="text-xs text-[#7D7166]">{time}</span>}
    </time>
  );
}

export default function Offers() {
  const { t } = useAppTranslation('services');
  const { isRTL, lang } = useLanguage();
  const { user } = useAuth();
  const notify = useNotify();
  const { getErrorMessage } = useErrorMessage();
  const offerText = (key, defaultValue, options) =>
    t(`offers.${key}`, { defaultValue, ...options });

  // All services for the dropdown and the Service column; the Services table above only holds one page.
  const [services, setServices] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ?offersPage=2&offersSize=20 — prefixed so it doesn't clash with the Services table.
  const { page, pageSize, setPage, setPageSize } = usePaginationParams('offers');
  const totalPages = Math.max(1, Math.ceil(offers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleOffers = offers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasServices = services.length > 0;
  const isFormValid =
    (form.allServices || form.serviceId !== '') &&
    Number(form.discountPercentage) > 0 &&
    Number(form.discountPercentage) <= 100 &&
    form.startAt !== '' &&
    form.endAt !== '' &&
    new Date(form.endAt) > new Date(form.startAt);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      setOffers(await getOffers());
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadOffers();
  }, [user, loadOffers]);

  useEffect(() => {
    // Refresh the options each time the dialog opens, so new services show up.
    if (!modalOpen && services.length > 0) return;

    let cancelled = false;
    loadAllServiceOptions()
      .then((options) => {
        if (!cancelled) setServices(options);
      })
      .catch(() => {
        // The dialog shows "Add a service first" when the list stays empty.
      });

    return () => {
      cancelled = true;
    };
  }, [modalOpen, services.length]);

  const serviceName = (offer) => {
    if (offer.serviceId == null) return offerText('allServices', 'All services');

    const service = services.find((item) => String(item.id) === String(offer.serviceId));
    if (service) return service.name[lang] || service.name.en;

    return offer.serviceName[lang] || offer.serviceName.en || `#${offer.serviceId ?? '—'}`;
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setForm(EMPTY_FORM);
  };

  const addOffer = async (event) => {
    event.preventDefault();
    if (!isFormValid || saving) return;

    setSaving(true);

    try {
      await createOffer(form);
      setModalOpen(false);
      setForm(EMPTY_FORM);
      notify.success('offerCreated');
      // Reload so the new offer shows with its backend ID.
      await loadOffers();
    } catch (error) {
      notify.error(error, 'offer.create');
    } finally {
      setSaving(false);
    }
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);

    try {
      await deleteOffer(deleteTarget.id);
      setOffers((current) => current.filter((offer) => offer.id !== deleteTarget.id));
      setDeleteTarget(null);
      notify.success('offerDeleted');
    } catch (error) {
      notify.error(error, 'offer.delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="flex w-full min-w-0 flex-1 flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#15201F]">{offerText('title', 'Offers')}</h2>
          <p className="mt-1 text-xs text-[#5A6968]">
            {offerText('subtitle', 'Manage service discounts and offer dates.')}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          {offerText('addOffer', 'Add offer')}
        </Button>
      </div>

      <Card padded={false} className="flex flex-1 flex-col">
        <div className="flex-1 overflow-x-auto pb-2">
          <Table className="w-full">
            <THead>
              <TR className="hover:bg-gray-50">
                <TH className={HEADER_CLASS}>{offerText('table.service', 'Service')}</TH>
                <TH className={HEADER_CLASS}>{offerText('table.discount', 'Discount')}</TH>
                <TH className={HEADER_CLASS}>{offerText('table.startAt', 'Starts at')}</TH>
                <TH className={HEADER_CLASS}>{offerText('table.endAt', 'Ends at')}</TH>
                <TH className={`${HEADER_CLASS} text-end`}>
                  {offerText('table.actions', 'Actions')}
                </TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={5}>
                    <LoadingScreen variant="section" />
                  </TD>
                </TR>
              ) : loadError ? (
                <TR>
                  <TD colSpan={5} className="py-10 text-center">
                    <p className="text-sm text-red-600">
                      {getErrorMessage(loadError, 'offer.load')}
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={loadOffers}>
                      {offerText('actions.retry', 'Try again')}
                    </Button>
                  </TD>
                </TR>
              ) : offers.length === 0 ? (
                <TR>
                  <TD colSpan={5}>
                    <EmptyState
                      icon={<BadgePercent />}
                      title={offerText('empty', 'No offers yet.')}
                      description={offerText(
                        'emptyDescription',
                        'Create a discount on a service for a set time.'
                      )}
                    />
                  </TD>
                </TR>
              ) : (
                visibleOffers.map((offer) => (
                  <TR key={offer.id} className="transition-colors hover:bg-[#FAF9F6]">
                    <TD className="min-w-[100px] px-3 py-3 font-semibold text-[#1C1712]">
                      {serviceName(offer)}
                    </TD>
                    <TD className="px-3 py-3 whitespace-nowrap">
                      <span className="inline-flex rounded-full bg-[#E8F1EF] px-3 py-1 text-sm font-semibold text-[#0E5C5B]">
                        {offer.discountPercentage}%
                      </span>
                    </TD>
                    <TD className="px-3 py-3 whitespace-nowrap">
                      <OfferDate value={offer.startAt} lang={lang} />
                    </TD>
                    <TD className="px-3 py-3 whitespace-nowrap">
                      <OfferDate value={offer.endAt} lang={lang} />
                    </TD>
                    <TD className="px-3 py-3 text-end whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(offer)}
                        disabled={deleting}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={offerText('actions.delete', 'Delete offer')}
                        title={offerText('actions.delete', 'Delete offer')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>

        {!loading && offers.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={offers.length}
            pageSize={pageSize}
            onPageChange={setPage}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={setPageSize}
          />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={offerText('modal.title', 'Add an offer')}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
              {offerText('actions.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              form="add-offer-form"
              disabled={!hasServices || !isFormValid || saving}
            >
              {saving ? offerText('saving', 'Saving…') : offerText('addOffer', 'Add offer')}
            </Button>
          </>
        }
      >
        <form id="add-offer-form" onSubmit={addOffer} className="grid gap-4 sm:grid-cols-2">
          {/* All services: a switch at the top of the form (the request then has no serviceId) */}
          <div
            className={`rounded-xl border px-4 py-3 transition-colors sm:col-span-2 ${
              form.allServices ? 'border-[#0E5C5B] bg-[#F2F8F7]' : 'border-[#E8E2D8] bg-[#FBF8F3]'
            }`}
          >
            <Toggle
              id="offer-all-services"
              checked={form.allServices}
              onChange={(checked) => updateField('allServices', checked)}
              disabled={!hasServices}
              label={offerText('fields.selectAllServices', 'Apply to all services')}
              description={offerText(
                'fields.selectAllServicesHint',
                'The discount applies to every service in your workshop.'
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Select
              id="offer-service"
              label={offerText('fields.service', 'Service')}
              value={form.allServices ? '' : form.serviceId}
              onChange={(event) => updateField('serviceId', event.target.value)}
              disabled={!hasServices || form.allServices}
              required={!form.allServices}
            >
              <option value="">
                {form.allServices
                  ? offerText('allServices', 'All services')
                  : offerText('fields.selectService', 'Choose a service')}
              </option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name[lang] || service.name.en}
                </option>
              ))}
            </Select>
          </div>
          <Input
            id="offer-discount-percentage"
            type="number"
            min="1"
            max="100"
            label={offerText('fields.discountPercentage', 'Discount percentage')}
            value={form.discountPercentage}
            onChange={(event) => updateField('discountPercentage', event.target.value)}
            required
          />
          <Input
            id="offer-start-at"
            type="datetime-local"
            label={offerText('fields.startAt', 'Starts at')}
            value={form.startAt}
            onChange={(event) => updateField('startAt', event.target.value)}
            required
          />
          <Input
            id="offer-end-at"
            type="datetime-local"
            min={form.startAt || undefined}
            label={offerText('fields.endAt', 'Ends at')}
            value={form.endAt}
            onChange={(event) => updateField('endAt', event.target.value)}
            required
          />
          {!hasServices && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:col-span-2">
              {offerText('noServices', 'Add a service first to create an offer.')}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={closeDeleteModal}
        title={offerText('delete.title', 'Delete offer')}
        size="sm"
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeDeleteModal} disabled={deleting}>
              {offerText('actions.cancel', 'Cancel')}
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting
                ? offerText('deleting', 'Deleting…')
                : offerText('delete.confirm', 'Delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#5A6968]">
          {offerText(
            'delete.message',
            'Delete the {{discount}}% offer on {{service}}? Customers will stop seeing it.',
            {
              discount: deleteTarget?.discountPercentage,
              service: deleteTarget ? serviceName(deleteTarget) : '',
            }
          )}
        </p>
      </Modal>
    </section>
  );
}
