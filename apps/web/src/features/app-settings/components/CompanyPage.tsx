import { useCallback, useId, useMemo, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { isLogoMimeType, matchesLogoType, MAX_LOGO_BYTES } from '@epd/domain/library';
import { euroCountries, type CompanyCountry } from '@epd/domain/vatRates';
import { assetBlob } from '@/lib/projectFile/epd';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from './PageHeader';

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
    <div className="flex max-w-lg flex-col gap-3">
      <PageHeader title={t('pages.company')} hint={t('company.hint')} />
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
      <CountryField
        value={company.country}
        onChange={(country) =>
          library.getState().apply((d) => {
            d.company.country = country;
          })
        }
      />
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

/**
 * Where the company buys: the euro-area countries by name in the UI language, then "Other
 * country". It sets the VAT removed from store prices.
 */
function CountryField({
  value,
  onChange,
}: {
  value: CompanyCountry;
  onChange: (country: CompanyCountry) => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const options = useMemo(() => {
    const names = new Intl.DisplayNames([i18n.language], { type: 'region' });
    const countries = euroCountries
      .map((code) => ({ value: code, label: names.of(code) ?? code }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language));
    return [...countries, { value: 'other', label: t('company.otherCountry') }];
  }, [i18n.language, t]);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-small text-text-muted">
        {t('company.country')}
      </label>
      <Select
        id={id}
        aria-label={t('company.country')}
        value={value}
        options={options}
        onValueChange={(v) => onChange(v as CompanyCountry)}
      />
      <p className="text-small text-text-faint">{t('company.countryHint')}</p>
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
