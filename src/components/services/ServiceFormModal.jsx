import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select } from '@/components/ui';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useServices } from '@/contexts';
import { useLanguage } from '@/contexts/LanguageContext';

const EMPTY_FORM = {
  nameEn: '',
  nameAr: '',
  categoryId: '',
  minPricing: '',
  maxPricing: '',
  durationMinutes: '',
  descriptionEn: '',
  descriptionAr: '',
};

/** The services list sends the category name only, so find its ID in the categories list. */
function findCategoryId(service, categories) {
  if (service.serviceCategoryId != null) return String(service.serviceCategoryId);
  const name = service.categoryName?.en?.trim().toLowerCase();
  const match = name && categories.find((category) => category.name.en.toLowerCase() === name);
  return match?.id ?? '';
}

function serviceToForm(service, categories) {
  if (!service) return EMPTY_FORM;
  return {
    nameEn: service.name?.en ?? '',
    nameAr: service.name?.ar ?? '',
    categoryId: findCategoryId(service, categories),
    minPricing: String(service.price?.from ?? ''),
    maxPricing: String(service.price?.to ?? ''),
    durationMinutes: String(service.durationMinutes ?? ''),
    descriptionEn: service.description?.en ?? '',
    descriptionAr: service.description?.ar ?? '',
  };
}

/** One form is shared by both Add and Edit so their fields stay consistent. */
export default function ServiceFormModal({ open, service, onClose, onSave, saving = false }) {
  const { categories } = useServices();
  const { lang } = useLanguage();
  const { t } = useAppTranslation('services');
  const [form, setForm] = useState(EMPTY_FORM);
  const isEditing = Boolean(service);

  useEffect(() => {
    if (open) setForm(serviceToForm(service, categories));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when the form opens
  }, [open, service]);

  // If the categories arrive after the edit form opened, fill in only the category.
  useEffect(() => {
    if (!open || !service || categories.length === 0) return;
    setForm((current) =>
      current.categoryId ? current : { ...current, categoryId: findCategoryId(service, categories) }
    );
  }, [open, service, categories]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  const formId = isEditing ? 'edit-service-form' : 'add-service-form';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('modal.editTitle') : t('modal.title')}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {isEditing ? t('actions.saveChanges') : t('actions.save')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        {isEditing && (
          <div className="rounded-lg border border-[#E8E2D8] bg-[#F6F3EE] px-3 py-2 text-sm">
            <span className="font-medium text-[#5A5045]">{t('fields.serviceId')}: </span>
            <span className="font-semibold text-[#1C1712]">{service.id}</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            id={`${formId}-name-en`}
            label={t('fields.nameEn')}
            placeholder={t('placeholders.nameEn', { defaultValue: 'e.g. Oil Change' })}
            value={form.nameEn}
            onChange={(event) => updateField('nameEn', event.target.value)}
            required
          />

          <Input
            id={`${formId}-name-ar`}
            label={t('fields.nameAr')}
            placeholder={t('placeholders.nameAr', { defaultValue: 'مثال: تغيير الزيت' })}
            value={form.nameAr}
            onChange={(event) => updateField('nameAr', event.target.value)}
            dir="rtl"
            required
          />

          <Input
            id={`${formId}-min-pricing`}
            type="number"
            min="0"

            label={t('fields.minPricing')}
            placeholder={t('placeholders.minPricing', { defaultValue: 'e.g. 200' })}
            value={form.minPricing}
            onChange={(event) => updateField('minPricing', event.target.value)}
            required
          />

          <Input
            id={`${formId}-max-pricing`}
            type="number"
            min={form.minPricing || '0'}

            label={t('fields.maxPricing')}
            placeholder={t('placeholders.maxPricing', { defaultValue: 'e.g. 500' })}
            value={form.maxPricing}
            onChange={(event) => updateField('maxPricing', event.target.value)}
            required
          />

          <Select
            id={`${formId}-category`}
            label={t('fields.category')}
            value={form.categoryId}
            onChange={(event) => updateField('categoryId', event.target.value)}
            disabled={categories.length === 0}
            required
          >
            <option value="" disabled>
              {categories.length === 0 ? t('loading') : t('fields.selectCategory')}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name[lang] || category.name.en}
              </option>
            ))}
          </Select>

          <Input
            id={`${formId}-duration`}
            type="number"
            min="1"
            label={t('fields.duration')}
            placeholder={t('placeholders.duration', { defaultValue: 'e.g. 60' })}
            value={form.durationMinutes}
            onChange={(event) => updateField('durationMinutes', event.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-description-en`} className="label">
              {t('fields.descriptionEn')}
            </label>
            <textarea
              id={`${formId}-description-en`}
              className="input min-h-24 resize-y"
              placeholder={t('placeholders.descriptionEn', {
                defaultValue: "What's included in this service?",
              })}
              value={form.descriptionEn}
              onChange={(event) => updateField('descriptionEn', event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor={`${formId}-description-ar`} className="label">
              {t('fields.descriptionAr')}
            </label>
            <textarea
              id={`${formId}-description-ar`}
              dir="rtl"
              className="input min-h-24 resize-y"
              placeholder={t('placeholders.descriptionAr', {
                defaultValue: 'ماذا تشمل هذه الخدمة؟',
              })}
              value={form.descriptionAr}
              onChange={(event) => updateField('descriptionAr', event.target.value)}
              required
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
