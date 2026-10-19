import { useCallback, useEffect, useMemo, useState } from 'react';
import { Car, Plus, Search, Trash2 } from 'lucide-react';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useNotify } from '@/hooks/useNotify';
import { useErrorMessage } from '@/hooks/useErrorMessage';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  addWorkshopCarBrand,
  getCarBrands,
  getWorkshopCarBrands,
  removeWorkshopCarBrand,
} from '@/API/carBrandsApi';
import { EmptyState } from '@/components/widgets/EmptyState';
import {
  Button,
  Card,
  Input,
  LoadingScreen,
  Modal,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';

const isImageUrl = (value) => typeof value === 'string' && /^(https?:)?\/\//.test(value);
// Older versions kept a copy of the workshop's brands in the browser; it's removed on load.
const OLD_STORAGE_KEY = 'workshop_vehicle_brands';

export default function VehicleCatalogDemo() {
  const { t } = useAppTranslation('services');
  const notify = useNotify();
  const { isRTL } = useLanguage();
  const catalogText = (key, defaultValue, options) =>
    t(`vehicleCatalog.${key}`, { defaultValue, ...options });

  const { user } = useAuth();
  const { getErrorMessage } = useErrorMessage();

  // GET /Workshop/me/car-brands: the brands this workshop services.
  const [ownBrands, setOwnBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [brandsError, setBrandsError] = useState(null);

  // silent: refresh after adding or removing, without the loading state.
  const loadBrands = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setBrandsLoading(true);
    setBrandsError(null);
    try {
      setOwnBrands(await getWorkshopCarBrands());
    } catch (error) {
      if (!silent) setBrandsError(error);
    } finally {
      setBrandsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadBrands();
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(OLD_STORAGE_KEY))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage unavailable: nothing to clean up.
    }
  }, [user, loadBrands]);

  // The catalog (all brands): GET /CarCatalog/car-brands, loaded when the section opens.
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  const [marketSearch, setMarketSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadCatalog = async () => {
    setCatalogLoading(true);
    setCatalogError(false);
    try {
      setCatalog(await getCarBrands());
    } catch {
      setCatalogError(true);
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per account
  }, [user?.id]);

  const openModal = () => {
    setModalOpen(true);
    if (catalog.length === 0 && !catalogLoading) loadCatalog();
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedBrand(null);
    setMarketSearch('');
    setBrandPickerOpen(false);
  };

  // Your brands, with the name and logo from the catalog when the list leaves them out.
  const brands = useMemo(
    () =>
      ownBrands.map((brand) => {
        const fromCatalog = catalog.find((item) => String(item.id) === String(brand.id));
        return fromCatalog
          ? { ...brand, name: brand.name || fromCatalog.name, icon: brand.icon || fromCatalog.icon }
          : brand;
      }),
    [ownBrands, catalog]
  );

  const availableBrands = useMemo(
    () =>
      catalog.filter(
        (brand) =>
          brand.name.toLowerCase().includes(marketSearch.toLowerCase()) &&
          !brands.some((item) => String(item.id) === String(brand.id))
      ),
    [catalog, brands, marketSearch]
  );

  const addBrand = async () => {
    if (!selectedBrand || saving) return;

    setSaving(true);
    try {
      await addWorkshopCarBrand(selectedBrand.id);
      setOwnBrands((current) => [...current, selectedBrand]);
      notify.success('carBrandAdded');
      closeModal();
      await loadBrands({ silent: true });
    } catch (error) {
      notify.error(error, 'carBrand.add');
    } finally {
      setSaving(false);
    }
  };

  const deleteBrand = async (brand) => {
    if (deletingId) return;

    setDeletingId(brand.id);
    try {
      await removeWorkshopCarBrand(brand.id);
      setOwnBrands((current) => current.filter((item) => item.id !== brand.id));
      notify.success('carBrandRemoved');
      await loadBrands({ silent: true });
    } catch (error) {
      notify.error(error, 'carBrand.remove');
    } finally {
      setDeletingId(null);
    }
  };

  const brandBadge = (brand) =>
    isImageUrl(brand.icon) ? (
      <img src={brand.icon} alt="" className="h-8 w-8 rounded-lg object-contain" />
    ) : (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F6F3EE] text-xs font-bold text-[#8A8074]">
        {(brand.name || '?').slice(0, 2).toUpperCase()}
      </div>
    );

  return (
    <section className="flex w-full min-w-0 flex-1 flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#15201F]">
            {catalogText('title', 'Vehicle catalog')}
          </h2>
          <p className="mt-1 text-xs text-[#5A6968]">
            {catalogText('subtitle', 'Manage customer car brands.')}
          </p>
        </div>
        <Button onClick={openModal} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          {catalogText('addBrand', 'Add brand')}
        </Button>
      </div>

      <Card padded={false} className="flex flex-1 flex-col">
        <div className="flex-1 overflow-x-auto px-4 pb-4">
          <Table className={brands.length ? 'w-full min-w-[360px]' : 'w-full'}>
            <THead>
              <TR className="hover:bg-gray-50">
                <TH className="px-3 py-2.5 whitespace-nowrap">
                  {catalogText('table.brand', 'Brand')}
                </TH>
                <TH className="px-3 py-2.5 text-end whitespace-nowrap">
                  {catalogText('table.actions', 'Actions')}
                </TH>
              </TR>
            </THead>
            <TBody>
              {brandsLoading ? (
                <TR>
                  <TD colSpan={2}>
                    <LoadingScreen variant="section" />
                  </TD>
                </TR>
              ) : brandsError ? (
                <TR>
                  <TD colSpan={2} className="py-10 text-center">
                    <p className="text-sm text-red-600">
                      {getErrorMessage(brandsError, 'carBrand.load')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => loadBrands()}
                    >
                      {catalogText('retry', 'Try again')}
                    </Button>
                  </TD>
                </TR>
              ) : brands.length === 0 ? (
                <TR>
                  <TD colSpan={2}>
                    <EmptyState
                      icon={<Car />}
                      title={catalogText('noBrands', 'No brands found.')}
                      description={catalogText(
                        'emptyDescription',
                        'Add the car brands your workshop services.'
                      )}
                    />
                  </TD>
                </TR>
              ) : (
                brands.map((item) => (
                  <TR key={item.id}>
                    <TD className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        {brandBadge(item)}
                        <p className="font-semibold text-[#1C1712]">{item.name}</p>
                      </div>
                    </TD>
                    <TD className="px-3 py-2.5 text-end whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => deleteBrand(item)}
                        disabled={deletingId === item.id}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label={catalogText('actions.deleteBrand', `Delete ${item.name}`, {
                          brand: item.name,
                        })}
                        title={catalogText('actions.deleteBrand', `Delete ${item.name}`, {
                          brand: item.name,
                        })}
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
      </Card>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={catalogText('modal.title', 'Add a vehicle brand')}
        size="lg"
        contentClassName="min-h-[300px]"
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeModal}>
              {catalogText('actions.cancel', 'Cancel')}
            </Button>
            <Button type="button" onClick={addBrand} disabled={!selectedBrand || saving}>
              {saving
                ? catalogText('actions.adding', 'Adding…')
                : catalogText('addBrand', 'Add brand')}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-[#1C1712]">
              {catalogText('modal.searchTitle', 'Search the market catalog')}
            </p>
            <p className="mt-1 text-xs text-[#7D7166]">
              {catalogText(
                'modal.searchDescription',
                'Select a brand to make it available to customers.'
              )}
            </p>
          </div>
          <div className="relative">
            <label htmlFor="market-brand-search" className="label">
              {catalogText('fields.brand', 'Vehicle brand')}
            </label>
            <div className="relative">
              <Input
                id="market-brand-search"
                value={marketSearch}
                onChange={(event) => {
                  setMarketSearch(event.target.value);
                  setSelectedBrand(null);
                  setBrandPickerOpen(true);
                }}
                onFocus={() => setBrandPickerOpen(true)}
                placeholder={catalogText(
                  'fields.searchPlaceholder',
                  'Search Toyota, BMW, Hyundai...'
                )}
                aria-label={catalogText('fields.searchLabel', 'Search market brands')}
                role="combobox"
                aria-expanded={brandPickerOpen}
                aria-controls="market-brand-options"
                className="ps-10"
              />
              <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-[#A89A8A]" />
            </div>
            {brandPickerOpen && (
              <div
                id="market-brand-options"
                className="absolute inset-x-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#E8E2D8] bg-white py-1 shadow-lg"
                role="listbox"
              >
                {catalogLoading ? (
                  <p className="px-3 py-3 text-sm text-[#7D7166]">
                    {catalogText('loadingBrands', 'Loading brands…')}
                  </p>
                ) : catalogError ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                    <span className="text-red-600">
                      {catalogText('loadError', "Couldn't load the brand list.")}
                    </span>
                    <button
                      type="button"
                      onClick={loadCatalog}
                      className="font-semibold text-[#0E5C5B] hover:underline"
                    >
                      {catalogText('retry', 'Try again')}
                    </button>
                  </div>
                ) : availableBrands.length > 0 ? (
                  availableBrands.map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      role="option"
                      aria-selected={selectedBrand?.id === brand.id}
                      onClick={() => {
                        setSelectedBrand(brand);
                        setMarketSearch(brand.name);
                        setBrandPickerOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start text-sm text-[#1C1712] hover:bg-[#F6F3EE]"
                    >
                      {brandBadge(brand)}
                      <span className="font-medium">{brand.name}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-sm text-[#7D7166]">
                    {catalogText('noBrands', 'No brands found.')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
