import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  csvFields,
  guessCsvMapping,
  itemsFromCsv,
  parseCsv,
  type CsvDefaults,
  type CsvField,
  type CsvMapping,
} from '@epd/domain/catalog/csv';
import { CatalogFileError, parseEpc } from '@epd/domain/catalog/epc';
import type { IncomingCatalog, IncomingItem } from '@epd/domain/catalog/replace';
import type { CatalogCategory } from '@epd/domain/catalog/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { NumberInput } from '@/components/ui/NumberInput';
import { TextField } from '@/components/ui/TextField';
import { formatMoney } from '@/lib/format';
import { categories } from './ItemDialog';

const PREVIEW_ROWS = 5;

type Step =
  | { kind: 'pick' }
  | { kind: 'epc'; source: string; items: IncomingItem[] }
  | { kind: 'csv'; source: string; header: string[]; rows: string[][] };

const baseName = (file: string) => file.replace(/\.[^.]+$/, '');

/**
 * Reads a catalog from an `.epc` file, or from a CSV price list through a column mapping.
 * Category and modules come from mapped columns or, for rows without them, from defaults;
 * items still lacking attributes are "price only".
 */
export function ImportDialog({
  title,
  initialName,
  onClose,
  onImport,
}: {
  title: string;
  /** Name for the catalog; the file name when absent. */
  initialName?: string;
  onClose: () => void;
  onImport: (catalog: IncomingCatalog) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initialName ?? '');
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [defaults, setDefaults] = useState<CsvDefaults>({ category: 'device' });

  const csv = useMemo(
    () => (step.kind === 'csv' ? itemsFromCsv(step.rows, mapping, defaults) : null),
    [step, mapping, defaults],
  );
  const items = step.kind === 'epc' ? step.items : (csv?.items ?? []);

  async function onFile(file: File) {
    setError(null);
    const text = await file.text();
    if (!initialName) setName(baseName(file.name));
    if (file.name.toLowerCase().endsWith('.epc')) {
      try {
        const catalog = parseEpc(JSON.parse(text), file.name);
        if (!initialName) setName(catalog.name);
        setStep({ kind: 'epc', source: file.name, items: catalog.items });
      } catch (e) {
        setError(t(`catalog.import.errors.${e instanceof CatalogFileError ? e.code : 'invalid'}`));
      }
      return;
    }
    const [header, ...rows] = parseCsv(text);
    if (!header || rows.length === 0) {
      setError(t('catalog.import.errors.empty'));
      return;
    }
    setMapping(guessCsvMapping(header));
    setStep({ kind: 'csv', source: file.name, header, rows });
  }

  const canImport = step.kind !== 'pick' && items.length > 0 && name.trim() !== '';

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      description={t('catalog.import.hint')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          {step.kind !== 'pick' ? (
            <Button
              variant="primary"
              disabled={!canImport}
              onClick={() => onImport({ name: name.trim(), source: step.source, items })}
            >
              {t('catalog.import.confirm', { count: items.length })}
            </Button>
          ) : null}
        </>
      }
    >
      {error ? (
        <p role="alert" className="mb-3 rounded bg-error-bg px-2 py-1 text-error">
          {error}
        </p>
      ) : null}
      {step.kind === 'pick' ? (
        <FileDropZone
          accept=".epc,.csv,.txt,text/csv,application/json"
          inputTestId="catalog-file"
          onFile={(file) => void onFile(file)}
        />
      ) : (
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          <TextField
            label={t('catalog.import.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {step.kind === 'csv' ? (
            <>
              <fieldset className="grid grid-cols-2 gap-2">
                <legend className="mb-1 font-medium">{t('catalog.import.columns')}</legend>
                {csvFields.map((field) => (
                  <ColumnSelect
                    key={field}
                    field={field}
                    header={step.header}
                    value={mapping[field]}
                    onChange={(index) => {
                      const next = { ...mapping };
                      if (index === undefined) delete next[field];
                      else next[field] = index;
                      setMapping(next);
                    }}
                  />
                ))}
              </fieldset>
              <fieldset className="grid grid-cols-2 gap-2">
                <legend className="mb-1 font-medium">{t('catalog.import.defaults')}</legend>
                <label className="flex flex-col gap-1">
                  {t('catalog.import.defaultCategory')}
                  <select
                    className="h-[var(--control-height)] rounded border border-border px-2"
                    value={defaults.category}
                    onChange={(e) =>
                      setDefaults({ ...defaults, category: e.target.value as CatalogCategory })
                    }
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {t(`catalog.categories.${c}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  {t('catalog.import.defaultModules')}
                  <NumberInput
                    aria-label={t('catalog.import.defaultModules')}
                    live
                    value={defaults.modules ?? null}
                    min={1}
                    onValueChange={(v) => {
                      const { modules: _m, ...rest } = defaults;
                      setDefaults(v ? { ...rest, modules: Math.round(v) } : rest);
                    }}
                  />
                </label>
              </fieldset>
              {mapping.name === undefined ? (
                <p className="text-warning">{t('catalog.import.needName')}</p>
              ) : null}
              {csv && csv.skipped.length > 0 ? (
                <p className="text-warning">
                  {t('catalog.import.skipped', { count: csv.skipped.length })}
                </p>
              ) : null}
            </>
          ) : null}
          <p data-testid="import-count">{t('catalog.import.count', { count: items.length })}</p>
          {items.length > 0 ? (
            <table className="w-full text-left">
              <tbody>
                {items.slice(0, PREVIEW_ROWS).map((item, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-0.5 pr-2 text-text-muted">{item.code}</td>
                    <td className="py-0.5 pr-2">{item.name}</td>
                    <td className="py-0.5 pr-2 text-text-muted">
                      {t(`catalog.categories.${item.category}`)}
                    </td>
                    <td className="py-0.5 text-right tabular-nums">
                      {item.unitPrice === undefined ? '—' : formatMoney(item.unitPrice, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}

function ColumnSelect({
  field,
  header,
  value,
  onChange,
}: {
  field: CsvField;
  header: readonly string[];
  value: number | undefined;
  onChange: (index: number | undefined) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="flex flex-col gap-1">
      {t(`catalog.import.fields.${field}`)}
      <select
        className="h-[var(--control-height)] rounded border border-border px-2"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      >
        <option value="">{t('catalog.import.notMapped')}</option>
        {header.map((h, i) => (
          <option key={i} value={i}>
            {h || t('catalog.import.column', { n: i + 1 })}
          </option>
        ))}
      </select>
    </label>
  );
}
