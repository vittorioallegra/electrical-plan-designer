import { useTranslation } from 'react-i18next';
import type { QuoteSettings } from '@epd/domain/types';
import { NumberInput } from '@/components/ui/NumberInput';

/** Material adjustment and VAT of the quote. */
export function QuoteSettingsForm({
  settings,
  readOnly,
  edit: editSettings,
}: {
  settings: QuoteSettings;
  readOnly: boolean;
  edit: (label: string, fn: (s: QuoteSettings) => void) => unknown;
}) {
  const { t } = useTranslation();
  return (
    <section aria-label={t('quote.settings')} className="flex flex-col gap-2">
      <h2 className="text-label font-semibold tracking-wide text-text-muted uppercase">
        {t('quote.settings')}
      </h2>
      <label className="flex items-center justify-between gap-2 text-text-muted">
        {t('quote.adjustment')}
        <NumberInput
          aria-label={t('quote.adjustment')}
          className="w-28"
          value={settings.materialAdjustmentPercent}
          unit="%"
          min={-100}
          max={1000}
          disabled={readOnly}
          onValueChange={(v) =>
            editSettings('quote adjustment', (s) => void (s.materialAdjustmentPercent = v))
          }
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-text-muted">
        {t('quote.vat')}
        <NumberInput
          aria-label={t('quote.vat')}
          className="w-28"
          value={settings.vatPercent}
          unit="%"
          min={0}
          max={100}
          disabled={readOnly}
          onValueChange={(v) => editSettings('quote vat', (s) => void (s.vatPercent = v))}
        />
      </label>
    </section>
  );
}
