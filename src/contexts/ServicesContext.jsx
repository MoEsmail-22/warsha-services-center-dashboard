/**
 * ServicesContext — provides services + pricing data + CRUD actions.
 *
 * Used by: Services & Pricing page (table), Quotes page (line items selection).
 *
 * Each service has bilingual names (en/ar) — the page picks the right one
 * based on the current language.
 *
 * The list is paginated: the page calls loadServices({ pageNumber, pageSize }) and
 * the context keeps only that page, plus the totals for the pagination bar.
 *
 * Exposes:
 *   { data, loading, error, pagination, loadServices, addService, updateService,
 *     toggleStatus, deleteService, duplicateService }
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useReducer,
  useRef,
} from 'react';
import {
  createService,
  editService,
  getServices,
  removeService,
  toggleServiceVisibility,
  getServiceCategories,
} from '@/API/Service';
import { isDemoMode } from '@/API/client';

import { useAuth } from './AuthContext';

const ServicesContext = createContext(null);

function normalizeService(service) {
  const visible = service.isActive ?? service.visible ?? service.isVisible ?? true;
  const categoryValue =
    service.category?.key ??
    service.category?.nameEn ??
    service.category?.name?.en ??
    service.serviceCategory?.key ??
    service.serviceCategory?.nameEn ??
    service.serviceCategory?.name?.en ??
    service.category ??
    service.serviceCategory ??
    service.categoryName ??
    '';

  return {
    ...service,
    id: service.id ?? service.workshopServiceId ?? service.serviceId,
    name: {
      en: service.name?.en ?? service.nameEn ?? '',
      ar: service.name?.ar ?? service.nameAr ?? '',
    },
    description: {
      en: service.description?.en ?? service.descriptionEn ?? '',
      ar: service.description?.ar ?? service.descriptionAr ?? '',
    },
    category:
      typeof categoryValue === 'string'
        ? categoryValue.trim().toLowerCase()
        : typeof categoryValue === 'object'
          ? ''
          : categoryValue,
    serviceCategoryId:
      service.serviceCategoryId ??
      service.categoryId ??
      service.category?.id ??
      service.serviceCategory?.id,
    // The category's name if the backend sends it with the service (used when there is no ID).
    categoryName: {
      en:
        service.categoryEn ??
        service.serviceCategory?.nameEn ??
        service.category?.nameEn ??
        service.serviceCategoryNameEn ??
        service.categoryNameEn ??
        service.serviceCategoryName ??
        (typeof service.categoryName === 'string' ? service.categoryName : null) ??
        (typeof service.category === 'string' ? service.category : null) ??
        '',
      ar:
        service.categoryAr ??
        service.serviceCategory?.nameAr ??
        service.category?.nameAr ??
        service.serviceCategoryNameAr ??
        service.categoryNameAr ??
        '',
    },
    durationMinutes: service.durationMinutes ?? service.duration ?? 0,
    // One price (older answers sent minPrice / maxPrice; the lower one is used then).
    price: Number(
      (typeof service.price === 'object' ? service.price?.from : service.price) ??
        service.minPrice ??
        0
    ),
    visible,
    status: service.status ?? (visible ? 'active' : 'inactive'),
  };
}

function getServiceRows(result) {
  const candidates = [
    result,
    result?.data,
    result?.services,
    result?.data?.services,
    result?.data?.items,
    result?.items,
  ];
  return candidates.find(Array.isArray) || [];
}

/** One page of services plus the totals the backend sends with it. */
function getServicePage(result) {
  const items = getServiceRows(result).map(normalizeService);
  const meta = result?.data && !Array.isArray(result.data) ? result.data : {};

  return {
    items,
    totalCount: meta.totalCount ?? items.length,
    totalPages: meta.totalPages ?? (items.length ? 1 : 0),
  };
}

/**
 * Every service in one list, for pickers such as the Offers service dropdown.
 * Not for the table: the table loads one page at a time through loadServices.
 */
export async function loadAllServiceOptions() {
  const result = await getServices({ pageNumber: 1, pageSize: 100 });
  return getServicePage(result).items;
}

const initialState = {
  data: [],
  loading: true,
  error: null,
  pagination: { totalCount: 0, totalPages: 0 },
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null };

    case 'LOAD_SUCCESS':
      return {
        data: action.payload.items,
        loading: false,
        error: null,
        pagination: {
          totalCount: action.payload.totalCount,
          totalPages: action.payload.totalPages,
        },
      };

    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.payload };

    case 'UPDATE_SERVICE':
      return {
        ...state,
        data: state.data.map((service) =>
          service.id === action.payload.id ? { ...service, ...action.payload } : service
        ),
      };

    case 'TOGGLE_STATUS':
      return {
        ...state,
        data: state.data.map((service) =>
          service.id === action.payload
            ? {
                ...service,
                status: service.status === 'active' ? 'inactive' : 'active',
                visible: service.status !== 'active',
              }
            : service
        ),
      };

    case 'DUPLICATE_SERVICE': {
      const original = state.data.find((service) => service.id === action.payload);
      if (!original) return state;

      const copy = {
        ...original,
        id: `S-${Date.now()}`,
        name: { ...original.name },
        description: { ...original.description },
      };

      return { ...state, data: [copy, ...state.data] };
    }

    default:
      return state;
  }
}

/** One backend category → what the UI needs. */
function normalizeCategory(category) {
  return {
    id: String(category.id),
    name: { en: category.nameEn ?? '', ar: category.nameAr ?? '' },
    icon: category.icon ?? '',
  };
}

export function ServicesProvider({ children }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);

  const [state, dispatch] = useReducer(reducer, initialState);
  // The page currently shown, so add/delete can reload the same page.
  const lastQuery = useRef({ pageNumber: 1, pageSize: 10 });
  // Only the newest request may update the table (fast clicks between pages).
  const latestRequest = useRef(0);

  const loadServices = useCallback(async (query = lastQuery.current) => {
    lastQuery.current = query;
    const requestId = ++latestRequest.current;
    dispatch({ type: 'LOAD_START' });

    try {
      const page = getServicePage(await getServices(query));
      if (requestId === latestRequest.current) dispatch({ type: 'LOAD_SUCCESS', payload: page });
    } catch (error) {
      if (requestId === latestRequest.current) {
        dispatch({ type: 'LOAD_ERROR', payload: error });
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setCategories([]);
      return undefined;
    }
    let cancelled = false;
    getServiceCategories()
      .then((result) => {
        if (!cancelled) setCategories((result?.data ?? []).map(normalizeCategory));
      })
      .catch((error) => console.error('Could not load service categories:', error.details));

    return () => {
      cancelled = true;
    };
  }, [user]);

  const addService = async (form) => {
    const parsedCategoryId = Number(form.categoryId);
    const serviceCategoryId =
      Number.isInteger(parsedCategoryId) && parsedCategoryId > 0 ? parsedCategoryId : null;

    const payload = {
      nameEn: form.nameEn.trim(),
      nameAr: form.nameAr.trim(),
      price: Number(form.price),
      serviceCategoryId,
      duration: Number(form.durationMinutes),
      descriptionEn: form.descriptionEn.trim(),
      descriptionAr: form.descriptionAr.trim(),
    };

    const result = await createService(payload);
    // Reload the current page so the totals and the new service's backend ID are right.
    await loadServices();
    return result;
  };

  const updateService = async (id, updates) => {
    const current = state.data.find((service) => String(service.id) === String(id));
    if (!current) throw new Error('This service is no longer in the list. Refresh and try again.');

    const categoryId = Number(updates.categoryId || current.serviceCategoryId);
    const resolvedCategoryId = Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;

    const payload = isDemoMode()
      ? updates
      : {
          workshopServiceId: Number(id),
          nameEn: updates.nameEn.trim(),
          nameAr: updates.nameAr.trim(),
          price: Number(updates.price),
          serviceCategoryId: resolvedCategoryId,
          duration: Number(updates.durationMinutes),
          descriptionEn: updates.descriptionEn.trim(),
          descriptionAr: updates.descriptionAr.trim(),
        };

    const result = await editService(id, payload);
    const updated = {
      id: current.id,
      name: {
        en: updates.nameEn.trim(),
        ar: updates.nameAr.trim(),
      },
      description: {
        en: updates.descriptionEn.trim(),
        ar: updates.descriptionAr.trim(),
      },
      serviceCategoryId: resolvedCategoryId ?? current.serviceCategoryId,
      durationMinutes: Number(updates.durationMinutes),
      price: Number(updates.price),
    };
    dispatch({ type: 'UPDATE_SERVICE', payload: updated });
    return result;
  };

  const toggleStatus = async (id) => {
    const service = state.data.find((item) => item.id === id);
    if (!service) return;

    const status = service.status === 'active' ? 'inactive' : 'active';
    await toggleServiceVisibility(id);
    const updated = { status, visible: status === 'active' };
    dispatch({ type: 'UPDATE_SERVICE', payload: { id, ...updated } });
    return updated;
  };

  const deleteService = async (id) => {
    await removeService(id);
    // Reload so the next service moves up into this page and the totals stay right.
    await loadServices();
  };

  const duplicateService = (id) => dispatch({ type: 'DUPLICATE_SERVICE', payload: id });

  return (
    <ServicesContext.Provider
      value={{
        ...state,
        loadServices,
        addService,
        updateService,
        toggleStatus,
        deleteService,
        duplicateService,
        categories,
      }}
    >
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices() {
  const context = useContext(ServicesContext);

  if (!context) {
    throw new Error('useServices must be used inside a <ServicesProvider>');
  }

  return context;
}
