import { useCallback, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { newId } from '@epd/domain/ids';
import type { Company } from '@epd/domain/projectFile';
import { assetBlob, type ProjectAsset } from '@/lib/projectFile/epd';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const fields = ['businessName', 'vatNumber', 'address', 'phone', 'email'] as const;
type Field = (typeof fields)[number];

/** `/project/company`: the business shown on this project's quotes, logo included. */
export function CompanyPage() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const toast = useToast();
  const company = useEditor((s) => s.data.company);
  const readOnly = useEditor((s) => s.readOnly);
  const logo = useEditor((s) =>
    s.data.company.logoAssetId ? s.assets.get(s.data.company.logoAssetId) : undefined,
  );

  const setCompany = (label: string, recipe: (c: Company) => void) =>
    store.getState().applyCommand(label, (d) => recipe(d.company));

  async function setLogo(file: File) {
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      toast(t('company.logoType'), 'error');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast(t('company.logoTooLarge'), 'error');
      return;
    }
    const id = newId();
    store.getState().addAsset(id, {
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    setCompany('logo', (c) => {
      c.logoAssetId = id;
    });
  }

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col gap-3 overflow-y-auto p-4">
      <h1 className="text-xl font-semibold">{t('pages.company')}</h1>
      <p className="text-text-muted">{t('company.hint')}</p>
      {fields.map((field) => (
        <CommitField
          key={field}
          label={t(`company.${field}`)}
          value={company[field]}
          disabled={readOnly}
          onCommit={(value) =>
            setCompany(field, (c) => {
              c[field as Field] = value;
            })
          }
        />
      ))}
      <div className="flex items-center gap-3">
        {logo ? (
          <AssetImage
            asset={logo}
            alt={t('company.logo')}
            className="h-16 w-auto rounded border border-border"
          />
        ) : null}
        <label className="flex flex-col gap-1">
          {t('company.logo')}
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={readOnly}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void setLogo(file);
            }}
          />
        </label>
        {logo ? (
          <Button
            variant="ghost"
            disabled={readOnly}
            onClick={() =>
              setCompany('remove logo', (c) => {
                delete c.logoAssetId;
              })
            }
          >
            {t('company.removeLogo')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** A text field that edits its own copy and commits on blur; undo/redo resets the copy. */
function CommitField({
  value,
  onCommit,
  ...props
}: {
  label: string;
  value: string;
  disabled: boolean;
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
      {...props}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim() !== value) onCommit(text.trim());
      }}
    />
  );
}

/** An <img> showing an asset through an object URL that is revoked when the image goes away. */
function AssetImage({
  asset,
  ...props
}: { asset: ProjectAsset } & Omit<ComponentProps<'img'>, 'src'>) {
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return;
      const url = URL.createObjectURL(assetBlob(asset));
      img.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [asset],
  );
  return <img ref={ref} {...props} />;
}
