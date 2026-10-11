import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useNotify } from '@/hooks/useNotify';
import { createLocalError } from '@/API/errors';

const MAX_IMAGE_SIZE_MB = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Workshop image with a preview. Picking a file uploads it right away
 * (PUT /Workshop/image), separate from the profile "Save changes" button.
 */
export default function WorkshopImagePicker({ imageUrl, onUpload }) {
  const { t } = useAppTranslation('settings');
  const notify = useNotify();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [brokenUrl, setBrokenUrl] = useState(null);

  const showImage = imageUrl && brokenUrl !== imageUrl;

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file again still triggers a change.
    event.target.value = '';
    if (!file) return;

    try {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        throw createLocalError('settings.imageType', 'Choose a JPG, PNG, or WEBP image.');
      }
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        throw createLocalError(
          'settings.imageSize',
          `The image must be ${MAX_IMAGE_SIZE_MB} MB or smaller.`
        );
      }

      setUploading(true);
      await onUpload(file);
      notify.success('imageUploaded');
    } catch (error) {
      notify.error(error, 'settings.image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <p className="label">{t('workshopImage', { defaultValue: 'Workshop image' })}</p>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8E2D8] bg-[#F6F3EE]">
          {showImage ? (
            <img
              src={imageUrl}
              alt={t('workshopImage', { defaultValue: 'Workshop image' })}
              className="h-full w-full object-cover"
              onError={() => setBrokenUrl(imageUrl)}
            />
          ) : (
            <ImagePlus className="h-8 w-8 text-[#A0978D]" aria-hidden="true" />
          )}

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-[#1C1712]" />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading
              ? t('uploadingImage', { defaultValue: 'Uploading…' })
              : showImage
                ? t('changeImage', { defaultValue: 'Change image' })
                : t('uploadImage', { defaultValue: 'Upload image' })}
          </Button>
          <p className="text-xs text-[#5A6968]">
            {t('imageHint', {
              defaultValue: 'JPG, PNG, or WEBP, up to {{size}} MB.',
              size: MAX_IMAGE_SIZE_MB,
            })}
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
