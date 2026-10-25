import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepositories } from '@/lib/repositories/provider';
import type { Profile } from '@/lib/repositories/types';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/auth/AuthProvider';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const fields = ['businessName', 'vatNumber', 'address', 'phone', 'email'] as const;

export function ProfilePage() {
  const { t } = useTranslation();
  const { profile: repo, files } = useRepositories();
  const session = useSession();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void repo
      .get()
      .then((p) => active && setProfile(p))
      .catch(() => toast(t('profile.loadFailed'), 'error'));
    return () => {
      active = false;
    };
  }, [repo, t, toast]);

  const logoPath = profile?.logoPath ?? null;
  useEffect(() => {
    if (!logoPath) return;
    let url: string | null = null;
    let active = true;
    void files
      .download('logos', logoPath)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setLogoUrl(url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [files, logoPath]);

  if (!profile) return <p className="text-text-muted">{t('common.loading')}</p>;

  async function save() {
    if (!profile) return;
    setBusy(true);
    try {
      const { logoPath: _logo, ...patch } = profile;
      await repo.update(patch);
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
      await repo.update({ logoPath: path });
      setLogoUrl(URL.createObjectURL(file));
      setProfile((p) => (p ? { ...p, logoPath: path } : p));
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
          onChange={(e) => setProfile({ ...profile, [field]: e.target.value })}
        />
      ))}
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
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
