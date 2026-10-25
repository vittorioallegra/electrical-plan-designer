import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '@/api/keys';
import { useFileBlob, useProfile, useUpdateProfile } from '@/api/profile';
import { useRepositories } from '@/lib/repositories/provider';
import type { Profile } from '@/lib/repositories/types';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/auth/AuthProvider';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const fields = ['businessName', 'vatNumber', 'address', 'phone', 'email'] as const;
type Draft = Pick<Profile, (typeof fields)[number]>;

export function ProfilePage() {
  const { t } = useTranslation();
  const { files } = useRepositories();
  const session = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useProfile();
  const update = useUpdateProfile();
  // The form edits a copy taken once; a background refetch never overwrites what is typed.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const loaded = query.data;
  if (loaded && !draft) {
    setDraft(Object.fromEntries(fields.map((f) => [f, loaded[f]])) as Draft);
  }

  const loadFailed = query.isError;
  useEffect(() => {
    if (loadFailed) toast(t('profile.loadFailed'), 'error');
  }, [loadFailed, t, toast]);

  const logo = useFileBlob('logos', loaded?.logoPath ?? null).data;

  if (!loaded || !draft) return <p className="text-text-muted">{t('common.loading')}</p>;
  const profile = draft;

  async function save() {
    setBusy(true);
    try {
      await update.mutateAsync(profile);
      toast(t('profile.saved'), 'success');
    } catch {
      toast(t('profile.saveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast(t('profile.logoType'), 'error');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast(t('profile.logoTooLarge'), 'error');
      return;
    }
    const path = `${session.userId}/logo.${file.type === 'image/png' ? 'png' : 'jpg'}`;
    try {
      await files.upload('logos', path, file);
      // Same path on every upload: replace the cached file before the profile points at it.
      queryClient.setQueryData(queryKeys.file(session.userId, 'logos', path), file);
      await update.mutateAsync({ logoPath: path });
    } catch {
      toast(t('profile.logoFailed'), 'error');
    }
  }

  return (
    <form
      className="mx-auto flex max-w-lg flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h1 className="text-xl font-semibold">{t('pages.profile')}</h1>
      <p className="text-text-muted">{t('profile.hint')}</p>
      {fields.map((field) => (
        <TextField
          key={field}
          label={t(`profile.${field}`)}
          value={profile[field]}
          onChange={(e) => setDraft({ ...profile, [field]: e.target.value })}
        />
      ))}
      <div className="flex items-center gap-3">
        {logo ? (
          <BlobImage
            blob={logo}
            alt={t('profile.logo')}
            className="h-16 w-auto rounded border border-border"
          />
        ) : null}
        <label className="flex flex-col gap-1">
          {t('profile.logo')}
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadLogo(file);
            }}
          />
        </label>
      </div>
      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

/** An <img> showing a blob through an object URL that is revoked when the image goes away. */
function BlobImage({ blob, ...props }: { blob: Blob } & Omit<ComponentProps<'img'>, 'src'>) {
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return;
      const url = URL.createObjectURL(blob);
      img.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [blob],
  );
  return <img ref={ref} {...props} />;
}
