import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, Card, Toggle } from '@/components/ui';
import FormHookInput from '@/components/ui/FormHookInput';
import { ErrorState, ResponsiveAccordion, SkeletonCard } from '@/components/widgets';
import { useSettings } from '@/contexts/SettingsContext';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useNotify } from '@/hooks/useNotify';
import GoogleMapsPreview from '@/components/settings/GoogleMapsPreview';
import LocationPicker from '@/components/settings/LocationPicker';
import WorkingHoursEditor from '@/components/settings/WorkingHoursEditor';
import WorkshopImagePicker from '@/components/settings/WorkshopImagePicker';
import { useServerFieldErrors } from '@/hooks/useServerFieldErrors';

const DESCRIPTION_MAX_LENGTH = 1000;

const DESCRIPTION_FIELDS = [
  { key: 'descriptionEn', translationKey: 'descriptionEn', dir: 'ltr' },
  { key: 'descriptionAr', translationKey: 'descriptionAr', dir: 'rtl' },
];

const EMPTY_FORM = {
  name: '',
  addressEn: '',
  addressAr: '',
  phone: '',
  googleMapsUrl: '',
};

const PROFILE_FIELDS = [
  { key: 'name', type: 'text', translationKey: 'workshopName' },
  { key: 'addressEn', type: 'text', translationKey: 'addressEn' },
  { key: 'addressAr', type: 'text', translationKey: 'addressAr', dir: 'rtl' },
  { key: 'phone', type: 'tel', translationKey: 'phone' },
];

const PREFERENCE_FIELDS = [
  { key: 'acceptOnlineBookings', translationKey: 'acceptOnlineBookings' },
  { key: 'showPrices', translationKey: 'showPrices' },
  { key: 'autoSendServiceUpdates', translationKey: 'autoSendUpdates' },
];

function isGoogleMapsUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      hostname === 'maps.app.goo.gl' ||
      hostname === 'goo.gl' ||
      hostname.endsWith('.google.com') ||
      hostname === 'google.com'
    );
  } catch {
    return false;
  }
}

function hasCoordinates(location) {
  return (
    Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude))
  );
}

function getFirstOpeningHours(workingHours) {
  return Object.values(workingHours || {}).find(
    (hours) => hours?.enabled && hours.open && hours.close
  );
}

export default function SettingsPage() {
  const { t } = useAppTranslation('settings');
  const {
    data,
    loading,
    error,
    updateWorkshop,
    saveWorkshopProfile,
    saveWorkshopImage,
    togglePreference,
  } = useSettings();
  const [workshopForm, setWorkshopForm] = useState(null);
  const notify = useNotify();
  const showFieldErrors = useServerFieldErrors();
  const [saving, setSaving] = useState(false);
  const [locationError, setLocationError] = useState('');
  const initializedForm = useRef(false);
  const {
    register,
    handleSubmit: submitForm,
    reset,
    setValue,
    getFieldState,
    watch,
    setError,
    formState: { errors: fieldErrors },
  } = useForm({
    defaultValues: { ...EMPTY_FORM, descriptionEn: '', descriptionAr: '' },
  });

  useEffect(() => {
    if (data?.workshop && !initializedForm.current) {
      reset({
        name: data.workshop.name || '',
        addressEn: data.workshop.addressEn || '',
        addressAr: data.workshop.addressAr || '',
        phone: data.workshop.phone || '',
        googleMapsUrl: data.workshop.location?.googleMapsUrl || '',
        descriptionEn: data.workshop.descriptionEn || '',
        descriptionAr: data.workshop.descriptionAr || '',
      });
      initializedForm.current = true;
    }
  }, [data?.workshop, reset]);

  // The descriptions are shown as editable text (not placeholders), so fill them
  // when the profile arrives from the API — unless the user already started typing.
  const savedDescriptionEn = data?.workshop?.descriptionEn;
  const savedDescriptionAr = data?.workshop?.descriptionAr;
  useEffect(() => {
    if (!getFieldState('descriptionEn').isDirty)
      setValue('descriptionEn', savedDescriptionEn || '');
    if (!getFieldState('descriptionAr').isDirty)
      setValue('descriptionAr', savedDescriptionAr || '');
  }, [savedDescriptionEn, savedDescriptionAr, getFieldState, setValue]);

  const handleSubmit = async (formValues) => {
    const enteredMapsUrl = formValues.googleMapsUrl?.trim() || '';
    const currentLocation = data.workshop.location;
    const savedMapsUrl = currentLocation?.googleMapsUrl || '';

    // A workshop needs either a map pin or a Google Maps link. A previously
    // saved value still counts when the user edits another profile field.
    if (!hasCoordinates(currentLocation) && !enteredMapsUrl && !savedMapsUrl) {
      setLocationError(
        t('locationRequired', { defaultValue: 'Choose a map location or add a Google Maps link.' })
      );
      return;
    }

    if (enteredMapsUrl && !isGoogleMapsUrl(enteredMapsUrl)) {
      setLocationError(
        t('invalidGoogleMapsUrl', { defaultValue: 'Enter a valid Google Maps link.' })
      );
      return;
    }

    // Empty fields keep their existing placeholder value; only typed fields change.
    const nextWorkshop = Object.fromEntries(
      PROFILE_FIELDS.map(({ key }) => [key, formValues[key]?.trim() || data.workshop[key] || ''])
    );

    const descriptions = {
      descriptionEn: formValues.descriptionEn?.trim() || '',
      descriptionAr: formValues.descriptionAr?.trim() || '',
    };

    const updates = {
      ...nextWorkshop,
      ...descriptions,
      location: enteredMapsUrl
        ? { ...currentLocation, googleMapsUrl: enteredMapsUrl }
        : currentLocation,
    };
    const openingHours = getFirstOpeningHours(data.workshop.workingHours);
    const profileData = {
      name: nextWorkshop.name,
      phone: nextWorkshop.phone,
      googleMapsLink: enteredMapsUrl || savedMapsUrl,
      addressEn: nextWorkshop.addressEn,
      addressAr: nextWorkshop.addressAr,
      ...descriptions,
      lat: Number(currentLocation?.latitude) || 0,
      lng: Number(currentLocation?.longitude) || 0,
      openingTime: openingHours?.open || '',
      closingTime: openingHours?.close || '',
    };

    setSaving(true);
    try {
      await saveWorkshopProfile(updates, profileData);
      // Short fields go back to showing the saved value as a placeholder;
      // the descriptions keep the saved text.
      reset({ ...EMPTY_FORM, ...descriptions });
      setLocationError('');
      notify.success('settingsSaved');
    } catch (err) {
      // A field the backend refused is marked on the form; anything else is a toast.
      const marked = showFieldErrors(err, setError, {
        fields: [...PROFILE_FIELDS, ...DESCRIPTION_FIELDS]
          .map((field) => field.key)
          .concat('googleMapsUrl'),
        fieldMap: { googleMapsLink: 'googleMapsUrl' },
      });
      if (!marked) notify.error(err, 'settings.save');
    } finally {
      setSaving(false);
    }
  };

  const handlePreferenceToggle = async (key) => {
    try {
      await togglePreference(key);
      notify.success('preferenceSaved');
    } catch (err) {
      notify.error(err, 'settings.save');
    }
  };

  if (error) {
    return (
      <ErrorState
        title={t('loadError', { defaultValue: 'Unable to load settings' })}
        description={error}
      />
    );
  }

  if (loading || !data?.workshop) {
    return (
      <div className="grid gap-4 lg:grid-cols-5">
        <SkeletonCard className="h-96 lg:col-span-3" rounded="xl" />
        <SkeletonCard className="h-72 lg:col-span-2" rounded="xl" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="mb-5">
        <h1
          className="text-2xl font-bold text-[#15201F]"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          {t('title', { defaultValue: 'Settings' })}
        </h1>
        <p className="mt-1 text-sm text-[#5A6968]">
          {t('subtitle', { defaultValue: 'Manage your workshop profile and account.' })}
        </p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <Card padded={false} className="lg:col-span-3">
          <ResponsiveAccordion
            title={t('workshopProfile', { defaultValue: 'Workshop profile' })}
            defaultOpen
          >
            <form onSubmit={submitForm(handleSubmit)} className="space-y-4 p-5">
              <WorkshopImagePicker imageUrl={data.workshop.imageUrl} onUpload={saveWorkshopImage} />

              {/* Fields come from one definition so adding a profile field stays simple. */}
              {PROFILE_FIELDS.map((field) => (
                <FormHookInput
                  key={field.key}
                  id={`workshop-${field.key}`}
                  type={field.type}
                  dir={field.dir}
                  label={t(field.translationKey)}
                  placeholder={
                    data.workshop[field.key] ||
                    (field.placeholderKey ? t(field.placeholderKey) : '')
                  }
                  register={register}
                  name={field.key}
                  error={fieldErrors[field.key]?.message}
                />
              ))}

              {DESCRIPTION_FIELDS.map((field) => (
                <div key={field.key}>
                  <label htmlFor={`workshop-${field.key}`} className="label">
                    {t(field.translationKey)}
                  </label>
                  <textarea
                    id={`workshop-${field.key}`}
                    dir={field.dir}
                    rows={4}
                    maxLength={DESCRIPTION_MAX_LENGTH}
                    placeholder={t(`${field.translationKey}Placeholder`)}
                    className={`input min-h-24 resize-y leading-6 ${
                      fieldErrors[field.key] ? 'border-red-500 focus:border-red-500' : ''
                    }`}
                    {...register(field.key)}
                  />
                  {fieldErrors[field.key] && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors[field.key].message}</p>
                  )}
                  <p className="mt-1 text-end text-xs text-[#5A6968]">
                    {(watch(field.key) || '').length}/{DESCRIPTION_MAX_LENGTH}
                  </p>
                </div>
              ))}

              <FormHookInput
                id="workshop-google-maps-url"
                type="url"
                label={t('googleMapsUrl')}
                placeholder={data.workshop.location?.googleMapsUrl || t('googleMapsUrlPlaceholder')}
                error={locationError || fieldErrors.googleMapsUrl?.message}
                register={register}
                name="googleMapsUrl"
                rules={{
                  onChange: () => setLocationError(''),
                }}
              />
              <LocationPicker
                value={data.workshop.location}
                onChange={(location) => {
                  updateWorkshop({ location });
                  setLocationError('');
                }}
              />

              <WorkingHoursEditor
                value={data.workshop.workingHours}
                onChange={(workingHours) => {
                  updateWorkshop({ workingHours });
                }}
              />

              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                <Button type="submit" className="min-h-10 px-5" disabled={saving}>
                  {t('saveChanges', { defaultValue: 'Save changes' })}
                </Button>
              </div>
            </form>
          </ResponsiveAccordion>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card padded={false}>
            <ResponsiveAccordion
              title={t('preferences', { defaultValue: 'Preferences' })}
              defaultOpen={false}
            >
              <div>
                {PREFERENCE_FIELDS.map((preference) => (
                  <div
                    key={preference.key}
                    className="border-b border-gray-200 px-5 py-4 last:border-b-0"
                  >
                    <Toggle
                      id={`preference-${preference.key}`}
                      label={t(preference.translationKey)}
                      checked={Boolean(data.preferences[preference.key])}
                      onChange={() => handlePreferenceToggle(preference.key)}
                    />
                  </div>
                ))}
              </div>
            </ResponsiveAccordion>
          </Card>

          <GoogleMapsPreview location={data.workshop.location} />
        </div>
      </div>
    </div>
  );
}
