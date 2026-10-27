import { useCallback, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { isLogoMimeType, matchesLogoType, MAX_LOGO_BYTES } from '@epd/domain/library';
import { assetBlob } from '@/lib/projectFile/epd';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';

const fields = ['businessName', 'vatNumber', 'address', 'phone', 'email'] as const;

/** `/settings/company`: the business shown on every quote and PDF, logo included. */
export function CompanyPage() {
  const { t } = useTranslation();
  const { library } = useEditorServices();
  const toast = useToast();
  const company = useLibrary((s) => s.library.company);
  const logo = useLibrary((s) => s.logo);

  async function setLogo(file: File) {
    if (!isLogoMimeType(file.type)) {
      toast(t('company.logoType'), 'error');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast(t('company.logoTooLarge'), 'error');
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesLogoType(file.type, bytes)) {
      toast(t('company.logoType'), 'error');
      return;
    }
    library.getState().setLogo({ mimeType: file.type, bytes });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3">
      <h1 className="text-xl font-semibold">{t('pages.company')}</h1>
      <p className="text-text-muted">{t('company.hint')}</p>
      {fields.map((field) => (
        <CommitField
          key={field}
          label={t(`company.${field}`)}
          value={company[field]}
          onCommit={(value) =>
            library.getState().apply((d) => {
              d.company[field] = value;
            })
          }
        />
      ))}
      <div className="flex items-center gap-3">
        {logo ? (
          <LogoImage
            logo={logo}
            alt={t('company.logo')}
            className="h-16 w-auto rounded border border-border"
          />
        ) : null}
        <label className="flex flex-col gap-1">
          {t('company.logo')}
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void setLogo(file);
            }}
          />
        </label>
        {logo ? (
          <Button variant="ghost" onClick={() => library.getState().setLogo(null)}>
            {t('company.removeLogo')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** A text field that edits its own copy and commits on blur. */
function CommitField({
  value,
  onCommit,
  label,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(value);
  }
  return (
    <TextField
      label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim() !== value) onCommit(text.trim());
      }}
    />
  );
}

/** An <img> showing the logo through an object URL that is revoked when the image goes away. */
function LogoImage({
  logo,
  ...props
}: { logo: { mimeType: 'image/png' | 'image/jpeg'; bytes: Uint8Array } } & Omit<
  ComponentProps<'img'>,
  'src'
>) {
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return;
      const url = URL.createObjectURL(assetBlob(logo));
      img.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [logo],
  );
  return <img ref={ref} {...props} />;
}
