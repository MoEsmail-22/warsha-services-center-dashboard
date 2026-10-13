import { lazy, Suspense, useState } from 'react';
import { Crosshair, MapPin } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import LocationSearch from './LocationSearch';

const LeafletLocationMap = lazy(() => import('./LeafletLocationMap'));

const DEFAULT_POSITION = { lat: 30.0444, lng: 31.2357 };

function locationToPosition(location) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { lat: latitude, lng: longitude };
  }

  return DEFAULT_POSITION;
}

export default function LocationPicker({ value, onChange }) {
  const { t } = useAppTranslation('settings');
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(() => locationToPosition(value));
  const [locationError, setLocationError] = useState('');

  const openPicker = () => {
    setPosition(locationToPosition(value));
    setLocationError('');
    setOpen(true);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(t('locationUnavailable'));
      return;
    }

    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      // zoom 17: close enough to see the nearby streets and places.
      ({ coords }) => setPosition({ lat: coords.latitude, lng: coords.longitude, zoom: 17 }),
      () => setLocationError(t('locationPermissionError')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const confirmLocation = () => {
    const latitude = Number(position.lat.toFixed(6));
    const longitude = Number(position.lng.toFixed(6));

    onChange({
      latitude,
      longitude,
      googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });
    setOpen(false);
  };

  return (
    <section aria-labelledby="workshop-location-heading">
      <div className="mb-2">
        <h3 id="workshop-location-heading" className="text-sm font-medium text-gray-700">
          {t('workshopLocation')}
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">{t('workshopLocationDescription')}</p>
      </div>

      {value?.latitude != null && value?.longitude != null && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
          <span className="font-medium text-gray-700">{t('selectedCoordinates')}: </span>
          <span className="text-gray-600">
            {value.latitude}, {value.longitude}
          </span>
        </div>
      )}

      <Button type="button" size="sm" className="w-full sm:w-auto" onClick={openPicker}>
        <MapPin className="h-4 w-4" />
        {value?.latitude != null ? t('editLocation') : t('setLocation')}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('locationPickerTitle')}
        size="lg"
        closeLabel={t('close')}
        contentClassName="px-4 py-4 sm:px-6"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={confirmLocation}>
              {t('confirmLocation')}
            </Button>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-md text-sm text-gray-500">{t('locationPickerHelp')}</p>
          <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation}>
            <Crosshair className="h-4 w-4" />
            {t('useCurrentLocation')}
          </Button>
        </div>

        <LocationSearch position={position} onLocationSelect={setPosition} />

        <Suspense
          fallback={
            <div className="flex h-[300px] items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500 sm:h-[380px]">
              {t('mapLoading')}
            </div>
          }
        >
          <LeafletLocationMap position={position} onPositionChange={setPosition} />
        </Suspense>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="block text-xs text-gray-500">{t('latitude')}</span>
            <span className="font-medium text-gray-800">{position.lat.toFixed(6)}</span>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <span className="block text-xs text-gray-500">{t('longitude')}</span>
            <span className="font-medium text-gray-800">{position.lng.toFixed(6)}</span>
          </div>
        </div>

        {locationError && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {locationError}
          </p>
        )}
      </Modal>
    </section>
  );
}
