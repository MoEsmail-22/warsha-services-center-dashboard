import { useEffect, useMemo, useState } from 'react';
import { MoreVertical, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { useServices } from '@/contexts';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useLoading } from '@/contexts/LoadingContext';
import { useNotify } from '@/hooks/useNotify';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { PAGE_SIZE_OPTIONS, usePaginationParams } from '@/hooks/usePaginationParams';
import Pagination from '@/components/widgets/Pagination';
import { EmptyState } from '@/components/widgets/EmptyState';
import {
  Button,
  LoadingScreen,
  Modal,
  Table,
  TBody,
  TD,
  TH,
  THead,
  Toggle,
  TR,
} from '@/components/ui';
import ServiceFormModal from '@/components/services/ServiceFormModal';
import BusyTime from '@/components/services/BusyTime';
import Offers from '@/components/services/Offers';
import VehicleCatalogDemo from '@/components/services/VehicleCatalogDemo';

// 45 → "45 min", 60 → "1 hr", 232 → "3 hrs 52 min"
function formatDuration(totalMinutes, language) {
  const value = Math.round(Number(totalMinutes));
  if (!Number.isFinite(value) || value <= 0) return '—';

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const parts = [];

  if (language === 'ar') {
    if (hours === 1) parts.push('ساعة');
    else if (hours === 2) parts.push('ساعتان');
    else if (hours > 2) parts.push(`${hours} ${hours <= 10 ? 'ساعات' : 'ساعة'}`);
    if (minutes > 0) parts.push(`${minutes} دقيقة`);
    return parts.join(' و ');
  }

  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hr' : 'hrs'}`);
  if (minutes > 0) parts.push(`${minutes} min`);
  return parts.join(' ');
}

function formatPrice(price, language) {
  const amount = new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US').format(
    Number(price) || 0
  );
  return language === 'ar' ? `${amount} ج.م` : `${amount} EGP`;
}

export default function ServicesPricingPage() {
  const { t } = useAppTranslation('services');
  const { t: tCommon } = useAppTranslation('common');
  const { withLoading } = useLoading();
  const notify = useNotify();
  const { getErrorMessage } = useErrorMessage();
  const { lang } = useLanguage();
  const {
    data: services,
    categories,
    loading,
    error: loadError,
    pagination,
    loadServices,
    addService,
    updateService,
    toggleStatus,
    deleteService,
  } = useServices();
  // ?page=2&size=20 in the URL decides which page of services is loaded.
  const { page, pageSize, setPage, setPageSize } = usePaginationParams();

  useEffect(() => {
    loadServices({ pageNumber: page, pageSize });
  }, [page, pageSize, loadServices]);

  // After deleting the last service on the last page, step back one page.
  useEffect(() => {
    if (!loading && pagination.totalPages > 0 && page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [loading, page, pagination.totalPages, setPage]);

  // "3" → { en: "Oils & Fluids", ar: "الزيوت والسوائل" } for the Category column.
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  /** Category name in the current language: by ID first, then by the name sent with the service. */
  const categoryLabel = (service) => {
    const byId = categoryNames.get(String(service.serviceCategoryId));
    if (byId) return byId[lang] || byId.en;

    const sentName = service.categoryName ?? { en: '', ar: '' };
    // Match the English name against the list to get the Arabic name too.
    const match = sentName.en
      ? categories.find(
          (category) => category.name.en.toLowerCase() === sentName.en.trim().toLowerCase()
        )
      : null;
    if (match) return match.name[lang] || match.name.en;

    return sentName[lang] || sentName.en || '—';
  };

  const [formModal, setFormModal] = useState({ open: false, service: null });
  const [activeMenuId, setActiveMenuId] = useState(null);
  // Screen position of the open actions menu. It is fixed-positioned so the
  // table's scroll container can't clip it.
  const [menuPosition, setMenuPosition] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStep, setDeleteStep] = useState(0);
  const [savingService, setSavingService] = useState(false);

  useEffect(() => {
    if (!activeMenuId) return undefined;

    const closeMenu = (event) => {
      if (!event.target.closest('[data-service-actions]')) setActiveMenuId(null);
    };

    // A fixed menu would drift away from its row while scrolling, so close it.
    const closeOnScroll = () => setActiveMenuId(null);

    document.addEventListener('mousedown', closeMenu);
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [activeMenuId]);

  const toggleMenu = (serviceId, button) => {
    if (activeMenuId === serviceId) {
      setActiveMenuId(null);
      return;
    }

    const MENU_HEIGHT = 96;
    const GAP = 4;
    const rect = button.getBoundingClientRect();
    const openUp = window.innerHeight - rect.bottom < MENU_HEIGHT + GAP && rect.top > MENU_HEIGHT;
    const isRTL = document.documentElement.dir === 'rtl';

    setMenuPosition({
      ...(openUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      // Align the menu's end edge with the button's end edge.
      ...(isRTL ? { left: rect.left } : { right: window.innerWidth - rect.right }),
    });
    setActiveMenuId(serviceId);
  };

  const closeFormModal = () => {
    if (savingService) return;
    setFormModal({ open: false, service: null });
  };

  const saveService = async (form) => {
    setSavingService(true);
    const isNew = !formModal.service;

    try {
      if (isNew) {
        await addService(form);
      } else {
        await updateService(formModal.service.id, form);
      }
      setFormModal({ open: false, service: null });
      notify.success(isNew ? 'serviceAdded' : 'serviceUpdated');
    } catch (error) {
      // The form stays open with the user's input so they can fix it and retry.
      notify.error(error, 'service.save');
    } finally {
      setSavingService(false);
    }
  };

  const changeVisibility = async (service) => {
    try {
      const updated = await toggleStatus(service.id);
      notify.success(updated?.status === 'active' ? 'serviceShown' : 'serviceHidden');
    } catch (error) {
      notify.error(error, 'service.toggle');
    }
  };

  const requestDelete = (service) => {
    setActiveMenuId(null);
    setDeleteTarget(service);
    setDeleteStep(2);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteStep(0);
  };

  const confirmDelete = async () => {
    try {
      await withLoading(() => deleteService(deleteTarget.id), tCommon('loading.deleting'));
      notify.success('serviceDeleted');
    } catch (error) {
      notify.error(error, 'service.delete');
    } finally {
      closeDeleteModal();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[#15201F]"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-[#5A6968]">{t('subtitle')}</p>
        </div>

        <Button
          onClick={() => setFormModal({ open: true, service: null })}
          className="gap-2 self-start sm:self-auto"
        >
          <Plus size={18} />
          {t('addService')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR className="hover:bg-gray-50">
                <TH>{t('table.serviceName')}</TH>
                <TH>{t('table.category')}</TH>
                <TH>{t('table.duration')}</TH>
                <TH>{t('table.price')}</TH>
                <TH>{t('table.status')}</TH>
                <TH className="text-end">{t('table.actions')}</TH>
              </TR>
            </THead>

            <TBody>
              {loading ? (
                <TR>
                  <TD colSpan={6}>
                    <LoadingScreen variant="section" />
                  </TD>
                </TR>
              ) : loadError ? (
                <TR>
                  <TD colSpan={6} className="py-10 text-center">
                    <p className="text-sm text-red-600">
                      {getErrorMessage(loadError, 'service.load')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => loadServices({ pageNumber: page, pageSize })}
                    >
                      {tCommon('errorPage.retry')}
                    </Button>
                  </TD>
                </TR>
              ) : services.length === 0 ? (
                <TR>
                  <TD colSpan={6}>
                    <EmptyState
                      icon={<Wrench />}
                      title={t('noServices')}
                      description={t('emptyDescription', {
                        defaultValue: 'Add the services you offer so customers can book them.',
                      })}
                      action={
                        <Button
                          onClick={() => setFormModal({ open: true, service: null })}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          {t('addService')}
                        </Button>
                      }
                    />
                  </TD>
                </TR>
              ) : (
                services.map((service) => {
                  const isActive = service.status === 'active';

                  return (
                    <TR key={service.id}>
                      <TD className="font-medium">{service.name[lang] || service.name.en}</TD>
                      <TD className="text-gray-600">{categoryLabel(service)}</TD>
                      <TD className="text-gray-600">
                        {formatDuration(service.durationMinutes, lang)}
                      </TD>
                      <TD className="text-gray-600">{formatPrice(service.price, lang)}</TD>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Toggle
                            id={`service-status-${service.id}`}
                            checked={isActive}
                            onChange={() => changeVisibility(service)}
                          />
                          <span
                            className={
                              isActive
                                ? 'text-sm font-medium text-emerald-700'
                                : 'text-sm font-medium text-gray-500'
                            }
                          >
                            {isActive ? t('status.active') : t('status.inactive')}
                          </span>
                        </div>
                      </TD>
                      <TD className="text-end">
                        <div className="relative inline-block" data-service-actions>
                          <button
                            type="button"
                            onClick={(event) => toggleMenu(service.id, event.currentTarget)}
                            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-[#F2EDE4] hover:text-[#1C1712]"
                            aria-label={t('actions.openMenu', { name: service.name[lang] })}
                            aria-expanded={activeMenuId === service.id}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {activeMenuId === service.id && menuPosition && (
                            <div
                              style={menuPosition}
                              className="fixed z-50 w-44 overflow-hidden rounded-xl border border-[#E8E2D8] bg-white py-1 text-start shadow-lg"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setFormModal({ open: true, service });
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-[#1C1712] hover:bg-[#F6F3EE]"
                              >
                                <Pencil className="h-4 w-4 text-[#8A8074]" />
                                {t('actions.edit')}
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDelete(service)}
                                className="flex w-full items-center gap-2 border-t border-[#F2EDE4] px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                {t('actions.delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>

        {pagination.totalCount > 0 && (
          <Pagination
            currentPage={page}
            totalItems={pagination.totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      <div className="mt-8 flex flex-col gap-8 xl:flex-row xl:items-stretch">
        <VehicleCatalogDemo />
        <Offers />
      </div>

      <div className="mt-8">
        <BusyTime />
      </div>

      <ServiceFormModal
        open={formModal.open}
        service={formModal.service}
        onClose={closeFormModal}
        onSave={saveService}
        saving={savingService}
      />

      <Modal
        open={deleteStep === 2}
        onClose={closeDeleteModal}
        title={t('delete.finalTitle')}
        size="sm"
        dismissOnBackdrop={false}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeDeleteModal}>
              {t('actions.cancel')}
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete}>
              {t('delete.confirm')}
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">{t('delete.finalWarning')}</p>
          <p className="mt-2 text-sm text-red-700">
            {t('delete.serviceDetails', {
              id: deleteTarget?.id,
              name: deleteTarget?.name?.[lang] || deleteTarget?.name?.en,
            })}
          </p>
        </div>
      </Modal>
    </div>
  );
}
